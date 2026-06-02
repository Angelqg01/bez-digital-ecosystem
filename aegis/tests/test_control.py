"""Tests for control router endpoints."""
import pytest
import json
from datetime import datetime, timezone

pytestmark = pytest.mark.asyncio


class TestControlSetMode:
    async def test_set_autonomous_mode(self, app_client, mock_db):
        res = await app_client.put("/api/aegis/control/set_mode", json={"mode": "autonomous"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["data"]["mode"] == "autonomous"

    async def test_set_suggest_mode(self, app_client, mock_db):
        res = await app_client.put("/api/aegis/control/set_mode", json={"mode": "suggest"})
        assert res.status_code == 200
        assert res.json()["data"]["mode"] == "suggest"

    async def test_set_invalid_mode(self, app_client):
        res = await app_client.put("/api/aegis/control/set_mode", json={"mode": "invalid"})
        assert res.status_code == 422


class TestControlPauseResume:
    async def test_pause(self, app_client):
        res = await app_client.post("/api/aegis/control/pause")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["data"]["status"] == "PAUSED"

    async def test_resume(self, app_client):
        res = await app_client.post("/api/aegis/control/resume")
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "ACTIVE"


class TestControlTriggerAction:
    async def test_purge_cache(self, app_client):
        res = await app_client.post("/api/aegis/control/trigger_action",
                                     json={"action": "purge_cache"})
        assert res.status_code == 200
        assert res.json()["data"]["action"] == "purge_cache"

    async def test_reindex_feeds(self, app_client):
        res = await app_client.post("/api/aegis/control/trigger_action",
                                     json={"action": "reindex_feeds"})
        assert res.status_code == 200
        assert res.json()["data"]["executed"] is True

    async def test_restart_web3_listeners(self, app_client):
        res = await app_client.post("/api/aegis/control/trigger_action",
                                     json={"action": "restart_web3_listeners"})
        assert res.status_code == 200

    async def test_invalid_action(self, app_client):
        res = await app_client.post("/api/aegis/control/trigger_action",
                                     json={"action": "hax0r"})
        assert res.status_code == 422


class TestControlApproveReject:
    async def test_approve_action(self, app_client, mock_db):
        # Set up mock to return a pending suggestion
        mock_db._mock_conn.fetchrow.return_value = {
            "id": "sugg-001",
            "action_type": "purge_cache",
            "target": "redis",
            "reason": "stale keys",
            "confidence": 0.85,
            "action_data": json.dumps({}),
            "status": "pending",
        }
        res = await app_client.post("/api/aegis/control/approve_action/sugg-001",
                                     json={"feedback": "looks good"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["data"]["status"] == "approved"

    async def test_approve_not_found(self, app_client, mock_db):
        mock_db._mock_conn.fetchrow.return_value = None
        res = await app_client.post("/api/aegis/control/approve_action/sugg-999",
                                     json={"feedback": "nope"})
        assert res.status_code == 404

    async def test_reject_action(self, app_client, mock_db):
        mock_db._mock_conn.fetchrow.return_value = {"id": "sugg-002"}
        res = await app_client.post("/api/aegis/control/reject_action/sugg-002",
                                     json={"feedback": "too risky"})
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "rejected"

    async def test_reject_not_found(self, app_client, mock_db):
        mock_db._mock_conn.fetchrow.return_value = None
        res = await app_client.post("/api/aegis/control/reject_action/sugg-999",
                                     json={"feedback": "nope"})
        assert res.status_code == 404


class TestPendingSuggestions:
    async def test_get_pending(self, app_client, mock_db):
        now = datetime.now(timezone.utc)
        mock_db._mock_conn.fetchval.return_value = 2
        mock_db._mock_conn.fetch.return_value = [
            {"id": "s1", "action_type": "purge_cache", "target": "redis",
             "reason": "stale", "confidence": 0.9, "created_at": now},
            {"id": "s2", "action_type": "reindex", "target": "feeds",
             "reason": "outdated", "confidence": 0.7, "created_at": now},
        ]
        res = await app_client.get("/api/aegis/suggestions/pending?limit=5")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["total"] == 2
        assert len(data["suggestions"]) == 2


class TestAegisConfig:
    async def test_set_anomaly_threshold(self, app_client):
        res = await app_client.put("/api/aegis/config/anomaly_threshold",
                                    json={"level": 0.7})
        assert res.status_code == 200
        assert res.json()["data"]["threshold"] == 0.7

    async def test_threshold_boundary_low(self, app_client):
        res = await app_client.put("/api/aegis/config/anomaly_threshold",
                                    json={"level": 0.0})
        assert res.status_code == 200

    async def test_threshold_boundary_high(self, app_client):
        res = await app_client.put("/api/aegis/config/anomaly_threshold",
                                    json={"level": 1.0})
        assert res.status_code == 200

    async def test_threshold_out_of_range(self, app_client):
        res = await app_client.put("/api/aegis/config/anomaly_threshold",
                                    json={"level": 1.5})
        assert res.status_code == 422

    async def test_set_telemetry_enabled(self, app_client, mock_db):
        res = await app_client.put("/api/aegis/config/telemetry",
                                    json={"enabled": True})
        assert res.status_code == 200
        assert res.json()["data"]["telemetry_enabled"] is True

    async def test_set_telemetry_disabled(self, app_client, mock_db):
        res = await app_client.put("/api/aegis/config/telemetry",
                                    json={"enabled": False})
        assert res.status_code == 200
        assert res.json()["data"]["telemetry_enabled"] is False

    async def test_set_samplerate(self, app_client, mock_db):
        res = await app_client.put("/api/aegis/config/telemetry_samplerate",
                                    json={"rate": 0.5})
        assert res.status_code == 200
        assert res.json()["data"]["samplerate"] == 0.5
        assert res.json()["data"]["percentage"] == 50

    async def test_samplerate_out_of_range(self, app_client):
        res = await app_client.put("/api/aegis/config/telemetry_samplerate",
                                    json={"rate": 2.0})
        assert res.status_code == 422


class TestModelManagement:
    async def test_mark_false_positive(self, app_client, mock_db):
        mock_db._mock_conn.fetchval.return_value = 3
        res = await app_client.post("/api/aegis/model/mark_false_positive",
                                     json={"log_id": "123", "reason": "not real"})
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["marked_as"] == "false_positive"
        assert data["retrain_suggested"] is False

    async def test_mark_false_positive_triggers_retrain(self, app_client, mock_db):
        mock_db._mock_conn.fetchval.return_value = 15
        res = await app_client.post("/api/aegis/model/mark_false_positive",
                                     json={"log_id": "456", "reason": "bad detection"})
        assert res.status_code == 200
        assert res.json()["data"]["retrain_suggested"] is True
        assert res.json()["data"]["fp_count_24h"] == 15

    async def test_retrain(self, app_client):
        res = await app_client.post("/api/aegis/model/retrain")
        assert res.status_code == 200
        data = res.json()
        assert "job_id" in data.get("data", data)

    async def test_retrain_status_unknown(self, app_client):
        res = await app_client.get("/api/aegis/model/retrain/status/fake_job_123")
        assert res.status_code == 200
        assert res.json()["data"]["status"] == "unknown"


class TestAegisStatus:
    async def test_full_status(self, app_client):
        res = await app_client.get("/api/aegis/status")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert "system_status" in data["data"]
        assert "models" in data["data"]
        assert "components" in data["data"]
