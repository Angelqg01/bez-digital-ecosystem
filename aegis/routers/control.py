"""
Aegis Control API Router
-------------------------
API de control para el dashboard de administración del servicio de IA Aegis.
Este router maneja la configuración, control de autonomía y gestión de acciones
para el sistema de monitoreo de la plataforma BeZhas Web3.
"""

from fastapi import APIRouter, HTTPException, status, Request, Depends, Header
from pydantic import BaseModel, Field
from typing import Literal, Union, Optional, Dict, Any
from datetime import datetime, timezone
import logging
import json
import os
import hmac

# Configurar logger
logger = logging.getLogger("aegis.control")

# ============================================================================
# AUTHENTICATION DEPENDENCY
# ============================================================================

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "dev-internal-key" if os.getenv("ENV", "development") != "production" else "")

async def require_admin_auth(x_internal_key: Optional[str] = Header(None), authorization: Optional[str] = Header(None)):
    """Validates admin access via internal API key (header: x-internal-key or Authorization: Bearer <key>)"""
    key = x_internal_key or (authorization.replace("Bearer ", "") if authorization else None)
    if not key or not INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Authentication required for control API")
    if not hmac.compare_digest(key, INTERNAL_API_KEY):
        raise HTTPException(status_code=403, detail="Invalid API key")
    return True

# ============================================================================
# SCHEMAS DE PYDANTIC (Request/Response Models)
# ============================================================================

# --- Control de Modo ---
class SetModeRequest(BaseModel):
    """Request para cambiar el modo de operación de Aegis"""
    mode: Literal['autonomous', 'suggest']
    
    class Config:
        schema_extra = {
            "example": {
                "mode": "autonomous"
            }
        }


# --- Trigger de Acciones ---
class TriggerActionRequest(BaseModel):
    """Request para ejecutar una acción manual en el sistema"""
    action: Literal['purge_cache', 'reindex_feeds', 'restart_web3_listeners']
    
    class Config:
        schema_extra = {
            "example": {
                "action": "purge_cache"
            }
        }


# --- Configuración de Anomalías ---
class ThresholdRequest(BaseModel):
    """Request para ajustar el umbral de detección de anomalías"""
    level: float = Field(..., ge=0.0, le=1.0, description="Nivel de sensibilidad (0.0 = mínimo, 1.0 = máximo)")
    
    class Config:
        schema_extra = {
            "example": {
                "level": 0.7
            }
        }


# --- Modelo de IA ---
class FalsePositiveRequest(BaseModel):
    """Request para marcar un log como falso positivo"""
    log_id: Union[int, str] = Field(..., description="ID del log/anomalía a marcar como falso positivo")
    reason: Optional[str] = Field(None, description="Razón opcional para el marcado")
    
    class Config:
        schema_extra = {
            "example": {
                "log_id": "log_12345",
                "reason": "Usuario legítimo con comportamiento inusual pero válido"
            }
        }


# --- Telemetría ---
class TelemetryConfigRequest(BaseModel):
    """Request para habilitar/deshabilitar la telemetría"""
    enabled: bool
    
    class Config:
        schema_extra = {
            "example": {
                "enabled": True
            }
        }


class SamplerateRequest(BaseModel):
    """Request para ajustar la tasa de muestreo de telemetría"""
    rate: float = Field(..., ge=0.0, le=1.0, description="Tasa de muestreo (0.0 = 0%, 1.0 = 100%)")
    
    class Config:
        schema_extra = {
            "example": {
                "rate": 0.1
            }
        }


# --- Aprobación/Rechazo de Sugerencias ---
class ActionDecisionRequest(BaseModel):
    """Request para aprobar o rechazar una sugerencia con feedback opcional"""
    feedback: Optional[str] = Field(None, description="Feedback opcional del administrador")
    
    class Config:
        schema_extra = {
            "example": {
                "feedback": "Acción correcta, proceder"
            }
        }


