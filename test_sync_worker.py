"""
test_sync_worker.py - Unit tests for sync_worker.py (Step 4).

Tests:
  1. Online sync - pending records get synced and marked SYNCED
  2. Offline - no transmission; records remain PENDING
  3. Priority ordering - P1 before P2 before P3
  4. Network failure mid-batch - already-synced records preserved; rest stay PENDING
  5. Retry + backoff - failure increments backoff; retry succeeds
  6. Empty queue - worker stays idle without errors
  7. Idempotency - duplicate uid rejected by CentralStore
  8. Degraded - only P1+P2 fetched, P3 stays pending
"""

import os
import shutil
import tempfile
import threading
import time
import unittest

from edge_storage import EdgeStorage
from network_state import NetworkState, NetworkMode
from sync_worker import SyncWorker, CentralStore


def _make_store(tmp_dir):
    return EdgeStorage(db_path=os.path.join(tmp_dir, "test_sync.db"))


def _make_worker(store, net, central=None, interval_s=0.1, batch_size=20,
                 batch_degraded=5, max_backoff=2):
    c = central if central is not None else CentralStore()
    return SyncWorker(
        store, net, central=c,
        interval_s=interval_s,
        batch_size=batch_size,
        batch_degraded=batch_degraded,
        max_backoff=max_backoff,
    ), c


def _insert(store, severity="NORMAL", n=1):
    uids = []
    for _ in range(n):
        uid = store.insert_record(
            station_id="MAITRI",
            record_type="TELEMETRY",
            severity=severity,
            payload={"test": True},
        )
        uids.append(uid)
    return uids


class TestOnlineSync(unittest.TestCase):
    """1. Online sync - records sync and are marked SYNCED."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.ONLINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_records_synced_online(self):
        _insert(self.store, "NORMAL", 3)
        self.assertEqual(self.store.get_stats()["pending"]["total"], 3)

        worker, central = _make_worker(self.store, self.net, interval_s=0.05)
        worker.start()
        time.sleep(0.5)
        worker.stop()

        stats = self.store.get_stats()
        self.assertEqual(stats["pending"]["total"], 0, "All records should be SYNCED")
        self.assertEqual(stats["synced"]["total"], 3)
        self.assertEqual(central.stats()["total_received"], 3)


class TestOfflineMode(unittest.TestCase):
    """2. Offline - no transmission; records remain PENDING."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.OFFLINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_no_sync_when_offline(self):
        _insert(self.store, "CRITICAL", 2)
        worker, central = _make_worker(self.store, self.net, interval_s=0.05)
        worker.start()
        time.sleep(0.4)
        worker.stop()

        stats = self.store.get_stats()
        self.assertEqual(stats["pending"]["total"], 2, "Records must stay PENDING when OFFLINE")
        self.assertEqual(central.stats()["total_received"], 0)


class TestPriorityOrdering(unittest.TestCase):
    """3. Priority ordering - P1 before P2 before P3."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.OFFLINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_priority_order(self):
        # Insert in wrong order: P3, P1, P2, P1, P3
        self.store.insert_record("MAITRI", "TELEMETRY", "NORMAL", {"order": 1})
        time.sleep(0.01)
        self.store.insert_record("MAITRI", "ALERT", "CRITICAL", {"order": 2})
        time.sleep(0.01)
        self.store.insert_record("MAITRI", "ALERT", "MODERATE", {"order": 3})
        time.sleep(0.01)
        self.store.insert_record("MAITRI", "ALERT", "CRITICAL", {"order": 4})
        time.sleep(0.01)
        self.store.insert_record("MAITRI", "TELEMETRY", "NORMAL", {"order": 5})

        # Fetch without worker to verify order
        pending = self.store.fetch_pending(limit=10)
        priorities = [r["priority"] for r in pending]
        severities = [r["severity"] for r in pending]

        # Should be P1, P1, P2, P3, P3
        self.assertEqual(priorities, [1, 1, 2, 3, 3])
        self.assertEqual(severities[0], "CRITICAL")
        self.assertEqual(severities[1], "CRITICAL")
        self.assertEqual(severities[2], "MODERATE")

        # Now sync online and verify central received in priority order
        received_order = []
        central = CentralStore()
        _orig_receive = central.receive
        lock = threading.Lock()
        def recording_receive(record):
            with lock:
                received_order.append(record["priority"])
            return _orig_receive(record)
        central.receive = recording_receive

        self.net.set_mode(NetworkMode.ONLINE)
        worker, _ = _make_worker(self.store, self.net, central=central,
                                  interval_s=0.05, batch_size=10)
        worker.start()
        time.sleep(0.6)
        worker.stop()

        self.assertEqual(received_order, [1, 1, 2, 3, 3],
                         f"Expected [1,1,2,3,3] but got {received_order}")


class TestMidBatchNetworkFailure(unittest.TestCase):
    """4. Network failure mid-batch - synced records stay SYNCED; rest stay PENDING."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.ONLINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_mid_batch_offline(self):
        # Insert 6 records
        _insert(self.store, "CRITICAL", 3)
        _insert(self.store, "NORMAL", 3)

        call_count = [0]
        central = CentralStore()
        _orig_receive = central.receive

        def flaky_receive(record):
            call_count[0] += 1
            if call_count[0] == 3:
                # Go OFFLINE right when the 3rd record is about to sync
                self.net.set_mode(NetworkMode.OFFLINE, source="test")
            return _orig_receive(record)

        central.receive = flaky_receive

        worker, _ = _make_worker(self.store, self.net, central=central,
                                  interval_s=0.05, batch_size=10)
        worker.start()
        time.sleep(0.8)
        worker.stop()

        stats = self.store.get_stats()
        # At least 2 records should be SYNCED (the ones before OFFLINE)
        # Remaining should be PENDING (not deleted)
        total = stats["pending"]["total"] + stats["synced"]["total"]
        self.assertEqual(total, 6, "No records should be lost")
        self.assertGreater(stats["synced"]["total"], 0, "Some records should be SYNCED")
        self.assertGreater(stats["pending"]["total"], 0, "Some records should still be PENDING")


