# Antarctic Research Station Telemetry Dashboard

Live telemetry pipeline connecting a Python data simulation engine to a real-time React web dashboard.

---

## Architecture Overview

```text
┌────────────────────────────────────────┐
│   data_simulator.py (Python 3.13)      │
│   ├── Background Daemon Thread         │
│   │   ├── Multi-Station Simulation     │
│   │   ├── Scenario & Anomaly Engine    │
│   │   └── updates thread-safe cache    │
│   │                                    │
│   ├── ollama_service.py (AI Alerts)    │
│   │                                    │
│   └── Flask REST API (Port 5000)       │
│       ├── GET /api/health              │
│       ├── GET /api/data  ◄─────────────┼───┐
│       ├── GET /api/telemetry/history   │   │
│       ├── GET /api/anomaly-events      │   │
│       ├── GET /api/scenario-status     │   │
│       ├── POST /api/alerts/analyze     │   │
│       └── GET /api/alerts/analyze/<id> │   │
└────────────────────────────────────────┘   │
                                             │ HTTP GET/POST (fetch every 2s)
                                             │ CORS enabled
┌────────────────────────────────────────┐   │
│   React Frontend (Vite • Port 3000)    │   │
│   ├── src/App.jsx ─────────────────────┴───┘
│   ├── src/components/
│   │   ├── Header.jsx (Connection Badge, Network, & Station Select)
│   │   ├── LeftPanel.jsx & WeatherPanel.jsx (Weather & Metrics)
│   │   ├── DigitalTwin.jsx & BharatiDigitalTwin.jsx (2D Interactive Maps)
│   │   ├── AlertPanel.jsx (Dynamic Alerts)
│   │   ├── LogisticsPanel.jsx (Resource Tracking)
│   │   ├── ScenarioBanner.jsx (Active Anomalies)
│   │   ├── RoomInfoPanel.jsx (Modal Room Inspector)
│   │   ├── ChartsSection.jsx (Chart.js Power & Diagnostics)
│   │   └── LogsView.jsx (Real-time Derived Event Stream)
│   ├── src/three/
│   │   └── Station3DView.jsx (Three.js 3D Model View)
│   └── src/index.css (Glassmorphic Dark Theme)
```

---

## 1. Prerequisites & Installation

### Backend Dependencies (Python 3.13)
Install Flask, Flask-CORS, NumPy, and Ollama (for AI alerts):

```bash
cd C:\PolarSync
py -3.13 -m pip install -r requirements.txt
```

*(Or individually via `py -3.13 -m pip install flask flask-cors numpy ollama`)*