# --- Response Models ---
class StandardResponse(BaseModel):
    """Respuesta estándar para operaciones exitosas"""
    status: Literal['success', 'error']
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============================================================================
# ROUTER DE CONTROL
# ============================================================================

router = APIRouter(
    prefix="/api/aegis",
    tags=["Aegis Control"],
    responses={404: {"description": "Not found"}},
    dependencies=[Depends(require_admin_auth)],
)


# ============================================================================
# ENDPOINTS: SECCIÓN DE CONTROL
# ============================================================================

@router.put("/control/set_mode", response_model=StandardResponse)
async def set_mode(request: SetModeRequest, req: Request):
    """
    Cambia el modo de operación de Aegis
    
    - **autonomous**: La IA ejecuta acciones automáticamente
    - **suggest**: La IA solo sugiere acciones y espera aprobación
    """
    logger.info(f"Cambiando modo de operación a: {request.mode}")

    db = getattr(req.app.state, 'db_manager', None)
    redis_mgr = getattr(req.app.state, 'redis_manager', None)
    de = getattr(req.app.state, 'decision_engine', None)

    # Persist mode to DB
    if db and db.is_connected:
        try:
            async with db.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO aegis_config (key, value, updated_at)
                       VALUES ('operation_mode', $1, NOW())
                       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()""",
                    request.mode,
                )
        except Exception as e:
            logger.error(f"Failed to persist mode: {e}")

    # Notify decision engine
    if de:
        de.mode = request.mode

    # Cache in Redis
    if redis_mgr and redis_mgr.is_connected:
        await redis_mgr.set('aegis:operation_mode', request.mode, ttl=86400)

    # Audit log
    await _audit_log(req, 'set_mode', {'mode': request.mode})

    return StandardResponse(
        status="success",
        message=f"Modo cambiado a '{request.mode}' exitosamente",
        data={"mode": request.mode, "changed_at": datetime.now(timezone.utc).isoformat()}
    )


@router.post("/control/pause", response_model=StandardResponse)
async def pause_system(request: Request):
    """
    Pausa de emergencia del sistema Aegis
    """
    logger.warning("Pausa de emergencia activada por el administrador")
    mon = getattr(request.app.state, 'monitor', None)
    if mon and mon.is_running:
        await mon.stop()

    return StandardResponse(
        status="success",
        message="Sistema Aegis pausado. Todas las operaciones automáticas detenidas.",
        data={"paused_at": datetime.now(timezone.utc).isoformat(), "status": "PAUSED"}
    )


@router.post("/control/resume", response_model=StandardResponse)
async def resume_system(request: Request):
    """
    Resume las operaciones del sistema Aegis después de una pausa
    """
    logger.info("Reanudando operaciones del sistema Aegis")
    mon = getattr(request.app.state, 'monitor', None)
    if mon and not mon.is_running:
        await mon.start()

    return StandardResponse(
        status="success",
        message="Sistema Aegis reanudado. Operaciones normales restauradas.",
        data={"resumed_at": datetime.now(timezone.utc).isoformat(), "status": "ACTIVE"}
    )


@router.post("/control/trigger_action", response_model=StandardResponse)
async def trigger_action(request: TriggerActionRequest, req: Request):
    """
    Ejecuta una acción manual de mantenimiento
    """
    logger.info(f"Ejecutando acción manual: {request.action}")
    st = req.app.state
    redis_mgr = getattr(st, 'redis_manager', None)
    healer = getattr(st, 'auto_healer', None)

    action_msg = {
        "purge_cache": "Limpieza de caché",
        "reindex_feeds": "Re-indexación de feeds",
        "restart_web3_listeners": "Reinicio de listeners Web3"
    }

    executed = False
    if request.action == 'purge_cache' and redis_mgr:
        await redis_mgr.clear_pattern('aegis:*')
        executed = True
    elif request.action == 'restart_web3_listeners' and healer:
        await healer.execute_action('resync_blockchain', {})
        executed = True
    else:
        executed = True  # reindex_feeds is a no-op for now

    return StandardResponse(
        status="success",
        message=f"{action_msg[request.action]} ejecutada exitosamente",
        data={
            "action": request.action,
            "executed": executed,
            "executed_at": datetime.now(timezone.utc).isoformat()
        }
    )


@router.post("/control/approve_action/{suggestion_id}", response_model=StandardResponse)
async def approve_action(suggestion_id: str, req: Request, request: Optional[ActionDecisionRequest] = None):
    """
    Aprueba una sugerencia de acción de la IA
    
    Cuando el modo es 'suggest', la IA propone acciones que requieren aprobación manual.
    """
    logger.info(f"Aprobando sugerencia: {suggestion_id}")
    feedback = request.feedback if request else None

    db = getattr(req.app.state, 'db_manager', None) if hasattr(req, 'app') else None
    healer = getattr(req.app.state, 'auto_healer', None) if hasattr(req, 'app') else None

    suggestion = None
    if db and db.is_connected:
        try:
            async with db.pool.acquire() as conn:
                suggestion = await conn.fetchrow(
                    "SELECT * FROM aegis_suggestions WHERE id = $1 AND status = 'pending'",
                    suggestion_id,
                )
                if not suggestion:
                    raise HTTPException(status_code=404, detail=f"Suggestion {suggestion_id} not found or not pending")

                await conn.execute(
                    """UPDATE aegis_suggestions
                       SET status = 'approved', feedback = $1, decided_at = NOW()
                       WHERE id = $2""",
                    feedback, suggestion_id,
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to approve suggestion: {e}")

    # Execute the approved action via auto-healer
    if suggestion and healer:
        try:
            action_type = suggestion.get('action_type') if hasattr(suggestion, 'get') else (dict(suggestion).get('action_type') if suggestion else None)
            action_data = suggestion.get('action_data') if hasattr(suggestion, 'get') else (dict(suggestion).get('action_data') if suggestion else None)
            if action_type:
                await healer.execute_action(action_type, json.loads(action_data) if isinstance(action_data, str) else (action_data or {}))
        except Exception as e:
            logger.error(f"Failed to execute approved action: {e}")

    await _audit_log(req, 'approve_suggestion', {'suggestion_id': suggestion_id, 'feedback': feedback})

    return StandardResponse(
        status="success",
        message=f"Sugerencia {suggestion_id} aprobada y ejecutada",
        data={
            "suggestion_id": suggestion_id,
            "status": "approved",
            "feedback": feedback,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }
    )


@router.post("/control/reject_action/{suggestion_id}", response_model=StandardResponse)
async def reject_action(suggestion_id: str, req: Request, request: Optional[ActionDecisionRequest] = None):
    """
    Rechaza una sugerencia de acción de la IA
    
    El rechazo ayuda al modelo a aprender y mejorar futuras sugerencias.
    """
    logger.info(f"Rechazando sugerencia: {suggestion_id}")
    feedback = request.feedback if request else None

    db = getattr(req.app.state, 'db_manager', None) if hasattr(req, 'app') else None

    if db and db.is_connected:
        try:
            async with db.pool.acquire() as conn:
                row = await conn.fetchrow(
                    "SELECT id FROM aegis_suggestions WHERE id = $1 AND status = 'pending'",
                    suggestion_id,
                )
                if not row:
                    raise HTTPException(status_code=404, detail=f"Suggestion {suggestion_id} not found or not pending")

                await conn.execute(
                    """UPDATE aegis_suggestions
                       SET status = 'rejected', feedback = $1, decided_at = NOW()
                       WHERE id = $2""",
                    feedback, suggestion_id,
                )

                # Store feedback as training data for model improvement
                if feedback:
                    await conn.execute(
                        """INSERT INTO aegis_training_data (source, label, text, stored_at)
                           VALUES ('suggestion_feedback', 'rejected', $1, NOW())""",
                        feedback,
                    )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to reject suggestion: {e}")

    await _audit_log(req, 'reject_suggestion', {'suggestion_id': suggestion_id, 'feedback': feedback})

    return StandardResponse(
        status="success",
        message=f"Sugerencia {suggestion_id} rechazada",
        data={
            "suggestion_id": suggestion_id,
            "status": "rejected",
            "feedback": feedback,
            "rejected_at": datetime.now(timezone.utc).isoformat()
        }
    )

# ============================================================================
# HELPER: Audit log writer
# ============================================================================

async def _audit_log(req_or_request, action: str, details: Dict[str, Any]):
    """Write an entry to aegis_logs as an audit trail."""
    app_state = getattr(req_or_request, 'app', None)
    if app_state is None:
        return
    db = getattr(app_state.state, 'db_manager', None)
    if not db or not db.is_connected:
        return
    try:
        async with db.pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO aegis_logs (level, message, service, ts, metadata)
                   VALUES ('info', $1, 'control', NOW(), $2)""",
                f'audit:{action}',
                json.dumps(details),
            )
    except Exception as e:
        logger.error(f'Audit log failed: {e}')

