"""
BeZhas Aegis — Configuración Centralizada para Agentes Departamentales
Lee variables de entorno del .env existente de Aegis.
Proporciona un objeto de configuración tipado y validado.

Variables de entorno (añadir al .env de aegis/):
    DEPT_AGENTS_REDIS_URL=redis://localhost:6379
    DEPT_AGENTS_AEGIS_URL=http://localhost:8001
    DEPT_AGENTS_API_URL=http://localhost:3001/api
    DEPT_AGENTS_RUNTIME_URL=http://localhost:3002
    DEPT_AGENTS_SLACK_WEBHOOK=https://hooks.slack.com/...  (opcional)
    DEPT_AGENTS_EMAIL_ENDPOINT=http://localhost:3001/api/notifications/email  (opcional)
    DEPT_AGENTS_ENABLED=true
    DEPT_AGENTS_LOG_LEVEL=INFO
    DEPT_AGENTS_ENG_INTERVAL=60
    DEPT_AGENTS_DEVOPS_INTERVAL=30
    DEPT_AGENTS_AI_INTERVAL=120
    DEPT_AGENTS_DEFI_INTERVAL=300
    DEPT_AGENTS_SECURITY_INTERVAL=45
    DEPT_AGENTS_BD_INTERVAL=3600
    DEPT_AGENTS_MKTG_INTERVAL=7200
    DEPT_AGENTS_FINANCE_INTERVAL=1800
    DEPT_AGENTS_CS_INTERVAL=900
    DEPT_AGENTS_LEGAL_INTERVAL=86400
"""

