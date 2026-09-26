"""
edge_pipeline.py - Phase 3 of the PolarSync edge layer.

For each simulation tick, runs the deterministic alert rules, maps them
to CRITICAL / MODERATE / NORMAL, tracks raise/clear events, samples
routine telemetry, and writes records to EdgeStorage.

Records are always written regardless of network mode. ONLINE/OFFLINE
only matters to the future sync worker.
"""

import copy
import threading
import time
from collections import deque

from edge_storage import EdgeStorage, SEVERITY_PRIORITY

# ── Severity mapping (single place, easy to edit) ────────────

# Default mapping from compute_alerts() severity strings to edge severity levels
ALERT_SEVERITY_MAP = {"CRITICAL": "CRITICAL", "HIGH": "MODERATE"}

# Per-alert-id overrides (life-safety alerts that must sync first)
ALERT_ID_OVERRIDES = {
    "medicine_critical": "CRITICAL",
    "resupply_critical": "CRITICAL",
}


def classify_alert(alert: dict) -> str:
    """Map one alert dict to an edge severity level.

    1. Per-id override wins.
    2. Else map by the alert's own severity string.
    3. Else (unknown/missing) → MODERATE (fail-safe: never NORMAL).
    """
    alert_id = alert.get("id", "")
    if alert_id in ALERT_ID_OVERRIDES:
        return ALERT_ID_OVERRIDES[alert_id]
    sev = alert.get("severity", "")
    return ALERT_SEVERITY_MAP.get(sev, "MODERATE")


# ── Alert event tracker ──────────────────────────────────────

class AlertTracker:
    """Tracks per-station active alerts and emits RAISED / CLEARED events.

    The diff method does NOT mutate state.  The caller commits state
    only after a successful write so a failed write is retried.
    """

    def __init__(self):
        # {station_id: {alert_id: mapped_severity}}
        self._active: dict[str, dict[str, str]] = {}

    def diff(self, station_id: str, current_alerts: list[dict]) -> tuple[list[dict], dict[str, str]]:
        """Return (events, new_state) without mutating internal state.

        Each event dict:
            {"event": "RAISED"|"CLEARED", "alert": {original alert dict},
             "mapped_severity": str}
        """
        prev = self._active.get(station_id, {})
        cur_map: dict[str, tuple[dict, str]] = {}
        for a in current_alerts:
            aid = a.get("id", "")
            mapped = classify_alert(a)
            cur_map[aid] = (a, mapped)

        events = []
        new_state: dict[str, str] = {}

        # RAISED or escalation
        for aid, (alert, mapped) in cur_map.items():
            new_state[aid] = mapped
            if aid not in prev:
                events.append({"event": "RAISED", "alert": alert, "mapped_severity": mapped})
            elif prev[aid] != mapped:
                # Escalation: severity changed → new RAISED with new severity
                events.append({"event": "RAISED", "alert": alert, "mapped_severity": mapped})

        # CLEARED: was active, now gone
        for aid, old_sev in prev.items():
            if aid not in cur_map:
                # Build a minimal alert dict for the cleared event
                cleared_alert = {"id": aid, "severity": old_sev, "message": f"Alert {aid} cleared"}
                events.append({"event": "CLEARED", "alert": cleared_alert, "mapped_severity": old_sev})

        return events, new_state

    def commit(self, station_id: str, new_state: dict[str, str]) -> None:
        """Persist the new active state after a successful write."""
        self._active[station_id] = new_state


# ── Pipeline ─────────────────────────────────────────────────

