"""Tests for core systems: AutoHealer, DecisionEngine, Monitor."""
import pytest
from unittest.mock import AsyncMock, MagicMock

pytestmark = pytest.mark.asyncio


class TestAutoHealer:
    @pytest.fixture
    def healer(self, mock_db, mock_redis):
        from core.auto_healer import AutoHealer
        return AutoHealer(mock_db, mock_redis)

    def test_get_healing_action(self, healer):
        action = healer.get_healing_action("slow_response")
        assert isinstance(action, str)
        assert action == "scale_up"

    async def test_handle_anomaly_executes(self, healer):
        # handle_anomaly returns None (logs + stats only)
        await healer.handle_anomaly("slow_response", {"service": "api"})
        assert healer.stats['total_healings'] == 1

    async def test_warm_cache(self, healer, mock_redis):
        result = await healer.warm_cache({"keys": ["key1", "key2"]})
        assert isinstance(result, bool)

    def test_get_stats_structure(self, healer):
        stats = healer.get_stats()
        assert "total_healings" in stats
        assert "successful_healings" in stats
        assert "failed_healings" in stats
        assert "success_rate" in stats


class TestDecisionEngine:
    @pytest.fixture
    def engine(self, ml_models, mock_auto_healer):
        from core.decision_engine import DecisionEngine
        return DecisionEngine(ml_models, mock_auto_healer)

    def test_classify_anomaly(self, engine):
        event = {"eventType": "api_call", "performance": {"responseTime": 5000}}
        anomaly_type = engine.classify_anomaly(event, 0.9)
        assert isinstance(anomaly_type, str)

    async def test_should_trigger_healing_high_score(self, engine):
        result = await engine.should_trigger_healing("high_latency",
            {"performance": {"responseTime": 5000}})
        assert isinstance(result, bool)

    def test_get_stats(self, engine):
        stats = engine.get_stats()
        assert "decisions_made" in stats


class TestSystemMonitor:
    @pytest.fixture
    def sys_monitor(self, mock_db, ml_models):
        from core.monitor import SystemMonitor
        return SystemMonitor(mock_db, ml_models)

    def test_get_uptime_before_start(self, sys_monitor):
        uptime = sys_monitor.get_uptime()
        assert uptime >= 0

    def test_get_stats(self, sys_monitor):
        stats = sys_monitor.get_stats()
        assert "is_running" in stats

    async def test_collect_metrics(self, sys_monitor, mock_db):
        mock_db.get_recent_telemetry.return_value = [
            {"metadata": {"cpuUsage": 50, "memoryUsage": 60},
             "performance": {"responseTime": 200}}
        ]
        await sys_monitor.collect_metrics()
        # Should not raise
