"""Tests for Aegis FastAPI endpoints."""
import pytest

pytestmark = pytest.mark.asyncio


class TestRoot:
    async def test_returns_service_info(self, app_client):
        res = await app_client.get("/")
        assert res.status_code == 200
        data = res.json()
        assert data["service"] == "BeZhas Aegis"
        assert data["status"] == "operational"


class TestHealthCheck:
    async def test_returns_healthy(self, app_client, mock_monitor):
        res = await app_client.get("/aegis/v1/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert isinstance(data["models_loaded"], list)
        assert data["uptime"] > 0


class TestIngestTelemetry:
    async def test_accepts_valid_events(self, app_client):
        events = [{
            "sessionId": "s1", "eventType": "page_view", "eventName": "home",
            "timestamp": 1700000000000, "metadata": {}
        }]
        res = await app_client.post("/aegis/v1/ingest/telemetry", json=events)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["processed"] == 1

    async def test_rejects_empty_body(self, app_client):
        res = await app_client.post("/aegis/v1/ingest/telemetry", json="bad")
        assert res.status_code == 422


class TestIngestWeb3:
    async def test_accepts_valid_events(self, app_client):
        events = [{
            "contract": "0x1111", "event": "Transfer", "blockNumber": 100,
            "txHash": "0xabc", "gasUsed": "21000", "data": {}
        }]
        res = await app_client.post("/aegis/v1/ingest/web3", json=events)
        assert res.status_code == 200
        assert res.json()["processed"] == 1


class TestIngestLogs:
    async def test_accepts_valid_events(self, app_client):
        events = [{
            "level": "info", "message": "Server started", "service": "api",
            "timestamp": 1700000000000, "metadata": {}
        }]
        res = await app_client.post("/aegis/v1/ingest/log", json=events)
        assert res.status_code == 200
        assert res.json()["processed"] == 1


class TestStats:
    async def test_returns_all_model_stats(self, app_client):
        res = await app_client.get("/aegis/v1/stats")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "anomaly_detector" in data["stats"]
        assert "gas_predictor" in data["stats"]
        assert "sentiment_analyzer" in data["stats"]
        assert "ux_optimizer" in data["stats"]


class TestValidate:
    async def test_approves_normal_tx(self, app_client, mock_anomaly):
        mock_anomaly.predict.return_value = 0.1
        res = await app_client.post("/api/aegis/validate", json={
            "type": "transaction", "data": {"value": "100"}
        })
        assert res.status_code == 200
        data = res.json()
        assert data["approved"] is True
        assert data["risk"] == "low"

    async def test_rejects_high_risk_tx(self, app_client, mock_anomaly):
        mock_anomaly.predict.return_value = 0.9
        res = await app_client.post("/api/aegis/validate", json={
            "type": "transaction", "data": {"value": "999999"}
        })
        data = res.json()
        assert data["approved"] is False
        assert data["risk"] == "high"
        assert "anomaly_detected" in data["flags"]

    async def test_medium_risk(self, app_client, mock_anomaly):
        mock_anomaly.predict.return_value = 0.6
        res = await app_client.post("/api/aegis/validate", json={
            "type": "transaction", "data": {}
        })
        data = res.json()
        assert data["approved"] is True
        assert data["risk"] == "medium"

    async def test_sentiment_analysis_path(self, app_client, mock_anomaly, mock_sentiment):
        mock_anomaly.predict.return_value = 0.1
        mock_sentiment.analyze.return_value = {"sentiment": "negative", "score": -0.7}
        res = await app_client.post("/api/aegis/validate", json={
            "type": "sentiment", "data": {"text": "This is terrible"}
        })
        data = res.json()
        assert data["success"] is True

    async def test_telemetry_merge(self, app_client, mock_anomaly):
        mock_anomaly.predict.return_value = 0.2
        res = await app_client.post("/api/aegis/validate", json={
            "type": "transaction",
            "data": {},
            "container_id": "CNT-001",
            "telemetry": {"temperature": 25, "humidity": 60}
        })
        data = res.json()
        assert data["success"] is True
        # Verify anomaly was called with merged data
        call_args = mock_anomaly.predict.call_args[0][0]
        assert call_args.get("container_id") == "CNT-001"
