"""
Ollama Cloud AI service for PolarSync alert analysis.

Required environment variables:
    OLLAMA_API_KEY   Your Ollama Cloud API key
    OLLAMA_MODEL     Cloud model name (default: gemma4:31b)
"""

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

Return your analysis in this format:

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
    return {
        "success": False,
        "analysis": (
            "AI analysis is currently unavailable. "
            "Please inspect the alert manually."
        ),
        "error": reason,
        "model": OLLAMA_MODEL,
    }


# ============================================================
# BUILD USER PROMPT
# ============================================================

def _build_user_prompt(alert_context: dict) -> str:
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

    if not OLLAMA_API_KEY:
        return _fallback_response(
            "OLLAMA_API_KEY is not configured."
        )

    user_prompt = _build_user_prompt(alert_context)

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

        analysis = data.get(
            "message",
            {}
        ).get(
            "content",
            ""
        )

        if not analysis:
            return _fallback_response(
                "Ollama Cloud returned an empty response."
            )

        return {
            "success": True,
            "analysis": analysis,
            "model": OLLAMA_MODEL,
        }

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
        result = analyze_alert(alert_context)

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