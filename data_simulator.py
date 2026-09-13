import json
import threading
import time

from flask import Flask, jsonify, request
from flask_cors import CORS
from flasgger import Swagger
from collections import deque

from simulation_core import SimulationConfig, SimulationCore, StationID, SimulationRNG, SCENARIO_TYPES
from environment import load_maitri_dataset, ReplayEngine

config = SimulationConfig.from_env()
config.dataset_path = config.dataset_path or "data/maitri_weather_2016.json"

maitri_records = load_maitri_dataset(config.dataset_path)
maitri_environment = ReplayEngine(
    maitri_records,
    simulation_time_multiplier=config.simulation_time_multiplier,
    dataset_interval_minutes=60,  # Maitri_AWS_2016 is hourly
)

bharati_records = load_maitri_dataset("data/bharati_weather_2026.json")
bharati_environment = ReplayEngine(
    bharati_records,
    simulation_time_multiplier=config.simulation_time_multiplier,
    dataset_interval_minutes=1,  # Bharati_AWS_2026 is minute-sampled
)

cores = {
    StationID.MAITRI: SimulationCore(
        station_id=StationID.MAITRI,
        config=config,
        environment_source=maitri_environment,
    ),
    StationID.BHARATI: SimulationCore(
        station_id=StationID.BHARATI,
        config=config,
        rng=SimulationRNG(config.seed + 1 if config.seed is not None else None),
        environment_source=bharati_environment,
    ),
}

latest_data = {StationID.MAITRI: {}, StationID.BHARATI: {}}
telemetry_history = {
    StationID.MAITRI: deque(maxlen=20),
    StationID.BHARATI: deque(maxlen=20),
}
data_lock = threading.Lock()

# Simulator can be paused/resumed via the API without killing the
# background thread or losing station state -- stopping just means
# "stop ticking," not "destroy the simulation."
simulator_running = threading.Event()
simulator_running.set()

# Small, deterministic threshold list -- same pattern already used in
# the frontend's stationRooms.js alert rules, ported here so the demo
# snapshot endpoint is self-contained. Not AI, not new physics.
def compute_alerts(d: dict) -> list:
    alerts = []
    if d.get("battery_soc", 100) <= 10:
        alerts.append({"id": "battery_critical", "severity": "CRITICAL", "message": "Battery reserve critical"})
    if d.get("fuel_level", 100) <= 15:
        alerts.append({"id": "fuel_low", "severity": "HIGH", "message": "Fuel level low"})
    if d.get("generator_status") != "RUNNING":
        alerts.append({"id": "generator_not_running", "severity": "CRITICAL", "message": f"Generator status: {d.get('generator_status')}"})
    if d.get("critical_systems_powered") is False:
        alerts.append({"id": "critical_power_loss", "severity": "CRITICAL", "message": "Critical systems unpowered"})
    if d.get("medicine_status") == "CRITICAL":
        alerts.append({"id": "medicine_critical", "severity": "HIGH", "message": "Medicine stock critical"})
    if d.get("resupply_risk") == "CRITICAL":
        alerts.append({"id": "resupply_critical", "severity": "HIGH", "message": "Resupply risk critical"})
    if d.get("communication_equipment_status") == "OFFLINE":
        alerts.append({"id": "comms_offline", "severity": "HIGH", "message": "Communication equipment offline"})
    if d.get("water_treatment_status") == "OFFLINE":
        alerts.append({"id": "water_offline", "severity": "HIGH", "message": "Water treatment offline"})
    return alerts


# Domain groupings for /telemetry/{domain}/latest -- to_api_dict() is a
# flat dict, so this just slices it by field name rather than requiring
# a new nested response shape that would break /api/data compatibility.
DOMAIN_FIELDS = {
    "environment": ["temperature", "air_pressure", "wind_speed", "wind_direction", "humidity",
                     "environment_source_type", "environment_quality"],
    "energy": ["energy", "generator_status", "critical_systems_powered", "generator_load",
               "power_generation", "power_consumption", "fuel_level", "battery_soc", "generator_health"],
    "infrastructure": ["heating", "pump_status", "equipment_temperature", "vibration", "runtime",
                        "network_status", "network_bandwidth", "network_latency", "packet_loss",
                        "signal_strength", "communication_equipment_health", "communication_equipment_status",
                        "water_treatment_health", "water_treatment_status", "backup_heater_health",
                        "backup_heater_active"],
    "logistics": ["food_stock_kg", "food_days_remaining", "food_consumption_daily_kg",
                  "food_storage_temperature", "food_status", "food_expiry_risk",
                  "medicine_stock_units", "medicine_days_remaining", "medicine_consumption_daily",
                  "medicine_expiry_risk", "medicine_storage_temperature", "medicine_status",
                  "generator_fuel_reserve_l", "generator_fuel_reserve_days_remaining", "resupply_risk"],
}

