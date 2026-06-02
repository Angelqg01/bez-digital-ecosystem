"""
BeZhas Aegis - AI Self-Healing & Optimization Service
FastAPI service for anomaly detection, auto-healing, and UX optimization
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
import uvicorn

# Internal imports - Commented temporarily until implemented
# from models.anomaly_detector import AnomalyDetector
# from models.ux_optimizer import UXOptimizer
# from models.sentiment_analyzer import SentimentAnalyzer
# from core.auto_healer import AutoHealer
# from core.monitor import SystemMonitor
# from core.decision_engine import DecisionEngine
# from utils.database import DatabaseManager
# from utils.redis_manager import RedisManager

# Import control router for dashboard API
from routers.control import router as control_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global instances
ml_models = {}
auto_healer = None
monitor = None
decision_engine = None
db_manager = None
redis_manager = None


# Simplified lifespan manager for Control API only
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for FastAPI app
    Simplified version - only for Control API
    """
    logger.info("🚀 Starting Aegis Control API...")
    logger.info("✅ Control API ready!")
    
    yield
    
    logger.info("🛑 Shutting down Aegis Control API...")
    logger.info("✅ Control API stopped cleanly")


# Original lifespan manager (commented until other modules are implemented)
"""
@asynccontextmanager
async def lifespan_full(app: FastAPI):
    # Lifecycle manager for FastAPI app
    # Handles ML model loading/unloading
    
    global ml_models, auto_healer, monitor, decision_engine, db_manager, redis_manager
    
    logger.info("🚀 Starting Aegis service...")
    
    try:
        # Initialize database connections
        db_manager = DatabaseManager()
        await db_manager.connect()
        logger.info("✅ Database connected")
        
        # Initialize Redis
        redis_manager = RedisManager()
        await redis_manager.connect()
        logger.info("✅ Redis connected")
        
        # Load ML models
        logger.info("📦 Loading ML models...")
        ml_models['anomaly'] = AnomalyDetector()
        ml_models['ux_optimizer'] = UXOptimizer()
        ml_models['sentiment'] = SentimentAnalyzer()
        
        await ml_models['anomaly'].load_model()
        await ml_models['ux_optimizer'].load_model()
        await ml_models['sentiment'].load_model()
        logger.info("✅ All ML models loaded")
        
        # Initialize core systems
        auto_healer = AutoHealer(db_manager, redis_manager)
        monitor = SystemMonitor(db_manager, ml_models)
        decision_engine = DecisionEngine(ml_models, auto_healer)
        logger.info("✅ Core systems initialized")
        
        # Start background monitoring
        await monitor.start()
        logger.info("✅ Background monitoring started")
        
        logger.info("🎉 Aegis service ready!")
        
        yield
        
        # Cleanup on shutdown
        logger.info("🛑 Shutting down Aegis service...")
        await monitor.stop()
        await db_manager.disconnect()
        await redis_manager.disconnect()
        logger.info("✅ Aegis service stopped cleanly")
        
    except Exception as e:
        logger.error(f"❌ Failed to start Aegis service: {str(e)}")
        raise
"""


# Create FastAPI app
app = FastAPI(
    title="BeZhas Aegis",
    description="AI Self-Healing & Optimization Service",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """
    Get service statistics
    """
    try:
        stats = {
            "anomaly_detector": ml_models['anomaly'].get_stats(),
            "ux_optimizer": ml_models['ux_optimizer'].get_stats(),
            "sentiment_analyzer": ml_models['sentiment'].get_stats(),
            "auto_healer": auto_healer.get_stats() if auto_healer else {},
            "monitor": monitor.get_stats() if monitor else {}
        }
        
        return {
            "success": True,
            "stats": stats,
            "timestamp": int(datetime.now().timestamp() * 1000)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to get stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ========================================
# BACKGROUND PROCESSING FUNCTIONS
# ========================================

async def process_telemetry_batch(events: List[TelemetryEvent]):
    """Process telemetry events in background"""
    try:
        # Store in database
        await db_manager.store_telemetry(events)
        
        # Run anomaly detection
        for event in events:
            anomaly_score = await ml_models['anomaly'].predict(event.dict())
            
            if anomaly_score > 0.8:  # High anomaly score
                logger.warning(f"🚨 Anomaly detected: {event.eventType} - Score: {anomaly_score}")
                
                # Trigger decision engine
                await decision_engine.handle_anomaly(event, anomaly_score)
        
        # Update UX optimizer with performance data
        perf_events = [e for e in events if e.performance]
        if perf_events:
            await ml_models['ux_optimizer'].update(perf_events)
        
        logger.info(f"✅ Processed {len(events)} telemetry events")
        
    except Exception as e:
        logger.error(f"❌ Failed to process telemetry batch: {str(e)}")


async def process_web3_batch(events: List[Web3Event]):
    """Process Web3 events in background"""
    try:
        # Store in database
        await db_manager.store_web3_events(events)
        
        # Analyze blockchain patterns
        for event in events:
            # Check for unusual gas usage
            gas_used = int(event.gasUsed)
            if gas_used > 1000000:  # Threshold
                logger.warning(f"⚠️  High gas usage detected: {gas_used}")
                await auto_healer.investigate_gas_usage(event)
        
        logger.info(f"✅ Processed {len(events)} Web3 events")
        
    except Exception as e:
        logger.error(f"❌ Failed to process Web3 batch: {str(e)}")


async def process_log_batch(events: List[LogEvent]):
    """Process log events in background"""
    try:
        # Store in database
        await db_manager.store_logs(events)
        
        # Analyze sentiment and errors
        error_logs = [e for e in events if e.level in ['error', 'fatal']]
        
        if error_logs:
            logger.warning(f"⚠️  {len(error_logs)} error logs received")
            
            for log in error_logs:
                # Run sentiment analysis
                sentiment = await ml_models['sentiment'].analyze(log.message)
                
                # If critical error, trigger auto-healing
                if log.level == 'fatal':
                    await auto_healer.handle_critical_error(log)
        
        logger.info(f"✅ Processed {len(events)} log events")
        
    except Exception as e:
        logger.error(f"❌ Failed to process log batch: {str(e)}")


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