import os
import logging
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class DeptAgentsConfig:
    """Configuración completa del sistema de agentes departamentales."""

    # URLs de servicios
    redis_url:    str = "redis://localhost:6379"
    aegis_url:    str = "http://localhost:8001"
    api_url:      str = "http://localhost:3001/api"
    runtime_url:  str = "http://localhost:3002"

    # Notificaciones externas (opcionales)
    slack_webhook_url: Optional[str] = None
    email_endpoint:    Optional[str] = None

    # Feature flags
    enabled:   bool = True
    log_level: str  = "INFO"

    # Ciclos de cada agente (segundos)
    interval_engineering: int = 60
    interval_devops:      int = 30
    interval_ai:          int = 120
    interval_defi:        int = 300
    interval_security:    int = 45
    interval_bd:          int = 3600
    interval_marketing:   int = 7200
    interval_finance:     int = 1800
    interval_cs:          int = 900
    interval_legal:       int = 86400

    # Límites de alertas
    alert_dedup_seconds:  int = 300
    max_alerts_per_agent: int = 100

    # Thresholds específicos
    batcher_wallet_critical_eth: float = 0.1
    batcher_wallet_warning_eth:  float = 0.3
    staking_cap_warning_pct:     float = 80.0
    gas_tank_critical_usd:       float = 20.0
    gas_tank_warning_usd:        float = 100.0
    disk_warning_pct:            float = 85.0
    api_error_rate_warning_pct:  float = 5.0
    failed_auth_warning_count:   int   = 50
    kyc_queue_warning_count:     int   = 20
    inference_latency_warning_ms: float = 500.0

    @classmethod
    def from_env(cls) -> "DeptAgentsConfig":
        """Lee configuración desde variables de entorno."""
        def _bool(key: str, default: bool) -> bool:
            val = os.getenv(key, str(default)).lower()
            return val in ("true", "1", "yes", "on")

        def _int(key: str, default: int) -> int:
            try:
                return int(os.getenv(key, str(default)))
            except (ValueError, TypeError):
                logger.warning(f"Invalid int for {key}, using default {default}")
                return default

        def _float(key: str, default: float) -> float:
            try:
                return float(os.getenv(key, str(default)))
            except (ValueError, TypeError):
                logger.warning(f"Invalid float for {key}, using default {default}")
                return default

        config = cls(
            redis_url   = os.getenv("DEPT_AGENTS_REDIS_URL",   "redis://localhost:6379"),
            aegis_url   = os.getenv("DEPT_AGENTS_AEGIS_URL",   "http://localhost:8001"),
            api_url     = os.getenv("DEPT_AGENTS_API_URL",     "http://localhost:3001/api"),
            runtime_url = os.getenv("DEPT_AGENTS_RUNTIME_URL", "http://localhost:3002"),

            slack_webhook_url = os.getenv("DEPT_AGENTS_SLACK_WEBHOOK"),
            email_endpoint    = os.getenv("DEPT_AGENTS_EMAIL_ENDPOINT"),

            enabled   = _bool("DEPT_AGENTS_ENABLED", True),
            log_level = os.getenv("DEPT_AGENTS_LOG_LEVEL", "INFO").upper(),

            interval_engineering = _int("DEPT_AGENTS_ENG_INTERVAL",      60),
            interval_devops      = _int("DEPT_AGENTS_DEVOPS_INTERVAL",    30),
            interval_ai          = _int("DEPT_AGENTS_AI_INTERVAL",        120),
            interval_defi        = _int("DEPT_AGENTS_DEFI_INTERVAL",      300),
            interval_security    = _int("DEPT_AGENTS_SECURITY_INTERVAL",  45),
            interval_bd          = _int("DEPT_AGENTS_BD_INTERVAL",        3600),
            interval_marketing   = _int("DEPT_AGENTS_MKTG_INTERVAL",      7200),
            interval_finance     = _int("DEPT_AGENTS_FINANCE_INTERVAL",   1800),
            interval_cs          = _int("DEPT_AGENTS_CS_INTERVAL",        900),
            interval_legal       = _int("DEPT_AGENTS_LEGAL_INTERVAL",     86400),

            batcher_wallet_critical_eth  = _float("DEPT_AGENTS_BATCHER_CRITICAL_ETH",  0.1),
            batcher_wallet_warning_eth   = _float("DEPT_AGENTS_BATCHER_WARNING_ETH",   0.3),
            staking_cap_warning_pct      = _float("DEPT_AGENTS_STAKING_CAP_WARNING",   80.0),
            gas_tank_critical_usd        = _float("DEPT_AGENTS_GAS_CRITICAL_USD",      20.0),
            gas_tank_warning_usd         = _float("DEPT_AGENTS_GAS_WARNING_USD",       100.0),
            disk_warning_pct             = _float("DEPT_AGENTS_DISK_WARNING_PCT",      85.0),
            api_error_rate_warning_pct   = _float("DEPT_AGENTS_API_ERROR_RATE",        5.0),
            failed_auth_warning_count    = _int("DEPT_AGENTS_AUTH_FAIL_WARNING",       50),
            kyc_queue_warning_count      = _int("DEPT_AGENTS_KYC_QUEUE_WARNING",       20),
            inference_latency_warning_ms = _float("DEPT_AGENTS_INFERENCE_LATENCY_MS", 500.0),
        )

        if config.enabled:
            logger.info("[DeptAgentsConfig] Configuration loaded from environment")
        else:
            logger.warning("[DeptAgentsConfig] Department agents are DISABLED (DEPT_AGENTS_ENABLED=false)")

        return config

    def apply_to_agents(self, agents: dict):
        """
        Aplica los intervalos y thresholds configurados a los agentes registrados.
        Llamar después de crear los agentes y antes de start_all().
        """
        interval_map = {
            "dept_eng_001":      self.interval_engineering,
            "dept_devops_002":   self.interval_devops,
            "dept_ai_003":       self.interval_ai,
            "dept_defi_004":     self.interval_defi,
            "dept_security_005": self.interval_security,
            "dept_bd_006":       self.interval_bd,
            "dept_mktg_007":     self.interval_marketing,
            "dept_finance_008":  self.interval_finance,
            "dept_cs_009":       self.interval_cs,
            "dept_legal_010":    self.interval_legal,
        }
        for agent_id, interval in interval_map.items():
            if agent_id in agents:
                agents[agent_id].CYCLE_INTERVAL_SECONDS = interval
                agents[agent_id].ALERT_DEDUP_SECONDS    = self.alert_dedup_seconds

        # URLs globales
        for agent in agents.values():
            agent.REDIS_URL        = self.redis_url
            agent.AEGIS_BASE_URL   = self.aegis_url
            agent.API_BASE_URL     = self.api_url
            agent.RUNTIME_BASE_URL = self.runtime_url

        # Slack webhook para el actions engine (se asigna tras start())
        for agent in agents.values():
            if hasattr(agent, "actions") and agent.actions:
                agent.actions.slack_webhook_url = self.slack_webhook_url
                agent.actions.email_endpoint    = self.email_endpoint

        logger.info(f"[DeptAgentsConfig] Applied config to {len(agents)} agents")

    def as_dict(self) -> dict:
        """Serializa la configuración (sin credenciales sensibles)."""
        return {
            k: v for k, v in self.__dict__.items()
            if "webhook" not in k and "password" not in k
        }


# Instancia global — se inicializa una vez al arrancar Aegis
config: DeptAgentsConfig = DeptAgentsConfig.from_env()