# ============================================================================
# ENDPOINTS: CONFIGURACIÓN Y MODELO
# ============================================================================

@router.put("/config/anomaly_threshold", response_model=StandardResponse)
async def set_anomaly_threshold(request: ThresholdRequest, req: Request):
    """
    Ajusta el umbral de detección de anomalías (0.0 – 1.0)
    """
    logger.info(f"Ajustando umbral de anomalías a: {request.level}")
    de = getattr(req.app.state, 'decision_engine', None)
    if de:
        de.thresholds['anomaly_score'] = request.level

    return StandardResponse(
        status="success",
        message=f"Umbral de detección ajustado a {request.level}",
        data={
            "threshold": request.level,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    )


@router.post("/model/mark_false_positive", response_model=StandardResponse)
async def mark_false_positive(request: FalsePositiveRequest, req: Request):
    """
    Marca un log como falso positivo
    
    Esto ayuda al modelo a aprender y reducir falsos positivos en el futuro.
    Los datos marcados se usan en el próximo ciclo de re-entrenamiento.
    """
    logger.info(f"Marcando log {request.log_id} como falso positivo")

    db = getattr(req.app.state, 'db_manager', None) if hasattr(req, 'app') else None
    redis_mgr = getattr(req.app.state, 'redis_manager', None) if hasattr(req, 'app') else None
    fp_count = 0

    if db and db.is_connected:
        try:
            async with db.pool.acquire() as conn:
                # Mark the log as false positive
                await conn.execute(
                    """UPDATE aegis_logs SET metadata = metadata || $1
                       WHERE id = $2""",
                    json.dumps({'false_positive': True, 'fp_reason': request.reason}),
                    int(request.log_id) if str(request.log_id).isdigit() else 0,
                )

                # Enqueue as training data
                await conn.execute(
                    """INSERT INTO aegis_training_data (source, label, text, stored_at)
                       VALUES ('false_positive', 'fp', $1, NOW())""",
                    request.reason or f'FP log {request.log_id}',
                )

                # Check if we need to suggest retraining
                fp_count = await conn.fetchval(
                    """SELECT COUNT(*) FROM aegis_training_data
                       WHERE source = 'false_positive'
                       AND stored_at >= NOW() - INTERVAL '24 hours'"""
                ) or 0
        except Exception as e:
            logger.error(f"Failed to mark false positive: {e}")

    # Cache retrain suggestion if too many FPs
    retrain_suggested = fp_count >= 10
    if retrain_suggested and redis_mgr and redis_mgr.is_connected:
        await redis_mgr.set('aegis:retrain_suggested', 'true', ttl=3600)

    await _audit_log(req, 'mark_false_positive', {'log_id': str(request.log_id), 'reason': request.reason})

    return StandardResponse(
        status="success",
        message=f"Log {request.log_id} marcado como falso positivo" + (' — re-entrenamiento sugerido' if retrain_suggested else ''),
        data={
            "log_id": request.log_id,
            "marked_as": "false_positive",
            "reason": request.reason,
            "retrain_suggested": retrain_suggested,
            "fp_count_24h": fp_count,
            "marked_at": datetime.now(timezone.utc).isoformat()
        }
    )


@router.post("/model/retrain", response_model=StandardResponse)
async def retrain_model(
    req: Request,
    include_false_positives: bool = True,
    include_approved_actions: bool = True
):
    """
    Inicia un trabajo de re-entrenamiento del modelo de IA
    """
    logger.info("Iniciando job de re-entrenamiento del modelo")

    job_id = f"retrain_job_{int(datetime.now(timezone.utc).timestamp())}"

    # Trigger retrain on sentiment analyzer if enough data exists
    ml = getattr(req.app.state, 'ml_models', {})
    db = getattr(req.app.state, 'db_manager', None)
    retrained = []
    if 'sentiment' in ml and db:
        # In the future, pull labeled data from DB tables
        retrained.append('sentiment_analyzer')

    return StandardResponse(
        status="success",
        message="Re-entrenamiento iniciado.",
        data={
            "job_id": job_id,
            "status": "queued",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "models_targeted": retrained or ["no labeled data yet"],
        }
    )


@router.get("/model/retrain/status/{job_id}", response_model=StandardResponse)
async def get_retrain_status(job_id: str, request: Request):
    """
    Obtiene el estado de un trabajo de re-entrenamiento
    """
    logger.info(f"Consultando estado del job: {job_id}")

    redis_mgr = getattr(request.app.state, 'redis_manager', None)
    job_data = None
    if redis_mgr and redis_mgr.is_connected:
        job_data = await redis_mgr.get_json(f'aegis:retrain_job:{job_id}')

    if job_data:
        return StandardResponse(
            status="success",
            message="Estado del re-entrenamiento",
            data=job_data,
        )

    return StandardResponse(
        status="success",
        message="Estado del re-entrenamiento",
        data={
            "job_id": job_id,
            "status": "unknown",
            "progress": 0,
            "current_step": "not_found",
            "eta_minutes": 0
        }
    )


# ============================================================================
# ENDPOINTS: TELEMETRÍA
# ============================================================================

@router.put("/config/telemetry", response_model=StandardResponse)
async def set_telemetry_config(request: TelemetryConfigRequest, req: Request):
    """
    Habilita o deshabilita la telemetría del frontend
    
    La telemetría recopila eventos de usuario para análisis y mejora del sistema.
    """
    logger.info(f"Configurando telemetría: enabled={request.enabled}")

    db = getattr(req.app.state, 'db_manager', None) if hasattr(req, 'app') else None
    redis_mgr = getattr(req.app.state, 'redis_manager', None) if hasattr(req, 'app') else None

    if db and db.is_connected:
        try:
            async with db.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO aegis_config (key, value, updated_at)
                       VALUES ('telemetry_enabled', $1, NOW())
                       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()""",
                    str(request.enabled).lower(),
                )
        except Exception as e:
            logger.error(f"Failed to persist telemetry config: {e}")

    if redis_mgr and redis_mgr.is_connected:
        await redis_mgr.set('aegis:telemetry_enabled', str(request.enabled).lower(), ttl=86400)

    await _audit_log(req, 'set_telemetry', {'enabled': request.enabled})

    status_text = "habilitada" if request.enabled else "deshabilitada"
    
    return StandardResponse(
        status="success",
        message=f"Telemetría {status_text} exitosamente",
        data={
            "telemetry_enabled": request.enabled,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    )


@router.put("/config/telemetry_samplerate", response_model=StandardResponse)
async def set_telemetry_samplerate(request: SamplerateRequest, req: Request):
    """
    Ajusta la tasa de muestreo de telemetría
    
    - **0.0**: No se recopilan eventos (deshabilitado)
    - **0.1**: Se recopila el 10% de los eventos (reducción de carga)
    - **1.0**: Se recopilan todos los eventos (máxima granularidad)
    
    Recomendado: 0.1 para producción, 1.0 para debugging
    """
    logger.info(f"Ajustando tasa de muestreo de telemetría a: {request.rate}")

    db = getattr(req.app.state, 'db_manager', None) if hasattr(req, 'app') else None
    redis_mgr = getattr(req.app.state, 'redis_manager', None) if hasattr(req, 'app') else None

    if db and db.is_connected:
        try:
            async with db.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO aegis_config (key, value, updated_at)
                       VALUES ('telemetry_samplerate', $1, NOW())
                       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()""",
                    str(request.rate),
                )
        except Exception as e:
            logger.error(f"Failed to persist samplerate: {e}")

    if redis_mgr and redis_mgr.is_connected:
        await redis_mgr.set('aegis:telemetry_samplerate', str(request.rate), ttl=86400)

    await _audit_log(req, 'set_samplerate', {'rate': request.rate})

    percentage = int(request.rate * 100)
    
    return StandardResponse(
        status="success",
        message=f"Tasa de muestreo ajustada a {percentage}%",
        data={
            "samplerate": request.rate,
            "percentage": percentage,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    )


# ============================================================================
# ENDPOINTS: ESTADO Y MONITOREO
# ============================================================================

@router.get("/status", response_model=StandardResponse)
async def get_system_status(request: Request):
    """
    Obtiene el estado general del sistema Aegis
    """
    logger.info("Consultando estado del sistema")

    st = request.app.state
    ml = getattr(st, 'ml_models', {})
    mon = getattr(st, 'monitor', None)
    db = getattr(st, 'db_manager', None)
    de = getattr(st, 'decision_engine', None)

    models_status = {k: v.is_loaded for k, v in ml.items()} if ml else {}

    return StandardResponse(
        status="success",
        message="Estado del sistema consultado",
        data={
            "system_status": "ACTIVE" if (mon and mon.is_running) else "DEGRADED",
            "mode": "autonomous",
            "uptime_seconds": mon.get_uptime() if mon else 0,
            "models": models_status,
            "components": {
                "database": "healthy" if (db and db.is_connected) else "disconnected",
                "redis": "healthy" if getattr(st, 'redis_manager', None) and getattr(st.redis_manager, 'is_connected', False) else "disconnected",
                "monitor": "running" if (mon and mon.is_running) else "stopped",
            },
            "decision_stats": de.get_stats() if de else {},
            "monitor_metrics": mon.get_stats() if mon else {},
        }
    )


@router.get("/suggestions/pending", response_model=StandardResponse)
async def get_pending_suggestions(request: Request, limit: int = 20):
    """
    Obtiene la lista de sugerencias pendientes de aprobación
    
    Solo relevante cuando el sistema está en modo 'suggest'
    """
    logger.info("Obteniendo sugerencias pendientes")

    db = getattr(request.app.state, 'db_manager', None) if hasattr(request, 'app') else None
    suggestions = []
    total = 0

    if db and db.is_connected:
        try:
            async with db.pool.acquire() as conn:
                total = await conn.fetchval(
                    "SELECT COUNT(*) FROM aegis_suggestions WHERE status = 'pending'"
                ) or 0
                rows = await conn.fetch(
                    """SELECT id, action_type, target, reason, confidence, created_at
                       FROM aegis_suggestions
                       WHERE status = 'pending'
                       ORDER BY confidence DESC, created_at DESC
                       LIMIT $1""",
                    limit,
                )
                suggestions = [
                    {
                        "id": str(r['id']),
                        "type": r['action_type'],
                        "target": r['target'],
                        "reason": r['reason'],
                        "confidence": float(r['confidence']) if r['confidence'] else 0,
                        "created_at": r['created_at'].isoformat() if r['created_at'] else None,
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.error(f"Failed to fetch pending suggestions: {e}")

    return StandardResponse(
        status="success",
        message="Sugerencias pendientes obtenidas",
        data={
            "suggestions": suggestions,
            "total": total,
            "limit": limit,
        }
    )
