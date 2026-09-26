"""
test_edge_pipeline.py - Unit tests for edge_pipeline.py.
"""

import copy
import os
import shutil
import tempfile
import time
import unittest

from edge_storage import EdgeStorage
from edge_pipeline import (
    EdgePipeline,
    classify_alert,
    AlertTracker,
    ALERT_SEVERITY_MAP,
    ALERT_ID_OVERRIDES,
)
from network_state import NetworkState, NetworkMode


def _make_pipeline(store, net_state=None, alerts_fn=None, sample_n=5):
    """Helper to build a pipeline with sensible defaults for tests."""
    if net_state is None:
        net_state = NetworkState()
    if alerts_fn is None:
        alerts_fn = lambda d: []
    return EdgePipeline(store, net_state, alerts_fn, normal_sample_every_n_ticks=sample_n)


class TestClassification(unittest.TestCase):
    """1. classify_alert mapping tests."""

    def test_critical_to_critical(self):
        self.assertEqual(classify_alert({"id": "battery_critical", "severity": "CRITICAL"}), "CRITICAL")

    def test_high_to_moderate(self):
        self.assertEqual(classify_alert({"id": "fuel_low", "severity": "HIGH"}), "MODERATE")

    def test_medicine_override(self):
        # medicine_critical has severity HIGH but is overridden to CRITICAL
        self.assertEqual(classify_alert({"id": "medicine_critical", "severity": "HIGH"}), "CRITICAL")

    def test_unknown_severity_to_moderate(self):
        self.assertEqual(classify_alert({"id": "foo", "severity": "UNKNOWN"}), "MODERATE")

    def test_missing_severity_to_moderate(self):
        self.assertEqual(classify_alert({"id": "bar"}), "MODERATE")


class TestTelemetrySampling(unittest.TestCase):
    """2. Normal telemetry sampling with N=5."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_sampling_rate(self):
        pipeline = _make_pipeline(self.store, sample_n=5)
        t0 = time.time()
        for i in range(10):
            pipeline.process_tick("MAITRI", {"tick": i}, t0 + i)

        records = self.store.fetch_pending(limit=100)
        telem = [r for r in records if r["record_type"] == "TELEMETRY"]
        # Ticks 1 and 6 → exactly 2 telemetry records
        self.assertEqual(len(telem), 2)
        for r in telem:
            self.assertEqual(r["severity"], "NORMAL")
            self.assertEqual(r["priority"], 3)


class TestRaisedOnlyOnce(unittest.TestCase):
    """3. An alert present for 6 consecutive ticks produces exactly 1 RAISED."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_single_raised(self):
        alert = [{"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"}]
        pipeline = _make_pipeline(self.store, alerts_fn=lambda d: alert, sample_n=999)
        t0 = time.time()
        for i in range(6):
            pipeline.process_tick("MAITRI", {}, t0 + i)

        records = self.store.fetch_pending(limit=100)
        alert_records = [r for r in records if r["record_type"] == "ALERT"]
        raised = [r for r in alert_records if r["payload"]["event"] == "RAISED"]
        self.assertEqual(len(raised), 1)


