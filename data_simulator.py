import json
import os
import threading
import time
from collections import deque
from datetime import datetime, timedelta

from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np


import sys

# ============================================================
# CONFIGURATION
# ============================================================

# Simulation generation interval in seconds.
# Default is 2 seconds for live hackathon demo (updates visibly in real-time).
# For production 60-second simulation, pass --prod or set INTERVAL_SECONDS=60.
INTERVAL_SECONDS = 2
if "--prod" in sys.argv or "--production" in sys.argv:
    INTERVAL_SECONDS = 60
elif "INTERVAL_SECONDS" in os.environ:
    try:
        INTERVAL_SECONDS = int(os.environ["INTERVAL_SECONDS"])
    except ValueError:
        INTERVAL_SECONDS = 2

# Probability of starting an anomaly on any normal minute
ANOMALY_PROBABILITY = 0.05

# Anomaly duration in simulated minutes
MIN_ANOMALY_DURATION = 3
MAX_ANOMALY_DURATION = 8

# Network mode ("NORMAL" or "SLOW")
NETWORK_MODE = os.environ.get("NETWORK_MODE", "NORMAL")

# Simulation time multiplier for inventory/slow processes
SIMULATION_TIME_MULTIPLIER = int(os.environ.get("SIMULATION_TIME_MULTIPLIER", 1))


# ============================================================
# INITIAL STATION STATE
# ============================================================

station = {
    "energy": 500.0,
    "generator_load": 60.0,
    "power_generation": 80.0,
    "power_consumption": 65.0,
    "fuel_level": 75.0,
    "battery_soc": 90.0,
    "heating": 20.0,
    "generator_health": 95.0,
    "pump_status": 1,
    "equipment_temperature": 35.0,
    "vibration": 2.0,
    "runtime": 1200,
    "food_stock_kg": 1840.0,
    "food_consumption_daily_kg": 20.0,
    "food_storage_temperature": -18.0,
    "food_expiry_risk": 2,
    "medicine_stock_units": 428.0,
    "medicine_consumption_daily": 3.5,
    "critical_medicine_items": 3,
    "low_medicine_items": 5,
    "medicine_expiry_risk": 2,
    "medicine_storage_temperature": 4.0
}


# ============================================================
# INTERNAL ANOMALY STATE
# These are NOT printed in the JSON output.
# ============================================================

active_anomaly = None
anomaly_remaining = 0
injected_anomaly = None

ANOMALY_TYPES = [
    "GENERATOR_LOAD_SPIKE",
    "POWER_GENERATION_DROP",
    "POWER_CONSUMPTION_SPIKE",
    "HEATING_SURGE",
    "PUMP_FAILURE",
    "HIGH_VIBRATION"
]


# ============================================================
# HELPER FUNCTION
# ============================================================

def clamp(value, minimum, maximum):
    return max(minimum, min(value, maximum))


# ============================================================
# GENERATE ONE DATA POINT
# ============================================================