SCENARIO_PRESETS = {
    "extreme_cold_demo": {"type": "EXTREME_COLD", "duration_ticks": 30},
    "extreme_wind_demo": {"type": "EXTREME_WIND", "duration_ticks": 30},
    "pressure_drop_demo": {"type": "PRESSURE_DROP", "duration_ticks": 30},
    "humidity_anomaly_demo": {"type": "HUMIDITY_ANOMALY", "duration_ticks": 30},
    "generator_failure_demo": {"type": "GENERATOR_FAILURE", "duration_ticks": 20},
    "communication_failure_demo": {"type": "COMMUNICATION_FAILURE", "duration_ticks": 20},
}


def _parse_station(default="MAITRI"):
    """Shared station-param parsing, used by every station-scoped route."""
    station_param = request.args.get("station") or (request.get_json(silent=True) or {}).get("station") or default
    station_param = station_param.upper()
    try:
        return StationID(station_param), None
    except ValueError:
        return None, jsonify({"error": f"Unknown station '{station_param}'. Known: {[s.value for s in StationID]}"}), 400


def run_simulator_background():
    global latest_data
    try:
        while True:
            if simulator_running.is_set():
                for station_id, station_core in cores.items():
                    data = station_core.tick().to_api_dict()
                    with data_lock:
                        latest_data[station_id] = data
                        telemetry_history[station_id].append(data)
                    print(json.dumps(data, separators=(",", ":")), flush=True)
            time.sleep(config.interval_seconds)
    except Exception as e:
        print(f"Simulator error in background thread: {e}", flush=True)


# ============================================================
# FLASK REST API
# ============================================================

app = Flask(__name__)
CORS(app)
app.config["SWAGGER"] = {"title": "PolarSync Simulator API", "uiversion": 3}
swagger = Swagger(app)


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint.
    ---
    responses:
      200:
        description: Service is up
    """
    return jsonify({"status": "ok"})


@app.route("/api/network/mode", methods=["GET", "POST"])
def set_network_mode():
    """Inspect or toggle network mode (NORMAL / SLOW).
    ---
    parameters:
      - name: mode
        in: query
        type: string
        enum: [NORMAL, SLOW]
        required: false
    responses:
      200:
        description: Current or updated network mode
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        mode = data.get("mode") or request.args.get("mode")
        if mode in ["NORMAL", "SLOW"]:
            config.network_mode = mode
            return jsonify({"status": "ok", "network_mode": config.network_mode})
    mode = request.args.get("mode")
    if mode in ["NORMAL", "SLOW"]:
        config.network_mode = mode
        return jsonify({"status": "ok", "network_mode": config.network_mode})
    return jsonify({"network_mode": config.network_mode})


@app.route("/api/data", methods=["GET"])
def get_data():
    """Latest telemetry snapshot for a station.
    ---
    parameters:
      - name: station
        in: query
        type: string
        enum: [MAITRI, BHARATI]
        required: false
        default: MAITRI
    responses:
      200:
        description: Latest telemetry
      400:
        description: Unknown station
    """
    result = _parse_station()
    if result[1] is not None:
        return result[1], result[2]
    station_id = result[0]

    with data_lock:
        if not latest_data[station_id]:
            latest_data[station_id] = cores[station_id].tick().to_api_dict()
        return jsonify(latest_data[station_id])


@app.route("/api/telemetry/history", methods=["GET"])
def get_telemetry_history():
    """Recent telemetry history for one station (bug fix: previously
    returned dict keys instead of history due to list(dict) on a
    station-keyed structure).
    ---
    parameters:
      - name: station
        in: query
        type: string
        enum: [MAITRI, BHARATI]
        required: false
        default: MAITRI
    responses:
      200:
        description: List of recent telemetry snapshots, oldest first
      400:
        description: Unknown station
    """
    result = _parse_station()
    if result[1] is not None:
        return result[1], result[2]
    station_id = result[0]

    with data_lock:
        return jsonify(list(telemetry_history[station_id]))


