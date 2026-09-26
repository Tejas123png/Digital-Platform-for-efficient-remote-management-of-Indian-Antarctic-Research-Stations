"""
test_edge_storage.py - Unit tests for edge_storage.py.
"""

import os
import shutil
import tempfile
import threading
import time
import unittest

from edge_storage import EdgeStorage, SEVERITY_PRIORITY


class TestEdgeStorage(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test_buffer.db")
        self.storage = EdgeStorage(self.db_path)

    def tearDown(self):
        self.storage.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_01_ordering(self):
        """1. Ordering: fetch_pending returns CRITICAL first (oldest first), then MODERATE, then NORMAL."""
        t0 = time.time()
        # Insert in mixed order with strictly increasing tick_time
        self.storage.insert_record("MAITRI", "TELEMETRY", "NORMAL", {"v": 1}, tick_time=t0 + 1)
        self.storage.insert_record("MAITRI", "ALERT", "CRITICAL", {"v": 2}, tick_time=t0 + 2)
        self.storage.insert_record("MAITRI", "TELEMETRY", "MODERATE", {"v": 3}, tick_time=t0 + 3)
        self.storage.insert_record("MAITRI", "TELEMETRY", "NORMAL", {"v": 4}, tick_time=t0 + 4)
        self.storage.insert_record("MAITRI", "ALERT", "CRITICAL", {"v": 5}, tick_time=t0 + 5)

        records = self.storage.fetch_pending(limit=10)
        self.assertEqual(len(records), 5)
        # Expected priorities: 1 (CRITICAL), 1 (CRITICAL), 2 (MODERATE), 3 (NORMAL), 3 (NORMAL)
        priorities = [r["priority"] for r in records]
        self.assertEqual(priorities, [1, 1, 2, 3, 3])

        # Within CRITICAL (priority 1), oldest first
        self.assertEqual(records[0]["payload"]["v"], 2)
        self.assertEqual(records[1]["payload"]["v"], 5)

        # Within NORMAL (priority 3), oldest first
        self.assertEqual(records[3]["payload"]["v"], 1)
        self.assertEqual(records[4]["payload"]["v"], 4)

    def test_02_priority_derived(self):
        """2. Priority derived: CRITICAL -> 1, MODERATE -> 2, NORMAL -> 3."""
        u1 = self.storage.insert_record("MAITRI", "ALERT", "CRITICAL", {})
        u2 = self.storage.insert_record("MAITRI", "TELEMETRY", "MODERATE", {})
        u3 = self.storage.insert_record("MAITRI", "TELEMETRY", "NORMAL", {})

        records = {r["record_uid"]: r["priority"] for r in self.storage.fetch_pending()}
        self.assertEqual(records[u1], 1)
        self.assertEqual(records[u2], 2)
        self.assertEqual(records[u3], 3)

    def test_03_validation(self):
        """3. Validation: bad severity and bad record_type raise ValueError; nothing written."""
        with self.assertRaises(ValueError):
            self.storage.insert_record("MAITRI", "TELEMETRY", "INVALID_SEV", {})
        with self.assertRaises(ValueError):
            self.storage.insert_record("MAITRI", "INVALID_TYPE", "CRITICAL", {})

        stats = self.storage.get_stats()
        self.assertEqual(stats["total_records"], 0)

    def test_04_payload_round_trip(self):
        """4. Payload round trip: nested dict comes back identical after fetch."""
        complex_payload = {
            "station": "BHARATI",
            "metrics": {"temperature": -15.4, "battery_soc": 89.2},
            "alerts": [{"id": "fuel_low", "active": True}],
            "count": 42,
        }
        uid = self.storage.insert_record("BHARATI", "TELEMETRY", "NORMAL", complex_payload)
        records = self.storage.fetch_pending()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["record_uid"], uid)
        self.assertEqual(records[0]["payload"], complex_payload)

    def test_05_mark_synced(self):
        """5. mark_synced: marks only given uids, returns count, marked rows no longer pending, repeat returns 0."""
        u1 = self.storage.insert_record("MAITRI", "ALERT", "CRITICAL", {"v": 1})
        u2 = self.storage.insert_record("MAITRI", "TELEMETRY", "NORMAL", {"v": 2})

        # Mark only u1
        updated = self.storage.mark_synced([u1])
        self.assertEqual(updated, 1)

        pending = self.storage.fetch_pending()
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["record_uid"], u2)

        # Repeating mark_synced on u1 should return 0
        updated_again = self.storage.mark_synced([u1])
        self.assertEqual(updated_again, 0)

    def test_06_max_priority_filter(self):
        """6. max_priority filter: max_priority=2 returns no NORMAL (priority 3) rows."""
        self.storage.insert_record("MAITRI", "ALERT", "CRITICAL", {})
        self.storage.insert_record("MAITRI", "TELEMETRY", "MODERATE", {})
        self.storage.insert_record("MAITRI", "TELEMETRY", "NORMAL", {})

        p1_and_p2 = self.storage.fetch_pending(max_priority=2)
        self.assertEqual(len(p1_and_p2), 2)
        priorities = {r["priority"] for r in p1_and_p2}
        self.assertEqual(priorities, {1, 2})

    def test_07_stats(self):
        """7. Stats: counts per priority correct before/after mark_synced, db_size_bytes > 0, oldest_pending_age_s."""
        stats0 = self.storage.get_stats()
        self.assertEqual(stats0["pending"]["total"], 0)
        self.assertIsNone(stats0["oldest_pending_age_s"])

        u_crit = self.storage.insert_record("MAITRI", "ALERT", "CRITICAL", {})
        self.storage.insert_record("MAITRI", "TELEMETRY", "MODERATE", {})
        self.storage.insert_record("MAITRI", "TELEMETRY", "NORMAL", {})

        stats1 = self.storage.get_stats()
        self.assertEqual(stats1["pending"]["total"], 3)
        self.assertEqual(stats1["pending"]["critical"], 1)
        self.assertEqual(stats1["pending"]["moderate"], 1)
        self.assertEqual(stats1["pending"]["normal"], 1)
        self.assertEqual(stats1["synced"]["total"], 0)
        self.assertGreater(stats1["db_size_bytes"], 0)
        self.assertIsNotNone(stats1["oldest_pending_age_s"])
        self.assertGreaterEqual(stats1["oldest_pending_age_s"], 0)

        # Mark critical as synced
        self.storage.mark_synced([u_crit])
        stats2 = self.storage.get_stats()
        self.assertEqual(stats2["pending"]["total"], 2)
        self.assertEqual(stats2["pending"]["critical"], 0)
        self.assertEqual(stats2["synced"]["total"], 1)
        self.assertEqual(stats2["total_records"], 3)

    def test_08_persistence(self):
        """8. Persistence: create new EdgeStorage on same file path; pending rows are preserved."""
        u1 = self.storage.insert_record("MAITRI", "ALERT", "CRITICAL", {"test": "persisted"})
        self.storage.close()

        # Reopen on same db_path
        storage2 = EdgeStorage(self.db_path)
        pending = storage2.fetch_pending()
        self.assertEqual(len(pending), 1)
        self.assertEqual(pending[0]["record_uid"], u1)
        self.assertEqual(pending[0]["payload"], {"test": "persisted"})
        storage2.close()

    def test_09_concurrency(self):
        """9. Concurrency: 4 writer threads each inserting 200 records while 1 reader thread calls fetch_pending & get_stats."""
        records_per_thread = 200
        num_writers = 4
        errors = []
        stop_reader = threading.Event()

        def writer_fn(thread_id):
            try:
                for i in range(records_per_thread):
                    sev = "CRITICAL" if i % 3 == 0 else ("MODERATE" if i % 3 == 1 else "NORMAL")
                    self.storage.insert_record(
                        station_id=f"STATION_{thread_id}",
                        record_type="TELEMETRY",
                        severity=sev,
                        payload={"i": i, "t": thread_id},
                    )
            except Exception as e:
                errors.append(f"Writer error: {e}")

        def reader_fn():
            try:
                while not stop_reader.is_set():
                    self.storage.fetch_pending(limit=20)
                    self.storage.get_stats()
                    time.sleep(0.005)
            except Exception as e:
                errors.append(f"Reader error: {e}")

        reader_thread = threading.Thread(target=reader_fn, daemon=True)
        reader_thread.start()

        writers = [threading.Thread(target=writer_fn, args=(w,)) for w in range(num_writers)]
        for w in writers:
            w.start()
        for w in writers:
            w.join()

        stop_reader.set()
        reader_thread.join(timeout=2.0)

        self.assertEqual(len(errors), 0, f"Concurrency errors occurred: {errors}")
        stats = self.storage.get_stats()
        self.assertEqual(stats["total_records"], num_writers * records_per_thread)
        self.assertEqual(stats["pending"]["total"], num_writers * records_per_thread)

    def test_10_insert_many_atomicity(self):
        """10. insert_many atomicity: a batch containing one invalid record raises and writes zero rows."""
        batch = [
            {"station_id": "MAITRI", "record_type": "TELEMETRY", "severity": "NORMAL", "payload": {}},
            {"station_id": "MAITRI", "record_type": "TELEMETRY", "severity": "INVALID_SEV", "payload": {}},
            {"station_id": "MAITRI", "record_type": "TELEMETRY", "severity": "NORMAL", "payload": {}},
        ]
        with self.assertRaises(ValueError):
            self.storage.insert_many(batch)

        stats = self.storage.get_stats()
        self.assertEqual(stats["total_records"], 0)

    def test_11_duplicate_uid_safety(self):
        """11. Duplicate uid safety: two inserts never generate the same record_uid."""
        uids = set()
        for _ in range(100):
            uid = self.storage.insert_record("MAITRI", "TELEMETRY", "NORMAL", {})
            self.assertNotIn(uid, uids)
            uids.add(uid)


if __name__ == "__main__":
    unittest.main()
