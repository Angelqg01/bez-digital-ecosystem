"""
Anomaly Detector Model
Detects anomalies in telemetry, logs, and system behavior
Uses Isolation Forest and statistical methods
"""

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import pickle
import logging
from pathlib import Path
from typing import Dict, Any, List
import asyncio

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """
    Anomaly detection using Isolation Forest
    """
    
    def __init__(self, model_path: str = "models/checkpoints/anomaly_detector.pkl"):
        self.model_path = Path(model_path)
        self.model = None
        self.scaler = StandardScaler()
        self.is_loaded = False
        self.feature_names = [
            'response_time', 'error_rate', 'request_count',
            'cpu_usage', 'memory_usage', 'network_latency',
            'gas_cost', 'tx_success_rate'
        ]
        self.stats = {
            'predictions': 0,
            'anomalies_detected': 0,
            'last_prediction_time': None
        }
    
    async def load_model(self):
        """Load pre-trained model or initialize new one"""
        try:
            if self.model_path.exists():
                logger.info(f"📦 Loading anomaly detector from {self.model_path}")
                with open(self.model_path, 'rb') as f:
                    checkpoint = pickle.load(f)
                    self.model = checkpoint['model']
                    self.scaler = checkpoint['scaler']
                logger.info("✅ Anomaly detector loaded")
            else:
                logger.warning("⚠️  No pre-trained model found, initializing new model")
                await self.initialize_model()
            
            self.is_loaded = True
            
        except Exception as e:
            logger.error(f"❌ Failed to load anomaly detector: {str(e)}")
            await self.initialize_model()
    
    async def initialize_model(self):
        """Initialize a new Isolation Forest model"""
        logger.info("🔧 Initializing new Isolation Forest model")
        self.model = IsolationForest(
            contamination=0.1,  # Expect 10% anomalies
            n_estimators=100,
            max_samples='auto',
            random_state=42
        )
        self.is_loaded = True
        logger.info("✅ New anomaly detector initialized")
    
    def extract_features(self, event: Dict[str, Any]) -> np.ndarray:
        """
        Extract numerical features from event
        """
        features = []
        
        # Extract performance metrics
        if 'performance' in event and event['performance']:
            perf = event['performance']
            features.append(perf.get('responseTime', 0))
            features.append(perf.get('errorRate', 0))
            features.append(perf.get('requestCount', 1))
        else:
            features.extend([0, 0, 1])
        
        # Extract system metrics (if available)
        metadata = event.get('metadata', {})
        features.append(metadata.get('cpuUsage', 0))
        features.append(metadata.get('memoryUsage', 0))
        features.append(metadata.get('networkLatency', 0))
        
        # Extract blockchain metrics (if Web3 event)
        features.append(float(metadata.get('gasCost', 0)))
        features.append(metadata.get('txSuccessRate', 1.0))
        
        return np.array(features).reshape(1, -1)
    
    async def predict(self, event: Dict[str, Any]) -> float:
        """
        Predict anomaly score for an event
        Returns: Float between 0 and 1 (1 = high anomaly)
        """
        try:
            if not self.is_loaded:
                logger.warning("Model not loaded, returning 0")
                return 0.0
            
            # Extract features
            features = self.extract_features(event)
            
            # Predict (-1 = anomaly, 1 = normal)
            prediction = self.model.predict(features)[0]
            
            # Get anomaly score (lower = more anomalous)
            score = self.model.score_samples(features)[0]
            
            # Normalize score to 0-1 range (higher = more anomalous)
            # score_samples returns negative values, more negative = more anomalous
            anomaly_score = 1 / (1 + np.exp(score))  # Sigmoid transformation
            
            # Update stats
            self.stats['predictions'] += 1
            if anomaly_score > 0.8:
                self.stats['anomalies_detected'] += 1
            self.stats['last_prediction_time'] = event.get('timestamp')
            
            return float(anomaly_score)
            
        except Exception as e:
            logger.error(f"❌ Prediction failed: {str(e)}")
            return 0.0
    
    async def train(self, events: List[Dict[str, Any]]):
        """
        Train model on new data
        """
        try:
            if len(events) < 100:
                logger.warning("Not enough data for training (need at least 100 events)")
                return
            
            logger.info(f"🎓 Training anomaly detector on {len(events)} events")
            
            # Extract features from all events
            features_list = [self.extract_features(e) for e in events]
            X = np.vstack(features_list)
            
            # Fit scaler and transform
            X_scaled = self.scaler.fit_transform(X)
            
            # Train model
            self.model.fit(X_scaled)
            
            # Save model
            await self.save_model()
            
            logger.info("✅ Anomaly detector trained successfully")
            
        except Exception as e:
            logger.error(f"❌ Training failed: {str(e)}")
    
    async def save_model(self):
        """Save model to disk"""
        try:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            
            checkpoint = {
                'model': self.model,
                'scaler': self.scaler,
                'feature_names': self.feature_names
            }
            
            with open(self.model_path, 'wb') as f:
                pickle.dump(checkpoint, f)
            
            logger.info(f"💾 Model saved to {self.model_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save model: {str(e)}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get model statistics"""
        return {
            'is_loaded': self.is_loaded,
            'predictions': self.stats['predictions'],
            'anomalies_detected': self.stats['anomalies_detected'],
            'detection_rate': (
                self.stats['anomalies_detected'] / self.stats['predictions']
                if self.stats['predictions'] > 0 else 0
            ),
            'last_prediction_time': self.stats['last_prediction_time']
        }
