"""
BeZhas Aegis - AI Self-Healing & Optimization Service
FastAPI service for anomaly detection, auto-healing, and UX optimization
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import uvicorn

# ML Models
from models.anomaly_detector import AnomalyDetector
from models.ux_optimizer import UXOptimizer
from models.sentiment_analyzer import SentimentAnalyzer
from models.gas_predictor import GasPredictor
from models.validator_monitor import ValidatorMonitor

# Core systems
from core.auto_healer import AutoHealer
from core.monitor import SystemMonitor
from core.decision_engine import DecisionEngine

# Infrastructure
from utils.database import DatabaseManager
from utils.redis_manager import RedisManager

# Control router
from routers.control import router as control_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global instances
ml_models: Dict[str, Any] = {}
auto_healer: Optional[AutoHealer] = None
monitor: Optional[SystemMonitor] = None
decision_engine: Optional[DecisionEngine] = None
db_manager: Optional[DatabaseManager] = None
redis_manager: Optional[RedisManager] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Full lifecycle: DB, Redis, ML models, core systems, monitoring"""
    global ml_models, auto_healer, monitor, decision_engine, db_manager, redis_manager

    logger.info("Starting Aegis service...")

    try:
        # Database
        db_manager = DatabaseManager()
        await db_manager.connect()

        # Redis
        redis_manager = RedisManager()
        await redis_manager.connect()

        # ML models
        logger.info("Loading ML models...")
        ml_models['anomaly'] = AnomalyDetector()
        ml_models['ux_optimizer'] = UXOptimizer()
        ml_models['sentiment'] = SentimentAnalyzer()
        ml_models['gas_predictor'] = GasPredictor()
        ml_models['validator_monitor'] = ValidatorMonitor()

        await ml_models['anomaly'].load_model()
        await ml_models['ux_optimizer'].load_model()
        await ml_models['sentiment'].load_model()
        await ml_models['gas_predictor'].load_model()
        logger.info("All ML models loaded")

        # Core systems
        auto_healer = AutoHealer(db_manager, redis_manager)
        monitor = SystemMonitor(db_manager, ml_models)
        decision_engine = DecisionEngine(ml_models, auto_healer)

        # Expose globals to routers via app.state
        app.state.ml_models = ml_models
        app.state.auto_healer = auto_healer
        app.state.monitor = monitor
        app.state.decision_engine = decision_engine
        app.state.db_manager = db_manager
        app.state.redis_manager = redis_manager

        # Start background monitoring
        await monitor.start()
        logger.info("Aegis service ready!")

        yield

    except Exception as e:
        logger.error(f"Aegis startup failed: {e}")
        # Still yield so the app can serve a degraded health endpoint
        yield

    finally:
        logger.info("Shutting down Aegis service...")
        if monitor:
            await monitor.stop()
        if db_manager:
            await db_manager.disconnect()
        if redis_manager:
            await redis_manager.disconnect()
        logger.info("Aegis service stopped")


