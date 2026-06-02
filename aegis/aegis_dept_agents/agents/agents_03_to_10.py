"""
BeZhas Aegis — Agentes Departamentales 03–10
AI/DS · DeFi/Tokenomics · Security/CISO · BD B2B · Marketing · Finance · Customer Success · Legal
"""

import asyncio
from typing import Any, Dict, List
from .core.base_dept_agent import BaseDeptAgent, AlertLevel


# ======================================================================
# AGENTE 03 — IA & Data Science
# ======================================================================

class AIDataScienceAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 120

    def __init__(self):
        super().__init__(
            agent_id="dept_ai_003",
            dept_name="IA & Data Science",
            dept_lead="Head of AI"
        )
        self._kpis = {
            "aegis_models_healthy": 0,
            "aegis_models_total": 4,
            "mcp_tools_available": 0,
            "agent_runtime_version": "0.4.0",
            "anomaly_detections_today": 0,
            "gas_predictions_accuracy_pct": 0.0,
            "autohealer_interventions_today": 0,
            "inference_avg_ms": 0.0,
            "active_sector_agents": 0
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:system-health",
            "mcp:assess-fraud-risk",
            "mcp:analyze-sentiment",
            "mcp:predict-demand"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_aegis_models(),
            self._check_agent_runtime(),
            self._check_inference_performance(),
        )

    async def _check_aegis_models(self):
        """Verifica que los 4 modelos ML de Aegis respondan correctamente."""
        models = ["anomaly-detector", "sentiment-analyzer", "ux-optimizer", "gas-predictor"]
        healthy = 0
        for model in models:
            result = await self.call_aegis(model, {"ping": True})
            if result.get("status") == "ok":
                healthy += 1
        self._kpis["aegis_models_healthy"] = healthy
        if healthy < 4:
            await self.emit_alert(
                AlertLevel.CRITICAL,
                f"Only {healthy}/4 Aegis ML models healthy",
                {"healthy": healthy, "total": 4}
            )

    async def _check_agent_runtime(self):
        result = await self.call_api("GET", "/agents")
        if result:
            active = len([a for a in result.get("agents", []) if a.get("status") == "active"])
            self._kpis["active_sector_agents"] = active
            mcp_result = await self.call_api("GET", "/config/mcp-tools")
            if mcp_result:
                self._kpis["mcp_tools_available"] = mcp_result.get("count", 0)

    async def _check_inference_performance(self):
        result = await self.call_api("GET", "/analytics/inference")
        if result:
            avg_ms = result.get("avg_inference_ms", 0)
            self._kpis["inference_avg_ms"] = avg_ms
            self._kpis["anomaly_detections_today"] = result.get("anomaly_count_today", 0)
            self._kpis["autohealer_interventions_today"] = result.get("autohealer_count", 0)
            if avg_ms > 500:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"Inference latency degraded: {avg_ms:.0f}ms avg (threshold 500ms)",
                    {"avg_ms": avg_ms}
                )


# ======================================================================
# AGENTE 04 — DeFi & Tokenomics
# ======================================================================

class DeFiTokenomicsAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 300  # Cada 5 min — on-chain data

    # Limits from TOKENOMICS_FINANCIAL_IMPACT_REPORT
    STAKING_DAILY_CAP = 50_000      # BEZ
    FARMING_DAILY_CAP = 25_000      # BEZ
    EMISSION_WARNING_PCT = 80       # Alerta al 80% del daily cap

    def __init__(self):
        super().__init__(
            agent_id="dept_defi_004",
            dept_name="DeFi & Tokenomics",
            dept_lead="Head of DeFi"
        )
        self._kpis = {
            "staking_daily_emission_bez": 0.0,
            "farming_daily_emission_bez": 0.0,
            "total_daily_emission_bez": 0.0,
            "staking_cap_used_pct": 0.0,
            "farming_cap_used_pct": 0.0,
            "treasury_balance_bez": 0.0,
            "bridge_volume_usd_today": 0.0,
            "bridge_fees_usd_today": 0.0,
            "staking_pool_tvl_bez": 0.0,
            "farming_pool_tvl_bez": 0.0,
            "platform_fee_bps": 250,
            "bridge_fee_rate_bps": 50,
            "active_governance_proposals": 0,
            "daily_pl_usd": 0.0
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:analyze-market",
            "mcp:calculate-smart-swap",
            "mcp:verify-compliance"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_emission_caps(),
            self._check_treasury(),
            self._check_bridge_activity(),
            self._check_governance(),
        )

    async def _check_emission_caps(self):
        """Alerta si la emisión diaria se acerca a los caps de seguridad."""
        result = await self.call_api("GET", "/gateway/v1/staking/stats")
        if result:
            staking_emitted = float(result.get("daily_emission_bez", 0))
            cap_pct = (staking_emitted / self.STAKING_DAILY_CAP) * 100
            self._kpis["staking_daily_emission_bez"] = staking_emitted
            self._kpis["staking_cap_used_pct"] = round(cap_pct, 1)

            if cap_pct >= 100:
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"Staking DAILY CAP REACHED: {staking_emitted:.0f}/{self.STAKING_DAILY_CAP} BEZ emitted",
                    {"emitted": staking_emitted, "cap": self.STAKING_DAILY_CAP}
                )
            elif cap_pct >= self.EMISSION_WARNING_PCT:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"Staking emission at {cap_pct:.1f}% of daily cap",
                    {"emitted": staking_emitted, "cap": self.STAKING_DAILY_CAP}
                )

        farming_result = await self.call_api("GET", "/gateway/v1/farming/stats")
        if farming_result:
            farming_emitted = float(farming_result.get("daily_emission_bez", 0))
            farming_pct = (farming_emitted / self.FARMING_DAILY_CAP) * 100
            self._kpis["farming_daily_emission_bez"] = farming_emitted
            self._kpis["farming_cap_used_pct"] = round(farming_pct, 1)
            total = (self._kpis["staking_daily_emission_bez"] + farming_emitted)
            self._kpis["total_daily_emission_bez"] = total

            if farming_pct >= 100:
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"Farming DAILY CAP REACHED: {farming_emitted:.0f}/{self.FARMING_DAILY_CAP} BEZ",
                    {"emitted": farming_emitted, "cap": self.FARMING_DAILY_CAP}
                )

    async def _check_treasury(self):
        result = await self.call_api("GET", "/gateway/v1/treasury")
        if result:
            self._kpis["treasury_balance_bez"] = float(result.get("balance_bez", 0))
            self._kpis["staking_pool_tvl_bez"] = float(result.get("staking_tvl", 0))
            self._kpis["farming_pool_tvl_bez"] = float(result.get("farming_tvl", 0))
            daily_pl = float(result.get("daily_pl_usd", 0))
            self._kpis["daily_pl_usd"] = daily_pl
            if daily_pl < -10_000:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"Daily P&L negative: ${daily_pl:,.0f} — review emission parameters",
                    {"pl_usd": daily_pl}
                )

    async def _check_bridge_activity(self):
        result = await self.call_api("GET", "/gateway/v1/bridge/stats")
        if result:
            self._kpis["bridge_volume_usd_today"] = float(result.get("volume_usd", 0))
            self._kpis["bridge_fees_usd_today"] = float(result.get("fees_usd", 0))

    async def _check_governance(self):
        result = await self.call_api("GET", "/gateway/v1/governance/proposals")
        if result:
            active = len([p for p in result.get("proposals", []) if p.get("status") == "active"])
            self._kpis["active_governance_proposals"] = active


# ======================================================================
# AGENTE 05 — Seguridad & Compliance (CISO)
# ======================================================================

class SecurityCISOAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 45  # Alta frecuencia para seguridad

    def __init__(self):
        super().__init__(
            agent_id="dept_security_005",
            dept_name="Seguridad & Compliance (CISO)",
            dept_lead="CISO"
        )
        self._kpis = {
            "anomalies_detected_today": 0,
            "circuit_breakers_open": 0,
            "waf_blocks_last_hour": 0,
            "failed_auth_attempts_last_hour": 0,
            "multisig_pending_operations": 0,
            "contracts_paused": 0,
            "high_value_txs_flagged_today": 0,
            "kyc_pending_verifications": 0,
            "slither_issues_open": 0,
            "last_security_scan": None
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:assess-fraud-risk",
            "mcp:audit-contract",
            "mcp:verify-compliance",
            "mcp:system-health"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_anomaly_detector(),
            self._check_circuit_breakers(),
            self._check_waf_and_auth(),
            self._check_multisig_queue(),
            self._check_high_value_transactions(),
        )

    async def _check_anomaly_detector(self):
        """Invoca AnomalyDetector de Aegis para detectar patrones anómalos."""
        result = await self.call_aegis("anomaly-detector", {
            "scope": "full_platform",
            "window_minutes": 60
        })
        if result:
            anomalies = result.get("anomalies_detected", 0)
            self._kpis["anomalies_detected_today"] = anomalies
            if anomalies > 0:
                severity = result.get("max_severity", "low")
                level = AlertLevel.CRITICAL if severity == "critical" else AlertLevel.WARNING
                await self.emit_alert(
                    level,
                    f"AnomalyDetector: {anomalies} anomalies detected (max severity: {severity})",
                    result
                )

    async def _check_circuit_breakers(self):
        result = await self.call_api("GET", "/agents/circuits")
        if result:
            open_breakers = [cb for cb in result.get("breakers", []) if cb.get("state") == "OPEN"]
            self._kpis["circuit_breakers_open"] = len(open_breakers)
            self._kpis["contracts_paused"] = result.get("contracts_paused", 0)
            if open_breakers:
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"{len(open_breakers)} circuit breaker(s) OPEN: {[cb['name'] for cb in open_breakers]}",
                    {"open_breakers": [cb["name"] for cb in open_breakers]}
                )

    async def _check_waf_and_auth(self):
        result = await self.call_api("GET", "/analytics/security")
        if result:
            waf_blocks = result.get("waf_blocks_last_hour", 0)
            auth_fails = result.get("failed_auth_last_hour", 0)
            self._kpis["waf_blocks_last_hour"] = waf_blocks
            self._kpis["failed_auth_attempts_last_hour"] = auth_fails
            if auth_fails > 50:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"High failed auth attempts: {auth_fails} in last hour — possible brute force",
                    {"failed_auth": auth_fails}
                )

    async def _check_multisig_queue(self):
        result = await self.call_api("GET", "/wallet/multisig/pending")
        if result:
            pending = result.get("pending_count", 0)
            self._kpis["multisig_pending_operations"] = pending
            if pending > 5:
                await self.emit_alert(
                    AlertLevel.INFO,
                    f"{pending} MultiSig operations awaiting approval",
                    {"pending": pending}
                )

    async def _check_high_value_transactions(self):
        result = await self.call_mcp_tool("assess-fraud-risk", {
            "scope": "daily_high_value",
            "threshold_usd": 50_000
        })
        if result:
            flagged = result.get("flagged_count", 0)
            self._kpis["high_value_txs_flagged_today"] = flagged
            if flagged > 0:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"{flagged} high-value transaction(s) flagged for review",
                    result
                )


# ======================================================================
# AGENTE 06 — Business Development B2B
# ======================================================================

class BusinessDevelopmentAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 3600  # Cada hora

    def __init__(self):
        super().__init__(
            agent_id="dept_bd_006",
            dept_name="Business Development B2B",
            dept_lead="Head of BD"
        )
        self._kpis = {
            "active_edge_nodes": 0,
            "total_enterprise_clients": 0,
            "clients_onboarding": 0,
            "edge_nodes_offline": 0,
            "avg_gas_consumption_per_client_usd": 0.0,
            "total_webhooks_processed_today": 0,
            "pipeline_open_deals": 0,
            "pipeline_value_usd": 0.0,
            "sectors_active": 0,
            "mrr_usd": 0.0
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:monitor-edge-node",
            "mcp:predict-demand",
            "mcp:score-supplier"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_edge_nodes(),
            self._check_client_pipeline(),
            self._check_sector_activity(),
        )

    async def _check_edge_nodes(self):
        """Monitoriza todos los edge nodes desplegados en clientes."""
        result = await self.call_mcp_tool("monitor-edge-node", {"scope": "all"})
        if result:
            nodes = result.get("nodes", [])
            online = [n for n in nodes if n.get("status") == "online"]
            offline = [n for n in nodes if n.get("status") != "online"]
            self._kpis["active_edge_nodes"] = len(online)
            self._kpis["edge_nodes_offline"] = len(offline)
            self._kpis["total_webhooks_processed_today"] = result.get("webhooks_today", 0)
            if offline:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"{len(offline)} Edge Node(s) offline — clients may be impacted",
                    {"offline_nodes": [n.get("client_name") for n in offline]}
                )

    async def _check_client_pipeline(self):
        result = await self.call_api("GET", "/analytics/clients")
        if result:
            self._kpis["total_enterprise_clients"] = result.get("total", 0)
            self._kpis["clients_onboarding"] = result.get("onboarding", 0)
            self._kpis["pipeline_open_deals"] = result.get("pipeline_deals", 0)
            self._kpis["pipeline_value_usd"] = result.get("pipeline_value_usd", 0)
            self._kpis["mrr_usd"] = result.get("mrr_usd", 0)
            self._kpis["avg_gas_consumption_per_client_usd"] = result.get("avg_gas_usd", 0)

    async def _check_sector_activity(self):
        result = await self.call_api("GET", "/sectors")
        if result:
            active = len([s for s in result.get("sectors", []) if s.get("active_clients", 0) > 0])
            self._kpis["sectors_active"] = active


