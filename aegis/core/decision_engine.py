"""
Decision Engine
Makes intelligent decisions based on ML models and system state
"""

import logging
from typing import Dict, Any, List
from datetime import datetime

logger = logging.getLogger(__name__)


class DecisionEngine:
    """
    Intelligent decision-making engine
    Combines ML models with business rules
    """
    
    def __init__(self, ml_models: Dict[str, Any], auto_healer):
        self.ml_models = ml_models
        self.auto_healer = auto_healer
        self.decision_history = []
        
        # Decision thresholds
        self.thresholds = {
            'anomaly_score': 0.8,  # Trigger healing if anomaly > 0.8
            'sentiment_negative': -0.5,  # Alert if sentiment < -0.5
            'ux_confidence': 0.7  # Apply UX change if confidence > 0.7
        }
        
        # Statistics
        self.stats = {
            'decisions_made': 0,
            'healings_triggered': 0,
            'ux_optimizations': 0,
            'alerts_sent': 0
        }
    
    async def handle_anomaly(self, event: Dict[str, Any], anomaly_score: float):
        """
        Handle detected anomaly
        Decide whether to trigger healing
        """
        try:
            logger.info(f"🤔 Evaluating anomaly: score={anomaly_score}")
            
            # Check if score exceeds threshold
            if anomaly_score < self.thresholds['anomaly_score']:
                logger.debug("Anomaly score below threshold, no action needed")
                return
            
            # Determine anomaly type
            anomaly_type = self.classify_anomaly(event, anomaly_score)
            
            # Check if we should trigger healing
            should_heal = await self.should_trigger_healing(anomaly_type, event)
            
            if should_heal:
                logger.warning(f"🚨 Triggering healing for: {anomaly_type}")
                await self.auto_healer.handle_anomaly(anomaly_type, event)
                self.stats['healings_triggered'] += 1
            else:
                logger.info(f"ℹ️  Anomaly logged but no healing needed: {anomaly_type}")
            
            # Record decision
            self.record_decision({
                'type': 'anomaly',
                'anomaly_type': anomaly_type,
                'score': anomaly_score,
                'healing_triggered': should_heal,
                'timestamp': datetime.now().isoformat()
            })
            
            self.stats['decisions_made'] += 1
            
        except Exception as e:
            logger.error(f"❌ Failed to handle anomaly: {str(e)}")
    
    def classify_anomaly(self, event: Dict[str, Any], score: float) -> str:
        """
        Classify type of anomaly based on event data
        """
        event_type = event.get('eventType', 'unknown')
        perf = event.get('performance', {})
        error = event.get('error')
        
        # Check for specific patterns
        if error:
            return 'high_error_rate'
        
        if perf.get('responseTime', 0) > 5000:
            return 'slow_response'
        
        if perf.get('memoryUsage', 0) > 0.9:
            return 'memory_leak'
        
        if event_type == 'web3_transaction' and float(event.get('gasUsed', 0)) > 1000000:
            return 'high_gas_cost'
        
        # Default to generic anomaly
        return 'generic_anomaly'
    
    async def should_trigger_healing(self, anomaly_type: str, event: Dict[str, Any]) -> bool:
        """
        Decide if healing should be triggered
        Uses business rules and historical data
        """
        # Critical anomalies always trigger healing
        critical_types = {'high_error_rate', 'memory_leak', 'database_connection'}
        if anomaly_type in critical_types:
            return True
        
        # Check frequency - don't heal if same anomaly occurred recently
        recent_count = await self.count_recent_healings(anomaly_type, minutes=5)
        if recent_count > 3:
            logger.warning(f"⚠️  Too many recent healings for {anomaly_type}, skipping")
            return False
        
        # Check time of day - be more conservative during peak hours
        hour = datetime.now().hour
        is_peak_hour = 9 <= hour <= 17
        
        if is_peak_hour and anomaly_type not in critical_types:
            logger.info("During peak hours, only healing critical issues")
            return False
        
        # Default to healing
        return True
    
    async def count_recent_healings(self, anomaly_type: str, minutes: int = 5) -> int:
        """
        Count recent healings of same type
        """
        cutoff_time = datetime.now().timestamp() - (minutes * 60)
        
        count = sum(
            1 for decision in self.decision_history
            if (
                decision.get('anomaly_type') == anomaly_type and
                decision.get('healing_triggered') and
                datetime.fromisoformat(decision.get('timestamp')).timestamp() > cutoff_time
            )
        )
        
        return count
    
    async def evaluate_ux_optimization(self, current_state: Dict[str, Any]):
        """
        Evaluate if UX optimization should be applied
        """
        try:
            # Get recommendation from UX optimizer
            recommendation = await self.ml_models['ux_optimizer'].recommend_optimization(current_state)
            
            confidence = recommendation.get('confidence', 0)
            action = recommendation.get('action')
            
            # Check if confidence is high enough
            if confidence > self.thresholds['ux_confidence']:
                logger.info(f"✨ Applying UX optimization: {action} (confidence={confidence})")
                
                # Apply optimization (in production, would update UI config)
                await self.apply_ux_optimization(action, current_state)
                
                self.stats['ux_optimizations'] += 1
            else:
                logger.debug(f"UX confidence too low: {confidence} < {self.thresholds['ux_confidence']}")
            
            self.stats['decisions_made'] += 1
            
        except Exception as e:
            logger.error(f"❌ Failed to evaluate UX optimization: {str(e)}")
    
    async def apply_ux_optimization(self, action: str, context: Dict[str, Any]):
        """
        Apply UX optimization
        """
        logger.info(f"🎨 Applying UX optimization: {action}")
        
        # In production, would:
        # - Update feature flags
        # - Modify UI configuration
        # - A/B test changes
        # - Notify frontend via WebSocket
        
        optimization = {
            'action': action,
            'context': context,
            'timestamp': datetime.now().isoformat()
        }
        
        self.record_decision({
            'type': 'ux_optimization',
            'optimization': optimization,
            'timestamp': datetime.now().isoformat()
        })
    
    async def analyze_sentiment_trend(self, recent_logs: List[Dict[str, Any]]):
        """
        Analyze sentiment trend and alert if negative
        """
        try:
            if not recent_logs:
                return
            
            messages = [log.get('message', '') for log in recent_logs]
            
            # Analyze batch
            sentiments = await self.ml_models['sentiment'].analyze_batch(messages)
            
            # Calculate average sentiment
            scores = [s['score'] for s in sentiments]
            avg_sentiment = sum(scores) / len(scores) if scores else 0
            
            # Check if concerning
            if avg_sentiment < self.thresholds['sentiment_negative']:
                logger.warning(f"⚠️  Negative sentiment detected: {avg_sentiment}")
                
                # Send alert
                await self.send_sentiment_alert(avg_sentiment, sentiments)
                self.stats['alerts_sent'] += 1
            
        except Exception as e:
            logger.error(f"❌ Failed to analyze sentiment trend: {str(e)}")
    
    async def send_sentiment_alert(self, avg_sentiment: float, details: List[Dict[str, Any]]):
        """
        Send alert about negative sentiment
        """
        logger.warning(f"📧 Sending sentiment alert: avg={avg_sentiment}")
        
        # In production, would send to monitoring system
        # (Slack, Discord, email, etc.)
    
    async def evaluate_validator_slashing(self, validator_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate whether a validator deserves slashing.
        Uses ValidatorMonitor + business rules to produce a slashing recommendation.
        In production, if should_slash is True with severity=critical,
        Aegis calls SlashingManager.slashForFraudulentData() via AEGIS_AI_ROLE.
        """
        operator = validator_data.get('operator', '')
        downtime_hours = validator_data.get('downtime_hours', 0)
        missed_votes = validator_data.get('missed_votes', 0)
        anomaly_score = validator_data.get('anomaly_score', 0)
        is_sequencer = validator_data.get('is_sequencer', False)

        reasons = []
        # Rule 1: Extended downtime (>24h for regular, >6h for sequencer)
        if is_sequencer and downtime_hours > 6:
            reasons.append('sequencer_downtime')
        elif downtime_hours > 24:
            reasons.append('extended_downtime')

        # Rule 2: Excessive missed DAO votes
        if missed_votes > 5:
            reasons.append('excessive_missed_votes')

        # Rule 3: High anomaly/fraud score from ML model
        if anomaly_score > 0.8:
            reasons.append('high_anomaly_score')

        # Rule 4: Use ValidatorMonitor if available
        if 'validator_monitor' in self.ml_models:
            monitor = self.ml_models['validator_monitor']
            health = monitor.evaluate(validator_data)
            if health.get('status') == 'critical':
                reasons.append('critical_health_score')

        should_slash = len(reasons) > 0
        severity = 'none'
        recommended_penalty_pct = 0

        if len(reasons) >= 3:
            severity = 'critical'
            recommended_penalty_pct = 10
        elif len(reasons) == 2:
            severity = 'high'
            recommended_penalty_pct = 5
        elif len(reasons) == 1:
            severity = 'medium'
            recommended_penalty_pct = 2

        result = {
            'operator': operator,
            'should_slash': should_slash,
            'severity': severity,
            'reasons': reasons,
            'recommended_penalty_pct': recommended_penalty_pct,
        }

        # If critical, trigger automated slashing pipeline
        if severity == 'critical':
            logger.warning(f"🚨 CRITICAL slash recommendation for {operator}: {reasons}")
            self.stats['alerts_sent'] += 1
            # In production: calls SlashingManager.slashForFraudulentData(operator, evidence)
            # via the AEGIS_AI_ROLE granted to this Aegis service wallet
            result['automated_action'] = 'slashForFraudulentData queued'

        self.record_decision({
            'type': 'validator_slashing',
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        self.stats['decisions_made'] += 1

        return result
    
    def record_decision(self, decision: Dict[str, Any]):
        """
        Record decision in history
        """
        self.decision_history.append(decision)
        
        # Keep only recent decisions (last 1000)
        if len(self.decision_history) > 1000:
            self.decision_history = self.decision_history[-1000:]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get decision engine statistics"""
        return {
            'decisions_made': self.stats['decisions_made'],
            'healings_triggered': self.stats['healings_triggered'],
            'ux_optimizations': self.stats['ux_optimizations'],
            'alerts_sent': self.stats['alerts_sent'],
            'recent_decisions': len(self.decision_history),
            'thresholds': self.thresholds
        }
