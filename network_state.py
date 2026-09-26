"""
network_state.py - Phase 1 of the PolarSync edge layer.

Single source of truth for the simulated uplink between the station
(edge) and the central system. It does NOT stop local processing; it
only says whether the sync worker is allowed to send data centrally.

    ONLINE    -> sync everything (P1, then P2, then P3)
    DEGRADED  -> sync only critical + moderate, throttled (defined in the sync step)
    OFFLINE   -> no central sync; edge keeps detecting and buffering
"""
import threading
import time
from enum import Enum


class NetworkMode(str, Enum):
    ONLINE = "ONLINE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"


class NetworkState:
    def __init__(self, mode: NetworkMode = NetworkMode.ONLINE):
        self._lock = threading.Lock()
        self._mode = mode
        self._since = time.time()
        self._history = []      # list of dicts, newest last
        self._listeners = []    # callbacks: fn(old_mode, new_mode)

    # ---- reads ----
    def get_mode(self) -> NetworkMode:
        with self._lock:
            return self._mode

    def can_sync(self) -> bool:
        return self.get_mode() != NetworkMode.OFFLINE

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "mode": self._mode.value,
                "since": self._since,
                "seconds_in_mode": round(time.time() - self._since, 1),
                "edge_mode_active": self._mode == NetworkMode.OFFLINE,
                "recent_changes": self._history[-10:],
            }

    # ---- writes ----
    def set_mode(self, new_mode: NetworkMode, source: str = "manual") -> bool:
        """Returns True if the mode actually changed."""
        with self._lock:
            old = self._mode
            if new_mode == old:
                return False
            self._mode = new_mode
            self._since = time.time()
            self._history.append({
                "at": self._since,
                "from": old.value,
                "to": new_mode.value,
                "source": source,
            })
            listeners = list(self._listeners)
        # call listeners outside the lock so they can safely read state
        for fn in listeners:
            try:
                fn(old, new_mode)
            except Exception as exc:  # a bad listener must never break the sim
                print(f"[network_state] listener error: {exc}")
        return True

    def on_change(self, callback) -> None:
        """Register fn(old_mode, new_mode). The sync worker will use this later."""
        with self._lock:
            self._listeners.append(callback)


# module-level singleton, import this everywhere
network_state = NetworkState()
