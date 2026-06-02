"""
Database Manager
Handles MongoDB connections and operations
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Dict, Any, List
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    MongoDB database manager
    """
    
    def __init__(self):
        self.client = None
        self.db = None
        self.collections = {}
        self.is_connected = False
        
        # MongoDB configuration
        self.mongo_uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
        self.db_name = os.getenv('MONGODB_DB', 'bezhas_aegis')
    
    async def connect(self):
        """Connect to MongoDB"""
        try:
            logger.info(f"📦 Connecting to MongoDB: {self.db_name}")
            
            self.client = AsyncIOMotorClient(self.mongo_uri)
            self.db = self.client[self.db_name]
            
            # Initialize collections
            self.collections['telemetry'] = self.db['telemetry']
            self.collections['web3_events'] = self.db['web3_events']
            self.collections['logs'] = self.db['logs']
            self.collections['healing_logs'] = self.db['healing_logs']
            self.collections['alerts'] = self.db['alerts']
            self.collections['gas_analysis'] = self.db['gas_analysis']
            
            # Test connection
            await self.client.admin.command('ping')
            
            self.is_connected = True
            logger.info("✅ MongoDB connected")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to MongoDB: {str(e)}")
            logger.warning("⚠️  Running without database persistence")
    
    async def disconnect(self):
        """Disconnect from MongoDB"""
        if self.client:
            self.client.close()
            logger.info("✅ MongoDB disconnected")
    
    async def reconnect(self):
        """Reconnect to MongoDB"""
        await self.disconnect()
        await self.connect()
    
    async def store_telemetry(self, events: List[Dict[str, Any]]):
        """Store telemetry events"""
        if not self.is_connected:
            logger.warning("Database not connected, skipping store")
            return
        
        try:
            # Add timestamps
            for event in events:
                event['stored_at'] = datetime.now()
            
            if events:
                await self.collections['telemetry'].insert_many(events)
                logger.debug(f"💾 Stored {len(events)} telemetry events")
            
        except Exception as e:
            logger.error(f"❌ Failed to store telemetry: {str(e)}")
    
    async def store_web3_events(self, events: List[Dict[str, Any]]):
        """Store Web3 blockchain events"""
        if not self.is_connected:
            return
        
        try:
            for event in events:
                event['stored_at'] = datetime.now()
            
            if events:
                await self.collections['web3_events'].insert_many(events)
                logger.debug(f"💾 Stored {len(events)} Web3 events")
            
        except Exception as e:
            logger.error(f"❌ Failed to store Web3 events: {str(e)}")
    
    async def store_logs(self, events: List[Dict[str, Any]]):
        """Store application logs"""
        if not self.is_connected:
            return
        
        try:
            for event in events:
                event['stored_at'] = datetime.now()
            
            if events:
                await self.collections['logs'].insert_many(events)
                logger.debug(f"💾 Stored {len(events)} log events")
            
        except Exception as e:
            logger.error(f"❌ Failed to store logs: {str(e)}")
    
    async def store_healing_log(self, healing_data: Dict[str, Any]):
        """Store healing attempt log"""
        if not self.is_connected:
            return
        
        try:
            healing_data['stored_at'] = datetime.now()
            await self.collections['healing_logs'].insert_one(healing_data)
            logger.debug("💾 Stored healing log")
            
        except Exception as e:
            logger.error(f"❌ Failed to store healing log: {str(e)}")
    
    async def store_alerts(self, alerts: List[Dict[str, Any]]):
        """Store system alerts"""
        if not self.is_connected:
            return
        
        try:
            for alert in alerts:
                alert['stored_at'] = datetime.now()
            
            if alerts:
                await self.collections['alerts'].insert_many(alerts)
                logger.debug(f"💾 Stored {len(alerts)} alerts")
            
        except Exception as e:
            logger.error(f"❌ Failed to store alerts: {str(e)}")
    
    async def store_gas_analysis(self, data: Dict[str, Any]):
        """Store gas usage analysis"""
        if not self.is_connected:
            return
        
        try:
            data['stored_at'] = datetime.now()
            await self.collections['gas_analysis'].insert_one(data)
            logger.debug("💾 Stored gas analysis")
            
        except Exception as e:
            logger.error(f"❌ Failed to store gas analysis: {str(e)}")
    
    async def get_recent_telemetry(self, minutes: int = 5) -> List[Dict[str, Any]]:
        """Get recent telemetry events"""
        if not self.is_connected:
            return []
        
        try:
            cutoff = datetime.now() - timedelta(minutes=minutes)
            
            cursor = self.collections['telemetry'].find({
                'stored_at': {'$gte': cutoff}
            }).sort('stored_at', -1)
            
            events = await cursor.to_list(length=1000)
            return events
            
        except Exception as e:
            logger.error(f"❌ Failed to get recent telemetry: {str(e)}")
            return []
    
    async def get_recent_logs(self, minutes: int = 5, level: str = None) -> List[Dict[str, Any]]:
        """Get recent log events"""
        if not self.is_connected:
            return []
        
        try:
            cutoff = datetime.now() - timedelta(minutes=minutes)
            
            query = {'stored_at': {'$gte': cutoff}}
            if level:
                query['level'] = level
            
            cursor = self.collections['logs'].find(query).sort('stored_at', -1)
            
            logs = await cursor.to_list(length=1000)
            return logs
            
        except Exception as e:
            logger.error(f"❌ Failed to get recent logs: {str(e)}")
            return []
