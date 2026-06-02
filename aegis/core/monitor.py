"""
System Monitor
Continuously monitors system health and metrics
"""

import logging
from typing import Dict, Any
import asyncio
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class SystemMonitor:
    """
    Continuous system health monitoring
    """
    
    def __init__(self, db_manager, ml_models):
        self.db = db_manager
        self.ml_models = ml_models
        self.is_running = False
        self.start_time = None
        self.monitor_task = None
        
        # Health metrics
        self.metrics = {
            'cpu_usage': 0.0,
            'memory_usage': 0.0,
            'request_count': 0,
            'error_count': 0,
            'avg_response_time': 0.0,
            'anomaly_count': 0
        }
        
        # Configuration
        self.check_interval = 30  # seconds
        self.alert_thresholds = {
            'cpu_usage': 80.0,
            'memory_usage': 85.0,
            'error_rate': 0.05,
            'response_time': 5000  # ms
        }
    
    async def start(self):
        """Start background monitoring"""
        if self.is_running:
            logger.warning("Monitor already running")
            return
        
        logger.info("🔍 Starting system monitor...")
        self.is_running = True
        self.start_time = datetime.now()
        
        # Start monitoring loop
        self.monitor_task = asyncio.create_task(self.monitoring_loop())
        
        logger.info("✅ System monitor started")
    
    async def stop(self):
        """Stop background monitoring"""
        logger.info("🛑 Stopping system monitor...")
        self.is_running = False
        
        if self.monitor_task:
            self.monitor_task.cancel()
            try:
                await self.monitor_task
            except asyncio.CancelledError:
                pass
        
        logger.info("✅ System monitor stopped")
    
    async def monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_running:
            try:
                await self.collect_metrics()
                await self.check_health()
                await asyncio.sleep(self.check_interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"❌ Monitoring error: {str(e)}")
                await asyncio.sleep(self.check_interval)
    
    async def collect_metrics(self):
        """Collect system metrics"""
        try:
            # Get metrics from database
            recent_telemetry = await self.db.get_recent_telemetry(minutes=5)
            
            if recent_telemetry:
                # Calculate metrics
                total_requests = len(recent_telemetry)
                errors = [t for t in recent_telemetry if t.get('error')]
                
                response_times = [
                    t.get('performance', {}).get('responseTime', 0)
                    for t in recent_telemetry
                    if t.get('performance')
                ]
                
                self.metrics['request_count'] = total_requests
                self.metrics['error_count'] = len(errors)
                self.metrics['avg_response_time'] = (
                    sum(response_times) / len(response_times)
                    if response_times else 0
                )
            
            logger.debug(f"📊 Metrics collected: {self.metrics}")
            
        except Exception as e:
            logger.error(f"❌ Failed to collect metrics: {str(e)}")
    
    async def check_health(self):
        """Check system health against thresholds"""
        try:
            alerts = []
            
            # Check CPU usage
            if self.metrics['cpu_usage'] > self.alert_thresholds['cpu_usage']:
                alerts.append({
                    'type': 'high_cpu',
                    'value': self.metrics['cpu_usage'],
                    'threshold': self.alert_thresholds['cpu_usage']
                })
            
            # Check memory usage
            if self.metrics['memory_usage'] > self.alert_thresholds['memory_usage']:
                alerts.append({
                    'type': 'high_memory',
                    'value': self.metrics['memory_usage'],
                    'threshold': self.alert_thresholds['memory_usage']
                })
            
            # Check error rate
            error_rate = (
                self.metrics['error_count'] / self.metrics['request_count']
                if self.metrics['request_count'] > 0 else 0
            )
            if error_rate > self.alert_thresholds['error_rate']:
                alerts.append({
                    'type': 'high_error_rate',
                    'value': error_rate,
                    'threshold': self.alert_thresholds['error_rate']
                })
            
            # Check response time
            if self.metrics['avg_response_time'] > self.alert_thresholds['response_time']:
                alerts.append({
                    'type': 'slow_response',
                    'value': self.metrics['avg_response_time'],
                    'threshold': self.alert_thresholds['response_time']
                })
            
            # Log alerts
            if alerts:
                logger.warning(f"⚠️  Health check alerts: {len(alerts)}")
                for alert in alerts:
                    logger.warning(f"   - {alert['type']}: {alert['value']} > {alert['threshold']}")
                
                # Store alerts
                await self.db.store_alerts(alerts)
            
        except Exception as e:
            logger.error(f"❌ Health check failed: {str(e)}")
    
    def get_uptime(self) -> float:
        """Get system uptime in seconds"""
        if not self.start_time:
            return 0.0
        
        delta = datetime.now() - self.start_time
        return delta.total_seconds()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get monitor statistics"""
        return {
            'is_running': self.is_running,
            'uptime': self.get_uptime(),
            'metrics': self.metrics,
            'check_interval': self.check_interval,
            'alert_thresholds': self.alert_thresholds
        }
