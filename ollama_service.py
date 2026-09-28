"""
Ollama AI service for alert analysis.

Supports:
- Local Ollama (default)
- Remote Ollama using OLLAMA_HOST environment variable

Environment variables:
    OLLAMA_MODEL   Model name. Default: qwen3:1.7b
    OLLAMA_HOST    Ollama server URL. Default: http://localhost:11434
    OLLAMA_TIMEOUT Request timeout in seconds. Default: 60
"""

import os
import threading
import uuid
from typing import Callable, Optional


# ============================================================
# CONFIGURATION
# ============================================================

OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:1.7b")

OLLAMA_HOST = os.environ.get(
    "OLLAMA_HOST",
    "http://localhost:11434"
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

Your job is to analyze station alerts and provide concise,
practical recommendations.

Focus on:
- Safety
- Equipment reliability
- Energy availability
- Environmental conditions
- Communication systems
- Water treatment
- Fuel and generator systems

Do not invent sensor values.

Return your analysis in a clear format containing:

1. Problem
2. Possible Cause
3. Immediate Action
4. Recommended Follow-up

Keep the response concise and operational.
"""


# ============================================================
# FALLBACK RESPONSE
# ============================================================

def _fallback_response(reason: str) -> dict:
    """
    Returns a safe response when Ollama is unavailable.
    """

    return {
        "success": False,
        "analysis": (
            "AI analysis is currently unavailable. "
            "Please inspect the alert manually."
        ),
        "error": reason,
        "model": OLLAMA_MODEL,
        "host": OLLAMA_HOST,
    }


# ============================================================
# BUILD USER PROMPT
# ============================================================

def _build_user_prompt(alert_context: dict) -> str:
    """
    Convert alert context into a structured prompt.
    """

    return f"""
Analyze the following Antarctic station alert.

Station:
{alert_context.get("station_id", "Unknown")}

Alert:
{alert_context.get("alert_type", "Unknown")}

Severity:
{alert_context.get("severity", "Unknown")}

Message:
{alert_context.get("message", "No message provided")}

Current Sensor Data:
{alert_context.get("sensor_data", {})}

Timestamp:
{alert_context.get("timestamp", "Unknown")}

Provide:

1. Problem
2. Possible Cause
3. Immediate Action
4. Recommended Follow-up

Keep the response concise and operational.
"""


# ============================================================
# SYNCHRONOUS ANALYSIS
# ============================================================

def analyze_alert(alert_context: dict) -> dict:
    """
    Analyze an alert using Ollama.

    OLLAMA_HOST determines which Ollama server is used.
    """

    # Import only what we actually use
    try:
        from ollama import Client
    except ImportError:
        return _fallback_response(
            "Ollama Python package is not installed. "
            "Run: pip install ollama"
        )

    user_prompt = _build_user_prompt(alert_context)

    try:
        # ----------------------------------------------------
        # Create Ollama client
        # ----------------------------------------------------

        client = Client(
            host=OLLAMA_HOST
        )

        # ----------------------------------------------------
        # Send request to Ollama
        # ----------------------------------------------------

        response = client.chat(
            model=OLLAMA_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            options={
                "temperature": 0.3,
                "num_predict": 1024
            }
        )

        # ----------------------------------------------------
        # Extract response
        # ----------------------------------------------------

        message = response.get("message", {})

        analysis = message.get(
            "content",
            ""
        )

        if not analysis:
            return _fallback_response(
                "Ollama returned an empty response."
            )

        return {
            "success": True,
            "analysis": analysis,
            "model": OLLAMA_MODEL,
            "host": OLLAMA_HOST
        }

    except Exception as e:
        return _fallback_response(
            f"Failed to connect to Ollama: {str(e)}"
        )


# ============================================================
# ASYNC ANALYSIS
# ============================================================

def analyze_alert_async(
    alert_context: dict,
    callback: Optional[Callable[[dict], None]] = None
) -> str:
    """
    Run alert analysis in a background thread.

    Returns a job ID immediately.
    """

    job_id = str(uuid.uuid4())

    def worker():
        result = analyze_alert(alert_context)

        if callback:
            try:
                callback(result)
            except Exception:
                pass

    thread = threading.Thread(
        target=worker,
        daemon=True
    )

    thread.start()

    return job_id