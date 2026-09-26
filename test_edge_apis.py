"""
test_edge_apis.py - Tests for Step 6 Backend Edge Data APIs
"""
import os
import shutil
import tempfile
import time
import unittest
from flask import Flask

from data_simulator import app, edge_store, network_state, sync_worker, NetworkMode, central_store
from edge_storage import EdgeStorage

class TestEdgeAPIs(unittest.TestCase):
    def setUp(self):
        # Create a test client
        self.client = app.test_client()
        self.client.testing = True
        
        # Clear out edge_store by replacing its DB for testing
        self.tmp = tempfile.mkdtemp()
        self.test_db = os.path.join(self.tmp, "test_api.db")
        
        # Monkeypatch the store to use our test DB for the duration of the test
        self.orig_db_path = edge_store.db_path
        edge_store.db_path = self.test_db
        # Re-initialize the table
        edge_store._init_db()
        
        network_state.set_mode(NetworkMode.ONLINE, source="test")
        
    def tearDown(self):
        edge_store.db_path = self.orig_db_path
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _insert(self, severity="NORMAL", n=1):
        for _ in range(n):
            edge_store.insert_record("MAITRI", "TELEMETRY", severity, {"val": 1})

    def test_1_empty_queue(self):
        """Test 1: Empty Queue"""
        res = self.client.get("/api/edge/queue")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["total_pending"], 0)
        self.assertEqual(data["priorities"]["P1"], 0)
        self.assertEqual(data["priorities"]["P2"], 0)
        self.assertEqual(data["priorities"]["P3"], 0)

    def test_2_priority_counts(self):
        """Test 2: Priority Counts"""
        self._insert("CRITICAL", 2) # P1
        self._insert("MODERATE", 3) # P2
        self._insert("NORMAL", 1)   # P3
        
        res = self.client.get("/api/edge/queue")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        
        self.assertEqual(data["total_pending"], 6)
        self.assertEqual(data["priorities"]["P1"], 2)
        self.assertEqual(data["priorities"]["P2"], 3)
        self.assertEqual(data["priorities"]["P3"], 1)

    def test_3_offline(self):
        """Test 3: Offline mode correctly reflects in status APIs"""
        self._insert("CRITICAL", 1)
        network_state.set_mode(NetworkMode.OFFLINE, source="test")
        
        res = self.client.get("/api/edge/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        
        self.assertTrue(data["edge_active"])
        self.assertEqual(data["network_mode"], "OFFLINE")
        self.assertEqual(data["sync"]["status"], "PAUSED")
        self.assertGreater(data["buffer"]["pending"]["total"], 0)

    def test_4_online_recovery(self):
        """Test 4: Online Recovery sync status"""
        network_state.set_mode(NetworkMode.ONLINE, source="test")
        res = self.client.get("/api/sync/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        
        self.assertEqual(data["network_mode"], "ONLINE")
        self.assertEqual(data["sync_status"], "ACTIVE")

    def test_5_degraded_mode(self):
        """Test 5: Degraded Mode"""
        network_state.set_mode(NetworkMode.DEGRADED, source="test")
        res = self.client.get("/api/sync/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        
        self.assertEqual(data["network_mode"], "DEGRADED")
        self.assertEqual(data["sync_status"], "THROTTLED")

    def test_6_history(self):
        """Test 6: History"""
        self._insert("CRITICAL", 2)
        res = self.client.get("/api/edge/history?limit=1")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        
        self.assertEqual(len(data), 1)
        record = data[0]
        self.assertIn("id", record)
        self.assertIn("timestamp", record)
        self.assertIn("station", record)
        self.assertIn("type", record)
        self.assertIn("priority", record)
        self.assertIn("status", record)

if __name__ == "__main__":
    unittest.main(verbosity=2)