# ======================================================================
# AGENTE 07 — Marketing & Comunidad
# ======================================================================

class MarketingCommunityAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 7200  # Cada 2 horas

    def __init__(self):
        super().__init__(
            agent_id="dept_mktg_007",
            dept_name="Marketing & Comunidad",
            dept_lead="CMO"
        )
        self._kpis = {
            "bez_holders_total": 0,
            "dao_active_voters": 0,
            "community_sentiment_score": 0.0,
            "new_leads_this_week": 0,
            "email_open_rate_pct": 0.0,
            "linkedin_response_rate_pct": 0.0,
            "content_pieces_this_month": 0,
            "token_price_usd": 0.10,
            "token_market_cap_usd": 0.0,
            "social_mentions_today": 0
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:analyze-sentiment",
            "mcp:analyze-market",
            "mcp:predict-demand"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_community_sentiment(),
            self._check_token_market(),
            self._check_lead_pipeline(),
        )

    async def _check_community_sentiment(self):
        """Analiza el sentimiento de la comunidad DAO y holders."""
        result = await self.call_aegis("sentiment-analyzer", {
            "source": "dao_forum",
            "window_hours": 24
        })
        if result:
            score = float(result.get("sentiment_score", 0.5))
            self._kpis["community_sentiment_score"] = round(score, 3)
            if score < 0.3:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"Community sentiment very negative: {score:.2f} — check DAO forum",
                    result
                )

    async def _check_token_market(self):
        result = await self.call_mcp_tool("analyze-market", {"token": "BEZ"})
        if result:
            price = float(result.get("price_usd", 0.10))
            self._kpis["token_price_usd"] = price
            self._kpis["token_market_cap_usd"] = price * 100_000_000
            self._kpis["bez_holders_total"] = result.get("holders", 0)
            if price < 0.05:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"BEZ-Coin price dropped below $0.05: current ${price:.4f}",
                    {"price": price}
                )

    async def _check_lead_pipeline(self):
        result = await self.call_api("GET", "/analytics/marketing")
        if result:
            self._kpis["new_leads_this_week"] = result.get("new_leads_week", 0)
            self._kpis["email_open_rate_pct"] = result.get("email_open_rate", 0)
            self._kpis["linkedin_response_rate_pct"] = result.get("linkedin_response_rate", 0)
            self._kpis["content_pieces_this_month"] = result.get("content_month", 0)


# ======================================================================
# AGENTE 08 — Finanzas & Tesorería
# ======================================================================

class FinanceTreasuryAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 1800  # Cada 30 min

    GAS_TANK_LOW_THRESHOLD_USD = 100.0
    GAS_TANK_CRITICAL_THRESHOLD_USD = 20.0
    AUTO_RECHARGE_TRIGGER_PCT = 10

    def __init__(self):
        super().__init__(
            agent_id="dept_finance_008",
            dept_name="Finanzas & Tesorería",
            dept_lead="CFO"
        )
        self._kpis = {
            "total_fiat_revenue_usd_month": 0.0,
            "stripe_mrr_usd": 0.0,
            "gas_tank_total_balance_usd": 0.0,
            "clients_below_gas_threshold": 0,
            "auto_recharge_triggered_today": 0,
            "bridge_fees_collected_usd_today": 0.0,
            "platform_fees_collected_usd_today": 0.0,
            "treasury_onchain_bez": 0.0,
            "operational_costs_usd_month": 0.0,
            "net_margin_pct": 0.0
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:analyze-market",
            "mcp:calculate-smart-swap"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_gas_tanks(),
            self._check_revenue(),
            self._check_platform_fees(),
        )

    async def _check_gas_tanks(self):
        """Verifica los tanques de gas de todos los clientes enterprise."""
        result = await self.call_api("GET", "/analytics/gas-tanks")
        if result:
            tanks = result.get("tanks", [])
            low_clients = [t for t in tanks if t.get("balance_usd", 0) < self.GAS_TANK_LOW_THRESHOLD_USD]
            critical_clients = [t for t in tanks if t.get("balance_usd", 0) < self.GAS_TANK_CRITICAL_THRESHOLD_USD]
            total_balance = sum(t.get("balance_usd", 0) for t in tanks)
            self._kpis["gas_tank_total_balance_usd"] = total_balance
            self._kpis["clients_below_gas_threshold"] = len(low_clients)

            if critical_clients:
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"{len(critical_clients)} client(s) with CRITICAL gas balance — their Edge Nodes will stop",
                    {"clients": [c.get("client_name") for c in critical_clients]}
                )
            elif low_clients:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"{len(low_clients)} client(s) with low gas balance — auto-recharge pending",
                    {"clients": [c.get("client_name") for c in low_clients]}
                )

    async def _check_revenue(self):
        result = await self.call_api("GET", "/analytics/revenue")
        if result:
            self._kpis["stripe_mrr_usd"] = result.get("stripe_mrr", 0)
            self._kpis["total_fiat_revenue_usd_month"] = result.get("total_revenue_month", 0)
            self._kpis["operational_costs_usd_month"] = result.get("costs_month", 0)
            revenue = result.get("total_revenue_month", 0)
            costs = result.get("costs_month", 1)
            self._kpis["net_margin_pct"] = round(((revenue - costs) / max(revenue, 1)) * 100, 1)

    async def _check_platform_fees(self):
        result = await self.call_api("GET", "/analytics/fees")
        if result:
            self._kpis["platform_fees_collected_usd_today"] = result.get("platform_fees_today_usd", 0)
            self._kpis["bridge_fees_collected_usd_today"] = result.get("bridge_fees_today_usd", 0)


# ======================================================================
# AGENTE 09 — Customer Success & Soporte
# ======================================================================

class CustomerSuccessAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 900  # Cada 15 min

    def __init__(self):
        super().__init__(
            agent_id="dept_cs_009",
            dept_name="Customer Success & Soporte",
            dept_lead="Head of CS"
        )
        self._kpis = {
            "open_support_tickets": 0,
            "avg_resolution_time_hours": 0.0,
            "clients_onboarded_this_month": 0,
            "avg_onboarding_time_minutes": 0.0,
            "client_satisfaction_score": 0.0,
            "edge_nodes_needing_attention": 0,
            "erp_integration_errors_today": 0,
            "sla_breaches_this_month": 0,
            "webhook_success_rate_pct": 0.0
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:monitor-edge-node",
            "mcp:system-health",
            "mcp:optimize-route"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_support_tickets(),
            self._check_onboarding_health(),
            self._check_webhook_success(),
        )

    async def _check_support_tickets(self):
        result = await self.call_api("GET", "/analytics/support")
        if result:
            open_tickets = result.get("open_tickets", 0)
            avg_hours = result.get("avg_resolution_hours", 0)
            sla_breaches = result.get("sla_breaches_month", 0)
            self._kpis["open_support_tickets"] = open_tickets
            self._kpis["avg_resolution_time_hours"] = avg_hours
            self._kpis["sla_breaches_this_month"] = sla_breaches
            if sla_breaches > 0:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"{sla_breaches} SLA breach(es) this month — review support capacity",
                    {"breaches": sla_breaches, "open_tickets": open_tickets}
                )

    async def _check_onboarding_health(self):
        result = await self.call_api("GET", "/analytics/onboarding")
        if result:
            onboarded = result.get("clients_onboarded_month", 0)
            avg_time = result.get("avg_onboarding_minutes", 0)
            self._kpis["clients_onboarded_this_month"] = onboarded
            self._kpis["avg_onboarding_time_minutes"] = avg_time
            if avg_time > 60:
                await self.emit_alert(
                    AlertLevel.INFO,
                    f"Onboarding taking longer than expected: {avg_time:.0f} min avg (target: 5 min)",
                    {"avg_minutes": avg_time}
                )

    async def _check_webhook_success(self):
        result = await self.call_api("GET", "/analytics/webhooks")
        if result:
            success_rate = float(result.get("success_rate_pct", 100))
            erp_errors = result.get("erp_errors_today", 0)
            self._kpis["webhook_success_rate_pct"] = success_rate
            self._kpis["erp_integration_errors_today"] = erp_errors
            if success_rate < 95:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"Webhook success rate low: {success_rate:.1f}% (threshold 95%)",
                    {"success_rate": success_rate, "erp_errors": erp_errors}
                )