class TestCleared(unittest.TestCase):
    """4. When an alert disappears, exactly 1 CLEARED record is written with same severity."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_cleared_event(self):
        alert = [{"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"}]
        current_alerts = list(alert)
        pipeline = _make_pipeline(self.store, alerts_fn=lambda d: current_alerts, sample_n=999)
        t0 = time.time()

        # Tick 1: alert active → RAISED
        pipeline.process_tick("MAITRI", {}, t0)
        # Tick 2: still active
        pipeline.process_tick("MAITRI", {}, t0 + 1)
        # Tick 3: alert clears
        current_alerts.clear()
        pipeline.process_tick("MAITRI", {}, t0 + 2)

        records = self.store.fetch_pending(limit=100)
        alert_records = [r for r in records if r["record_type"] == "ALERT"]
        cleared = [r for r in alert_records if r["payload"]["event"] == "CLEARED"]
        self.assertEqual(len(cleared), 1)
        # CLEARED severity matches the RAISED severity (MODERATE for HIGH)
        self.assertEqual(cleared[0]["severity"], "MODERATE")


class TestEscalation(unittest.TestCase):
    """5. Same alert id changing HIGH→CRITICAL produces new RAISED with CRITICAL."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_escalation(self):
        current_alerts = [{"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"}]
        pipeline = _make_pipeline(self.store, alerts_fn=lambda d: current_alerts, sample_n=999)
        t0 = time.time()

        # Tick 1: HIGH → MODERATE raised
        pipeline.process_tick("MAITRI", {}, t0)
        # Tick 2: escalate to CRITICAL
        current_alerts[0] = {"id": "fuel_low", "severity": "CRITICAL", "message": "Fuel critical"}
        pipeline.process_tick("MAITRI", {}, t0 + 1)

        records = self.store.fetch_pending(limit=100)
        alert_records = [r for r in records if r["record_type"] == "ALERT"]
        raised = [r for r in alert_records if r["payload"]["event"] == "RAISED"]
        self.assertEqual(len(raised), 2)
        # Sort by tick_time to get chronological order (fetch_pending orders by priority)
        raised.sort(key=lambda r: r["tick_time"])
        # First raised is MODERATE (from HIGH), second is CRITICAL (escalation)
        self.assertEqual(raised[0]["severity"], "MODERATE")
        self.assertEqual(raised[0]["priority"], 2)
        self.assertEqual(raised[1]["severity"], "CRITICAL")
        self.assertEqual(raised[1]["priority"], 1)


class TestStationIndependence(unittest.TestCase):
    """6. Same alert id on two stations tracked separately."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_independence(self):
        alert = [{"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"}]
        pipeline = _make_pipeline(self.store, alerts_fn=lambda d: alert, sample_n=999)
        t0 = time.time()

        pipeline.process_tick("MAITRI", {}, t0)
        pipeline.process_tick("BHARATI", {}, t0 + 1)

        records = self.store.fetch_pending(limit=100)
        alert_records = [r for r in records if r["record_type"] == "ALERT"]
        raised = [r for r in alert_records if r["payload"]["event"] == "RAISED"]
        # Each station gets its own RAISED
        self.assertEqual(len(raised), 2)
        stations = {r["station_id"] for r in raised}
        self.assertEqual(stations, {"MAITRI", "BHARATI"})


class TestPriorityInDB(unittest.TestCase):
    """7. Priority ordering in DB: CRITICAL before MODERATE before TELEMETRY."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_fetch_order(self):
        current_alerts = []
        pipeline = _make_pipeline(self.store, alerts_fn=lambda d: current_alerts, sample_n=1)
        t0 = time.time()

        # Tick 1: no alerts, writes TELEMETRY (NORMAL, P3)
        pipeline.process_tick("MAITRI", {}, t0)
        # Tick 2: HIGH alert (→ MODERATE, P2)
        current_alerts.append({"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"})
        pipeline.process_tick("MAITRI", {}, t0 + 1)
        # Tick 3: CRITICAL alert (→ CRITICAL, P1)
        current_alerts.append({"id": "battery_critical", "severity": "CRITICAL", "message": "Battery critical"})
        pipeline.process_tick("MAITRI", {}, t0 + 2)

        records = self.store.fetch_pending(limit=100)
        priorities = [r["priority"] for r in records]
        # CRITICAL (1) should come before MODERATE (2) before NORMAL (3)
        self.assertEqual(priorities, sorted(priorities))
        self.assertIn(1, priorities)
        self.assertIn(2, priorities)
        self.assertIn(3, priorities)


