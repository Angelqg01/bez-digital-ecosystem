"""
BeZhas Aegis — Métricas Prometheus para Agentes Departamentales
Expone métricas de cada agente en el formato estándar de Prometheus
para Grafana. Se integra con el scrape existente de Prometheus en :8001/metrics.

Métricas expuestas:
  bezhas_dept_agent_cycles_total          — contador de ciclos por agente
  bezhas_dept_agent_errors_total          — contador de errores por agente
  bezhas_dept_agent_alerts_total          — alertas emitidas por nivel
  bezhas_dept_agent_up                    — 1 si running, 0 si no
  bezhas_dept_agent_cycle_duration_seconds — duración del último ciclo
  bezhas_dept_kpi_*                       — KPIs numéricos por departamento
"""

import time
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Intento importar prometheus_client — es opcional
try:
    from prometheus_client import (
        Counter, Gauge, Histogram, REGISTRY,
        generate_latest, CONTENT_TYPE_LATEST
    )
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False
    logger.warning("prometheus_client not installed — metrics disabled. Run: pip install prometheus-client")


class DeptAgentMetrics:
    """
    Registro centralizado de métricas Prometheus para todos los agentes.
    Singleton — una sola instancia para todos los agentes.
    """

    _instance: Optional["DeptAgentMetrics"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._kpi_gauges: Dict[str, Any] = {}

        if not PROMETHEUS_AVAILABLE:
            self._noop = True
            return

        self._noop = False

        # --- Core agent metrics ---
        self.cycles_total = Counter(
            "bezhas_dept_agent_cycles_total",
            "Total execution cycles per department agent",
            ["agent_id", "dept"]
        )
        self.errors_total = Counter(
            "bezhas_dept_agent_errors_total",
            "Total errors per department agent",
            ["agent_id", "dept"]
        )
        self.alerts_total = Counter(
            "bezhas_dept_agent_alerts_total",
            "Total alerts emitted per agent and level",
            ["agent_id", "dept", "level"]
        )
        self.agent_up = Gauge(
            "bezhas_dept_agent_up",
            "1 if agent is running, 0 otherwise",
            ["agent_id", "dept"]
        )
        self.cycle_duration = Histogram(
            "bezhas_dept_agent_cycle_duration_seconds",
            "Duration of each agent execution cycle",
            ["agent_id", "dept"],
            buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0]
        )
        self.bus_messages_total = Counter(
            "bezhas_dept_agent_bus_messages_total",
            "Messages sent via inter-agent bus",
            ["sender_id", "target_id", "msg_type"]
        )

        # --- DeFi / Tokenomics KPIs ---
        self.staking_emission_bez = Gauge(
            "bezhas_defi_staking_emission_bez",
            "Daily BEZ emission from staking pool"
        )
        self.farming_emission_bez = Gauge(
            "bezhas_defi_farming_emission_bez",
            "Daily BEZ emission from farming pool"
        )
        self.treasury_balance_bez = Gauge(
            "bezhas_defi_treasury_balance_bez",
            "Treasury balance in BEZ"
        )
        self.staking_cap_used_pct = Gauge(
            "bezhas_defi_staking_cap_used_pct",
            "Percentage of staking daily emission cap used"
        )
        self.farming_cap_used_pct = Gauge(
            "bezhas_defi_farming_cap_used_pct",
            "Percentage of farming daily emission cap used"
        )

        # --- Security KPIs ---
        self.anomalies_detected = Gauge(
            "bezhas_security_anomalies_detected_today",
            "Number of anomalies detected today"
        )
        self.circuit_breakers_open = Gauge(
            "bezhas_security_circuit_breakers_open",
            "Number of open circuit breakers"
        )
        self.waf_blocks = Gauge(
            "bezhas_security_waf_blocks_last_hour",
            "WAF blocks in the last hour"
        )
        self.contracts_paused = Gauge(
            "bezhas_security_contracts_paused",
            "Number of paused contracts"
        )

        # --- Engineering / L2 KPIs ---
        self.l2_block_number = Gauge(
            "bezhas_eng_l2_block_number",
            "Current L2 block number"
        )
        self.l2_tps = Gauge(
            "bezhas_eng_l2_tps",
            "Current L2 transactions per second"
        )
        self.batcher_wallet_eth = Gauge(
            "bezhas_eng_batcher_wallet_eth",
            "Batcher wallet ETH balance"
        )

        # --- DevOps KPIs ---
        self.docker_services_up = Gauge(
            "bezhas_devops_docker_services_up",
            "Number of Docker services running"
        )
        self.api_latency_ms = Gauge(
            "bezhas_devops_api_latency_ms",
            "Average API response latency in ms"
        )
        self.disk_used_pct = Gauge(
            "bezhas_devops_disk_used_pct",
            "Disk usage percentage"
        )

        # --- Finance KPIs ---
        self.stripe_mrr_usd = Gauge(
            "bezhas_finance_stripe_mrr_usd",
            "Monthly recurring revenue from Stripe"
        )
        self.gas_tank_balance_usd = Gauge(
            "bezhas_finance_gas_tank_total_usd",
            "Total gas tank balance across all enterprise clients"
        )
        self.clients_below_threshold = Gauge(
            "bezhas_finance_clients_below_gas_threshold",
            "Number of clients with low gas tank balance"
        )

        # --- BD / Edge Nodes ---
        self.active_edge_nodes = Gauge(
            "bezhas_bd_active_edge_nodes",
            "Number of active enterprise edge nodes"
        )
        self.edge_nodes_offline = Gauge(
            "bezhas_bd_edge_nodes_offline",
            "Number of offline enterprise edge nodes"
        )
        self.total_enterprise_clients = Gauge(
            "bezhas_bd_total_enterprise_clients",
            "Total enterprise clients"
        )

        # --- AI KPIs ---
        self.aegis_models_healthy = Gauge(
            "bezhas_ai_aegis_models_healthy",
            "Number of healthy Aegis ML models"
        )
        self.inference_avg_ms = Gauge(
            "bezhas_ai_inference_avg_ms",
            "Average ML inference latency in ms"
        )
        self.active_sector_agents = Gauge(
            "bezhas_ai_active_sector_agents",
            "Number of active sector agents"
        )

    # ------------------------------------------------------------------ #
    #  Recording methods                                                  #
    # ------------------------------------------------------------------ #

    def record_cycle(self, agent_id: str, dept: str, duration: float):
        if self._noop:
            return
        self.cycles_total.labels(agent_id=agent_id, dept=dept).inc()
        self.cycle_duration.labels(agent_id=agent_id, dept=dept).observe(duration)

    def record_error(self, agent_id: str, dept: str):
        if self._noop:
            return
        self.errors_total.labels(agent_id=agent_id, dept=dept).inc()

    def record_alert(self, agent_id: str, dept: str, level: str):
        if self._noop:
            return
        self.alerts_total.labels(agent_id=agent_id, dept=dept, level=level).inc()

    def set_agent_status(self, agent_id: str, dept: str, is_running: bool):
        if self._noop:
            return
        self.agent_up.labels(agent_id=agent_id, dept=dept).set(1 if is_running else 0)

    def record_bus_message(self, sender: str, target: str, msg_type: str):
        if self._noop:
            return
        self.bus_messages_total.labels(
            sender_id=sender, target_id=target, msg_type=msg_type
        ).inc()

    def update_kpis(self, agent_id: str, kpis: Dict[str, Any]):
        """
        Actualiza las métricas Gauge específicas según el agente.
        Sólo actualiza los KPIs que tengan Gauge registrado.
        """
        if self._noop:
            return

        # Mapa de KPI key → atributo de métrica en esta clase
        KPI_MAP = {
            # DeFi
            "staking_daily_emission_bez": "staking_emission_bez",
            "farming_daily_emission_bez": "farming_emission_bez",
            "treasury_balance_bez": "treasury_balance_bez",
            "staking_cap_used_pct": "staking_cap_used_pct",
            "farming_cap_used_pct": "farming_cap_used_pct",
            # Security
            "anomalies_detected_today": "anomalies_detected",
            "circuit_breakers_open": "circuit_breakers_open",
            "waf_blocks_last_hour": "waf_blocks",
            "contracts_paused": "contracts_paused",
            # Engineering
            "l2_block_number": "l2_block_number",
            "l2_tps": "l2_tps",
            "batcher_wallet_eth": "batcher_wallet_eth",
            # DevOps
            "docker_services_up": "docker_services_up",
            "avg_api_latency_ms": "api_latency_ms",
            "disk_used_pct": "disk_used_pct",
            # Finance
            "stripe_mrr_usd": "stripe_mrr_usd",
            "gas_tank_total_balance_usd": "gas_tank_balance_usd",
            "clients_below_gas_threshold": "clients_below_threshold",
            # BD
            "active_edge_nodes": "active_edge_nodes",
            "edge_nodes_offline": "edge_nodes_offline",
            "total_enterprise_clients": "total_enterprise_clients",
            # AI
            "aegis_models_healthy": "aegis_models_healthy",
            "inference_avg_ms": "inference_avg_ms",
            "active_sector_agents": "active_sector_agents",
        }

        for kpi_key, metric_attr in KPI_MAP.items():
            if kpi_key in kpis:
                gauge = getattr(self, metric_attr, None)
                if gauge is not None:
                    try:
                        gauge.set(float(kpis[kpi_key]))
                    except (TypeError, ValueError):
                        pass

    # ------------------------------------------------------------------ #
    #  Export                                                             #
    # ------------------------------------------------------------------ #

    def export(self) -> bytes:
        """Exporta todas las métricas en formato Prometheus text."""
        if self._noop or not PROMETHEUS_AVAILABLE:
            return b"# prometheus_client not available\n"
        return generate_latest(REGISTRY)

    @property
    def content_type(self) -> str:
        if not PROMETHEUS_AVAILABLE:
            return "text/plain"
        return CONTENT_TYPE_LATEST


# Singleton global
metrics = DeptAgentMetrics()