def generate_data():

    global active_anomaly
    global anomaly_remaining
    global injected_anomaly

    # --------------------------------------------------------
    # Start a new anomaly
    # --------------------------------------------------------

    if active_anomaly is None:

        if np.random.random() < ANOMALY_PROBABILITY:

            active_anomaly = np.random.choice(ANOMALY_TYPES)

            anomaly_remaining = int(
                np.random.randint(
                    MIN_ANOMALY_DURATION,
                    MAX_ANOMALY_DURATION + 1
                )
            )

    # --------------------------------------------------------
    # Normal generator load
    # --------------------------------------------------------

    station["generator_load"] += np.random.uniform(-3.0, 3.0)

    station["generator_load"] = clamp(
        station["generator_load"],
        20.0,
        90.0
    )

    # --------------------------------------------------------
    # Normal power generation
    # --------------------------------------------------------

    station["power_generation"] = (
        station["generator_load"] * 1.20
        + np.random.normal(0, 2)
    )

    station["power_generation"] = clamp(
        station["power_generation"],
        20.0,
        120.0
    )

    # --------------------------------------------------------
    # Normal power consumption
    # --------------------------------------------------------

    station["power_consumption"] += np.random.uniform(-4.0, 4.0)

    station["power_consumption"] = clamp(
        station["power_consumption"],
        30.0,
        110.0
    )

    # --------------------------------------------------------
    # Equipment temperature
    # --------------------------------------------------------

    station["equipment_temperature"] += np.random.uniform(
        -0.5,
        0.5
    )

    station["equipment_temperature"] = clamp(
        station["equipment_temperature"],
        15.0,
        80.0
    )

    # --------------------------------------------------------
    # Heating
    # Colder equipment/environment -> more heating
    # --------------------------------------------------------

    station["heating"] = (
        15.0
        + max(
            0.0,
            40.0 - station["equipment_temperature"]
        ) * 0.6
        + np.random.normal(0, 2)
    )

    station["heating"] = clamp(
        station["heating"],
        0.0,
        60.0
    )

    # --------------------------------------------------------
    # Fuel consumption
    # --------------------------------------------------------

    fuel_usage = (
        station["power_generation"] * 0.0007
        + np.random.uniform(0.01, 0.03)
    )

    station["fuel_level"] -= fuel_usage

    station["fuel_level"] = clamp(
        station["fuel_level"],
        0.0,
        100.0
    )

    # --------------------------------------------------------
    # Battery SOC
    # --------------------------------------------------------

    energy_difference = (
        station["power_generation"]
        - station["power_consumption"]
    )

    station["battery_soc"] += (
        energy_difference * 0.03
        + np.random.normal(0, 0.2)
    )

    station["battery_soc"] = clamp(
        station["battery_soc"],
        0.0,
        100.0
    )

    # --------------------------------------------------------
    # Generator health
    # --------------------------------------------------------

    station["generator_health"] -= np.random.uniform(
        0.001,
        0.01
    )

    station["generator_health"] = clamp(
        station["generator_health"],
        0.0,
        100.0
    )

    # --------------------------------------------------------
    # Pump status
    # --------------------------------------------------------

    station["pump_status"] = 1

    # --------------------------------------------------------
    # Vibration
    # --------------------------------------------------------

    station["vibration"] += np.random.uniform(
        -0.2,
        0.2
    )

    station["vibration"] = clamp(
        station["vibration"],
        0.5,
        5.0
    )

    # --------------------------------------------------------
    # Energy
    # --------------------------------------------------------

    station["energy"] += (
        energy_difference * 0.01
        + np.random.normal(0, 0.5)
    )

    station["energy"] = clamp(
        station["energy"],
        0.0,
        1000.0
    )

    # --------------------------------------------------------
    # Apply anomaly
    # IMPORTANT:
    # No anomaly information is added to the JSON.
    # --------------------------------------------------------

    if active_anomaly == "GENERATOR_LOAD_SPIKE":

        station["generator_load"] = np.random.uniform(
            90.0,
            100.0
        )

        station["power_generation"] = (
            station["generator_load"] * 1.20
            + np.random.normal(0, 2)
        )

        station["power_generation"] = clamp(
            station["power_generation"],
            20.0,
            120.0
        )

    elif active_anomaly == "POWER_GENERATION_DROP":

        station["power_generation"] = np.random.uniform(
            20.0,
            40.0
        )

    elif active_anomaly == "POWER_CONSUMPTION_SPIKE":

        station["power_consumption"] = np.random.uniform(
            100.0,
            140.0
        )

    elif active_anomaly == "HEATING_SURGE":

        station["heating"] = np.random.uniform(
            65.0,
            95.0
        )

        # Heating increases power consumption
        station["power_consumption"] += np.random.uniform(
            10.0,
            25.0
        )

    elif active_anomaly == "PUMP_FAILURE":

        station["pump_status"] = 0

    elif active_anomaly == "HIGH_VIBRATION":

        station["vibration"] = np.random.uniform(
            7.0,
            12.0
        )

    # --------------------------------------------------------
    # Update runtime
    # --------------------------------------------------------

    station["runtime"] += 1

    # --------------------------------------------------------
    # Decrease anomaly duration
    # --------------------------------------------------------

    if active_anomaly is not None:

        anomaly_remaining -= 1

        if anomaly_remaining <= 0:

            active_anomaly = None
            anomaly_remaining = 0

    # --------------------------------------------------------
    # Inventory Simulation (Food & Medicine)
    # --------------------------------------------------------
    
    # Calculate simulated days passed in this tick
    days_passed = SIMULATION_TIME_MULTIPLIER / (24.0 * 60.0)

    # Food consumption
    station["food_stock_kg"] -= station["food_consumption_daily_kg"] * days_passed
    station["food_stock_kg"] = max(0.0, station["food_stock_kg"])
    
    food_days_remaining = 0
    if station["food_consumption_daily_kg"] > 0:
        food_days_remaining = int(station["food_stock_kg"] / station["food_consumption_daily_kg"])

    if food_days_remaining > 60:
        food_status = "NORMAL"
    elif food_days_remaining > 30:
        food_status = "LOW"
    else:
        food_status = "CRITICAL"

    # Medicine consumption (event based probability)
    # small event
    if np.random.random() < (0.5 * days_passed):
        station["medicine_stock_units"] -= np.random.randint(1, 5)
    # emergency event
    if np.random.random() < (0.05 * days_passed):
        station["medicine_stock_units"] -= np.random.randint(10, 30)
    
    station["medicine_stock_units"] = max(0.0, station["medicine_stock_units"])

    medicine_days_remaining = 0
    if station["medicine_consumption_daily"] > 0:
        medicine_days_remaining = int(station["medicine_stock_units"] / station["medicine_consumption_daily"])

    if medicine_days_remaining <= 30 or station["critical_medicine_items"] > 0:
        medicine_status = "CRITICAL"
    elif medicine_days_remaining <= 60 or station["low_medicine_items"] > 0:
        medicine_status = "LOW"
    else:
        medicine_status = "NORMAL"

    # --------------------------------------------------------
    # Network status simulation
    # --------------------------------------------------------
    # Injected communication_loss overrides network mode
    if injected_anomaly is not None and injected_anomaly["type"] == "communication_loss":
        net_status = "DEGRADED"
        net_bandwidth = round(float(np.random.uniform(1.0, 5.0)), 1)
        net_latency = int(np.random.randint(400, 900))
        pkt_loss = round(float(np.random.uniform(8.0, 25.0)), 1)
        sig_strength = int(np.random.randint(15, 35))
        injected_anomaly["readings"].append(net_bandwidth)
    else:
        current_net_mode = os.environ.get("NETWORK_MODE", NETWORK_MODE)
        if current_net_mode == "SLOW":
            net_status = "SLOW"
            net_bandwidth = round(float(np.random.uniform(5.5, 9.5)), 1)
            net_latency = int(np.random.randint(250, 450))
            pkt_loss = round(float(np.random.uniform(3.0, 8.0)), 1)
            sig_strength = int(np.random.randint(45, 65))
        else:
            net_status = "NORMAL"
            net_bandwidth = round(float(np.random.uniform(75.0, 92.0)), 1)
            net_latency = int(np.random.randint(50, 80))
            pkt_loss = round(float(np.random.uniform(0.2, 1.2)), 1)
            sig_strength = int(np.random.randint(88, 98))

    # --------------------------------------------------------
    # Create JSON object
    # --------------------------------------------------------

    data = {
        "timestamp": simulation_time.strftime(
            "%Y-%m-%d %H:%M:%S"
        ),
        "energy": round(station["energy"], 2),
        "generator_load": round(station["generator_load"], 2),
        "power_generation": round(
            station["power_generation"],
            2
        ),
        "power_consumption": round(
            station["power_consumption"],
            2
        ),
        "fuel_level": round(
            station["fuel_level"],
            2
        ),
        "battery_soc": round(
            station["battery_soc"],
            2
        ),
        "heating": round(
            station["heating"],
            2
        ),
        "generator_health": round(
            station["generator_health"],
            2
        ),
        "pump_status": int(
            station["pump_status"]
        ),
        "equipment_temperature": round(
            station["equipment_temperature"],
            2
        ),
        "vibration": round(
            station["vibration"],
            2
        ),
        "runtime": station["runtime"],
        "network_status": net_status,
        "network_bandwidth": net_bandwidth,
        "network_latency": net_latency,
        "packet_loss": pkt_loss,
        "signal_strength": sig_strength,
        "food_stock_kg": int(station["food_stock_kg"]),
        "food_days_remaining": food_days_remaining,
        "food_consumption_daily_kg": station["food_consumption_daily_kg"],
        "food_storage_temperature": station["food_storage_temperature"],
        "food_status": food_status,
        "food_expiry_risk": station["food_expiry_risk"],
        "medicine_stock_units": int(station["medicine_stock_units"]),
        "medicine_days_remaining": medicine_days_remaining,
        "medicine_consumption_daily": station["medicine_consumption_daily"],
        "critical_medicine_items": station["critical_medicine_items"],
        "low_medicine_items": station["low_medicine_items"],
        "medicine_expiry_risk": station["medicine_expiry_risk"],
        "medicine_storage_temperature": station["medicine_storage_temperature"],
        "medicine_status": medicine_status
    }

    return data


