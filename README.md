# ❄️ PolarSync: Antarctic Station Management & Edge Computing System

[![Python 3.13](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Vite 6](https://img.shields.io/badge/Vite-6-646cff.svg)](https://vitejs.dev/)
[![SQLite WAL](https://img.shields.io/badge/Database-SQLite_WAL-003b57.svg)](https://www.sqlite.org/)
[![Ollama AI](https://img.shields.io/badge/AI-Ollama_DeepSeek-orange.svg)](https://ollama.com/)

**PolarSync** is an mission-critical telemetry, edge computing, and AI-powered station management system designed for extreme polar conditions at Antarctic research stations (**Maitri** and **Bharati**). 

Operating in Antarctica presents severe engineering challenges: geomagnetic storms cause frequent satellite blackouts, temperatures drop below -50°C, and life-safety systems (Generators, Heating, Fuel) demand instant local response. PolarSync solves this with an **Edge-First Architecture**, ensuring zero data loss and strict priority synchronization even during total network blackouts.

---

## 📸 Quick Overview

```text
+-----------------------------------------------------------------------------------+
| POLAR SYNC   MAITRI                     [● SIMULATOR ONLINE] [⇄ SYNC ACTIVE ›]    |
+-----------------------------------------------------------------------------------+
|  STATION STATUS  |          2D INTERACTIVE DIGITAL TWIN          | PRIORITY QUEUE |
|  ENERGY 471 kWh  |       [Control] [Living] [Lab] [Can] [Med]    | P1 Crit    0   |
|  BATTERY  62%    |       [Generator Room] [Fuel Storage]         | P2 Mod     0   |
|  FUEL      0% ⚠  |                                               | P3 Norm    0   |
|  POWER   80.9 kW |       ---------------------------------       | ✓ SYNC COMPLETE|
|                  |       POWER: GENERATION VS CONSUMPTION        | EDGE HISTORY   |
|  ENVIRONMENT     |       DIAGNOSTICS: LOAD & BATTERY             | ACTIVE ALERTS  |
|  TEMP   31.8°C   |       EVENT LOG STREAM                        | ALERT HISTORY  |
+-----------------------------------------------------------------------------------+
```

---

## 🌟 Key System Features

### ⚡ 1. Local Edge Computing & Resilience Layer
* **Offline Sovereignty:** Data processing, anomaly detection, and alert classification occur 100% locally on-station.
* **Crash-Safe SQLite WAL Storage (`edge_storage.py`):** Multi-threaded local database operating in Write-Ahead Logging (WAL) mode guarantees zero data loss during sudden power outages.
* **Priority-Ordered Buffer ($P1 \rightarrow P2 \rightarrow P3$):**
  * **P1 CRITICAL:** Life-safety alerts (Generator Failure, Fuel Depletion). Syncs first under all conditions.
  * **P2 MODERATE:** Operational warnings (Equipment Overheat, High Heating Load).
  * **P3 NORMAL:** Routine periodic telemetry samples.
* **Bandwidth-Adaptive Sync Worker (`sync_worker.py`):**
  * **ONLINE Mode (80 Mbps):** Full transmission batching (20 records/cycle, all priorities).
  * **DEGRADED Mode (Storm):** Restricts sync to **P1 & P2 records only**, dropping routine P3 telemetry to save satellite bandwidth.
  * **OFFLINE Mode (Blackout):** Zero network calls. Local SQLite buffer retains all telemetry records until connection is restored.
* **Interactive Header Sync Control `[ ⇄ SYNC ACTIVE › ]`:** Real-time clickable dashboard control opening a detailed live sync status popup (Network Mode, SQLite Buffer size, Pending queue, Oldest pending record, Recent activity log).

### 🤖 2. Local AI Anomaly Diagnostics (Ollama / DeepSeek)
* **On-Station AI Diagnosis (`ollama_service.py`):** Integrates local LLMs to diagnose telemetry anomalies and propose actionable resolution steps without cloud latency.
* **Asynchronous Analysis Queue:** Runs AI inference in non-blocking background threads via `/api/alerts/analyze`.
* **Full Alert History Modal:** View all historical alerts in a searchable, 5-column table complete with inline **`AI Analyze`** buttons.

### 🏢 3. Dual-Station Digital Twin & Infrastructure Monitoring
* **Multi-Station Support:** Instant switching between **Maitri Station** (Schirmacher Oasis) and **Bharati Station** (Larsemann Hills).
* **2D & 3D Interactive Floor Maps:** Click on any room (Generator Room, Living Quarters, Laboratory, Medical Bay, Fuel Tanks) to inspect localized telemetry and room health.
* **Logistics & Inventory Tracking:** Real-time stock degradation predictions for **Food**, **Medicine**, and **Fuel**, including days remaining until resupply.

---

## 🏗 System Architecture

```text
┌────────────────────────────────────────────────────────┐
│             Data Simulation Daemon                     │
│             (data_simulator.py / Python 3.13)          │
│   ├── Generates Maitri & Bharati Telemetry Ticks       │
│   └── Evaluates Weather & Anomaly Scenarios            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           v
┌────────────────────────────────────────────────────────┐
│             Edge Pipeline & Severity Classifier        │
│             (edge_pipeline.py)                         │
│   ├── Maps Alerts to P1 CRITICAL / P2 MODERATE / P3     │
│   └── Tracks RAISED & CLEARED Alert Event Diffs        │
└──────────────────────────┬─────────────────────────────┘
                           │
                           v
┌────────────────────────────────────────────────────────┐
│             SQLite WAL Database Buffer                 │
│             (edge_storage.py / edge_buffer.db)         │
│   ├── PRAGMA journal_mode = WAL                        │
│   └── Composite Index (idx_pending_order)              │
└──────────────────────────┬─────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              v                         v
┌───────────────────────────┐ ┌───────────────────────────┐
│ Priority Sync Worker      │ │ Flask REST API            │
│ (sync_worker.py)          │ │ (Port 5000)               │
│ ├── ONLINE (P1, P2, P3)   │ │ ├── GET  /api/data        │
│ ├── DEGRADED (P1, P2)     │ │ ├── GET  /api/edge/status │
│ └── OFFLINE (Buffer Grow) │ │ └── POST /api/alerts/...  │
└─────────────┬─────────────┘ └─────────────┬─────────────┘
              │                             │
              v                             v
┌────────────────────────────────────────────────────────┐
│             React Dashboard & Command Center           │
│             (Vite • Port 3000)                         │
│   ├── Interactive [ ⇄ SYNC ACTIVE › ] Popup            │
│   ├── Permanent Priority Queue & Edge History          │
│   ├── Full Alert History Modal with AI Diagnostics     │
│   └── Chart.js Power & Environmental Trends            │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Step 1: Prerequisites
Ensure you have **Python 3.13+** and **Node.js 18+** installed.

### Step 2: Start Backend Telemetry & Sync Engine
```bash
# Install Python dependencies
py -3.13 -m pip install -r requirements.txt

# Launch Backend Simulation & Flask REST Server (Port 5000)
py -3.13 data_simulator.py
```
*The simulator spawns the edge pipeline, SQLite buffer, sync worker, and Flask API server at `http://localhost:5000`.*

### Step 3: Start React Dashboard
```bash
# Open a new terminal window
cd frontend

# Install Node modules
npm install

# Start Vite Dev Server (Port 3000)
npm run dev
```
*Open your browser and navigate to **`http://localhost:3000`**.*

---

## 📡 API Endpoint Reference

| HTTP Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend service health check. |
| `GET` | `/api/data?station=MAITRI` | Latest telemetry snapshot for the specified station. |
| `GET` | `/api/telemetry/history?station=MAITRI` | 30-point telemetry history array for charts. |
| `GET` | `/api/anomaly-events?station=MAITRI` | Recent simulated active station anomalies. |
| `GET` | `/api/edge/status` | Edge computing network state, sync state, and processing health. |
| `GET` | `/api/edge/queue` | Priority queue counts (P1 Pending, P2 Pending, P3 Pending). |
| `GET` | `/api/edge/history?limit=20` | Recent telemetry transmission log from local SQLite. |
| `POST` | `/api/alerts/analyze` | Dispatches an asynchronous local AI diagnosis job (Ollama). |
| `GET` | `/api/alerts/analyze/<job_id>` | Polls status/result of an AI analysis job. |

---

## 📁 Repository Structure

```text
PolarSync/
├── data_simulator.py       # Main telemetry daemon & Flask API backend
├── edge_pipeline.py        # Edge anomaly detection & severity classifier
├── edge_storage.py         # SQLite WAL thread-safe priority database buffer
├── sync_worker.py          # Bandwidth-adaptive priority sync engine
├── network_state.py        # Network mode controller (ONLINE / DEGRADED / OFFLINE)
├── ollama_service.py       # Local AI analysis engine integration
├── simulation_core.py      # Station physical simulation math & scenarios
├── requirements.txt        # Python library dependencies
├── PolarSync_Edge_Computing_and_DB_Report.pdf # Executive PDF Technical Report
└── frontend/               # React Vite Web Dashboard
    ├── src/
    │   ├── App.jsx         # Main Dashboard Layout Shell
    │   ├── index.css       # Glassmorphic Dark Industrial Command Center Styles
    │   └── components/
    │       ├── Header.jsx               # Top Bar with [ ⇄ SYNC ACTIVE › ] button
    │       ├── EdgeComputingControl.jsx # Header Sync Button & Live Dropdown Popup
    │       ├── EdgeComputingPanel.jsx   # Permanent Priority Queue Sidebar
    │       ├── AlertPanel.jsx           # Active Alerts & Full Alert History Modal
    │       ├── DigitalTwin.jsx          # Maitri 2D Map Inspector
    │       └── BharatiDigitalTwin.jsx   # Bharati 2D Map Inspector
```

---

## 📄 Technical PDF Report

For an executive deep-dive into the mathematical and architectural design of PolarSync's Edge Layer and SQLite database, refer to the included technical report:

📄 **[PolarSync_Edge_Computing_and_DB_Report.pdf](PolarSync_Edge_Computing_and_DB_Report.pdf)**

---

## 🛠 License & Credits
Built for Antarctic Station Management & Resilient Remote Systems Engineering.