# Create FastAPI app
app = FastAPI(
    title="BeZhas Aegis",
    description="AI Self-Healing & Optimization Service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware — restrict origins in production
import os
_allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:5174").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics at /metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# ========================================
# INCLUDE ROUTERS
# ========================================

# Control router - Dashboard API for admin control
app.include_router(control_router)


# ========================================
# PYDANTIC MODELS
# ========================================

class TelemetryEvent(BaseModel):
    sessionId: str
    userId: Optional[str] = None
    eventType: str
    eventName: str
    timestamp: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    performance: Optional[Dict[str, float]] = None
    error: Optional[Dict[str, str]] = None


class Web3Event(BaseModel):
    contract: str
    event: str
    blockNumber: int
    txHash: str
    gasUsed: str
    timestamp: Optional[int] = Field(default_factory=lambda: int(datetime.now().timestamp() * 1000))
    data: Dict[str, Any] = Field(default_factory=dict)


class LogEvent(BaseModel):
    level: str
    message: str
    service: str
    timestamp: int
    metadata: Dict[str, Any] = Field(default_factory=dict)


class HealthResponse(BaseModel):
    status: str
    timestamp: int
    models_loaded: List[str]
    uptime: float


# ========================================
# ENDPOINTS
# ========================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "BeZhas Aegis",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/aegis/v1/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        models_loaded = [name for name, model in ml_models.items() if model.is_loaded]
        
        return HealthResponse(
            status="healthy",
            timestamp=int(datetime.now().timestamp() * 1000),
            models_loaded=models_loaded,
            uptime=monitor.get_uptime() if monitor else 0.0
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Service unhealthy")


@app.post("/aegis/v1/ingest/telemetry")
async def ingest_telemetry(
    events: List[TelemetryEvent],
    background_tasks: BackgroundTasks
):
    """
    Ingest telemetry events from frontend/backend
    """
    try:
        logger.info(f"📊 Received {len(events)} telemetry events")
        
        # Process in background
        background_tasks.add_task(
            process_telemetry_batch,
            events
        )
        
        return {
            "success": True,
            "processed": len(events),
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to ingest telemetry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/aegis/v1/ingest/web3")
async def ingest_web3_events(
    events: List[Web3Event],
    background_tasks: BackgroundTasks
):
    """
    Ingest Web3 blockchain events
    """
    try:
        logger.info(f"⛓️  Received {len(events)} Web3 events")
        
        # Process in background
        background_tasks.add_task(
            process_web3_batch,
            events
        )
        
        return {
            "success": True,
            "processed": len(events),
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to ingest Web3 events: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/aegis/v1/ingest/log")
async def ingest_logs(
    events: List[LogEvent],
    background_tasks: BackgroundTasks
):
    """
    Ingest application logs for anomaly detection
    """
    try:
        logger.info(f"📝 Received {len(events)} log events")
        
        # Process in background
        background_tasks.add_task(
            process_log_batch,
            events
        )
        
        return {
            "success": True,
            "processed": len(events),
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to ingest logs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/aegis/v1/stats")
async def get_stats():
    """Get service statistics"""
    try:
        stats = {
            "anomaly_detector": ml_models['anomaly'].get_stats() if 'anomaly' in ml_models else {},
            "ux_optimizer": ml_models['ux_optimizer'].get_stats() if 'ux_optimizer' in ml_models else {},
            "sentiment_analyzer": ml_models['sentiment'].get_stats() if 'sentiment' in ml_models else {},
            "gas_predictor": ml_models['gas_predictor'].get_stats() if 'gas_predictor' in ml_models else {},
            "validator_monitor": ml_models['validator_monitor'].get_stats() if 'validator_monitor' in ml_models else {},
            "auto_healer": auto_healer.stats if auto_healer else {},
            "monitor": monitor.get_stats() if monitor else {},
        }
        return {"success": True, "stats": stats, "timestamp": int(datetime.now().timestamp() * 1000)}
    except Exception as e:
        logger.error(f"Failed to get stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# VALIDATE ENDPOINT (for API service integration)
# ========================================

class ValidateRequest(BaseModel):
    type: str = "transaction"
    data: Dict[str, Any] = Field(default_factory=dict)
    # Fields from aegisService.js
    container_id: Optional[str] = None
    telemetry: Optional[Dict[str, Any]] = None

@app.post("/api/aegis/validate")
async def validate_transaction(req: ValidateRequest):
    """
    Validate a transaction/event using anomaly detection + gas prediction.
    Called by api/services/aegisService.js
    """
    try:
        # Merge telemetry into data if provided (aegisService.js format)
        effective_data = req.data
        if req.telemetry:
            effective_data = {**req.telemetry, 'container_id': req.container_id}

        result: Dict[str, Any] = {"approved": True, "risk": "low", "flags": [], "score": None}

        # Anomaly check
        if 'anomaly' in ml_models and ml_models['anomaly'].is_loaded:
            score = await ml_models['anomaly'].predict(effective_data)
            result['score'] = round(score, 4)
            if score > 0.8:
                result['risk'] = 'high'
                result['flags'].append('anomaly_detected')
            elif score > 0.5:
                result['risk'] = 'medium'

        # Gas prediction for tx type
        if req.type == 'transaction' and 'gas_predictor' in ml_models:
            gas = ml_models['gas_predictor'].predict(effective_data)
            result['gas_prediction'] = gas

        # Sentiment analysis path
        if req.type == 'sentiment' and 'sentiment' in ml_models:
            text = effective_data.get('text', '')
            sentiment_result = await ml_models['sentiment'].analyze(text)
            result.update(sentiment_result)

        # Validator monitor path
        if req.type == 'validator_monitor':
            if 'validator_monitor' in ml_models:
                health = ml_models['validator_monitor'].evaluate(effective_data)
                result.update(health)
            else:
                result.update({'health_score': 100, 'status': 'healthy', 'alerts': []})

        # Slash check path
        if req.type == 'slash_check' and decision_engine:
            slash_result = await decision_engine.evaluate_validator_slashing(effective_data)
            result.update(slash_result)

        if result['risk'] == 'high':
            result['approved'] = False

        return {"success": True, **result, "timestamp": int(datetime.now().timestamp() * 1000)}
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return {"success": True, "approved": True, "risk": "unknown", "flags": ["validation_error"]}


# ========================================
# BACKGROUND PROCESSING FUNCTIONS
# ========================================

async def process_telemetry_batch(events: List[TelemetryEvent]):
    """Process telemetry events in background"""
    try:
        if db_manager:
            await db_manager.store_telemetry([e.model_dump() for e in events])

        # Anomaly detection
        if 'anomaly' in ml_models and ml_models['anomaly'].is_loaded:
            for event in events:
                anomaly_score = await ml_models['anomaly'].predict(event.model_dump())
                if anomaly_score > 0.8:
                    logger.warning(f"Anomaly detected: {event.eventType} score={anomaly_score}")
                    if decision_engine:
                        await decision_engine.handle_anomaly(event.model_dump(), anomaly_score)

        # Feed UX optimizer
        if 'ux_optimizer' in ml_models:
            perf_events = [e for e in events if e.performance]
            if perf_events:
                await ml_models['ux_optimizer'].update(perf_events)

        logger.info(f"Processed {len(events)} telemetry events")
    except Exception as e:
        logger.error(f"Failed to process telemetry batch: {e}")


async def process_web3_batch(events: List[Web3Event]):
    """Process Web3 events in background"""
    try:
        if db_manager:
            await db_manager.store_web3_events([e.model_dump() for e in events])

        for event in events:
            gas_used = int(event.gasUsed)
            if gas_used > 1_000_000 and auto_healer:
                logger.warning(f"High gas usage: {gas_used}")
                await auto_healer.investigate_gas_usage(event.model_dump())

        logger.info(f"Processed {len(events)} Web3 events")
    except Exception as e:
        logger.error(f"Failed to process Web3 batch: {e}")


async def process_log_batch(events: List[LogEvent]):
    """Process log events in background"""
    try:
        if db_manager:
            await db_manager.store_logs([e.model_dump() for e in events])

        error_logs = [e for e in events if e.level in ('error', 'fatal')]
        if error_logs:
            logger.warning(f"{len(error_logs)} error logs received")
            for log in error_logs:
                if 'sentiment' in ml_models:
                    sentiment = await ml_models['sentiment'].analyze(log.message)
                if log.level == 'fatal' and auto_healer:
                    await auto_healer.handle_critical_error(log.model_dump())

        logger.info(f"Processed {len(events)} log events")
    except Exception as e:
        logger.error(f"Failed to process log batch: {e}")


# ========================================
# MAIN ENTRY POINT
# ========================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
