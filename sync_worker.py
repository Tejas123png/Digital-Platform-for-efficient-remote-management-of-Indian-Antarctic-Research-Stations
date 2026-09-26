"""
sync_worker.py - Phase 4 of the PolarSync edge layer.

Priority-based background sync worker: reads PENDING records from the
local SQLite edge buffer (edge_storage.py) and transmits them to the
central store when the network allows it.

  ONLINE    -> full batch (SYNC_BATCH_SIZE), all priorities
  DEGRADED  -> throttled batch (SYNC_BATCH_DEGRADED), P1+P2 only
  OFFLINE   -> no transmission; buffer grows until connectivity returns

Transmission is idempotent by record_uid: the central store rejects
duplicate UIDs with a no-op, so a delayed/lost ACK that triggers a
retry can never duplicate data.

A record is only marked SYNCED *after* the central store has confirmed
receipt.  Failed records stay PENDING and are retried with exponential
back-off.

Configuration (environment variables, all optional):
  SYNC_INTERVAL          - seconds between worker cycles (default 3)
  SYNC_BATCH_SIZE        - records per cycle in ONLINE mode (default 20)
  SYNC_BATCH_DEGRADED    - records per cycle in DEGRADED mode (default 5)
  SYNC_MAX_BACKOFF       - maximum back-off seconds (default 32)
"""

import os
import threading
import time
from collections import deque
from typing import Optional

from edge_storage import EdgeStorage
from network_state import NetworkState, NetworkMode


# ---- Configuration ----------------------------------------------------------

def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (ValueError, TypeError):
        return default


SYNC_INTERVAL       = _int_env("SYNC_INTERVAL", 3)
SYNC_BATCH_SIZE     = _int_env("SYNC_BATCH_SIZE", 20)
SYNC_BATCH_DEGRADED = _int_env("SYNC_BATCH_DEGRADED", 5)
SYNC_MAX_BACKOFF    = _int_env("SYNC_MAX_BACKOFF", 32)


# ---- Central store (in-process, thread-safe) --------------------------------
#
# No external Supabase/REST/PostgreSQL is configured in this prototype.
# We use an in-process "central store" (RAM dict) so we can demonstrate
# the full sync lifecycle without network infrastructure.
#
# A real deployment would replace CentralStore.receive() with an
# authenticated HTTPS call to the production central API.

class CentralStore:
    """In-memory central store.  Thread-safe.  Idempotent by record_uid."""

    def __init__(self):
        self._lock = threading.Lock()
        self._records: dict = {}   # uid -> record
        self._total_received = 0
        
        # Simulated failure controls (Step 5)
        self._simulate_failures_remaining = 0
        self._simulate_latency_s = 0.0

    def inject_failures(self, count: int) -> None:
        """Force the next `count` calls to receive() to fail."""
        with self._lock:
            self._simulate_failures_remaining = count

    def set_latency(self, latency_s: float) -> None:
        """Introduce artificial delay for each receive() call."""
        with self._lock:
            self._simulate_latency_s = latency_s

    def receive(self, record: dict) -> bool:
        """
        Accept one record.  Returns True if new, False if duplicate.
        Never raises under normal operation (raises for injected failures).
        """
        # Read simulation parameters
        with self._lock:
            failures = self._simulate_failures_remaining
            latency = self._simulate_latency_s
            if self._simulate_failures_remaining > 0:
                self._simulate_failures_remaining -= 1
        
        # Apply simulated latency
        if latency > 0:
            time.sleep(latency)
            
        # Apply simulated failure
        if failures > 0:
            print("[SYNC] Transmission failure injected", flush=True)
            raise RuntimeError("Simulated transmission failure injected")

        uid = record.get("record_uid", "")
        with self._lock:
            if uid in self._records:
                return False
            self._records[uid] = record
            self._total_received += 1
            return True

    def stats(self) -> dict:
        with self._lock:
            return {
                "total_received": self._total_received,
                "unique_records": len(self._records),
                "injected_failures_remaining": self._simulate_failures_remaining,
                "latency_s": self._simulate_latency_s,
            }


# Module-level singleton imported by data_simulator.py
central_store = CentralStore()


# ---- Sync Worker ------------------------------------------------------------