# ============================================================
# SIMULATION START TIME & THREAD-SAFE STATE
# ============================================================

simulation_time = datetime.now()
latest_data = {}
telemetry_history = deque(maxlen=20)   # rolling buffer for AI context
data_lock = threading.Lock()


# ============================================================
# BACKGROUND SIMULATION WORKER
# ============================================================

def run_simulator_background():
    """Continuously runs the simulation loop in a background thread."""
    global simulation_time, latest_data
    while True:
        try:
            data = generate_data()

            # Safely update latest_data for API consumers
            with data_lock:
                latest_data = data
                telemetry_history.append(data)

            # ONLY JSON IS PRINTED TO THE TERMINAL (preserves existing behavior)
            print(
                json.dumps(
                    data,
                    separators=(",", ":")
                ),
                flush=True
            )

            # Move simulated timestamp forward
            simulation_time += timedelta(minutes=SIMULATION_TIME_MULTIPLIER)

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Simulator error in background thread: {e}", flush=True)

        # Wait before generating next record
        time.sleep(INTERVAL_SECONDS)


# ============================================================
# FLASK REST API
# ============================================================

app = Flask(__name__)
# Enable CORS for all routes so frontend dev server can query the API
CORS(app)


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


@app.route("/api/network/mode", methods=["GET", "POST"])
def set_network_mode():
    """Endpoint to inspect or toggle network mode (NORMAL / SLOW)."""
    global NETWORK_MODE
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        mode = data.get("mode") or request.args.get("mode")
        if mode in ["NORMAL", "SLOW"]:
            NETWORK_MODE = mode
            return jsonify({"status": "ok", "network_mode": NETWORK_MODE})
    mode = request.args.get("mode")
    if mode in ["NORMAL", "SLOW"]:
        NETWORK_MODE = mode
        return jsonify({"status": "ok", "network_mode": NETWORK_MODE})
    return jsonify({"network_mode": NETWORK_MODE})


