"""
Ollama Cloud AI service for PolarSync alert analysis.

Required environment variables:
    OLLAMA_API_KEY   Your Ollama Cloud API key
    OLLAMA_MODEL     Cloud model name (default: gemma4:31b)
"""

import json
import os
import threading
import uuid
from typing import Callable, Optional

import requests


# ============================================================
# CONFIGURATION
# ============================================================

OLLAMA_API_URL = "https://ollama.com/api/chat"

OLLAMA_API_KEY = os.environ.get(
    "OLLAMA_API_KEY",
    ""
)

OLLAMA_MODEL = os.environ.get(
    "OLLAMA_MODEL",
    "gemma4:31b"
)

OLLAMA_TIMEOUT = int(
    os.environ.get("OLLAMA_TIMEOUT", "60")
)


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are an AI diagnostic assistant for PolarSync,
a remote management platform for Indian Antarctic Research Stations.

Analyze station alerts using ONLY the information provided.

Focus on:
- Safety
- Equipment reliability
- Energy availability
- Environmental conditions
- Communication systems
- Water treatment
- Fuel and generator systems

Do not invent sensor values.
Do not invent equipment conditions that are not supported by the data.

Return ONLY valid JSON.
Do not use markdown.
Do not use ```json code fences.

The JSON MUST have exactly this structure:

{
  "summary": "Short explanation of the problem",
  "possible_causes": [
    "Possible cause 1",
    "Possible cause 2"
  ],
  "affected_systems": [
    "Affected system 1",
    "Affected system 2"
  ],
  "risk": "Short description of the operational risk",
  "recommended_actions": [
    "Recommended action 1",
    "Recommended action 2"
  ]
}

Keep the response concise and operational.
"""


# ============================================================
# FALLBACK RESPONSE
# ============================================================

def _fallback_response(reason: str) -> dict:
    return {
        "error": True,
        "summary": (
            "AI analysis is currently unavailable. "
            "Please inspect the alert manually."
        ),
        "possible_causes": [],
        "affected_systems": [],
        "risk": reason,
        "recommended_actions": [
            "Inspect the alert manually.",
            "Check the AI service configuration."
        ],
    }


# ============================================================
# BUILD USER PROMPT
# ============================================================

def _build_user_prompt(alert_context: dict) -> str:

    station = alert_context.get(
        "station",
        "Unknown"
    )

    alert = alert_context.get(
        "alert",
        {}
    )

    current_telemetry = alert_context.get(
        "current_telemetry",
        {}
    )

    recent_telemetry = alert_context.get(
        "recent_telemetry",
        []
    )

    return f"""
Analyze this Antarctic research station alert.

STATION:
{station}

ALERT:
{json.dumps(alert, indent=2, default=str)}

CURRENT TELEMETRY:
{json.dumps(current_telemetry, indent=2, default=str)}

RECENT TELEMETRY:
{json.dumps(recent_telemetry, indent=2, default=str)}

Return ONLY the required JSON structure.

Remember:
- Do not invent sensor values.
- Keep the analysis concise.
- Base the analysis on the supplied alert and telemetry.
"""


# ============================================================
# PARSE AI RESPONSE
# ============================================================

def _parse_analysis(content: str) -> dict:

    content = content.strip()

    # Remove accidental markdown code fences
    if content.startswith("```"):
        lines = content.splitlines()

        if lines and lines[0].startswith("```"):
            lines = lines[1:]

        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]

        content = "\n".join(lines).strip()

    try:
        result = json.loads(content)

    except json.JSONDecodeError:
        # Try to recover JSON if the model added extra text
        start = content.find("{")
        end = content.rfind("}")

        if start == -1 or end == -1 or end <= start:
            raise ValueError(
                "Ollama Cloud returned a response that was not valid JSON."
            )

        try:
            result = json.loads(
                content[start:end + 1]
            )
        except json.JSONDecodeError as e:
            raise ValueError(
                f"Could not parse Ollama response as JSON: {e}"
            )

    if not isinstance(result, dict):
        raise ValueError(
            "Ollama Cloud returned JSON in an unexpected format."
        )

    # Ensure the fields expected by AlertPanel.jsx exist
    summary = result.get(
        "summary",
        "No summary was provided."
    )

    possible_causes = result.get(
        "possible_causes",
        []
    )

    affected_systems = result.get(
        "affected_systems",
        []
    )

    risk = result.get(
        "risk",
        ""
    )

    recommended_actions = result.get(
        "recommended_actions",
        []
    )

    # Normalize values so the frontend can safely render them
    if not isinstance(possible_causes, list):
        possible_causes = [str(possible_causes)]

    if not isinstance(affected_systems, list):
        affected_systems = [str(affected_systems)]

    if not isinstance(recommended_actions, list):
        recommended_actions = [str(recommended_actions)]

    return {
        "error": False,
        "summary": str(summary),
        "possible_causes": [
            str(item) for item in possible_causes
        ],
        "affected_systems": [
            str(item) for item in affected_systems
        ],
        "risk": str(risk),
        "recommended_actions": [
            str(item) for item in recommended_actions
        ],
    }


# ============================================================
# SYNCHRONOUS ANALYSIS
# ============================================================

def analyze_alert(alert_context: dict) -> dict:

    if not OLLAMA_API_KEY:
        return _fallback_response(
            "OLLAMA_API_KEY is not configured."
        )

    user_prompt = _build_user_prompt(
        alert_context
    )

    try:

        response = requests.post(
            OLLAMA_API_URL,
            headers={
                "Authorization": f"Bearer {OLLAMA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": SYSTEM_PROMPT,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                "stream": False,
            },
            timeout=OLLAMA_TIMEOUT,
        )

        response.raise_for_status()

        data = response.json()

        content = data.get(
            "message",
            {}
        ).get(
            "content",
            ""
        )

        if not content:
            return _fallback_response(
                "Ollama Cloud returned an empty response."
            )

        analysis = _parse_analysis(
            content
        )

        return analysis

    except requests.exceptions.Timeout:
        return _fallback_response(
            "Ollama Cloud request timed out."
        )

    except requests.exceptions.RequestException as e:
        return _fallback_response(
            f"Failed to connect to Ollama Cloud: {str(e)}"
        )

    except Exception as e:
        return _fallback_response(
            f"AI analysis failed: {str(e)}"
        )


# ============================================================
# ASYNC ANALYSIS
# ============================================================

def analyze_alert_async(
    alert_context: dict,
    callback: Optional[Callable[[dict], None]] = None,
) -> str:

    job_id = str(uuid.uuid4())

    def worker():

        result = analyze_alert(
            alert_context
        )

        if callback:
            try:
                callback(result)
            except Exception:
                pass

    thread = threading.Thread(
        target=worker,
        daemon=True,
    )

    thread.start()

    return job_id