*(Optional)* To enable the AI alert analysis, make sure you have the [Ollama](https://ollama.com/) server running locally with the required model.

### Frontend Dependencies (Node.js & npm)
Install React, Vite, and Chart.js dependencies:

```bash
cd C:\PolarSync\frontend
npm install
```

---

## 2. Running the System

### Terminal 1: Start the Python Simulator & Flask API
```bash
cd C:\PolarSync
py -3.13 data_simulator.py
```

- Spawns the telemetry simulator in a background daemon thread.
- Streams live JSON records to stdout for CLI monitoring and debugging.
- Exposes the Flask REST API server on **`http://localhost:5000`**.
- Configurable interval:
  - Default: 2 seconds (intended simulation interval for demo).
  - For 60-second updates: pass `--prod` or set `$env:INTERVAL_SECONDS="60"`.
- Uses `SIMULATION_TIME_MULTIPLIER` for fast-forwarding inventory simulations.

### Terminal 2: Start the React Frontend (Vite)
```bash
cd C:\PolarSync\frontend
npm run dev
```

Open your browser and navigate to:
**`http://localhost:3000`**

To produce an optimized production bundle:
```bash
npm run build
```

---

## 3. API Endpoint Documentation

### `GET /api/health`
Health check endpoint to verify that the Flask server is running.
- **URL**: `http://localhost:5000/api/health`

### `GET /api/data`
Returns the most recent station telemetry snapshot.
- **URL**: `http://localhost:5000/api/data?station=MAITRI`

### `GET /api/telemetry/history`
Returns recent telemetry history for trend analysis.
- **URL**: `http://localhost:5000/api/telemetry/history?station=MAITRI`

### `GET /api/anomaly-events`
Returns recent simulated anomaly events for the selected station.
- **URL**: `http://localhost:5000/api/anomaly-events?station=MAITRI`

### `GET /api/scenario-status`
Returns currently active scenarios (e.g. `EXTREME_COLD`, `COMMUNICATION_FAILURE`) and their remaining duration ticks.
- **URL**: `http://localhost:5000/api/scenario-status?station=MAITRI`

### `POST /api/alerts/analyze`
Starts an async AI-powered alert analysis job via local Ollama.
- **URL**: `http://localhost:5000/api/alerts/analyze`
- **Body Schema**:
  ```json
  {
    "station_id": "MAITRI",
    "alert_id": "low_battery",
    "alert_message": "LOW BATTERY RESERVE",
    "severity": "critical",
    "telemetry_context": {...}
  }
  ```
- **Returns**: `{"job_id": "uuid-here"}`

### `GET /api/alerts/analyze/<job_id>`
Poll the background AI analysis job to get the completed response without timing out.
- **URL**: `http://localhost:5000/api/alerts/analyze/<job_id>`

---

## 4. Telemetry Field Mapping

| Field | Description | Display / Treatment |
|---|---|---|
| `energy` | Station grid reserve | Value (kWh) & capacity progress bar |
| `generator_load` | Turbine load percentage | Value (%) & load warning indicator |
| `power_generation` | Current generation rate | Value (kW) & plotted on Power Chart |
| `power_consumption` | Current station load | Value (kW) & plotted on Power Chart |
| `fuel_level` | Sub-surface fuel bunker level | Value (%) & level bar |
| `battery_soc` | Li-FePO4 State of Charge | Value (%) & reserve status |
| `heating` | Habitat climate thermal output | Value (kW) & heat output bar |
| `generator_health` | Generator operational health | Value (%) in summary bar |
| `pump_status` | Primary cooling pump state | `1` = Operational, `0` = Offline |
| `equipment_temperature`| Core equipment temperature | Value (°C) & plotted on Diagnostics Chart |
| `vibration` | Piezo vibration sensor reading | Value (mm/s) & plotted on Diagnostics Chart |
| `runtime` | Generator runtime counter | Total elapsed hours/cycles |
| `timestamp` | Simulation timestamp | Displayed in "Last Updated" |
| `food_stock_kg` | Food supply inventory | Value (kg) |
| `medicine_stock_units`| Medicine inventory | Value (units) |
| `network_status` | Network Status (NORMAL/SLOW/DEGRADED) | Network Badge Indicator |
| `network_bandwidth` | Current Network Bandwidth | Value (Mbps) |
| `network_latency` | Network Latency | Value (ms) |
| `packet_loss` | Network Packet Loss | Value (%) |
| `signal_strength` | Network Signal Strength | Value (%) |

*(Inventory variables such as days remaining, daily consumption, risk, storage temperatures, and status are also simulated and mapped).*

---

## 5. End-to-End Data Flow

1. **Continuous Simulation Worker**:
   - `data_simulator.py` runs `run_simulator_background()` in a daemon thread.
   - Every interval, it advances the deterministic `simulation_core` for each station (MAITRI and BHARATI), applying weather effects and random anomaly scenarios.
   - Safely locks and updates the shared `latest_data` and `telemetry_history` dicts.

2. **Flask REST Service**:
   - Runs on port 5000. Routes are station-aware (via `?station=MAITRI`).
   - `POST /api/alerts/analyze` kicks off non-blocking background analysis using Ollama and returns a job ID to the frontend to prevent timeouts.

3. **Frontend Polling & Rendering**:
   - The React application polls `GET /api/data` every 2000ms for the currently active station.
   - Supports switching between **MAITRI** and **BHARATI**, rendering distinct 2D maps, unique 3D visualizers, logistics panels, scenario banners, and event logs.
   - Telemetry history is maintained for each station independently for instant switching.

---

## 6. Troubleshooting & FAQs

### Q: The frontend shows "Simulator Disconnected"
- **Check if Flask is running**: Open `http://localhost:5000/api/health` in your browser.
- **Port Conflict**: Check if another process is holding port 5000.

### Q: What about CORS errors?
- Flask-CORS is configured globally. This allows cross-origin requests from the Vite frontend (`http://localhost:3000`).

### Q: Why do the charts cap at 30 points?
- To ensure optimal client-side performance and avoid memory leaks, the React `history` buffer keeps the latest 30 telemetry points.

### Q: How can I adjust the simulation speed?
- Default simulation interval is 2 seconds (live demo).
- You can pass `--prod` to stream updates every 60 seconds.
- You can also set `SIMULATION_TIME_MULTIPLIER` (e.g. `SIMULATION_TIME_MULTIPLIER=60`) to accelerate simulated inventory consumption independently of the real-time polling interval.

### Q: Why are AI Alert Analytics failing?
- Ensure that the Ollama package is installed (`pip install ollama`).
- Check if your Ollama server is running locally and has the required language model downloaded.