@app.route("/api/data", methods=["GET"])
def get_data():
    """Returns the latest Antarctic station telemetry JSON."""
    global latest_data
    with data_lock:
        if not latest_data:
            latest_data = generate_data()
        return jsonify(latest_data)


@app.route("/api/telemetry/history", methods=["GET"])
def get_telemetry_history():
    """Returns recent telemetry history for trend analysis."""
    with data_lock:
        return jsonify(list(telemetry_history))


@app.route("/api/alerts/analyze", methods=["POST"])
def analyze_alert_endpoint():
    """AI-powered alert analysis via local Ollama.

    Expects JSON body:
      { "alert_id": "low_battery", "alert_message": "LOW BATTERY RESERVE", "severity": "critical" }

    Returns structured AI analysis or error.
    """
    try:
        from ollama_service import analyze_alert
    except ImportError as e:
        return jsonify({
            "error": True,
            "summary": f"AI service module not available: {e}",
            "possible_causes": [],
            "affected_systems": [],
            "risk": "AI analysis unavailable.",
            "recommended_actions": ["Ensure ollama_service.py exists alongside data_simulator.py."]
        }), 503

    req = request.get_json(silent=True) or {}
    alert_id      = req.get("alert_id",      "unknown")
    alert_message = req.get("alert_message",  "Unknown alert")
    severity      = req.get("severity",       "unknown")

    # Build alert context from current state
    with data_lock:
        current = dict(latest_data) if latest_data else {}
        history_list = list(telemetry_history)

    # Select relevant telemetry fields for the context
    relevant_keys = [
        "energy", "generator_load", "power_generation", "power_consumption",
        "fuel_level", "battery_soc", "heating", "generator_health",
        "pump_status", "equipment_temperature", "vibration"
    ]
    current_telem = {k: current.get(k) for k in relevant_keys if current.get(k) is not None}

    # Build compact history (only relevant fields, last 10 entries)
    recent = []
    for snap in history_list[-10:]:
        entry = {k: snap.get(k) for k in relevant_keys if snap.get(k) is not None}
        recent.append(entry)

    alert_context = {
        "station": "Maitri",
        "alert": {
            "type":     alert_id,
            "message":  alert_message,
            "severity": severity,
        },
        "current_telemetry": current_telem,
        "recent_telemetry":  recent,
    }

    result = analyze_alert(alert_context)
    status_code = 503 if result.get("error") else 200
    return jsonify(result), status_code


if __name__ == "__main__":
    # Start the simulator in a background daemon thread
    sim_thread = threading.Thread(target=run_simulator_background, daemon=True)
    sim_thread.start()

    # Allow a brief moment for the initial data point to be generated
    time.sleep(0.1)

    print(f"* Antarctic Data Simulator background thread started (INTERVAL_SECONDS={INTERVAL_SECONDS}s)")
    print("* Starting Flask API server on http://127.0.0.1:5000")

    # Run Flask server (debug=False ensures single background thread)
    app.run(host="0.0.0.0", port=5000, debug=False)