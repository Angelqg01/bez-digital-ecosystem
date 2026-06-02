"""
BeZhas Aegis — Actions Engine para Agentes Departamentales
Sistema de acciones automáticas de remediación y notificación.

Los agentes no solo monitorean — también actúan:
  - Slack / webhook notifications para alertas críticas
  - Auto-remediation: recargar gas tanks, pausar contratos, etc.
  - Email dispatch para compliance y reportes
  - Ticket creation para Customer Success
  - On-chain actions via API (llamar setPlatformFee, setMinimumFee, etc.)
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
import httpx

logger = logging.getLogger(__name__)


class ActionType(str, Enum):
    NOTIFY_SLACK       = "notify_slack"
    NOTIFY_EMAIL       = "notify_email"
    NOTIFY_WEBHOOK     = "notify_webhook"
    CALL_API           = "call_api"
    CALL_ON_CHAIN      = "call_on_chain"
    AUTO_RECHARGE_GAS  = "auto_recharge_gas"
    PAUSE_CONTRACT     = "pause_contract"
    RESUME_CONTRACT    = "resume_contract"
    CREATE_TICKET      = "create_ticket"
    TRIGGER_AUDIT      = "trigger_audit"
    LOG_COMPLIANCE     = "log_compliance"


class ActionStatus(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"
    SKIPPED   = "skipped"


@dataclass
class ActionResult:
    action_type: str
    status: ActionStatus
    message: str
    data: Dict = None
    executed_at: str = None

    def __post_init__(self):
        if self.executed_at is None:
            self.executed_at = datetime.now(timezone.utc).isoformat()
        if self.data is None:
            self.data = {}


class ActionsEngine:
    """
    Motor de acciones para agentes departamentales de BeZhas.
    Cada agente tiene su propia instancia pero comparten el http client.
    """

    API_BASE = "http://localhost:3001/api"
    AEGIS_BASE = "http://localhost:8001"

    def __init__(
        self,
        agent_id: str,
        http_client: httpx.AsyncClient,
        slack_webhook_url: Optional[str] = None,
        email_endpoint: Optional[str] = None,
    ):
        self.agent_id = agent_id
        self._http = http_client
        self.slack_webhook_url = slack_webhook_url
        self.email_endpoint = email_endpoint
        self._action_history: List[ActionResult] = []

    # ------------------------------------------------------------------ #
    #  Notifications                                                      #
    # ------------------------------------------------------------------ #

    async def notify_slack(
        self,
        message: str,
        level: str = "info",
        fields: Dict[str, str] = None,
    ) -> ActionResult:
        """
        Envía notificación a Slack via webhook.
        Si no hay webhook configurado, hace fallback a log.
        """
        if not self.slack_webhook_url:
            logger.info(f"[Actions][{self.agent_id}] Slack (no webhook): {message}")
            return ActionResult(ActionType.NOTIFY_SLACK, ActionStatus.SKIPPED, "No Slack webhook configured")

        color_map = {"info": "#36a64f", "warning": "#ffaa00", "critical": "#ff0000"}
        payload = {
            "attachments": [{
                "color": color_map.get(level, "#36a64f"),
                "title": f"[BeZhas][{self.agent_id}] {level.upper()}",
                "text": message,
                "fields": [{"title": k, "value": v, "short": True} for k, v in (fields or {}).items()],
                "footer": f"BeZhas Dept Agent • {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            }]
        }
        try:
            r = await self._http.post(self.slack_webhook_url, json=payload, timeout=10.0)
            r.raise_for_status()
            result = ActionResult(ActionType.NOTIFY_SLACK, ActionStatus.COMPLETED, "Sent")
        except Exception as e:
            logger.warning(f"[Actions][{self.agent_id}] Slack failed: {e}")
            result = ActionResult(ActionType.NOTIFY_SLACK, ActionStatus.FAILED, str(e))
        self._record(result)
        return result

    async def notify_webhook(
        self, url: str, payload: Dict, timeout: float = 15.0
    ) -> ActionResult:
        """Envía notificación a cualquier endpoint webhook externo."""
        try:
            r = await self._http.post(url, json={
                "agent_id": self.agent_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                **payload
            }, timeout=timeout)
            r.raise_for_status()
            result = ActionResult(ActionType.NOTIFY_WEBHOOK, ActionStatus.COMPLETED, f"HTTP {r.status_code}")
        except Exception as e:
            result = ActionResult(ActionType.NOTIFY_WEBHOOK, ActionStatus.FAILED, str(e))
        self._record(result)
        return result

    # ------------------------------------------------------------------ #
    #  Finance / Gas Tank Actions                                        #
    # ------------------------------------------------------------------ #

    async def trigger_gas_recharge(self, client_id: str, amount_usd: float) -> ActionResult:
        """
        Dispara la recarga de gas para un cliente enterprise.
        Llama al gasMonitor del API backend que usa Stripe internamente.
        """
        try:
            r = await self._http.post(
                f"{self.API_BASE}/gas/recharge",
                json={"client_id": client_id, "amount_usd": amount_usd},
                timeout=30.0
            )
            r.raise_for_status()
            data = r.json()
            result = ActionResult(
                ActionType.AUTO_RECHARGE_GAS,
                ActionStatus.COMPLETED,
                f"Recharged ${amount_usd} for client {client_id}",
                data
            )
            logger.info(f"[Actions][{self.agent_id}] Gas recharge triggered for {client_id}: ${amount_usd}")
        except Exception as e:
            result = ActionResult(ActionType.AUTO_RECHARGE_GAS, ActionStatus.FAILED, str(e))
            logger.error(f"[Actions][{self.agent_id}] Gas recharge failed: {e}")
        self._record(result)
        return result

    # ------------------------------------------------------------------ #
    #  Security / Contract Actions                                       #
    # ------------------------------------------------------------------ #

    async def pause_contract(self, contract_name: str, reason: str) -> ActionResult:
        """
        Pausa un contrato inteligente via el API backend (SecurityModule).
        Requiere que el agente tenga permisos de guardian.
        """
        try:
            r = await self._http.post(
                f"{self.API_BASE}/contracts/pause",
                json={"contract": contract_name, "reason": reason, "paused_by": self.agent_id},
                timeout=30.0
            )
            r.raise_for_status()
            result = ActionResult(
                ActionType.PAUSE_CONTRACT,
                ActionStatus.COMPLETED,
                f"Contract '{contract_name}' paused. Reason: {reason}"
            )
            logger.warning(f"[Actions][{self.agent_id}] Paused contract: {contract_name}")
        except Exception as e:
            result = ActionResult(ActionType.PAUSE_CONTRACT, ActionStatus.FAILED, str(e))
        self._record(result)
        return result

    async def resume_contract(self, contract_name: str) -> ActionResult:
        """Reanuda un contrato pausado."""
        try:
            r = await self._http.post(
                f"{self.API_BASE}/contracts/resume",
                json={"contract": contract_name, "resumed_by": self.agent_id},
                timeout=30.0
            )
            r.raise_for_status()
            result = ActionResult(
                ActionType.RESUME_CONTRACT,
                ActionStatus.COMPLETED,
                f"Contract '{contract_name}' resumed"
            )
        except Exception as e:
            result = ActionResult(ActionType.RESUME_CONTRACT, ActionStatus.FAILED, str(e))
        self._record(result)
        return result

    async def trigger_incident_report(self, title: str, description: str, severity: str = "medium") -> ActionResult:
        """Crea un incidente en el sistema via AutoHealer de Aegis."""
        try:
            r = await self._http.post(
                f"{self.AEGIS_BASE}/autohealer/incident",
                json={
                    "title": title,
                    "description": description,
                    "severity": severity,
                    "reporter": self.agent_id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                },
                timeout=15.0
            )
            r.raise_for_status()
            data = r.json()
            result = ActionResult(
                ActionType.TRIGGER_AUDIT,
                ActionStatus.COMPLETED,
                f"Incident created: {data.get('incident_id', 'unknown')}",
                data
            )
        except Exception as e:
            result = ActionResult(ActionType.TRIGGER_AUDIT, ActionStatus.FAILED, str(e))
        self._record(result)
        return result

    # ------------------------------------------------------------------ #
    #  Customer Success Actions                                          #
    # ------------------------------------------------------------------ #

    async def create_support_ticket(
        self,
        client_id: str,
        subject: str,
        description: str,
        priority: str = "medium"
    ) -> ActionResult:
        """Abre un ticket de soporte para un cliente enterprise."""
        try:
            r = await self._http.post(
                f"{self.API_BASE}/notifications/ticket",
                json={
                    "client_id": client_id,
                    "subject": subject,
                    "description": description,
                    "priority": priority,
                    "created_by": self.agent_id
                },
                timeout=15.0
            )
            r.raise_for_status()
            result = ActionResult(
                ActionType.CREATE_TICKET,
                ActionStatus.COMPLETED,
                f"Ticket created for client {client_id}: {subject}"
            )
        except Exception as e:
            result = ActionResult(ActionType.CREATE_TICKET, ActionStatus.FAILED, str(e))
        self._record(result)
        return result

    # ------------------------------------------------------------------ #
    #  Legal / Compliance Actions                                        #
    # ------------------------------------------------------------------ #

    async def log_compliance_event(
        self,
        event_type: str,
        details: Dict,
        regulation: str = "MiCA"
    ) -> ActionResult:
        """Registra un evento de compliance en el audit log on-chain."""
        try:
            r = await self._http.post(
                f"{self.API_BASE}/analytics/compliance-log",
                json={
                    "event_type": event_type,
                    "regulation": regulation,
                    "details": details,
                    "logged_by": self.agent_id,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                },
                timeout=15.0
            )
            r.raise_for_status()
            result = ActionResult(ActionType.LOG_COMPLIANCE, ActionStatus.COMPLETED, f"Logged: {event_type}")
        except Exception as e:
            result = ActionResult(ActionType.LOG_COMPLIANCE, ActionStatus.FAILED, str(e))
        self._record(result)
        return result

    # ------------------------------------------------------------------ #
    #  History                                                           #
    # ------------------------------------------------------------------ #

    def _record(self, result: ActionResult):
        self._action_history.append(result)
        if len(self._action_history) > 200:
            self._action_history = self._action_history[-200:]

    def get_history(self, limit: int = 20) -> List[Dict]:
        from dataclasses import asdict
        return [asdict(r) for r in self._action_history[-limit:]]

    def get_failed_actions(self) -> List[Dict]:
        from dataclasses import asdict
        return [asdict(r) for r in self._action_history if r.status == ActionStatus.FAILED]