class SyncWorker:
    """
    Background daemon thread that drains the local SQLite edge buffer
    into the central store, respecting network mode and using exponential
    back-off on failure.

    Usage:
        worker = SyncWorker(edge_store, network_state)
        worker.start()
        worker.get_metrics()
        worker.stop()
    """

    def __init__(
        self,
        store: EdgeStorage,
        network_state: NetworkState,
        central: CentralStore = None,
        interval_s: float = SYNC_INTERVAL,
        batch_size: int = SYNC_BATCH_SIZE,
        batch_degraded: int = SYNC_BATCH_DEGRADED,
        max_backoff: float = SYNC_MAX_BACKOFF,
    ):
        self._store = store
        self._net = network_state
        self._central = central if central is not None else central_store
        self._interval = interval_s
        self._batch_size = batch_size
        self._batch_degraded = batch_degraded
        self._max_backoff = max_backoff

        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

        # Metrics (lock-protected)
        self._lock = threading.Lock()
        self._cycles_run = 0
        self._records_synced = 0
        self._records_failed = 0
        self._last_sync_at: Optional[float] = None
        self._last_error: Optional[str] = None
        self._current_backoff = 0.0
        self._consecutive_failures = 0
        self._last_log_key: str = ""
        self._history: deque = deque(maxlen=50)

        # Wake immediately when network changes to a sync-capable mode
        self._wake_event = threading.Event()
        self._net.on_change(self._on_network_change)

    # ---- Public interface ---------------------------------------------------

    def start(self) -> None:
        """Start the daemon worker thread (idempotent)."""
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run,
            name="SyncWorker",
            daemon=True,
        )
        self._thread.start()
        print("[SYNC] Worker started", flush=True)

    def stop(self, timeout: float = 5.0) -> None:
        self._stop_event.set()
        self._wake_event.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)
        print("[SYNC] Worker stopped", flush=True)

    def get_metrics(self) -> dict:
        with self._lock:
            cycles_run = self._cycles_run
            records_synced = self._records_synced
            records_failed = self._records_failed
            last_sync_at = self._last_sync_at
            last_error = self._last_error
            current_backoff = self._current_backoff
            consecutive_failures = self._consecutive_failures
            history = list(self._history)
            
        worker_running = self._thread is not None and self._thread.is_alive()
        
        # Try to get edge_store pending count for convenience
        pending_count = 0
        synced_count = 0
        try:
            stats = self._store.get_stats()
            pending_count = stats["pending"]["total"]
            synced_count = stats["synced"]["total"]
        except Exception:
            pass

        return {
            "network_mode":         self._net.get_mode().value,
            "worker_running":       worker_running,
            "pending_count":        pending_count,
            "synced_count":         synced_count,
            "cycles_run":           cycles_run,
            "records_synced":       records_synced,
            "records_failed":       records_failed,
            "last_sync_at":         last_sync_at,
            "last_error":           last_error,
            "backoff_seconds":      round(current_backoff, 1),
            "retry_count":          consecutive_failures,
            "history":              history,
            "central":              self._central.stats(),
        }

    # ---- Network listener --------------------------------------------------

    def _on_network_change(self, old_mode: NetworkMode, new_mode: NetworkMode) -> None:
        print(f"[RESILIENCE] Network changed: {old_mode.value} -> {new_mode.value}", flush=True)
        if new_mode != NetworkMode.OFFLINE:
            self._wake_event.set()

    # ---- Main loop ---------------------------------------------------------

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._cycle()
            except Exception as exc:
                with self._lock:
                    self._last_error = f"cycle error: {type(exc).__name__}: {exc}"
                print(f"[SYNC] Unhandled cycle error: {exc}", flush=True)
            self._wake_event.clear()
            sleep_s = self._current_backoff if self._current_backoff > 0 else self._interval
            self._wake_event.wait(timeout=sleep_s)

    def _cycle(self) -> None:
        mode = self._net.get_mode()
        with self._lock:
            self._cycles_run += 1

        if mode == NetworkMode.OFFLINE:
            self._log_once("offline", "[SYNC] Transmission paused -- network offline, records remain buffered")
            return

        if mode == NetworkMode.DEGRADED:
            batch = self._batch_degraded
            max_prio = 2
            self._log_once("degraded", f"[SYNC] Degraded mode -- P3 records held, throttled batch={batch}")
        else:
            batch = self._batch_size
            max_prio = None
            self._log_once("online", "[SYNC] Network ONLINE -- checking pending records")

        pending = self._store.fetch_pending(limit=batch, max_priority=max_prio)

        if not pending:
            self._log_once("empty", "[SYNC] Buffer drained -- 0 pending records")
            self._reset_backoff()
            return

        # New non-empty batch: reset dedup key so mode log appears again next cycle
        with self._lock:
            self._last_log_key = ""

        print(f"[SYNC] Found {len(pending)} pending record(s) -- syncing ...", flush=True)

        synced_uids = []
        failed = 0

        for record in pending:
            # Safety: re-check network before each record
            if self._net.get_mode() == NetworkMode.OFFLINE:
                print("[SYNC] Network went OFFLINE mid-batch -- stopping; synced records preserved", flush=True)
                break

            uid = record["record_uid"]
            sev = record.get("severity", "?")
            prio = record.get("priority", "?")

            try:
                accepted = self._central.receive(record)
                if accepted:
                    print(f"[SYNC] Synced  P{prio}/{sev}  uid={uid[:12]}...", flush=True)
                else:
                    print(f"[SYNC] Dup/skip P{prio}/{sev}  uid={uid[:12]}... (already at central)", flush=True)
                synced_uids.append(uid)

            except Exception as exc:
                failed += 1
                err_msg = f"{type(exc).__name__}: {exc}"
                print(f"[SYNC] Sync failed  uid={uid[:12]}...  error={err_msg}", flush=True)
                with self._lock:
                    self._records_failed += 1
                    self._last_error = err_msg
                break

        # Mark synced ONLY after successful central receipt
        if synced_uids:
            count = self._store.mark_synced(synced_uids)
            with self._lock:
                self._records_synced += count
                self._last_sync_at = time.time()
            with self._lock:
                self._history.append({
                    "at": time.time(),
                    "event": "sync",
                    "synced": count,
                    "failed": failed,
                    "mode": mode.value,
                })
            
            try:
                pending_count = self._store.get_stats()["pending"]["total"]
                print(f"[EDGE] Buffered records remaining: {pending_count}", flush=True)
            except Exception:
                pass

        if failed > 0:
            self._increment_backoff()
            print(f"[SYNC] Retry scheduled in {self._current_backoff:.0f} seconds", flush=True)
        else:
            self._reset_backoff()

    # ---- Back-off ----------------------------------------------------------

    def _reset_backoff(self) -> None:
        with self._lock:
            self._current_backoff = 0.0
            self._consecutive_failures = 0

    def _increment_backoff(self) -> None:
        with self._lock:
            self._consecutive_failures += 1
            self._current_backoff = min(2 ** self._consecutive_failures, self._max_backoff)

    # ---- Utilities ---------------------------------------------------------

    def _log_once(self, key: str, message: str) -> None:
        with self._lock:
            if self._last_log_key == key:
                return
            self._last_log_key = key
        print(message, flush=True)
