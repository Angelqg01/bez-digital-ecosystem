"""
Database Manager - PostgreSQL via asyncpg
Migrated from MongoDB (motor) to PostgreSQL for FASE 6
"""

import logging
import asyncpg
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
import json
import os

logger = logging.getLogger(__name__)


class DatabaseManager:
    """PostgreSQL async database manager for Aegis AI"""

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.is_connected = False
        self.dsn = os.getenv(
            'DATABASE_URL',
            'postgresql://bezhas:bezhas@localhost:5432/bezhas',
        )

    async def connect(self):
        """Create asyncpg connection pool and ensure tables exist"""
        try:
            logger.info('Connecting to PostgreSQL...')
            self.pool = await asyncpg.create_pool(
                self.dsn, min_size=2, max_size=10, command_timeout=30
            )
            await self._ensure_tables()
            self.is_connected = True
            logger.info('PostgreSQL connected')
        except Exception as e:
            logger.error(f'Failed to connect to PostgreSQL: {e}')
            logger.warning('Running without database persistence')

    async def disconnect(self):
        if self.pool:
            await self.pool.close()
            self.is_connected = False
            logger.info('PostgreSQL disconnected')

    async def reconnect(self):
        await self.disconnect()
        await self.connect()

    async def _ensure_tables(self):
        """Create Aegis-specific tables if missing"""
        async with self.pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS aegis_telemetry (
                    id          BIGSERIAL PRIMARY KEY,
                    session_id  TEXT,
                    user_id     TEXT,
                    event_type  TEXT NOT NULL,
                    event_name  TEXT NOT NULL,
                    ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    metadata    JSONB DEFAULT '{}',
                    performance JSONB,
                    error       JSONB,
                    stored_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS aegis_web3_events (
                    id           BIGSERIAL PRIMARY KEY,
                    contract     TEXT NOT NULL,
                    event        TEXT NOT NULL,
                    block_number BIGINT,
                    tx_hash      TEXT,
                    gas_used     BIGINT,
                    ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    data         JSONB DEFAULT '{}',
                    stored_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS aegis_logs (
                    id        BIGSERIAL PRIMARY KEY,
                    level     TEXT NOT NULL,
                    message   TEXT,
                    service   TEXT,
                    ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    metadata  JSONB DEFAULT '{}',
                    stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS aegis_healing_logs (
                    id           BIGSERIAL PRIMARY KEY,
                    anomaly_type TEXT,
                    action_taken TEXT,
                    severity     TEXT,
                    success      BOOLEAN,
                    details      JSONB DEFAULT '{}',
                    stored_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS aegis_alerts (
                    id         BIGSERIAL PRIMARY KEY,
                    alert_type TEXT,
                    severity   TEXT,
                    message    TEXT,
                    data       JSONB DEFAULT '{}',
                    stored_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS aegis_gas_analysis (
                    id        BIGSERIAL PRIMARY KEY,
                    avg_gas   DOUBLE PRECISION,
                    max_gas   DOUBLE PRECISION,
                    trend     TEXT,
                    data      JSONB DEFAULT '{}',
                    stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS aegis_config (
                    key        TEXT PRIMARY KEY,
                    value      TEXT NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS aegis_suggestions (
                    id          TEXT PRIMARY KEY DEFAULT 'sug_' || extract(epoch from now())::bigint::text || '_' || (random()*1000)::int::text,
                    action_type TEXT NOT NULL,
                    target      TEXT,
                    reason      TEXT,
                    confidence  DOUBLE PRECISION DEFAULT 0,
                    action_data JSONB DEFAULT '{}',
                    status      TEXT NOT NULL DEFAULT 'pending',
                    feedback    TEXT,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    decided_at  TIMESTAMPTZ
                );
                CREATE TABLE IF NOT EXISTS aegis_training_data (
                    id        BIGSERIAL PRIMARY KEY,
                    source    TEXT NOT NULL,
                    label     TEXT NOT NULL,
                    text      TEXT,
                    stored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
            """)

    # ---- Write helpers ----
    async def store_telemetry(self, events: List[Dict[str, Any]]):
        if not self.is_connected or not events:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.executemany(
                    """INSERT INTO aegis_telemetry
                       (session_id, user_id, event_type, event_name, ts, metadata, performance, error)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
                    [
                        (
                            e.get('sessionId'), e.get('userId'), e['eventType'], e['eventName'],
                            datetime.fromtimestamp(e['timestamp'] / 1000, tz=timezone.utc)
                            if isinstance(e.get('timestamp'), (int, float))
                            else datetime.now(timezone.utc),
                            json.dumps(e.get('metadata', {})),
                            json.dumps(e.get('performance')) if e.get('performance') else None,
                            json.dumps(e.get('error')) if e.get('error') else None,
                        )
                        for e in events
                    ],
                )
            logger.debug(f'Stored {len(events)} telemetry events')
        except Exception as e:
            logger.error(f'Failed to store telemetry: {e}')

    async def store_web3_events(self, events: List[Dict[str, Any]]):
        if not self.is_connected or not events:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.executemany(
                    """INSERT INTO aegis_web3_events
                       (contract, event, block_number, tx_hash, gas_used, ts, data)
                       VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                    [
                        (
                            e['contract'], e['event'], e.get('blockNumber'),
                            e.get('txHash'), int(e.get('gasUsed', 0)),
                            datetime.fromtimestamp(e['timestamp'] / 1000, tz=timezone.utc)
                            if isinstance(e.get('timestamp'), (int, float))
                            else datetime.now(timezone.utc),
                            json.dumps(e.get('data', {})),
                        )
                        for e in events
                    ],
                )
            logger.debug(f'Stored {len(events)} Web3 events')
        except Exception as e:
            logger.error(f'Failed to store Web3 events: {e}')

    async def store_logs(self, events: List[Dict[str, Any]]):
        if not self.is_connected or not events:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.executemany(
                    """INSERT INTO aegis_logs (level, message, service, ts, metadata)
                       VALUES ($1,$2,$3,$4,$5)""",
                    [
                        (
                            e['level'], e.get('message'), e.get('service'),
                            datetime.fromtimestamp(e['timestamp'] / 1000, tz=timezone.utc)
                            if isinstance(e.get('timestamp'), (int, float))
                            else datetime.now(timezone.utc),
                            json.dumps(e.get('metadata', {})),
                        )
                        for e in events
                    ],
                )
            logger.debug(f'Stored {len(events)} log events')
        except Exception as e:
            logger.error(f'Failed to store logs: {e}')

    async def store_healing_log(self, data: Dict[str, Any]):
        if not self.is_connected:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO aegis_healing_logs
                       (anomaly_type, action_taken, severity, success, details)
                       VALUES ($1,$2,$3,$4,$5)""",
                    data.get('anomaly_type'), data.get('action'),
                    data.get('severity', 'info'), data.get('success', True),
                    json.dumps(data.get('details', {})),
                )
        except Exception as e:
            logger.error(f'Failed to store healing log: {e}')

    async def store_alerts(self, alerts: List[Dict[str, Any]]):
        if not self.is_connected or not alerts:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.executemany(
                    """INSERT INTO aegis_alerts (alert_type, severity, message, data)
                       VALUES ($1,$2,$3,$4)""",
                    [(a.get('type', 'unknown'), a.get('severity', 'info'),
                      a.get('message', ''), json.dumps(a.get('data', {}))) for a in alerts],
                )
        except Exception as e:
            logger.error(f'Failed to store alerts: {e}')

    async def store_gas_analysis(self, data: Dict[str, Any]):
        if not self.is_connected:
            return
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """INSERT INTO aegis_gas_analysis (avg_gas, max_gas, trend, data)
                       VALUES ($1,$2,$3,$4)""",
                    data.get('avg_gas', data.get('gasUsed', 0)),
                    data.get('max_gas', data.get('gasUsed', 0)),
                    data.get('trend', 'stable'), json.dumps(data),
                )
        except Exception as e:
            logger.error(f'Failed to store gas analysis: {e}')

    # ---- Read helpers ----
    async def get_recent_telemetry(self, minutes: int = 5) -> List[Dict[str, Any]]:
        if not self.is_connected:
            return []
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT * FROM aegis_telemetry
                       WHERE stored_at >= NOW() - make_interval(mins => $1)
                       ORDER BY stored_at DESC LIMIT 1000""", minutes)
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f'Failed to get recent telemetry: {e}')
            return []

    async def get_recent_logs(self, minutes: int = 5, level: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self.is_connected:
            return []
        try:
            async with self.pool.acquire() as conn:
                if level:
                    rows = await conn.fetch(
                        """SELECT * FROM aegis_logs
                           WHERE stored_at >= NOW() - make_interval(mins => $1) AND level = $2
                           ORDER BY stored_at DESC LIMIT 500""", minutes, level)
                else:
                    rows = await conn.fetch(
                        """SELECT * FROM aegis_logs
                           WHERE stored_at >= NOW() - make_interval(mins => $1)
                           ORDER BY stored_at DESC LIMIT 500""", minutes)
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f'Failed to get recent logs: {e}')
            return []

    async def get_recent_web3(self, minutes: int = 10) -> List[Dict[str, Any]]:
        if not self.is_connected:
            return []
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT * FROM aegis_web3_events
                       WHERE stored_at >= NOW() - make_interval(mins => $1)
                       ORDER BY stored_at DESC LIMIT 500""", minutes)
            return [dict(r) for r in rows]
        except Exception as e:
            logger.error(f'Failed to get recent web3 events: {e}')
            return []

    async def get_healing_stats(self) -> Dict[str, Any]:
        if not self.is_connected:
            return {}
        try:
            async with self.pool.acquire() as conn:
                total = await conn.fetchval('SELECT COUNT(*) FROM aegis_healing_logs')
                success = await conn.fetchval(
                    'SELECT COUNT(*) FROM aegis_healing_logs WHERE success = true')
            return {'total_actions': total or 0, 'successful': success or 0}
        except Exception as e:
            logger.error(f'Failed to get healing stats: {e}')
            return {}
