"""
Aegis test configuration — shared fixtures for pytest.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.connect = AsyncMock()
    db.disconnect = AsyncMock()
    db.is_connected = True
    db.store_telemetry = AsyncMock()
    db.store_web3_events = AsyncMock()
    db.store_logs = AsyncMock()
    db.store_healing_log = AsyncMock()
    db.store_alerts = AsyncMock()
    db.store_gas_analysis = AsyncMock()
    db.get_recent_telemetry = AsyncMock(return_value=[])
    db.get_recent_logs = AsyncMock(return_value=[])
    db.get_recent_web3 = AsyncMock(return_value=[])
    db.get_healing_stats = AsyncMock(return_value={"total_actions": 0, "successful": 0})

    # Pool mock for control.py direct queries
    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[])
    mock_conn.fetchrow = AsyncMock(return_value=None)
    mock_conn.fetchval = AsyncMock(return_value=0)

    # Use asynccontextmanager pattern for pool.acquire()
    class FakeAcquire:
        async def __aenter__(self):
            return mock_conn
        async def __aexit__(self, *args):
            pass

    mock_pool = MagicMock()
    mock_pool.acquire = MagicMock(return_value=FakeAcquire())
    db.pool = mock_pool
    db._mock_conn = mock_conn  # expose for tests

    return db


@pytest.fixture
def mock_redis():
    r = AsyncMock()
    r.connect = AsyncMock()
    r.disconnect = AsyncMock()
    r.is_connected = True
    r.get = AsyncMock(return_value=None)
    r.set = AsyncMock()
    r.delete = AsyncMock()
    r.get_json = AsyncMock(return_value=None)
    r.set_json = AsyncMock()
    r.check_rate_limit = AsyncMock(return_value=False)
    r.warm_cache = AsyncMock()
    r.set_rate_limit = AsyncMock()
    r.clear_pattern = AsyncMock()
    return r


@pytest.fixture
def mock_anomaly():
    m = AsyncMock()
    m.is_loaded = True
    m.load_model = AsyncMock()
    m.predict = AsyncMock(return_value=0.2)
    m.train = AsyncMock()
    m.get_stats = MagicMock(return_value={"is_loaded": True, "predictions": 10, "anomalies_detected": 1})
    return m


@pytest.fixture
def mock_ux_optimizer():
    m = AsyncMock()
    m.is_loaded = True
    m.load_model = AsyncMock()
    m.update = AsyncMock()
    m.recommend_optimization = AsyncMock(return_value={"action": "optimize_layout", "confidence": 0.8})
    m.get_stats = MagicMock(return_value={"is_loaded": True, "updates": 5})
    return m


@pytest.fixture
def mock_sentiment():
    m = AsyncMock()
    m.is_loaded = True
    m.load_model = AsyncMock()
    m.analyze = AsyncMock(return_value={"sentiment": "positive", "score": 0.8, "confidence": 0.9, "method": "lexicon"})
    m.get_stats = MagicMock(return_value={"is_loaded": True, "analyses": 20})
    return m


@pytest.fixture
def mock_gas_predictor():
    m = MagicMock()
    m.is_loaded = True
    m.load_model = AsyncMock()
    m.predict = MagicMock(return_value={"predicted_gas": "1.5", "confidence": 0.7, "recommendation": "send_now"})
    m.get_stats = MagicMock(return_value={"is_loaded": True, "predictions_made": 15})
    return m


@pytest.fixture
def ml_models(mock_anomaly, mock_ux_optimizer, mock_sentiment, mock_gas_predictor):
    return {
        "anomaly": mock_anomaly,
        "ux_optimizer": mock_ux_optimizer,
        "sentiment": mock_sentiment,
        "gas_predictor": mock_gas_predictor,
    }


@pytest.fixture
def mock_auto_healer(mock_db, mock_redis):
    from unittest.mock import MagicMock as MM
    h = AsyncMock()
    h.handle_anomaly = AsyncMock(return_value=True)
    h.execute_action = AsyncMock()
    h.stats = {"total_healings": 0, "successful": 0, "failed": 0}
    h.get_stats = MagicMock(return_value=h.stats)
    h.investigate_gas_usage = AsyncMock()
    h.handle_critical_error = AsyncMock()
    return h


@pytest.fixture
def mock_monitor(ml_models, mock_db):
    m = AsyncMock()
    m.start = AsyncMock()
    m.stop = AsyncMock()
    m.is_running = True
    m.get_uptime = MagicMock(return_value=120.0)
    m.get_stats = MagicMock(return_value={"is_running": True, "uptime": 120.0})
    return m


@pytest.fixture
def mock_decision_engine(ml_models, mock_auto_healer):
    d = AsyncMock()
    d.mode = "autonomous"
    d.thresholds = {"anomaly_score": 0.5}
    d.handle_anomaly = AsyncMock()
    d.get_stats = MagicMock(return_value={"decisions_made": 5})
    return d


@pytest.fixture
async def app_client(ml_models, mock_auto_healer, mock_monitor, mock_decision_engine, mock_db, mock_redis):
    """Create a test client with mocked services — bypass lifespan."""
    import main

    # Inject mocks into module globals used by endpoints
    main.ml_models = ml_models
    main.auto_healer = mock_auto_healer
    main.monitor = mock_monitor
    main.decision_engine = mock_decision_engine
    main.db_manager = mock_db
    main.redis_manager = mock_redis

    # Create a fresh app without lifespan to avoid real DB/Redis connections
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    test_app = FastAPI()
    test_app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

    # Re-register all routes from the original app
    for route in main.app.routes:
        test_app.routes.append(route)

    # Also inject into app.state for routers that use request.app.state
    test_app.state.ml_models = ml_models
    test_app.state.auto_healer = mock_auto_healer
    test_app.state.monitor = mock_monitor
    test_app.state.decision_engine = mock_decision_engine
    test_app.state.db_manager = mock_db
    test_app.state.redis_manager = mock_redis

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    # Cleanup
    main.ml_models = {}
    main.auto_healer = None
    main.monitor = None
    main.decision_engine = None
    main.db_manager = None
    main.redis_manager = None