class TestNetworkModeRecorded(unittest.TestCase):
    """8. OFFLINE mode is recorded in payloads and buffering still works."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_offline_mode_in_payload(self):
        net_state = NetworkState(NetworkMode.OFFLINE)
        alert = [{"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"}]
        pipeline = _make_pipeline(self.store, net_state=net_state, alerts_fn=lambda d: alert, sample_n=1)
        t0 = time.time()
        pipeline.process_tick("MAITRI", {"v": 1}, t0)

        records = self.store.fetch_pending(limit=100)
        self.assertGreater(len(records), 0)
        for r in records:
            self.assertEqual(r["payload"]["network_mode_at_buffer"], "OFFLINE")


class TestFailureIsolation(unittest.TestCase):
    """9. Store failure: process_tick does not raise, write_errors increments,
    tracker not committed so event retries on next tick."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_failure_and_retry(self):
        class BrokenStore:
            def insert_many(self, records):
                raise RuntimeError("disk on fire")
            def get_stats(self, **kw):
                return {}

        alert = [{"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"}]
        pipeline = _make_pipeline(BrokenStore(), alerts_fn=lambda d: alert, sample_n=999)
        t0 = time.time()

        # Tick 1: fails, but no exception raised
        result = pipeline.process_tick("MAITRI", {}, t0)
        # Should not raise
        self.assertIsInstance(result, dict)

        metrics = pipeline.get_metrics()
        self.assertEqual(metrics["write_errors"], 1)

        # Now switch to a working store — the RAISED event should appear
        # because the tracker was not committed.
        real_store = EdgeStorage(self.db_path)
        pipeline._store = real_store
        pipeline.process_tick("MAITRI", {}, t0 + 1)

        records = real_store.fetch_pending(limit=100)
        raised = [r for r in records if r["record_type"] == "ALERT" and r["payload"]["event"] == "RAISED"]
        self.assertEqual(len(raised), 1)
        real_store.close()


class TestNoMutation(unittest.TestCase):
    """10. Input tick dict is not mutated."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_no_mutation(self):
        alert = [{"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"}]
        pipeline = _make_pipeline(self.store, alerts_fn=lambda d: alert, sample_n=1)
        data = {"energy": 500.0, "nested": {"a": 1}}
        original = copy.deepcopy(data)
        pipeline.process_tick("MAITRI", data, time.time())
        self.assertEqual(data, original)


class TestMetrics(unittest.TestCase):
    """11. Metrics: ticks_processed correct, detection_ms is non-negative."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_metrics_values(self):
        pipeline = _make_pipeline(self.store, sample_n=1)
        for i in range(5):
            t = time.time()
            pipeline.process_tick("MAITRI", {}, t)
            time.sleep(0.001)

        m = pipeline.get_metrics()
        self.assertEqual(m["ticks_processed"], 5)
        self.assertIsNotNone(m["detection_ms"]["last"])
        self.assertGreaterEqual(m["detection_ms"]["last"], 0)
        self.assertEqual(m["write_errors"], 0)


class TestPayloadShape(unittest.TestCase):
    """12. ALERT payload has required keys; TELEMETRY payload has required keys."""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test.db")
        self.store = EdgeStorage(self.db_path)

    def tearDown(self):
        self.store.close()
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_alert_payload(self):
        alert = [{"id": "fuel_low", "severity": "HIGH", "message": "Fuel low"}]
        pipeline = _make_pipeline(self.store, alerts_fn=lambda d: alert, sample_n=999)
        pipeline.process_tick("MAITRI", {"energy": 100}, time.time())

        records = self.store.fetch_pending(limit=100)
        alerts = [r for r in records if r["record_type"] == "ALERT"]
        self.assertEqual(len(alerts), 1)
        payload = alerts[0]["payload"]
        self.assertIn("network_mode_at_buffer", payload)
        self.assertIn("event", payload)
        self.assertIn("alert", payload)
        self.assertIn("mapped_severity", payload)
        self.assertIn("snapshot", payload)

    def test_telemetry_payload(self):
        pipeline = _make_pipeline(self.store, sample_n=1)
        pipeline.process_tick("MAITRI", {"energy": 100}, time.time())

        records = self.store.fetch_pending(limit=100)
        telem = [r for r in records if r["record_type"] == "TELEMETRY"]
        self.assertEqual(len(telem), 1)
        payload = telem[0]["payload"]
        self.assertIn("network_mode_at_buffer", payload)
        self.assertIn("data", payload)


if __name__ == "__main__":
    unittest.main()