class EdgePipeline:
    def __init__(self, store, network_state, compute_alerts_fn,
                 normal_sample_every_n_ticks: int = 5):
        self._store: EdgeStorage = store
        self._network_state = network_state
        self._compute_alerts_fn = compute_alerts_fn
        self._sample_n = normal_sample_every_n_ticks
        self._tracker = AlertTracker()

        # Per-station tick counter for telemetry sampling
        self._tick_counts: dict[str, int] = {}

        # ── Metrics (guarded by lock) ────────────────────────
        self._lock = threading.Lock()
        self._ticks_processed = 0
        self._records_written = 0
        self._write_errors = 0
        self._last_error: str | None = None
        self._last_error_print_time = 0.0  # rate-limit error prints

        self._window_size = 100
        self._detection_ms_window: deque[float] = deque(maxlen=self._window_size)
        self._write_ms_window: deque[float] = deque(maxlen=self._window_size)

    def process_tick(self, station_id: str, data: dict, tick_time: float) -> dict:
        """Process one tick for one station. Never raises."""
        summary = {"events": 0, "telemetry_written": False, "records": 0}
        try:
            # 1. Run deterministic alert rules
            alerts = self._compute_alerts_fn(data) or []

            # 2. Classify and diff
            events, new_state = self._tracker.diff(station_id, alerts)

            # 3. Detection timestamp
            detected_at = time.time()
            detection_ms = (detected_at - tick_time) * 1000.0

            # 4. Determine network mode at this moment
            net_mode = self._network_state.get_mode().value

            # 5. Build records
            records = []

            for evt in events:
                records.append({
                    "station_id": str(station_id),
                    "record_type": "ALERT",
                    "severity": evt["mapped_severity"],
                    "payload": {
                        "network_mode_at_buffer": net_mode,
                        "event": evt["event"],
                        "alert": evt["alert"],
                        "mapped_severity": evt["mapped_severity"],
                        "snapshot": copy.deepcopy(data),
                    },
                    "tick_time": tick_time,
                    "detected_at": detected_at,
                })

            # Telemetry sampling
            sid_str = str(station_id)
            count = self._tick_counts.get(sid_str, 0) + 1
            self._tick_counts[sid_str] = count
            write_telemetry = (count == 1) or ((count - 1) % self._sample_n == 0)

            if write_telemetry:
                records.append({
                    "station_id": sid_str,
                    "record_type": "TELEMETRY",
                    "severity": "NORMAL",
                    "payload": {
                        "network_mode_at_buffer": net_mode,
                        "data": copy.deepcopy(data),
                    },
                    "tick_time": tick_time,
                    "detected_at": detected_at,
                })

            summary["events"] = len(events)
            summary["telemetry_written"] = write_telemetry
            summary["records"] = len(records)

            # 6. Write to storage
            write_ms = None
            if records:
                t0 = time.time()
                self._store.insert_many(records)
                t1 = time.time()
                write_ms = (t1 - t0) * 1000.0

            # 7. Commit tracker state on success
            self._tracker.commit(station_id, new_state)

            # 8. Update metrics
            with self._lock:
                self._ticks_processed += 1
                self._records_written += len(records)
                self._detection_ms_window.append(detection_ms)
                if write_ms is not None:
                    self._write_ms_window.append(write_ms)

        except Exception as exc:
            with self._lock:
                self._ticks_processed += 1
                self._write_errors += 1
                self._last_error = f"{type(exc).__name__}: {exc}"

            # Rate-limited error logging (at most once per 30s)
            now = time.time()
            if now - self._last_error_print_time >= 30.0:
                self._last_error_print_time = now
                print(f"[edge_pipeline] write error: {exc}", flush=True)

        return summary

    def get_metrics(self) -> dict:
        with self._lock:
            det_list = list(self._detection_ms_window)
            wr_list = list(self._write_ms_window)
            return {
                "ticks_processed": self._ticks_processed,
                "records_written": self._records_written,
                "write_errors": self._write_errors,
                "last_error": self._last_error,
                "detection_ms": _window_stats(det_list),
                "write_ms": _window_stats(wr_list),
                "window_size": self._window_size,
            }


def _window_stats(values: list[float]) -> dict:
    if not values:
        return {"last": None, "avg": None, "max": None}
    return {
        "last": round(values[-1], 3),
        "avg": round(sum(values) / len(values), 3),
        "max": round(max(values), 3),
    }
