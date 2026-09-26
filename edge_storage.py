"""
edge_storage.py - Phase 2 of the PolarSync edge layer.

Standalone, thread-safe SQLite buffer for edge telemetry and alerts.
Persists records locally during normal and offline operations, guaranteeing
priority-ordered retrieval (CRITICAL P1 -> MODERATE P2 -> NORMAL P3)
for central synchronization.
"""

import contextlib
import json
import os
from pathlib import Path
import sqlite3
import threading
import time
import uuid

SEVERITY_PRIORITY = {"CRITICAL": 1, "MODERATE": 2, "NORMAL": 3}
RECORD_TYPES = ("TELEMETRY", "ALERT")


def now() -> float:
    return time.time()


class EdgeStorage:
    def __init__(self, db_path=None):
        if db_path is None:
            base_dir = Path(__file__).resolve().parent / "data"
            base_dir.mkdir(parents=True, exist_ok=True)
            self.db_path = str(base_dir / "edge_buffer.db")
        else:
            p = Path(db_path).resolve()
            p.parent.mkdir(parents=True, exist_ok=True)
            self.db_path = str(p)

        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=5.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=5000;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        return conn

    def _init_db(self) -> None:
        with contextlib.closing(self._get_connection()) as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            with conn:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS telemetry_buffer (
                        id            INTEGER PRIMARY KEY AUTOINCREMENT,
                        record_uid    TEXT    NOT NULL UNIQUE,
                        station_id    TEXT    NOT NULL,
                        record_type   TEXT    NOT NULL,
                        severity      TEXT    NOT NULL,
                        priority      INTEGER NOT NULL,
                        payload       TEXT    NOT NULL,
                        tick_time     REAL    NOT NULL,
                        detected_at   REAL    NOT NULL,
                        buffered_at   REAL    NOT NULL,
                        sync_status   TEXT    NOT NULL DEFAULT 'PENDING',
                        synced_at     REAL
                    );
                    """
                )
                conn.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_pending_order
                        ON telemetry_buffer (sync_status, priority, tick_time, id);
                    """
                )
                conn.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_station
                        ON telemetry_buffer (station_id);
                    """
                )

    def insert_record(
        self,
        station_id: str,
        record_type: str,
        severity: str,
        payload,
        tick_time: float = None,
        detected_at: float = None,
    ) -> str:
        if severity not in SEVERITY_PRIORITY:
            raise ValueError(f"Invalid severity '{severity}'. Must be one of {list(SEVERITY_PRIORITY.keys())}")
        if record_type not in RECORD_TYPES:
            raise ValueError(f"Invalid record_type '{record_type}'. Must be one of {RECORD_TYPES}")

        priority = SEVERITY_PRIORITY[severity]
        current_time = time.time()
        t_time = current_time if tick_time is None else float(tick_time)
        d_time = current_time if detected_at is None else float(detected_at)
        b_time = current_time
        record_uid = uuid.uuid4().hex
        payload_json = json.dumps(payload, default=str)

        with contextlib.closing(self._get_connection()) as conn:
            with conn:
                conn.execute(
                    """
                    INSERT INTO telemetry_buffer (
                        record_uid, station_id, record_type, severity, priority,
                        payload, tick_time, detected_at, buffered_at, sync_status, synced_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)
                    """,
                    (
                        record_uid,
                        str(station_id),
                        record_type,
                        severity,
                        priority,
                        payload_json,
                        t_time,
                        d_time,
                        b_time,
                    ),
                )

        return record_uid

    def insert_many(self, records: list[dict]) -> list[str]:
        if not records:
            return []

        prepared = []
        uids = []
        current_time = time.time()

        # Validate all records before executing transaction
        for r in records:
            severity = r.get("severity")
            record_type = r.get("record_type")
            if severity not in SEVERITY_PRIORITY:
                raise ValueError(f"Invalid severity '{severity}'. Must be one of {list(SEVERITY_PRIORITY.keys())}")
            if record_type not in RECORD_TYPES:
                raise ValueError(f"Invalid record_type '{record_type}'. Must be one of {RECORD_TYPES}")

            priority = SEVERITY_PRIORITY[severity]
            t_time = current_time if r.get("tick_time") is None else float(r["tick_time"])
            d_time = current_time if r.get("detected_at") is None else float(r["detected_at"])
            b_time = current_time
            record_uid = uuid.uuid4().hex
            payload_json = json.dumps(r.get("payload"), default=str)

            prepared.append(
                (
                    record_uid,
                    str(r.get("station_id")),
                    record_type,
                    severity,
                    priority,
                    payload_json,
                    t_time,
                    d_time,
                    b_time,
                )
            )
            uids.append(record_uid)

        with contextlib.closing(self._get_connection()) as conn:
            with conn:
                conn.executemany(
                    """
                    INSERT INTO telemetry_buffer (
                        record_uid, station_id, record_type, severity, priority,
                        payload, tick_time, detected_at, buffered_at, sync_status, synced_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)
                    """,
                    prepared,
                )

        return uids

    def fetch_pending(self, limit: int = 100, max_priority: int = None, station_id: str = None) -> list[dict]:
        query = ["SELECT * FROM telemetry_buffer WHERE sync_status = 'PENDING'"]
        params = []

        if max_priority is not None:
            query.append("AND priority <= ?")
            params.append(int(max_priority))

        if station_id is not None:
            query.append("AND station_id = ?")
            params.append(str(station_id))

        query.append("ORDER BY priority ASC, tick_time ASC, id ASC LIMIT ?")
        params.append(int(limit))

        sql = " ".join(query)
        results = []

        with contextlib.closing(self._get_connection()) as conn:
            cursor = conn.execute(sql, params)
            for row in cursor.fetchall():
                d = dict(row)
                try:
                    d["payload"] = json.loads(d["payload"])
                except Exception:
                    pass
                results.append(d)

        return results

    def mark_synced(self, record_uids: list[str], synced_at: float = None) -> int:
        if not record_uids:
            return 0

        sync_time = time.time() if synced_at is None else float(synced_at)
        placeholders = ",".join("?" for _ in record_uids)
        sql = f"""
            UPDATE telemetry_buffer
            SET sync_status = 'SYNCED', synced_at = ?
            WHERE sync_status = 'PENDING' AND record_uid IN ({placeholders})
        """
        params = [sync_time] + list(record_uids)

        with contextlib.closing(self._get_connection()) as conn:
            with conn:
                cursor = conn.execute(sql, params)
                return cursor.rowcount

    def get_stats(self, station_id: str = None) -> dict:
        where_pending = ["sync_status = 'PENDING'"]
        where_synced = ["sync_status = 'SYNCED'"]
        params_pending = []
        params_synced = []

        if station_id is not None:
            where_pending.append("station_id = ?")
            params_pending.append(str(station_id))
            where_synced.append("station_id = ?")
            params_synced.append(str(station_id))

        sql_pending = f"""
            SELECT priority, COUNT(*) as cnt, MIN(buffered_at) as min_b
            FROM telemetry_buffer
            WHERE {" AND ".join(where_pending)}
            GROUP BY priority
        """

        sql_synced = f"""
            SELECT COUNT(*) as cnt
            FROM telemetry_buffer
            WHERE {" AND ".join(where_synced)}
        """

        pending_counts = {1: 0, 2: 0, 3: 0}
        oldest_buffered = None
        total_synced = 0

        with contextlib.closing(self._get_connection()) as conn:
            for row in conn.execute(sql_pending, params_pending).fetchall():
                p = row["priority"]
                if p in pending_counts:
                    pending_counts[p] = row["cnt"]
                if row["min_b"] is not None:
                    if oldest_buffered is None or row["min_b"] < oldest_buffered:
                        oldest_buffered = row["min_b"]

            synced_row = conn.execute(sql_synced, params_synced).fetchone()
            if synced_row and synced_row["cnt"]:
                total_synced = synced_row["cnt"]

        total_pending = sum(pending_counts.values())
        total_records = total_pending + total_synced

        db_size_bytes = 0
        if os.path.exists(self.db_path):
            try:
                db_size_bytes = os.path.getsize(self.db_path)
            except OSError:
                db_size_bytes = 0

        oldest_pending_age_s = (
            round(time.time() - oldest_buffered, 3) if oldest_buffered is not None else None
        )

        return {
            "pending": {
                "total": total_pending,
                "critical": pending_counts[1],
                "moderate": pending_counts[2],
                "normal": pending_counts[3],
            },
            "synced": {"total": total_synced},
            "total_records": total_records,
            "db_size_bytes": db_size_bytes,
            "oldest_pending_age_s": oldest_pending_age_s,
        }

    def get_history(self, limit: int = 20) -> list[dict]:
        """Fetch recent records for observability."""
        sql = """
            SELECT 
                record_uid as id,
                buffered_at as timestamp,
                station_id as station,
                record_type as type,
                priority,
                sync_status as status,
                severity
            FROM telemetry_buffer
            ORDER BY buffered_at DESC
            LIMIT ?
        """
        results = []
        with contextlib.closing(self._get_connection()) as conn:
            for row in conn.execute(sql, [limit]).fetchall():
                results.append(dict(row))
        return results

    def close(self):
        pass
