"""
Ollama AI Analysis Service for POLAR SYNC
==========================================
Provides LLM-powered analysis of station alerts using a locally running
Ollama instance.  The deterministic anomaly detection system remains the
source of truth — this module only *explains* already-detected anomalies.

Configuration (environment variables):
    OLLAMA_MODEL  — model tag to use          (default: qwen3:2b)
    OLLAMA_HOST   — Ollama server address     (default: http://localhost:11434)
    OLLAMA_TIMEOUT — request timeout seconds  (default: 60)
"""

import json
import os
import traceback
from threading import Thread

# ── Configuration ────────────────────────────────────────────
OLLAMA_MODEL   = os.environ.get("OLLAMA_MODEL",   "qwen3:1.7b")
OLLAMA_HOST    = os.environ.get("OLLAMA_HOST",     "http://localhost:11434")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "60"))

# ── System prompt ────────────────────────────────────────────
SYSTEM_PROMPT = """You are an AI operations assistant for Maitri, an Indian Antarctic research station located in the Schirmacher Oasis, Antarctica.

A deterministic monitoring system has already detected an active alert. Your task is to analyze the available telemetry data and explain the likely situation to a station operator.

RULES:
- Do NOT decide whether an anomaly exists — it has already been detected.
- Do NOT invent measurements that are not provided.
- Do NOT claim certainty when evidence is insufficient.
- Clearly distinguish observed facts from possible causes.
- Keep the response concise and operational.
- Do NOT recommend shutting down life-critical systems unless absolutely necessary.

You MUST respond with valid JSON in exactly this format (no markdown, no code fences, just raw JSON):
{
  "summary": "One or two sentence summary of what is happening",
  "possible_causes": ["cause 1", "cause 2"],
  "affected_systems": ["system 1", "system 2"],
  "risk": "Brief description of operational risk",
  "recommended_actions": ["action 1", "action 2", "action 3"]
}"""


def _build_user_prompt(context: dict) -> str:
    """Build the user prompt from alert context."""
    alert = context.get("alert", {})
    current = context.get("current_telemetry", {})
    history = context.get("recent_telemetry", [])

    lines = []
    lines.append(f"Station: {context.get('station', 'Maitri')}")
    lines.append("")
    lines.append(f"Alert Type: {alert.get('type', 'UNKNOWN')}")
    lines.append(f"Alert Message: {alert.get('message', 'Unknown alert')}")
    lines.append(f"Severity: {alert.get('severity', 'unknown')}")
    if alert.get("duration_seconds") is not None:
        lines.append(f"Alert Duration: {alert['duration_seconds']}s")
    lines.append("")

    lines.append("Current Telemetry:")
    for key, val in current.items():
        lines.append(f"  {key}: {val}")
    lines.append("")

    if history:
        lines.append(f"Recent Telemetry Trend (last {len(history)} readings, oldest first):")
        for i, snap in enumerate(history):
            vals = ", ".join(f"{k}: {v}" for k, v in snap.items() if k != "timestamp")
            lines.append(f"  [{i+1}] {vals}")
        lines.append("")

    weather = context.get("weather")
    if weather:
        lines.append("Weather Context:")
        for key, val in weather.items():
            lines.append(f"  {key}: {val}")
        lines.append("")

    lines.append("Provide your analysis as JSON.")
    return "\n".join(lines)


def _parse_response(text: str) -> dict:
    """Try to extract valid JSON from model output, with fallbacks."""
    if not text or not text.strip():
        return _fallback_response("Empty response from AI model.")

    cleaned = text.strip()

    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        # Remove opening fence (```json or ```)
        first_newline = cleaned.index("\n") if "\n" in cleaned else len(cleaned)
        cleaned = cleaned[first_newline + 1:]
        # Remove closing fence
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3].rstrip()

    # Try direct JSON parse
    try:
        result = json.loads(cleaned)
        if isinstance(result, dict) and "summary" in result:
            return _normalize_result(result)
    except json.JSONDecodeError:
        pass

    # Try to find JSON object in the text
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            result = json.loads(cleaned[start:end + 1])
            if isinstance(result, dict):
                return _normalize_result(result)
        except json.JSONDecodeError:
            pass

    # Fallback: use the raw text as summary
    return {
        "summary": cleaned[:500],
        "possible_causes": [],
        "affected_systems": [],
        "risk": "Unable to parse structured analysis.",
        "recommended_actions": ["Review the alert manually."]
    }


def _normalize_result(result: dict) -> dict:
    """Ensure all expected keys exist and have correct types."""
    return {
        "summary":             str(result.get("summary", "No summary provided.")),
        "possible_causes":     _ensure_list(result.get("possible_causes", [])),
        "affected_systems":    _ensure_list(result.get("affected_systems", [])),
        "risk":                str(result.get("risk", "Unknown risk.")),
        "recommended_actions": _ensure_list(result.get("recommended_actions", [])),
    }


def _ensure_list(val) -> list:
    if isinstance(val, list):
        return [str(item) for item in val]
    if isinstance(val, str):
        return [val]
    return []


def _fallback_response(reason: str) -> dict:
    return {
        "summary":             reason,
        "possible_causes":     [],
        "affected_systems":    [],
        "risk":                "Unable to perform AI analysis.",
        "recommended_actions": ["Inspect the alert manually.", "Check Ollama service status."],
        "error":               True,
    }


# ── Public API ───────────────────────────────────────────────

def analyze_alert(alert_context: dict) -> dict:
    """
    Synchronous call to Ollama for alert analysis.
    Returns a structured dict.  Never raises — always returns a result.
    """
    try:
        from ollama import chat, ResponseError
    except ImportError:
        return _fallback_response(
            "Ollama Python package is not installed. Run: pip install ollama"
        )

    user_prompt = _build_user_prompt(alert_context)

    try:
        response = chat(
            model=OLLAMA_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            options={"temperature": 0.3, "num_predict": 1024},
        )

        text = response.message.content if response and response.message else ""
        return _parse_response(text)

    except Exception as e:
        error_msg = str(e)
        if "refused" in error_msg.lower() or "connection" in error_msg.lower():
            return _fallback_response(
                "Ollama service is offline. Start Ollama and try again."
            )
        if "not found" in error_msg.lower() or "pull" in error_msg.lower():
            return _fallback_response(
                f"Model '{OLLAMA_MODEL}' not found. Run: ollama pull {OLLAMA_MODEL}"
            )
        traceback.print_exc()
        return _fallback_response(f"AI analysis failed: {error_msg[:200]}")


def analyze_alert_async(alert_context: dict, callback):
    """
    Run analysis in a background thread so it doesn't block the caller.
    callback(result_dict) is called from the background thread.
    """
    def _worker():
        result = analyze_alert(alert_context)
        callback(result)
    thread = Thread(target=_worker, daemon=True)
    thread.start()
    return thread
