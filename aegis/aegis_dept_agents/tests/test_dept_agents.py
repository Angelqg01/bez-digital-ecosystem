"""
BeZhas Aegis — Tests para Agentes Departamentales
Pytest suite completa: unit tests + integration tests.
Ejecutar: cd aegis && pytest dept_agents/tests/ -v
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from datetime import datetime, timezone

# ------------------------------------------------------------------ #
#  Fixtures                                                           #
# ------------------------------------------------------------------ #

@pytest.fixture
def mock_http():
    """Cliente HTTP mock que retorna respuestas controladas."""
    client = AsyncMock()

    async def mock_get(url, **kwargs):
        resp = AsyncMock()
        resp.status_code = 200
        resp.raise_for_status = MagicMock()
        # Respuestas por endpoint
        if "/gas/batcher-wallet" in url:
            resp.json = MagicMock(return_value={"balance_eth": 0.5})
        elif "/contracts" in url:
            resp.json = MagicMock(return_value={"contracts": [{}]*66, "tests_passing": 1147})
        elif "/analytics/system" in url:
            resp.json = MagicMock(return_value={"disk_pct": 45.0, "ram_pct": 60.0, "cpu_pct": 30.0})
        elif "/gateway/v1/staking/stats" in url:
            resp.json = MagicMock(return_value={"daily_emission_bez": 1200.0})
        elif "/analytics/kyc" in url:
            resp.json = MagicMock(return_value={"pending": 3, "approved_month": 42, "rejected_month": 2, "high_value_rwa_pending": 0})
        elif "/analytics/gas-tanks" in url:
            resp.json = MagicMock(return_value={"tanks": [
                {"client_name": "ClientA", "balance_usd": 200.0},
                {"client_name": "ClientB", "balance_usd": 450.0},
            ]})
        else:
            resp.json = MagicMock(return_value={})
        return resp

    async def mock_post(url, **kwargs):
        resp = AsyncMock()
        resp.status_code = 200
        resp.raise_for_status = MagicMock()
        if "invoke" in url:
            resp.json = MagicMock(return_value={"status": "ok", "result": {}})
        elif "anomaly-detector" in url:
            resp.json = MagicMock(return_value={"status": "ok", "anomalies_detected": 0})
        elif "gas-predictor" in url:
            resp.json = MagicMock(return_value={"status": "ok", "predicted_gwei": 12.5})
        elif "sentiment-analyzer" in url:
            resp.json = MagicMock(return_value={"status": "ok", "sentiment_score": 0.72})
        elif "openclaw" in url:
            resp.json = MagicMock(return_value={"status": "ok", "platforms": []})
        else:
            resp.json = MagicMock(return_value={"status": "ok"})
        return resp

    client.get  = mock_get
    client.post = mock_post
    return client


@pytest.fixture
def mock_redis():
    """Redis mock async."""
    redis = AsyncMock()
    redis.lpush     = AsyncMock(return_value=1)
    redis.ltrim     = AsyncMock(return_value=True)
    redis.publish   = AsyncMock(return_value=1)
    redis.hset      = AsyncMock(return_value=1)
    redis.lrange    = AsyncMock(return_value=[])
    redis.hgetall   = AsyncMock(return_value={})
    redis.aclose    = AsyncMock()
    redis.pubsub    = MagicMock(return_value=AsyncMock())
    return redis


# ------------------------------------------------------------------ #
#  Base Agent Tests                                                   #
# ------------------------------------------------------------------ #

class TestBaseDeptAgent:
    """Tests de la clase base y su ciclo de vida."""

    def _make_agent(self):
        """Crea un agente concreto minimal para testing."""
        from dept_agents.core.base_dept_agent import BaseDeptAgent, AlertLevel, AgentStatus

        class _TestAgent(BaseDeptAgent):
            CYCLE_INTERVAL_SECONDS = 60

            def __init__(self):
                super().__init__("test_001", "Test Dept", "Test Lead")
                self.execute_called = 0

            async def execute(self):
                self.execute_called += 1

            def get_kpis(self):
                return {"test_kpi": self.execute_called}

            def get_tools(self):
                return ["mcp:system-health"]

        return _TestAgent()

    @pytest.mark.asyncio
    async def test_agent_init(self):
        agent = self._make_agent()
        from dept_agents.core.base_dept_agent import AgentStatus
        assert agent.agent_id == "test_001"
        assert agent.status   == AgentStatus.IDLE
        assert agent.run_count == 0

    @pytest.mark.asyncio
    async def test_start_sets_running_status(self, mock_http, mock_redis):
        agent = self._make_agent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
        from dept_agents.core.base_dept_agent import AgentStatus
        assert agent.status == AgentStatus.RUNNING
        assert agent.started_at is not None

    @pytest.mark.asyncio
    async def test_run_cycle_increments_counter(self, mock_http, mock_redis):
        agent = self._make_agent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent.run_cycle()
            await agent.run_cycle()
        assert agent.run_count == 2
        assert agent.execute_called == 2

    @pytest.mark.asyncio
    async def test_emit_alert_stores_alert(self, mock_http, mock_redis):
        from dept_agents.core.base_dept_agent import AlertLevel
        agent = self._make_agent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent.emit_alert(AlertLevel.WARNING, "Test warning alert", deduplicate=False)
        assert len(agent.alerts) == 1
        assert agent.alerts[0]["level"] == "warning"
        assert agent.alerts[0]["message"] == "Test warning alert"

    @pytest.mark.asyncio
    async def test_alert_deduplication(self, mock_http, mock_redis):
        from dept_agents.core.base_dept_agent import AlertLevel
        agent = self._make_agent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent.emit_alert(AlertLevel.WARNING, "Dedup test", deduplicate=True)
            await agent.emit_alert(AlertLevel.WARNING, "Dedup test", deduplicate=True)
            await agent.emit_alert(AlertLevel.WARNING, "Dedup test", deduplicate=True)
        # Solo 1 debe haberse registrado
        assert len(agent.alerts) == 1

    @pytest.mark.asyncio
    async def test_get_kpis_returns_dict(self):
        agent = self._make_agent()
        kpis = agent.get_kpis()
        assert isinstance(kpis, dict)

    @pytest.mark.asyncio
    async def test_info_includes_all_fields(self, mock_http, mock_redis):
        agent = self._make_agent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            info = agent.info()
        required_keys = ["agent_id", "dept_name", "dept_lead", "status", "kpis", "tools", "recent_alerts"]
        for key in required_keys:
            assert key in info, f"Missing key in info(): {key}"

    @pytest.mark.asyncio
    async def test_stop_changes_status(self, mock_http, mock_redis):
        from dept_agents.core.base_dept_agent import AgentStatus
        agent = self._make_agent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            assert agent.status == AgentStatus.RUNNING
            await agent.stop()
        assert agent.status == AgentStatus.IDLE

    @pytest.mark.asyncio
    async def test_error_in_execute_increments_error_count(self, mock_http, mock_redis):
        from dept_agents.core.base_dept_agent import BaseDeptAgent

        class _FailingAgent(BaseDeptAgent):
            def __init__(self):
                super().__init__("fail_001", "Failing", "Nobody")
            async def execute(self):
                raise RuntimeError("Intentional test failure")
            def get_kpis(self): return {}
            def get_tools(self): return []

        agent = _FailingAgent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent.run_cycle()
        assert agent.error_count == 1


# ------------------------------------------------------------------ #
#  Engineering Agent Tests                                            #
# ------------------------------------------------------------------ #

class TestBlockchainEngineeringAgent:

    @pytest.mark.asyncio
    async def test_low_batcher_wallet_emits_critical_alert(self, mock_http, mock_redis):
        from dept_agents.agents.agent_01_engineering import BlockchainEngineeringAgent
        from dept_agents.core.base_dept_agent import AlertLevel

        # Override mock: batcher wallet below threshold
        async def mock_get_low_wallet(url, **kwargs):
            resp = AsyncMock()
            resp.raise_for_status = MagicMock()
            if "/gas/batcher-wallet" in url:
                resp.json = MagicMock(return_value={"balance_eth": 0.05})  # CRITICAL < 0.1
            else:
                resp.json = MagicMock(return_value={})
            return resp

        mock_http.get = mock_get_low_wallet
        agent = BlockchainEngineeringAgent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent._check_batcher_wallet()
        assert any(a["level"] == "critical" for a in agent.alerts)

    @pytest.mark.asyncio
    async def test_healthy_batcher_no_alert(self, mock_http, mock_redis):
        from dept_agents.agents.agent_01_engineering import BlockchainEngineeringAgent
        agent = BlockchainEngineeringAgent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent._check_batcher_wallet()
        assert len(agent.alerts) == 0

    @pytest.mark.asyncio
    async def test_kpis_structure(self):
        from dept_agents.agents.agent_01_engineering import BlockchainEngineeringAgent
        agent = BlockchainEngineeringAgent()
        kpis = agent.get_kpis()
        assert "l2_block_number" in kpis
        assert "batcher_wallet_eth" in kpis
        assert "contracts_deployed" in kpis


# ------------------------------------------------------------------ #
#  DeFi Agent Tests                                                   #
# ------------------------------------------------------------------ #

class TestDeFiTokenomicsAgent:

    @pytest.mark.asyncio
    async def test_staking_cap_exceeded_emits_critical(self, mock_http, mock_redis):
        from dept_agents.agents.agents_03_to_10 import DeFiTokenomicsAgent

        async def mock_get_overcap(url, **kwargs):
            resp = AsyncMock()
            resp.raise_for_status = MagicMock()
            if "staking/stats" in url:
                # Emission exceeds 50K cap
                resp.json = MagicMock(return_value={"daily_emission_bez": 52_000.0})
            elif "farming/stats" in url:
                resp.json = MagicMock(return_value={"daily_emission_bez": 10_000.0})
            else:
                resp.json = MagicMock(return_value={})
            return resp

        mock_http.get = mock_get_overcap
        agent = DeFiTokenomicsAgent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent._check_emission_caps()
        assert any(a["level"] == "critical" for a in agent.alerts)

    @pytest.mark.asyncio
    async def test_emission_within_cap_no_alert(self, mock_http, mock_redis):
        from dept_agents.agents.agents_03_to_10 import DeFiTokenomicsAgent
        agent = DeFiTokenomicsAgent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent._check_emission_caps()
        assert len([a for a in agent.alerts if a["level"] == "critical"]) == 0


# ------------------------------------------------------------------ #
#  Security Agent Tests                                               #
# ------------------------------------------------------------------ #

class TestSecurityCISOAgent:

    @pytest.mark.asyncio
    async def test_open_circuit_breaker_emits_critical(self, mock_http, mock_redis):
        from dept_agents.agents.agents_03_to_10 import SecurityCISOAgent

        async def mock_get_breaker(url, **kwargs):
            resp = AsyncMock()
            resp.raise_for_status = MagicMock()
            if "/agents/circuits" in url:
                resp.json = MagicMock(return_value={
                    "breakers": [{"name": "StakingPool", "state": "OPEN"}],
                    "contracts_paused": 1
                })
            else:
                resp.json = MagicMock(return_value={})
            return resp

        mock_http.get = mock_get_breaker
        agent = SecurityCISOAgent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent._check_circuit_breakers()
        assert any(a["level"] == "critical" for a in agent.alerts)
        assert agent.get_kpis()["contracts_paused"] == 1

    @pytest.mark.asyncio
    async def test_tools_list_includes_fraud_check(self):
        from dept_agents.agents.agents_03_to_10 import SecurityCISOAgent
        agent = SecurityCISOAgent()
        tools = agent.get_tools()
        assert "mcp:assess-fraud-risk" in tools


# ------------------------------------------------------------------ #
#  Finance Agent Tests                                                #
# ------------------------------------------------------------------ #

class TestFinanceTreasuryAgent:

    @pytest.mark.asyncio
    async def test_critical_gas_tank_emits_critical_alert(self, mock_http, mock_redis):
        from dept_agents.agents.agents_03_to_10 import FinanceTreasuryAgent

        async def mock_critical_tank(url, **kwargs):
            resp = AsyncMock()
            resp.raise_for_status = MagicMock()
            if "/analytics/gas-tanks" in url:
                resp.json = MagicMock(return_value={"tanks": [
                    {"client_name": "CriticalCorp", "balance_usd": 5.0},  # < $20 threshold
                ]})
            else:
                resp.json = MagicMock(return_value={})
            return resp

        mock_http.get = mock_critical_tank
        agent = FinanceTreasuryAgent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent._check_gas_tanks()
        assert any(a["level"] == "critical" for a in agent.alerts)

    @pytest.mark.asyncio
    async def test_healthy_tanks_no_alert(self, mock_http, mock_redis):
        from dept_agents.agents.agents_03_to_10 import FinanceTreasuryAgent
        agent = FinanceTreasuryAgent()
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            await agent.start()
            await agent._check_gas_tanks()
        assert len(agent.alerts) == 0


# ------------------------------------------------------------------ #
#  Manager Tests                                                      #
# ------------------------------------------------------------------ #

class TestDeptAgentManager:

    @pytest.mark.asyncio
    async def test_manager_registers_10_agents(self, mock_http, mock_redis):
        from dept_agents.manager import DeptAgentManager
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            mgr = DeptAgentManager()
        assert len(mgr.agents) == 10

    @pytest.mark.asyncio
    async def test_all_agent_ids_unique(self, mock_http, mock_redis):
        from dept_agents.manager import DeptAgentManager
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            mgr = DeptAgentManager()
        ids = list(mgr.agents.keys())
        assert len(ids) == len(set(ids)), "Duplicate agent IDs found!"

    @pytest.mark.asyncio
    async def test_summary_structure(self, mock_http, mock_redis):
        from dept_agents.manager import DeptAgentManager
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            mgr = DeptAgentManager()
            summary = mgr.summary()
        assert "total_agents" in summary
        assert "running" in summary
        assert "critical_alerts" in summary
        assert summary["total_agents"] == 10

    @pytest.mark.asyncio
    async def test_get_all_alerts_returns_list(self, mock_http, mock_redis):
        from dept_agents.manager import DeptAgentManager
        with patch("redis.asyncio.from_url", return_value=mock_redis), \
             patch("httpx.AsyncClient", return_value=mock_http):
            mgr = DeptAgentManager()
            alerts = mgr.get_all_alerts()
        assert isinstance(alerts, list)

    def test_all_agents_have_required_methods(self, mock_http, mock_redis):
        from dept_agents.manager import DeptAgentManager
        mgr = DeptAgentManager()
        for agent_id, agent in mgr.agents.items():
            assert hasattr(agent, "execute"),   f"{agent_id} missing execute()"
            assert hasattr(agent, "get_kpis"),  f"{agent_id} missing get_kpis()"
            assert hasattr(agent, "get_tools"), f"{agent_id} missing get_tools()"
            assert hasattr(agent, "info"),      f"{agent_id} missing info()"
            assert callable(agent.get_kpis),    f"{agent_id} get_kpis not callable"

    def test_all_agents_have_cycle_interval(self):
        from dept_agents.manager import DeptAgentManager
        mgr = DeptAgentManager()
        for agent_id, agent in mgr.agents.items():
            interval = getattr(agent, "CYCLE_INTERVAL_SECONDS", None)
            assert interval is not None, f"{agent_id} missing CYCLE_INTERVAL_SECONDS"
            assert interval > 0, f"{agent_id} CYCLE_INTERVAL_SECONDS must be > 0"

    def test_kpis_are_dicts(self):
        from dept_agents.manager import DeptAgentManager
        mgr = DeptAgentManager()
        for agent_id, agent in mgr.agents.items():
            kpis = agent.get_kpis()
            assert isinstance(kpis, dict), f"{agent_id} get_kpis() must return dict, got {type(kpis)}"

    def test_tools_are_lists(self):
        from dept_agents.manager import DeptAgentManager
        mgr = DeptAgentManager()
        for agent_id, agent in mgr.agents.items():
            tools = agent.get_tools()
            assert isinstance(tools, list), f"{agent_id} get_tools() must return list"


# ------------------------------------------------------------------ #
#  OpenClaw Client Tests                                              #
# ------------------------------------------------------------------ #

class TestOpenClawClient:

    @pytest.mark.asyncio
    async def test_invoke_returns_result(self, mock_http):
        from dept_agents.core.openclaw_client import OpenClawClient
        client = OpenClawClient("test_agent", mock_http)
        result = await client.invoke("analyze-gas", {"contract": "0x123"})
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_invoke_timeout_returns_error_dict(self):
        import httpx
        from dept_agents.core.openclaw_client import OpenClawClient
        http = AsyncMock()
        http.post = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        client = OpenClawClient("test_agent", http)
        result = await client.invoke("slow-skill", {})
        assert "error" in result
        assert result["error"] == "timeout"

    @pytest.mark.asyncio
    async def test_invoke_many_concurrent(self, mock_http):
        from dept_agents.core.openclaw_client import OpenClawClient
        client = OpenClawClient("test_agent", mock_http)
        calls = [
            {"skill": "analyze-gas",  "params": {"x": 1}},
            {"skill": "analyze-market", "params": {"token": "BEZ"}},
            {"skill": "system-health", "params": {}},
        ]
        results = await client.invoke_many(calls, max_concurrency=3)
        assert len(results) == 3
