"""
BeZhas Aegis — Inter-Agent Message Bus
Sistema de mensajería entre agentes departamentales via Redis Pub/Sub.

Permite:
  - Security → Engineering: "circuit breaker abierto, revisa contratos"
  - DeFi → Finance: "daily cap alcanzado, revisar ingresos"
  - Engineering → DevOps: "build fallido, revisa pipeline"
  - BD → CS: "cliente nuevo onboarding, preparar soporte"
  - Legal → DeFi: "propuesta governance necesita revisión legal"

Canales Redis:
  bezhas:agent_bus:{target_agent_id}   — mensajes directos
  bezhas:agent_broadcast               — broadcast a todos los agentes
  bezhas:dept_events                   — eventos generales del sistema
"""

import asyncio
import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------ #
#  Message types                                                       #
# ------------------------------------------------------------------ #

class MessageType:
    # Alertas de seguridad cruzadas
    SECURITY_ALERT      = "security_alert"
    # Solicitudes de acción a otro agente
    ACTION_REQUEST      = "action_request"
    # Respuesta a una acción
    ACTION_RESPONSE     = "action_response"
    # Notificaciones informativas
    INFO                = "info"
    # Solicitud de KPIs de otro departamento
    KPI_REQUEST         = "kpi_request"
    KPI_RESPONSE        = "kpi_response"
    # Escaladas entre departamentos
    ESCALATION          = "escalation"
    # Sincronización de estado
    STATE_SYNC          = "state_sync"


@dataclass
class AgentMessage:
    """Mensaje entre agentes departamentales."""
    msg_id: str
    sender_id: str
    sender_dept: str
    target_id: str          # agent_id destino, o "broadcast"
    msg_type: str
    subject: str
    payload: Dict[str, Any] = field(default_factory=dict)
    priority: int = 5       # 1 (crítico) → 10 (info)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    requires_ack: bool = False
    correlation_id: Optional[str] = None  # para enlazar request/response

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, data: str) -> "AgentMessage":
        return cls(**json.loads(data))


# ------------------------------------------------------------------ #
#  Message Bus                                                         #
# ------------------------------------------------------------------ #

class AgentBus:
    """
    Bus de mensajería async entre agentes departamentales.
    Cada agente tiene una instancia que comparte el mismo Redis.
    """

    BROADCAST_CHANNEL = "bezhas:agent_broadcast"
    DIRECT_PREFIX = "bezhas:agent_bus:"
    HISTORY_KEY = "bezhas:agent_bus_history"
    MAX_HISTORY = 1000

    def __init__(self, agent_id: str, dept_name: str, redis_url: str = "redis://localhost:6379"):
        self.agent_id = agent_id
        self.dept_name = dept_name
        self.redis_url = redis_url
        self._pub: Optional[aioredis.Redis] = None
        self._sub: Optional[aioredis.client.PubSub] = None
        self._handlers: Dict[str, List[Callable]] = {}
        self._listen_task: Optional[asyncio.Task] = None
        self._msg_counter = 0

    async def connect(self):
        """Conecta al Redis y suscribe a los canales del agente."""
        self._pub = await aioredis.from_url(self.redis_url, decode_responses=True)
        sub_client = await aioredis.from_url(self.redis_url, decode_responses=True)
        self._sub = sub_client.pubsub()
        await self._sub.subscribe(
            self.BROADCAST_CHANNEL,
            f"{self.DIRECT_PREFIX}{self.agent_id}"
        )
        self._listen_task = asyncio.create_task(
            self._listen_loop(),
            name=f"bus_listen_{self.agent_id}"
        )
        logger.debug(f"[AgentBus][{self.agent_id}] Connected and subscribed")

    async def disconnect(self):
        if self._listen_task:
            self._listen_task.cancel()
            try:
                await self._listen_task
            except asyncio.CancelledError:
                pass
        if self._sub:
            await self._sub.unsubscribe()
            await self._sub.aclose()
        if self._pub:
            await self._pub.aclose()

    # ------------------------------------------------------------------ #
    #  Sending                                                            #
    # ------------------------------------------------------------------ #

    async def send(
        self,
        target_agent_id: str,
        msg_type: str,
        subject: str,
        payload: Dict[str, Any] = None,
        priority: int = 5,
        requires_ack: bool = False,
        correlation_id: Optional[str] = None,
    ) -> str:
        """Envía un mensaje directo a otro agente."""
        self._msg_counter += 1
        msg = AgentMessage(
            msg_id=f"{self.agent_id}_msg_{self._msg_counter}",
            sender_id=self.agent_id,
            sender_dept=self.dept_name,
            target_id=target_agent_id,
            msg_type=msg_type,
            subject=subject,
            payload=payload or {},
            priority=priority,
            requires_ack=requires_ack,
            correlation_id=correlation_id,
        )
        channel = f"{self.DIRECT_PREFIX}{target_agent_id}"
        await self._publish(channel, msg)
        return msg.msg_id

    async def broadcast(
        self,
        msg_type: str,
        subject: str,
        payload: Dict[str, Any] = None,
        priority: int = 5,
    ) -> str:
        """Envía un mensaje a todos los agentes."""
        self._msg_counter += 1
        msg = AgentMessage(
            msg_id=f"{self.agent_id}_bcast_{self._msg_counter}",
            sender_id=self.agent_id,
            sender_dept=self.dept_name,
            target_id="broadcast",
            msg_type=msg_type,
            subject=subject,
            payload=payload or {},
            priority=priority,
        )
        await self._publish(self.BROADCAST_CHANNEL, msg)
        return msg.msg_id

    async def _publish(self, channel: str, msg: AgentMessage):
        if not self._pub:
            logger.warning(f"[AgentBus][{self.agent_id}] Not connected, message dropped")
            return
        data = msg.to_json()
        await self._pub.publish(channel, data)
        # Guardar en historial
        await self._pub.lpush(self.HISTORY_KEY, data)
        await self._pub.ltrim(self.HISTORY_KEY, 0, self.MAX_HISTORY - 1)
        logger.debug(f"[AgentBus][{self.agent_id}] → {msg.target_id}: {msg.subject}")

    # ------------------------------------------------------------------ #
    #  Receiving                                                          #
    # ------------------------------------------------------------------ #

    def on(self, msg_type: str, handler: Callable):
        """
        Registra un handler para un tipo de mensaje.
        Handler signature: async def handler(msg: AgentMessage) -> None
        """
        if msg_type not in self._handlers:
            self._handlers[msg_type] = []
        self._handlers[msg_type].append(handler)

    async def _listen_loop(self):
        """Loop de escucha de mensajes entrantes."""
        try:
            async for raw in self._sub.listen():
                if raw["type"] != "message":
                    continue
                try:
                    msg = AgentMessage.from_json(raw["data"])
                    # No procesar mensajes propios en broadcast
                    if msg.sender_id == self.agent_id:
                        continue
                    await self._dispatch(msg)
                except Exception as e:
                    logger.warning(f"[AgentBus][{self.agent_id}] Parse error: {e}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[AgentBus][{self.agent_id}] Listen loop error: {e}", exc_info=True)

    async def _dispatch(self, msg: AgentMessage):
        """Despacha el mensaje a los handlers registrados."""
        handlers = self._handlers.get(msg.msg_type, []) + self._handlers.get("*", [])
        if not handlers:
            logger.debug(f"[AgentBus][{self.agent_id}] No handler for '{msg.msg_type}' from {msg.sender_id}")
            return
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(msg)
                else:
                    handler(msg)
            except Exception as e:
                logger.error(f"[AgentBus][{self.agent_id}] Handler error: {e}", exc_info=True)

    # ------------------------------------------------------------------ #
    #  Convenience methods                                               #
    # ------------------------------------------------------------------ #

    async def alert_agent(self, target: str, subject: str, data: Dict = None):
        """Shortcut para enviar una alerta de seguridad a otro agente."""
        await self.send(target, MessageType.SECURITY_ALERT, subject, data, priority=1)

    async def request_kpis(self, target: str) -> str:
        """Solicita KPIs de otro agente."""
        return await self.send(target, MessageType.KPI_REQUEST, "kpi_request", priority=7)

    async def escalate(self, target: str, subject: str, data: Dict = None):
        """Escala un problema a otro departamento."""
        await self.send(target, MessageType.ESCALATION, subject, data, priority=2)

    async def get_history(self, limit: int = 50) -> List[AgentMessage]:
        """Obtiene el historial de mensajes del bus."""
        if not self._pub:
            return []
        raw_list = await self._pub.lrange(self.HISTORY_KEY, 0, limit - 1)
        messages = []
        for raw in raw_list:
            try:
                messages.append(AgentMessage.from_json(raw))
            except Exception:
                pass
        return messages


