"""
BeZhas Aegis — SSE Streaming para Agentes Departamentales
Server-Sent Events en tiempo real para el Control Center dashboard.

Streams disponibles:
  GET /dept-agents/stream             — Todos los eventos de todos los agentes
  GET /dept-agents/stream/{agent_id}  — Eventos de un agente específico
  GET /dept-agents/stream/alerts      — Solo alertas (todas las prioridades)

Formato SSE:
  data: {"type": "kpi_update", "agent_id": "dept_eng_001", "kpis": {...}}
  data: {"type": "alert", "level": "critical", "message": "...", "dept": "..."}
  data: {"type": "agent_status", "agent_id": "...", "status": "running"}
  data: {"type": "heartbeat", "ts": "2026-04-22T..."}
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, Optional

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

sse_router = APIRouter(prefix="/dept-agents", tags=["Department Agents SSE"])

REDIS_URL = "redis://localhost:6379"
HEARTBEAT_INTERVAL = 15  # segundos


# ------------------------------------------------------------------ #
#  SSE helpers                                                        #
# ------------------------------------------------------------------ #

def _sse_format(data: Dict, event: str = None, id: str = None) -> str:
    """Formatea un evento SSE correctamente."""
    lines = []
    if id:
        lines.append(f"id: {id}")
    if event:
        lines.append(f"event: {event}")
    lines.append(f"data: {json.dumps(data)}")
    lines.append("")  # blank line terminates event
    lines.append("")
    return "\n".join(lines)


def _heartbeat() -> str:
    return _sse_format(
        {"type": "heartbeat", "ts": datetime.now(timezone.utc).isoformat()},
        event="heartbeat"
    )


# ------------------------------------------------------------------ #
#  Event generators                                                   #
# ------------------------------------------------------------------ #

async def _stream_all_events(manager, request: Request) -> AsyncGenerator[str, None]:
    """
    Genera un stream SSE con todos los eventos de todos los agentes.
    Fusiona:
      1. Canal Redis bezhas:dept_events (eventos en tiempo real)
      2. Canal Redis bezhas:dept_alerts (alertas)
      3. Heartbeat cada HEARTBEAT_INTERVAL segundos
      4. Snapshot inicial de KPIs al conectar
    """
    # Snapshot inicial
    for agent in manager.agents.values():
        yield _sse_format({
            "type": "agent_snapshot",
            "agent_id": agent.agent_id,
            "dept": agent.dept_name,
            "status": agent.status.value,
            "kpis": agent.get_kpis(),
            "recent_alerts": agent.alerts[-3:],
        }, event="snapshot")

    yield _sse_format({"type": "stream_ready", "agent_count": len(manager.agents)}, event="ready")

    # Suscripción a Redis
    redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("bezhas:dept_events", "bezhas:dept_alerts", "bezhas:agent_broadcast")

    heartbeat_counter = 0
    last_heartbeat = asyncio.get_event_loop().time()

    try:
        while True:
            if await request.is_disconnected():
                break

            # Heartbeat periódico
            now = asyncio.get_event_loop().time()
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                heartbeat_counter += 1
                yield _heartbeat()
                # También emitir KPI snapshot periódico
                if heartbeat_counter % 4 == 0:  # cada 4 heartbeats (~1 min)
                    summary = manager.summary()
                    yield _sse_format({
                        "type": "periodic_summary",
                        "running": summary["running"],
                        "errors": summary["errors"],
                        "critical_alerts": summary["critical_alerts"],
                    }, event="summary")
                last_heartbeat = now

            # Mensajes Redis (non-blocking)
            try:
                raw = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=1.0)
            except asyncio.TimeoutError:
                raw = None

            if raw and raw.get("type") == "message":
                channel = raw.get("channel", "")
                data_str = raw.get("data", "{}")
                try:
                    data = json.loads(data_str)
                    # Determinar event type por canal
                    if "alerts" in channel:
                        event_name = "alert"
                    elif "broadcast" in channel:
                        event_name = "broadcast"
                    else:
                        event_name = "event"
                    yield _sse_format(data, event=event_name)
                except json.JSONDecodeError:
                    pass

    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe()
        await pubsub.aclose()
        await redis_client.aclose()


async def _stream_agent_events(agent_id: str, manager, request: Request) -> AsyncGenerator[str, None]:
    """Stream SSE para un agente específico."""
    if agent_id not in manager.agents:
        yield _sse_format({"type": "error", "message": f"Agent '{agent_id}' not found"}, event="error")
        return

    agent = manager.agents[agent_id]

    # Snapshot inicial del agente
    yield _sse_format({
        "type": "agent_snapshot",
        "agent_id": agent.agent_id,
        "dept": agent.dept_name,
        "status": agent.status.value,
        "kpis": agent.get_kpis(),
        "alerts": agent.alerts[-10:],
    }, event="snapshot")

    redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("bezhas:dept_events", "bezhas:dept_alerts")

    last_heartbeat = asyncio.get_event_loop().time()

    try:
        while True:
            if await request.is_disconnected():
                break

            now = asyncio.get_event_loop().time()
            if now - last_heartbeat >= HEARTBEAT_INTERVAL:
                # KPI update del agente
                yield _sse_format({
                    "type": "kpi_update",
                    "agent_id": agent_id,
                    "status": agent.status.value,
                    "kpis": agent.get_kpis(),
                    "run_count": agent.run_count,
                    "error_count": agent.error_count,
                }, event="kpi_update")
                last_heartbeat = now

            try:
                raw = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=1.0)
            except asyncio.TimeoutError:
                raw = None

            if raw and raw.get("type") == "message":
                data_str = raw.get("data", "{}")
                try:
                    data = json.loads(data_str)
                    # Solo forwarding si es de este agente
                    if data.get("agent_id") == agent_id:
                        yield _sse_format(data, event="event")
                except json.JSONDecodeError:
                    pass

    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe()
        await pubsub.aclose()
        await redis_client.aclose()


async def _stream_alerts_only(manager, request: Request) -> AsyncGenerator[str, None]:
    """Stream SSE que emite solo alertas de todos los agentes."""
    # Alertas históricas recientes
    recent = manager.get_all_alerts()[:20]
    for alert in reversed(recent):
        yield _sse_format(alert, event="alert")

    redis_client = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("bezhas:dept_alerts")

    try:
        while True:
            if await request.is_disconnected():
                break

            try:
                raw = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=2.0)
            except asyncio.TimeoutError:
                raw = None
                yield _heartbeat()

            if raw and raw.get("type") == "message":
                data_str = raw.get("data", "{}")
                try:
                    data = json.loads(data_str)
                    yield _sse_format(data, event="alert")
                except json.JSONDecodeError:
                    pass

    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe()
        await pubsub.aclose()
        await redis_client.aclose()


# ------------------------------------------------------------------ #
#  FastAPI SSE endpoints                                              #
# ------------------------------------------------------------------ #

# Manager reference — se inyecta desde manager.py al inicializar
_manager_ref = None


def set_manager_ref(manager):
    global _manager_ref
    _manager_ref = manager


@sse_router.get("/stream", summary="Stream SSE de todos los eventos departamentales")
async def stream_all(request: Request):
    """
    Stream en tiempo real de todos los eventos de los 10 agentes.
    Incluye: KPI updates, alertas, estado, heartbeat periódico.
    Compatible con EventSource de JavaScript en el Control Center.

    Ejemplo de uso en frontend:
        const es = new EventSource('/dept-agents/stream');
        es.addEventListener('alert', e => console.log(JSON.parse(e.data)));
        es.addEventListener('kpi_update', e => updateDashboard(JSON.parse(e.data)));
    """
    if _manager_ref is None:
        return {"error": "Manager not initialized"}
    return StreamingResponse(
        _stream_all_events(_manager_ref, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )


@sse_router.get("/stream/alerts", summary="Stream SSE solo de alertas")
async def stream_alerts(request: Request):
    """Stream en tiempo real de alertas de todos los departamentos."""
    if _manager_ref is None:
        return {"error": "Manager not initialized"}
    return StreamingResponse(
        _stream_alerts_only(_manager_ref, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@sse_router.get("/stream/{agent_id}", summary="Stream SSE de un agente específico")
async def stream_agent(agent_id: str, request: Request):
    """Stream en tiempo real de un agente departamental específico."""
    if _manager_ref is None:
        return {"error": "Manager not initialized"}
    return StreamingResponse(
        _stream_agent_events(agent_id, _manager_ref, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
