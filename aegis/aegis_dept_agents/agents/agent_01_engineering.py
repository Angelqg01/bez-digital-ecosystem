"""
BeZhas Aegis — Agente Departamental: Blockchain Engineering
Monitoriza contratos, CI/CD, tests, SDK y salud de la red L2.
"""

import asyncio
from typing import Any, Dict, List
from .core.base_dept_agent import BaseDeptAgent, AlertLevel


class BlockchainEngineeringAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 60  # Cada minuto

    def __init__(self):
        super().__init__(
            agent_id="dept_eng_001",
            dept_name="Blockchain Engineering",
            dept_lead="CTO"
        )
        # KPIs en memoria — se actualizan en cada ciclo
        self._kpis = {
            "contracts_deployed": 0,
            "tests_passing": 0,
            "tests_total": 1147,
            "last_build_status": "unknown",
            "l2_block_number": 0,
            "l2_tps": 0.0,
            "batcher_wallet_eth": 0.0,
            "sequencer_status": "unknown",
            "sdk_version": "3.0.0",
            "active_chains": 5
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:system-health",
            "mcp:audit-contract",
            "mcp:analyze-gas",
            "mcp:verify-compliance"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def on_start(self):
        self.logger_note = "Engineering agent online — monitoring L2 + contracts"

    async def execute(self):
        await asyncio.gather(
            self._check_l2_health(),
            self._check_batcher_wallet(),
            self._check_build_status(),
            self._check_contracts_deployed(),
        )

    # ------------------------------------------------------------------ #
    #  Checks                                                             #
    # ------------------------------------------------------------------ #

    async def _check_l2_health(self):
        """Verifica bloque actual y TPS del nodo L2."""
        result = await self.call_mcp_tool("system-health", {"service": "bezhas-l2"})
        if result:
            self._kpis["l2_block_number"] = result.get("block_number", 0)
            self._kpis["l2_tps"] = result.get("tps", 0.0)
            self._kpis["sequencer_status"] = result.get("sequencer_status", "unknown")
            if result.get("sequencer_status") != "healthy":
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"Sequencer unhealthy: {result.get('sequencer_status')}",
                    result
                )

    async def _check_batcher_wallet(self):
        """Alerta si la wallet del batcher tiene poco ETH para L1."""
        result = await self.call_api("GET", "/gas/batcher-wallet")
        if result:
            eth_balance = float(result.get("balance_eth", 0))
            self._kpis["batcher_wallet_eth"] = eth_balance
            if eth_balance < 0.1:
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"Batcher wallet critically low: {eth_balance:.4f} ETH — L2 will STOP submitting batches",
                    {"balance": eth_balance, "threshold": 0.1}
                )
            elif eth_balance < 0.3:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"Batcher wallet low: {eth_balance:.4f} ETH — top up soon",
                    {"balance": eth_balance}
                )

    async def _check_build_status(self):
        """Consulta el último estado del pipeline CI/CD."""
        result = await self.call_api("GET", "/config/ci-status")
        if result:
            status = result.get("last_build_status", "unknown")
            self._kpis["last_build_status"] = status
            if status == "failed":
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    "CI/CD pipeline FAILED — contracts build or tests broken",
                    result
                )

    async def _check_contracts_deployed(self):
        """Cuenta contratos desplegados y detecta divergencia vs ABIs."""
        result = await self.call_api("GET", "/contracts")
        if result:
            count = len(result.get("contracts", []))
            self._kpis["contracts_deployed"] = count
            self._kpis["tests_passing"] = result.get("tests_passing", 0)

            # Parity check — SDK vs deployed contracts
            parity = await self.call_api("GET", "/agents/parity")
            if parity and not parity.get("is_ok", True):
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"SDK/Contract parity mismatch: {parity.get('mismatches', [])}",
                    parity
                )
