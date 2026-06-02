"""
BeZhas Aegis — Base Department Agent (v2)
Integra: OpenClaw · AgentBus · Metrics · Actions · ciclo completo.
"""

import asyncio, logging, time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from enum import Enum
import httpx
import redis.asyncio as aioredis

from .openclaw_client import OpenClawClient, OpenClawSkills  # noqa: F401
from .agent_bus import AgentBus, AgentBusMixin, MessageType  # noqa: F401
from .metrics import metrics as dept_metrics
from .actions import ActionsEngine

logger = logging.getLogger(__name__)


class AgentStatus(str, Enum):
    IDLE        = "idle"
    RUNNING     = "running"
    PAUSED      = "paused"
    ERROR       = "error"
    MAINTENANCE = "maintenance"


class AlertLevel(str, Enum):
    INFO     = "info"
    WARNING  = "warning"
    CRITICAL = "critical"


class BaseDeptAgent(AgentBusMixin, ABC):
    """
    Clase base completa para los 10 agentes departamentales de BeZhas.
    """

    AEGIS_BASE_URL         = "http://localhost:8001"
    API_BASE_URL           = "http://localhost:3001/api"
    RUNTIME_BASE_URL       = "http://localhost:3002"
    REDIS_URL              = "redis://localhost:6379"
    CYCLE_INTERVAL_SECONDS = 300
    ALERT_DEDUP_SECONDS    = 300

    def __init__(self, agent_id: str, dept_name: str, dept_lead: str):
        self.agent_id     = agent_id
        self.dept_name    = dept_name
        self.dept_lead    = dept_lead
        self.status       = AgentStatus.IDLE
        self.started_at:  Optional[datetime] = None
        self.last_run:    Optional[datetime] = None
        self.error_count  = 0
        self.run_count    = 0
        self.alerts:      List[Dict] = []
        self._alert_dedup: Dict[str, float] = {}
        self._redis:      Optional[aioredis.Redis] = None
        self._http:       Optional[httpx.AsyncClient] = None
        self.openclaw:    Optional[OpenClawClient] = None
        self.actions:     Optional[ActionsEngine] = None
        logger.info(f"[{self.agent_id}] Initialized — {self.dept_name}")

    # ------------------------------------------------------------------ #
    #  Lifecycle
    # ------------------------------------------------------------------ #

    async def start(self):
        self._redis   = await aioredis.from_url(self.REDIS_URL, decode_responses=True)
        self._http    = httpx.AsyncClient(timeout=30.0, limits=httpx.Limits(max_connections=20))
        self.openclaw = OpenClawClient(self.agent_id, self._http)
        self.actions  = ActionsEngine(self.agent_id, self._http)
        await self._setup_bus(self.REDIS_URL)
        self.status     = AgentStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)
        dept_metrics.set_agent_status(self.agent_id, self.dept_name, True)
        await self._publish_event("agent_started", {"agent": self.agent_id})
        logger.info(f"[{self.agent_id}] Started — all subsystems online")
        await self.on_start()

    async def stop(self):
        self.status = AgentStatus.IDLE
        dept_metrics.set_agent_status(self.agent_id, self.dept_name, False)
        await self.on_stop()
        await self._teardown_bus()
        if self._http:  await self._http.aclose()
        if self._redis: await self._redis.aclose()
        logger.info(f"[{self.agent_id}] Stopped cleanly")

    async def run_cycle(self):
        if self.status != AgentStatus.RUNNING:
            return
        t0 = time.monotonic()
        try:
            self.run_count += 1
            self.last_run   = datetime.now(timezone.utc)
            await self.execute()
            await self._store_state()
            dept_metrics.update_kpis(self.agent_id, self.get_kpis())
        except Exception as e:
            self.error_count += 1
            dept_metrics.record_error(self.agent_id, self.dept_name)
            self.status = AgentStatus.ERROR
            await self.emit_alert(AlertLevel.CRITICAL, f"Cycle error: {e}")
            logger.error(f"[{self.agent_id}] Cycle error: {e}", exc_info=True)
            if self.error_count < 5:
                self.status = AgentStatus.RUNNING
        finally:
            dept_metrics.record_cycle(self.agent_id, self.dept_name, time.monotonic() - t0)

    # ------------------------------------------------------------------ #
    #  Abstract interface
    # ------------------------------------------------------------------ #

    @abstractmethod
    async def execute(self): ...

    @abstractmethod
    def get_kpis(self) -> Dict[str, Any]: ...

    @abstractmethod
    def get_tools(self) -> List[str]: ...

    async def on_start(self): pass
    async def on_stop(self):  pass

    # ------------------------------------------------------------------ #
    #  External calls
    # ------------------------------------------------------------------ #

    async def call_aegis(self, model: str, payload: Dict) -> Dict:
        try:
            r = await self._http.post(f"{self.AEGIS_BASE_URL}/{model}/predict", json=payload)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"[{self.agent_id}] Aegis ({model}): {e}")
            return {}

    async def call_skill(self, skill: str, params: Dict = None) -> Dict:
        """Invoca una skill via OpenClaw."""
        if not self.openclaw:
            return {}
        return await self.openclaw.invoke(skill, params or {})

    async def call_mcp_tool(self, tool: str, params: Dict) -> Dict:
        try:
            r = await self._http.post(f"{self.RUNTIME_BASE_URL}/invoke", json={"tool": tool, "params": params})
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"[{self.agent_id}] MCP ({tool}): {e}")
            return {}

    async def call_api(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        try:
            url = f"{self.API_BASE_URL}{endpoint}"
            fn  = {"GET": self._http.get, "POST": self._http.post,
                   "PUT": self._http.put, "DELETE": self._http.delete}[method.upper()]
            r   = await fn(url, **({"json": data or {}} if method.upper() in ("POST","PUT") else {}))
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logger.warning(f"[{self.agent_id}] API {method} {endpoint}: {e}")
            return {}

    # ------------------------------------------------------------------ #
    #  Alerts with dedup
    # ------------------------------------------------------------------ #

    async def emit_alert(self, level: AlertLevel, message: str,
                         data: Dict = None, deduplicate: bool = True):
        if deduplicate:
            key  = f"{level.value}:{message[:100]}"
            now  = time.monotonic()
            if now - self._alert_dedup.get(key, 0.0) < self.ALERT_DEDUP_SECONDS:
                return
            self._alert_dedup[key] = now

        alert = {
            "agent_id": self.agent_id, "dept": self.dept_name,
            "level": level.value, "message": message,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.alerts.append(alert)
        if len(self.alerts) > 100:
            self.alerts = self.alerts[-100:]

        if self._redis:
            import json as _j
            raw = _j.dumps(alert)
            await self._redis.lpush("bezhas:dept_alerts", raw)
            await self._redis.ltrim("bezhas:dept_alerts", 0, 499)
            await self._redis.publish("bezhas:dept_alerts", raw)

        dept_metrics.record_alert(self.agent_id, self.dept_name, level.value)
        fn = logger.error if level == AlertLevel.CRITICAL else logger.warning
        fn(f"[{self.agent_id}] [{level.value.upper()}] {message}")

    # ------------------------------------------------------------------ #
    #  Events & persistence
    # ------------------------------------------------------------------ #

    async def _publish_event(self, event_type: str, data: Dict):
        if self._redis:
            import json as _j
            await self._redis.publish("bezhas:dept_events", _j.dumps({
                "type": event_type, "agent_id": self.agent_id,
                "dept": self.dept_name, "data": data,
                "ts": datetime.now(timezone.utc).isoformat()
            }))

    async def _store_state(self):
        if self._redis:
            import json as _j
            await self._redis.hset("bezhas:dept_agents", self.agent_id, _j.dumps({
                "agent_id": self.agent_id, "dept": self.dept_name,
                "status": self.status.value, "run_count": self.run_count,
                "error_count": self.error_count,
                "last_run": self.last_run.isoformat() if self.last_run else None,
                "kpis": self.get_kpis()
            }))

    # ------------------------------------------------------------------ #
    #  Info
    # ------------------------------------------------------------------ #

    def info(self) -> Dict:
        uptime = int((datetime.now(timezone.utc) - self.started_at).total_seconds()) if self.started_at else None
        return {
            "agent_id": self.agent_id, "dept_name": self.dept_name, "dept_lead": self.dept_lead,
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "last_run":   self.last_run.isoformat()   if self.last_run   else None,
            "uptime_secs": uptime, "run_count": self.run_count, "error_count": self.error_count,
            "tools": self.get_tools(), "kpis": self.get_kpis(),
            "recent_alerts": self.alerts[-5:],
            "action_history": self.actions.get_history(5) if self.actions else [],
        }