@app.route("/telemetry/<domain>/latest", methods=["GET"])
def get_domain_telemetry(domain):
    """Latest telemetry for one domain (environment / energy / infrastructure / logistics).
    ---
    parameters:
      - name: domain
        in: path
        type: string
        enum: [environment, energy, infrastructure, logistics]
        required: true
      - name: station
        in: query
        type: string
        enum: [MAITRI, BHARATI]
        required: false
        default: MAITRI
    responses:
      200:
        description: Latest telemetry filtered to one domain
      400:
        description: Unknown station or domain
    """
    if domain not in DOMAIN_FIELDS:
        return jsonify({"error": f"Unknown domain '{domain}'. Known: {list(DOMAIN_FIELDS.keys())}"}), 400
    result = _parse_station()
    if result[1] is not None:
        return result[1], result[2]
    station_id = result[0]

    with data_lock:
        if not latest_data[station_id]:
            latest_data[station_id] = cores[station_id].tick().to_api_dict()
        full = latest_data[station_id]
        filtered = {k: full[k] for k in DOMAIN_FIELDS[domain] if k in full}
        return jsonify(filtered)


@app.route("/simulator/status", methods=["GET"])
def simulator_status():
    """Whether the simulator is running, plus per-station simulated time and active scenarios.
    ---
    responses:
      200:
        description: Simulator status
    """
    with data_lock:
        stations = {}
        for sid, core in cores.items():
            stations[sid.value] = {
                "simulation_time": latest_data[sid].get("timestamp"),
                "active_scenarios": core.get_active_scenarios(),
            }
    return jsonify({"running": simulator_running.is_set(), "stations": stations})


@app.route("/simulator/start", methods=["POST"])
def simulator_start():
    """Resume ticking (station state is preserved, not reset).
    ---
    responses:
      200:
        description: Simulator resumed
    """
    simulator_running.set()
    return jsonify({"status": "ok", "running": True})


@app.route("/simulator/stop", methods=["POST"])
def simulator_stop():
    """Pause ticking (station state is preserved, not destroyed).
    ---
    responses:
      200:
        description: Simulator paused
    """
    simulator_running.clear()
    return jsonify({"status": "ok", "running": False})


@app.route("/scenario/start", methods=["POST"])
def scenario_start():
    """Start a deterministic scenario on a station.
    ---
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            station:
              type: string
              enum: [MAITRI, BHARATI]
            type:
              type: string
              enum: [EXTREME_COLD, EXTREME_WIND, PRESSURE_DROP, HUMIDITY_ANOMALY, GENERATOR_FAILURE, COMMUNICATION_FAILURE]
            duration_ticks:
              type: integer
              default: 30
    responses:
      200:
        description: Scenario started
      400:
        description: Unknown station, unknown scenario type, or invalid duration
    """
    body = request.get_json(silent=True) or {}
    result = _parse_station()
    if result[1] is not None:
        return result[1], result[2]
    station_id = result[0]

    scenario_type = (body.get("type") or "").upper()
    duration_ticks = body.get("duration_ticks", 30)

    with data_lock:
        try:
            cores[station_id].start_scenario(scenario_type, duration_ticks)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

    return jsonify({
        "status": "ok",
        "station": station_id.value,
        "scenario_started": scenario_type,
        "duration_ticks": duration_ticks,
    })


@app.route("/scenario/stop", methods=["POST"])
def scenario_stop():
    """Stop a specific scenario, or all active scenarios if type is omitted.
    ---
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            station:
              type: string
              enum: [MAITRI, BHARATI]
            type:
              type: string
              enum: [EXTREME_COLD, EXTREME_WIND, PRESSURE_DROP, HUMIDITY_ANOMALY, GENERATOR_FAILURE, COMMUNICATION_FAILURE]
    responses:
      200:
        description: Scenario(s) stopped
      400:
        description: Unknown station
    """
    body = request.get_json(silent=True) or {}
    result = _parse_station()
    if result[1] is not None:
        return result[1], result[2]
    station_id = result[0]

    scenario_type = body.get("type")
    with data_lock:
        if scenario_type:
            cores[station_id].stop_scenario(scenario_type.upper())
        else:
            cores[station_id].stop_all_scenarios()

    return jsonify({"status": "ok", "station": station_id.value, "stopped": scenario_type or "ALL"})


@app.route("/scenario/status", methods=["GET"])
def scenario_status():
    """Active scenarios and remaining ticks for a station.
    ---
    parameters:
      - name: station
        in: query
        type: string
        enum: [MAITRI, BHARATI]
        required: false
        default: MAITRI
    responses:
      200:
        description: Active scenarios
      400:
        description: Unknown station
    """
    result = _parse_station()
    if result[1] is not None:
        return result[1], result[2]
    station_id = result[0]

    with data_lock:
        active = cores[station_id].get_active_scenarios()
    return jsonify({"station": station_id.value, "active_scenarios": active})