# ======================================================================
# AGENTE 10 — Legal & Regulatorio
# ======================================================================

class LegalRegulatoryAgent(BaseDeptAgent):

    CYCLE_INTERVAL_SECONDS = 86400  # Una vez al día — datos de compliance

    def __init__(self):
        super().__init__(
            agent_id="dept_legal_010",
            dept_name="Legal & Regulatorio",
            dept_lead="General Counsel"
        )
        self._kpis = {
            "kyc_pending_reviews": 0,
            "kyc_approved_this_month": 0,
            "kyc_rejected_this_month": 0,
            "high_value_rwa_pending_kyc": 0,
            "compliance_checks_passed_today": 0,
            "compliance_checks_failed_today": 0,
            "active_legal_contracts": 0,
            "contracts_expiring_30d": 0,
            "mica_compliance_status": "pending_review",
            "gdpr_data_requests_open": 0,
            "governance_proposals_legal_review": 0
        }

    def get_tools(self) -> List[str]:
        return [
            "mcp:verify-compliance",
            "mcp:audit-contract",
            "mcp:assess-fraud-risk"
        ]

    def get_kpis(self) -> Dict[str, Any]:
        return self._kpis.copy()

    async def execute(self):
        await asyncio.gather(
            self._check_kyc_queue(),
            self._check_compliance_status(),
            self._check_legal_contracts(),
            self._check_governance_review(),
        )

    async def _check_kyc_queue(self):
        """Verifica la cola KYC/AML — alertas para transacciones >10% supply RWA."""
        result = await self.call_api("GET", "/analytics/kyc")
        if result:
            pending = result.get("pending", 0)
            approved = result.get("approved_month", 0)
            rejected = result.get("rejected_month", 0)
            high_value = result.get("high_value_rwa_pending", 0)
            self._kpis["kyc_pending_reviews"] = pending
            self._kpis["kyc_approved_this_month"] = approved
            self._kpis["kyc_rejected_this_month"] = rejected
            self._kpis["high_value_rwa_pending_kyc"] = high_value
            if high_value > 0:
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"{high_value} high-value RWA purchase(s) BLOCKED pending KYC (>10% supply threshold)",
                    {"pending_kyc": high_value}
                )
            if pending > 20:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"KYC queue backlog: {pending} reviews pending",
                    {"pending": pending}
                )

    async def _check_compliance_status(self):
        result = await self.call_mcp_tool("verify-compliance", {"scope": "platform_daily"})
        if result:
            passed = result.get("checks_passed", 0)
            failed = result.get("checks_failed", 0)
            self._kpis["compliance_checks_passed_today"] = passed
            self._kpis["compliance_checks_failed_today"] = failed
            self._kpis["mica_compliance_status"] = result.get("mica_status", "unknown")
            if failed > 0:
                await self.emit_alert(
                    AlertLevel.CRITICAL,
                    f"{failed} compliance check(s) FAILED — immediate legal review required",
                    {"failed_checks": result.get("failed_details", [])}
                )

    async def _check_legal_contracts(self):
        result = await self.call_api("GET", "/analytics/legal-contracts")
        if result:
            self._kpis["active_legal_contracts"] = result.get("active", 0)
            expiring = result.get("expiring_30d", 0)
            self._kpis["contracts_expiring_30d"] = expiring
            gdpr_requests = result.get("gdpr_open_requests", 0)
            self._kpis["gdpr_data_requests_open"] = gdpr_requests
            if expiring > 0:
                await self.emit_alert(
                    AlertLevel.INFO,
                    f"{expiring} legal contract(s) expiring in the next 30 days — schedule renewal",
                    {"expiring": expiring}
                )
            if gdpr_requests > 0:
                await self.emit_alert(
                    AlertLevel.WARNING,
                    f"{gdpr_requests} GDPR data request(s) pending response (30-day legal deadline)",
                    {"gdpr_requests": gdpr_requests}
                )

    async def _check_governance_review(self):
        result = await self.call_api("GET", "/gateway/v1/governance/proposals")
        if result:
            needs_review = len([
                p for p in result.get("proposals", [])
                if p.get("status") == "active" and not p.get("legal_reviewed", False)
            ])
            self._kpis["governance_proposals_legal_review"] = needs_review
            if needs_review > 0:
                await self.emit_alert(
                    AlertLevel.INFO,
                    f"{needs_review} DAO governance proposal(s) require legal review before vote",
                    {"proposals_pending": needs_review}
                )
