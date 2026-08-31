"""
Redis Manager
Handles Redis connections for caching and rate limiting
"""

import logging
import redis.asyncio as aioredis
from typing import Dict, Any, List, Optional
import json
import os

logger = logging.getLogger(__name__)


class RedisManager:
    """
    Redis cache and rate limit manager
    """
    
    def __init__(self):
        self.client = None
        self.is_connected = False
        
        # Redis configuration
        self.redis_host = os.getenv('REDIS_HOST', 'localhost')
        self.redis_port = int(os.getenv('REDIS_PORT', 6379))
        self.redis_db = int(os.getenv('REDIS_DB', 0))
        self.redis_password = os.getenv('REDIS_PASSWORD', None)
    
    async def connect(self):
        """Connect to Redis"""
        try:
            logger.info(f"📦 Connecting to Redis: {self.redis_host}:{self.redis_port}")
            
            self.client = await aioredis.from_url(
                f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}",
                password=self.redis_password,
                decode_responses=True
            )
            
            # Test connection
            await self.client.ping()
            
            self.is_connected = True
            logger.info("✅ Redis connected")
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {str(e)}")
            logger.warning("⚠️  Running without Redis cache")
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.client:
            await self.client.close()
            logger.info("✅ Redis disconnected")
    
    async def get(self, key: str) -> Optional[str]:
        """Get value from cache"""
        if not self.is_connected:
            return None
        
        try:
            value = await self.client.get(key)
            return value
        except Exception as e:
            logger.error(f"❌ Redis GET failed: {str(e)}")
            return None
    
    async def set(self, key: str, value: str, ttl: int = None):
        """Set value in cache"""
        if not self.is_connected:
            return
        
        try:
            if ttl:
                await self.client.setex(key, ttl, value)
            else:
                await self.client.set(key, value)
        except Exception as e:
            logger.error(f"❌ Redis SET failed: {str(e)}")
    
    async def delete(self, key: str):
        """Delete key from cache"""
        if not self.is_connected:
            return
        
        try:
            await self.client.delete(key)
        except Exception as e:
            logger.error(f"❌ Redis DELETE failed: {str(e)}")
    
    async def get_json(self, key: str) -> Optional[Dict[str, Any]]:
        """Get JSON value from cache"""
        value = await self.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                logger.error(f"❌ Failed to parse JSON for key: {key}")
                return None
        return None
    
    async def set_json(self, key: str, value: Dict[str, Any], ttl: int = None):
        """Set JSON value in cache"""
        try:
            json_str = json.dumps(value)
            await self.set(key, json_str, ttl)
        except Exception as e:
            logger.error(f"❌ Failed to set JSON: {str(e)}")
    
    async def set_rate_limit(self, user_id: str, ttl: int = 60):
        """Set rate limit for user"""
        if not self.is_connected:
            return
        
        try:
            key = f"rate_limit:{user_id}"
            current = await self.client.get(key)
            
            if current:
                await self.client.incr(key)
            else:
                await self.client.setex(key, ttl, 1)
            
            logger.debug(f"🚦 Rate limit set for {user_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to set rate limit: {str(e)}")
    
    async def check_rate_limit(self, user_id: str, max_requests: int = 100) -> bool:
        """Check if user is rate limited"""
        if not self.is_connected:
            return False  # Allow if Redis unavailable
        
        try:
            key = f"rate_limit:{user_id}"
            current = await self.client.get(key)
            
            if current and int(current) >= max_requests:
                return True  # Rate limited
            
            return False  # Not rate limited
            
        except Exception as e:
            logger.error(f"❌ Failed to check rate limit: {str(e)}")
            return False
    
    async def warm_cache(self, keys: List[str]):
        """Pre-load cache with data"""
        if not self.is_connected:
            return
        
        try:
            logger.info(f"🔥 Warming cache for {len(keys)} keys")
            
            # In production, would load frequently accessed data
            # For now, just a placeholder
            for key in keys:
                await self.set(key, "warmed", ttl=300)
            
            logger.info("✅ Cache warmed")
            
        except Exception as e:
            logger.error(f"❌ Failed to warm cache: {str(e)}")
    
    async def clear_pattern(self, pattern: str):
        """Clear keys matching pattern"""
        if not self.is_connected:
            return
        
        try:
            keys = []
            async for key in self.client.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                await self.client.delete(*keys)
                logger.info(f"🗑️  Cleared {len(keys)} keys matching {pattern}")
            
        except Exception as e:
            logger.error(f"❌ Failed to clear pattern: {str(e)}")