# ======================================================================
# Mixin para integrar en BaseDeptAgent
# ======================================================================

class AgentBusMixin:
    """
    Mixin que añade capacidades de mensajería a cualquier agente.
    Incluir en BaseDeptAgent junto con la inicialización del bus.

    Uso en subclases:
        await self.bus.send("dept_defi_004", MessageType.INFO, "Emission cap reached")
        await self.bus.broadcast(MessageType.SECURITY_ALERT, "Critical anomaly detected")
    """

    async def _setup_bus(self, redis_url: str):
        """Inicializa y conecta el bus de mensajes."""
        self.bus = AgentBus(self.agent_id, self.dept_name, redis_url)
        await self.bus.connect()
        self._register_bus_handlers()

    async def _teardown_bus(self):
        """Desconecta el bus limpiamente."""
        if hasattr(self, "bus"):
            await self.bus.disconnect()

    def _register_bus_handlers(self):
        """
        Registra handlers por defecto. Sobreescribir en subclases para
        añadir lógica específica del departamento.
        """
        if hasattr(self, "bus"):
            self.bus.on(MessageType.KPI_REQUEST, self._handle_kpi_request)
            self.bus.on(MessageType.SECURITY_ALERT, self._handle_security_alert)
            self.bus.on(MessageType.ESCALATION, self._handle_escalation)

    async def _handle_kpi_request(self, msg: "AgentMessage"):
        """Responde a solicitudes de KPIs con los datos actuales."""
        kpis = self.get_kpis()
        await self.bus.send(
            msg.sender_id,
            MessageType.KPI_RESPONSE,
            f"kpi_response_from_{self.agent_id}",
            {"kpis": kpis, "agent_id": self.agent_id},
            correlation_id=msg.msg_id
        )

    async def _handle_security_alert(self, msg: "AgentMessage"):
        """Procesa alertas de seguridad de otros agentes."""
        logger.warning(
            f"[{self.agent_id}] Security alert from {msg.sender_dept}: {msg.subject}"
        )

    async def _handle_escalation(self, msg: "AgentMessage"):
        """Procesa escaladas de otros departamentos."""
        logger.warning(
            f"[{self.agent_id}] Escalation from {msg.sender_dept}: {msg.subject}"
        )