class TestRetryBackoff(unittest.TestCase):
    """5. Retry + back-off - failure increments backoff; retry succeeds."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.ONLINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_retry_after_failure(self):
        _insert(self.store, "CRITICAL", 1)

        fail_count = [0]
        central = CentralStore()
        _orig_receive = central.receive

        def failing_then_ok(record):
            fail_count[0] += 1
            if fail_count[0] <= 1:
                raise RuntimeError("simulated failure")
            return _orig_receive(record)

        central.receive = failing_then_ok

        worker, _ = _make_worker(self.store, self.net, central=central,
                                  interval_s=0.05, max_backoff=0.5)
        worker.start()
        time.sleep(1.5)
        worker.stop()

        stats = self.store.get_stats()
        self.assertEqual(stats["synced"]["total"], 1,
                         "Record should eventually sync after retry")
        self.assertEqual(stats["pending"]["total"], 0)
        metrics = worker.get_metrics()
        self.assertGreaterEqual(metrics["records_failed"], 1,
                                "Failure counter should have incremented")


class TestEmptyQueue(unittest.TestCase):
    """6. Empty queue - worker stays idle without errors."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.ONLINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_empty_queue_no_errors(self):
        worker, _ = _make_worker(self.store, self.net, interval_s=0.05)
        worker.start()
        time.sleep(0.4)
        worker.stop()

        metrics = worker.get_metrics()
        self.assertIsNone(metrics["last_error"], "No errors expected on empty queue")
        self.assertEqual(metrics["records_synced"], 0)
        self.assertGreater(metrics["cycles_run"], 1)


class TestIdempotency(unittest.TestCase):
    """7. Idempotency - CentralStore rejects duplicate record_uid."""

    def test_duplicate_rejected(self):
        c = CentralStore()
        record = {"record_uid": "abc123", "severity": "CRITICAL"}
        r1 = c.receive(record)
        r2 = c.receive(record)
        self.assertTrue(r1)
        self.assertFalse(r2, "Duplicate should be rejected")
        self.assertEqual(c.stats()["unique_records"], 1)
        self.assertEqual(c.stats()["total_received"], 1)


class TestDegradedMode(unittest.TestCase):
    """8. Degraded - only P1+P2 synced; P3 stays pending."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.DEGRADED)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_degraded_only_p1_p2(self):
        _insert(self.store, "CRITICAL", 2)
        _insert(self.store, "MODERATE", 2)
        _insert(self.store, "NORMAL", 3)   # P3 — must stay PENDING

        worker, central = _make_worker(
            self.store, self.net,
            interval_s=0.05, batch_degraded=10
        )
        worker.start()
        time.sleep(0.8)
        worker.stop()

        stats = self.store.get_stats()
        # P3 records must still be PENDING (degraded only syncs P1+P2)
        self.assertEqual(stats["pending"]["normal"], 3,
                         "P3 records must stay PENDING in DEGRADED mode")
        # P1+P2 should be synced
        self.assertEqual(stats["synced"]["total"], 4)

class TestRepeatedTransitions(unittest.TestCase):
    """9. Repeated ONLINE/OFFLINE transitions do not corrupt the queue."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.ONLINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_repeated_transitions(self):
        worker, central = _make_worker(self.store, self.net, interval_s=0.05, batch_size=2)
        worker.start()

        # Insert 10 records total
        for i in range(5):
            _insert(self.store, "NORMAL", 2)
            time.sleep(0.02)
            self.net.set_mode(NetworkMode.OFFLINE, source="test")
            time.sleep(0.02)
            self.net.set_mode(NetworkMode.ONLINE, source="test")
            time.sleep(0.02)
            
        time.sleep(0.5)
        worker.stop()

        stats = self.store.get_stats()
        self.assertEqual(stats["pending"]["total"], 0)
        self.assertEqual(stats["synced"]["total"], 10)
        self.assertEqual(central.stats()["total_received"], 10)


class TestDrainAfterStableOnline(unittest.TestCase):
    """10. Eventually all pending records drain after stable ONLINE connectivity."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.store = _make_store(self.tmp)
        self.net = NetworkState(NetworkMode.OFFLINE)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_drain_after_recovery(self):
        worker, central = _make_worker(self.store, self.net, interval_s=0.05, batch_size=5)
        worker.start()

        # Buffer 15 records while offline
        _insert(self.store, "CRITICAL", 5)
        _insert(self.store, "MODERATE", 5)
        _insert(self.store, "NORMAL", 5)

        time.sleep(0.2)
        stats = self.store.get_stats()
        self.assertEqual(stats["pending"]["total"], 15)
        self.assertEqual(central.stats()["total_received"], 0)

        # Recover network
        self.net.set_mode(NetworkMode.ONLINE, source="test")
        time.sleep(1.0)
        worker.stop()

        stats = self.store.get_stats()
        self.assertEqual(stats["pending"]["total"], 0)
        self.assertEqual(stats["synced"]["total"], 15)
        self.assertEqual(central.stats()["total_received"], 15)


if __name__ == "__main__":
    unittest.main(verbosity=2)
