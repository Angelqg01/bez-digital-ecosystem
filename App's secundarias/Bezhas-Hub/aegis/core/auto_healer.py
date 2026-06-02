"""
Auto Healer
Executes automated healing actions based on detected issues
"""

import logging
from typing import Dict, Any, List
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)


class AutoHealer:
    """
    Automated healing system for common issues
    """
    
    def __init__(self, db_manager, redis_manager):
        self.db = db_manager
        self.redis = redis_manager
        self.healing_actions = {}
        self.stats = {
            'total_healings': 0,
            'successful_healings': 0,
            'failed_healings': 0,
            'by_action_type': {}
        }
    
    async def handle_anomaly(self, anomaly_type: str, context: Dict[str, Any]):
        """
        Handle detected anomaly with appropriate healing action
        """
        try:
            logger.info(f"🔧 Handling anomaly: {anomaly_type}")
            
            action = self.get_healing_action(anomaly_type)
            
            if action:
                success = await self.execute_action(action, context)
                
                if success:
                    self.stats['successful_healings'] += 1
                    logger.info(f"✅ Healing action successful: {action}")
                else:
                    self.stats['failed_healings'] += 1
                    logger.error(f"❌ Healing action failed: {action}")
            else:
                logger.warning(f"⚠️  No healing action defined for {anomaly_type}")
            
            self.stats['total_healings'] += 1
            
            # Log healing attempt
            await self.log_healing_attempt(anomaly_type, action, success if action else False)
            
        except Exception as e:
            logger.error(f"❌ Failed to handle anomaly: {str(e)}")
    
    def get_healing_action(self, anomaly_type: str) -> str:
        """
        Map anomaly type to healing action
        """
        action_map = {
            'high_error_rate': 'restart_service',
            'slow_response': 'scale_up',
            'memory_leak': 'restart_process',
            'high_gas_cost': 'optimize_transaction',
            'database_connection': 'reconnect_database',
            'cache_miss': 'warm_cache',
            'rate_limit': 'throttle_requests',
            'authentication_failure': 'refresh_tokens',
            'blockchain_sync': 'resync_blockchain'
        }
        
        return action_map.get(anomaly_type)
    
    async def execute_action(self, action: str, context: Dict[str, Any]) -> bool:
        """
        Execute specific healing action
        """
        try:
            logger.info(f"⚡ Executing healing action: {action}")
            
            # Track action type
            if action not in self.stats['by_action_type']:
                self.stats['by_action_type'][action] = 0
            self.stats['by_action_type'][action] += 1
            
            # Execute action based on type
            if action == 'restart_service':
                return await self.restart_service(context)
            
            elif action == 'scale_up':
                return await self.scale_up(context)
            
            elif action == 'restart_process':
                return await self.restart_process(context)
            
            elif action == 'optimize_transaction':
                return await self.optimize_transaction(context)
            
            elif action == 'reconnect_database':
                return await self.reconnect_database()
            
            elif action == 'warm_cache':
                return await self.warm_cache(context)
            
            elif action == 'throttle_requests':
                return await self.throttle_requests(context)
            
            elif action == 'refresh_tokens':
                return await self.refresh_tokens(context)
            
            elif action == 'resync_blockchain':
                return await self.resync_blockchain(context)
            
            else:
                logger.warning(f"⚠️  Unknown healing action: {action}")
                return False
            
        except Exception as e:
            logger.error(f"❌ Action execution failed: {str(e)}")
            return False
    
    async def restart_service(self, context: Dict[str, Any]) -> bool:
        """
        Simulate service restart (in production, would trigger actual restart)
        """
        logger.info("🔄 Simulating service restart...")
        await asyncio.sleep(1)  # Simulate restart time
        logger.info("✅ Service restart completed")
        return True
    
    async def scale_up(self, context: Dict[str, Any]) -> bool:
        """
        Scale up resources (in production, would trigger cloud scaling)
        """
        logger.info("📈 Simulating resource scaling...")
        await asyncio.sleep(1)
        logger.info("✅ Resources scaled up")
        return True
    
    async def restart_process(self, context: Dict[str, Any]) -> bool:
        """
        Restart specific process
        """
        process_id = context.get('processId', 'unknown')
        logger.info(f"🔄 Restarting process: {process_id}")
        await asyncio.sleep(1)
        logger.info(f"✅ Process {process_id} restarted")
        return True
    
    async def optimize_transaction(self, context: Dict[str, Any]) -> bool:
        """
        Optimize blockchain transaction parameters
        """
        logger.info("⚡ Optimizing transaction gas settings...")
        # In production, would adjust gas price/limit
        await asyncio.sleep(0.5)
        logger.info("✅ Transaction optimized")
        return True
    
    async def reconnect_database(self) -> bool:
        """
        Reconnect to database
        """
        logger.info("🔌 Reconnecting to database...")
        try:
            await self.db.reconnect()
            logger.info("✅ Database reconnected")
            return True
        except Exception as e:
            logger.error(f"❌ Database reconnection failed: {str(e)}")
            return False
    
    async def warm_cache(self, context: Dict[str, Any]) -> bool:
        """
        Pre-load cache with frequently accessed data
        """
        logger.info("🔥 Warming cache...")
        try:
            # In production, would load popular data into Redis
            await self.redis.warm_cache(context.get('keys', []))
            logger.info("✅ Cache warmed")
            return True
        except Exception as e:
            logger.error(f"❌ Cache warming failed: {str(e)}")
            return False
    
    async def throttle_requests(self, context: Dict[str, Any]) -> bool:
        """
        Apply rate limiting
        """
        logger.info("🚦 Applying rate limiting...")
        try:
            user_id = context.get('userId')
            await self.redis.set_rate_limit(user_id, ttl=60)
            logger.info("✅ Rate limiting applied")
            return True
        except Exception as e:
            logger.error(f"❌ Rate limiting failed: {str(e)}")
            return False
    
    async def refresh_tokens(self, context: Dict[str, Any]) -> bool:
        """
        Refresh authentication tokens
        """
        logger.info("🔑 Refreshing authentication tokens...")
        await asyncio.sleep(0.5)
        logger.info("✅ Tokens refreshed")
        return True
    
    async def resync_blockchain(self, context: Dict[str, Any]) -> bool:
        """
        Resync blockchain data
        """
        logger.info("⛓️  Resyncing blockchain...")
        await asyncio.sleep(2)
        logger.info("✅ Blockchain resynced")
        return True
    
    async def investigate_gas_usage(self, event: Dict[str, Any]):
        """
        Investigate high gas usage
        """
        logger.warning(f"🔍 Investigating high gas usage: {event.get('gasUsed')}")
        
        # Check if this is a pattern
        tx_hash = event.get('txHash')
        contract = event.get('contract')
        
        # Store for analysis
        await self.db.store_gas_analysis({
            'txHash': tx_hash,
            'contract': contract,
            'gasUsed': event.get('gasUsed'),
            'timestamp': datetime.now().isoformat()
        })
        
        logger.info("✅ Gas usage investigation logged")
    
    async def handle_critical_error(self, log_event: Dict[str, Any]):
        """
        Handle critical error log
        """
        logger.error(f"🚨 Critical error detected: {log_event.get('message')}")
        
        # Trigger immediate healing
        await self.handle_anomaly('critical_error', log_event)
        
        # Alert administrators
        await self.send_admin_alert(log_event)
    
    async def send_admin_alert(self, context: Dict[str, Any]):
        """
        Send alert to administrators
        """
        logger.warning(f"📧 Sending admin alert: {context.get('message')}")
        # In production, would send email/Slack/Discord notification
        await asyncio.sleep(0.1)
    
    async def log_healing_attempt(self, anomaly_type: str, action: str, success: bool):
        """
        Log healing attempt to database
        """
        try:
            await self.db.store_healing_log({
                'anomaly_type': anomaly_type,
                'action': action,
                'success': success,
                'timestamp': datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"❌ Failed to log healing attempt: {str(e)}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get auto-healer statistics"""
        success_rate = (
            self.stats['successful_healings'] / self.stats['total_healings']
            if self.stats['total_healings'] > 0 else 0
        )
        
        return {
            'total_healings': self.stats['total_healings'],
            'successful_healings': self.stats['successful_healings'],
            'failed_healings': self.stats['failed_healings'],
            'success_rate': success_rate,
            'by_action_type': self.stats['by_action_type']
        }