@app.route("/scenario/presets", methods=["GET"])
def scenario_presets():
    """List available named scenario presets.
    ---
    responses:
      200:
        description: Preset definitions
    """
    return jsonify(SCENARIO_PRESETS)


@app.route("/scenario/preset/start", methods=["POST"])
def scenario_preset_start():
    """Start a named preset scenario on a station.
    ---
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            station:
              type: string
              enum: [MAITRI, BHARATI]
            preset:
              type: string
    responses:
      200:
        description: Preset started
      400:
        description: Unknown station or preset name
    """
    body = request.get_json(silent=True) or {}
    result = _parse_station()
    if result[1] is not None:
        return result[1], result[2]
    station_id = result[0]

    preset_name = body.get("preset")
    preset = SCENARIO_PRESETS.get(preset_name)
    if preset is None:
        return jsonify({"error": f"Unknown preset '{preset_name}'. Known: {list(SCENARIO_PRESETS.keys())}"}), 400

    with data_lock:
        cores[station_id].start_scenario(preset["type"], preset["duration_ticks"])

    return jsonify({"status": "ok", "station": station_id.value, "preset": preset_name, **preset})


@app.route("/demo/snapshot", methods=["GET"])
def demo_snapshot():
    """Full demo-ready snapshot: telemetry by domain, active scenario, and alerts, for one station.
    ---
    parameters:
      - name: station
        in: query
        type: string
        enum: [MAITRI, BHARATI]
        required: false
        default: MAITRI
    responses:
      200:
        description: Full snapshot
      400:
        description: Unknown station
    """
    result = _parse_station()
    if result[1] is not None:
        return result[1], result[2]
    station_id = result[0]

    with data_lock:
        if not latest_data[station_id]:
            latest_data[station_id] = cores[station_id].tick().to_api_dict()
        d = latest_data[station_id]
        active_scenarios = cores[station_id].get_active_scenarios()

    snapshot = {
        "station": station_id.value,
        "simulation_time": d.get("timestamp"),
        "simulator_running": simulator_running.is_set(),
        "active_scenarios": active_scenarios,
        "environment": {k: d[k] for k in DOMAIN_FIELDS["environment"] if k in d},
        "energy": {k: d[k] for k in DOMAIN_FIELDS["energy"] if k in d},
        "infrastructure": {k: d[k] for k in DOMAIN_FIELDS["infrastructure"] if k in d},
        "logistics": {k: d[k] for k in DOMAIN_FIELDS["logistics"] if k in d},
        "alerts": compute_alerts(d),
    }
    return jsonify(snapshot)


@app.route("/api/alerts/analyze", methods=["POST"])
def analyze_alert_endpoint():
    """AI-powered alert analysis via local Ollama.
    ---
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            alert_id:
              type: string
            alert_message:
              type: string
            severity:
              type: string
    responses:
      200:
        description: AI analysis
      503:
        description: AI service unavailable
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

    with data_lock:
        current = dict(latest_data.get(StationID.MAITRI, {}))
        history_list = list(telemetry_history[StationID.MAITRI])

    relevant_keys = [
        "energy", "generator_load", "power_generation", "power_consumption",
        "fuel_level", "battery_soc", "heating", "generator_health",
        "pump_status", "equipment_temperature", "vibration"
    ]
    current_telem = {k: current.get(k) for k in relevant_keys if current.get(k) is not None}

    recent = []
    for snap in history_list[-10:]:
        entry = {k: snap.get(k) for k in relevant_keys if snap.get(k) is not None}
        recent.append(entry)

    alert_context = {
        "station": "Maitri",
        "alert": {"type": alert_id, "message": alert_message, "severity": severity},
        "current_telemetry": current_telem,
        "recent_telemetry": recent,
    }

    result = analyze_alert(alert_context)
    status_code = 503 if result.get("error") else 200
    return jsonify(result), status_code


if __name__ == "__main__":
    sim_thread = threading.Thread(target=run_simulator_background, daemon=True)
    sim_thread.start()

    time.sleep(0.1)

    print(f"* Antarctic Data Simulator background thread started (INTERVAL_SECONDS={config.interval_seconds}s)")
    print("* Starting Flask API server on http://127.0.0.1:5000")
    print("* Swagger UI available at http://127.0.0.1:5000/apidocs")

    app.run(host="0.0.0.0", port=5000, debug=False)