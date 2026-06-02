"""
Gas Price Predictor - FASE 6A
Uses sklearn GradientBoostingRegressor to predict optimal tx timing
based on historical gas usage from aegis_web3_events + aegis_gas_analysis.
"""

import logging
import pickle
import os
import numpy as np
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MODEL_PATH = os.getenv('GAS_MODEL_PATH', 'models/gas_predictor.pkl')


class GasPredictor:
    """Predicts gas prices for optimal transaction timing on BeZhas L2"""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.is_loaded = False
        self.predictions_made = 0
        self.feature_names = [
            'hour_of_day',    # 0-23
            'day_of_week',    # 0-6
            'avg_gas_1h',     # rolling mean of gas used (last 1h)
            'avg_gas_6h',     # rolling mean (6h)
            'tx_count_1h',    # number of txs in last hour
            'pending_tx',     # estimated pending txs
            'block_utilization',  # % of block gas limit used
        ]

    async def load_model(self):
        """Load trained model from disk or initialize fresh"""
        try:
            if os.path.exists(MODEL_PATH):
                with open(MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                self.model = data['model']
                self.scaler = data['scaler']
                self.is_loaded = True
                logger.info('GasPredictor: loaded from checkpoint')
            else:
                self._init_fresh()
                logger.info('GasPredictor: initialized fresh (no checkpoint)')
        except Exception as e:
            logger.error(f'GasPredictor load failed: {e}')
            self._init_fresh()

    def _init_fresh(self):
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.preprocessing import StandardScaler
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=4,
            learning_rate=0.1,
            random_state=42,
        )
        self.scaler = StandardScaler()
        self.is_loaded = True

    async def predict(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict optimal gas fee given current network context.
        Returns: {predicted_gas, confidence, recommendation, wait_seconds}
        """
        if not self.is_loaded:
            return {'predicted_gas': 0.05, 'confidence': 0.0, 'recommendation': 'model_not_loaded', 'wait_seconds': 0}

        try:
            features = self._extract_features(context)
            arr = np.array([features])

            # If model hasn't been trained yet, return heuristic prediction
            if not hasattr(self.model, 'estimators_') or self.model.estimators_ is None:
                return self._heuristic_predict(context)

            arr_scaled = self.scaler.transform(arr)
            predicted = float(self.model.predict(arr_scaled)[0])
            predicted = max(0.001, predicted)  # floor at minimum gas

            current_gas = context.get('current_gas', 0.05)
            savings_pct = (current_gas - predicted) / current_gas if current_gas > 0 else 0

            self.predictions_made += 1

            if savings_pct > 0.05:
                recommendation = 'wait'
                wait = 30  # wait 30s for cheaper gas
            elif savings_pct < -0.1:
                recommendation = 'send_now'
                wait = 0
            else:
                recommendation = 'neutral'
                wait = 0

            return {
                'predicted_gas': round(predicted, 6),
                'confidence': round(min(0.95, 0.5 + self.predictions_made * 0.001), 3),
                'recommendation': recommendation,
                'wait_seconds': wait,
                'savings_pct': round(savings_pct * 100, 2),
            }
        except Exception as e:
            logger.error(f'GasPredictor predict error: {e}')
            return self._heuristic_predict(context)

    def _heuristic_predict(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Simple rule-based fallback when model is untrained"""
        hour = datetime.now(timezone.utc).hour
        # L2 gas is typically lower at night (UTC)
        base = context.get('current_gas', 0.05)
        if 2 <= hour <= 8:
            predicted = base * 0.92
            rec = 'send_now'
        elif 14 <= hour <= 20:
            predicted = base * 1.08
            rec = 'wait'
        else:
            predicted = base
            rec = 'neutral'

        return {
            'predicted_gas': round(predicted, 6),
            'confidence': 0.45,
            'recommendation': rec,
            'wait_seconds': 30 if rec == 'wait' else 0,
            'savings_pct': round((base - predicted) / base * 100, 2) if base > 0 else 0,
        }

    def _extract_features(self, ctx: Dict[str, Any]) -> List[float]:
        now = datetime.now(timezone.utc)
        return [
            float(now.hour),
            float(now.weekday()),
            float(ctx.get('avg_gas_1h', 0.05)),
            float(ctx.get('avg_gas_6h', 0.05)),
            float(ctx.get('tx_count_1h', 0)),
            float(ctx.get('pending_tx', 0)),
            float(ctx.get('block_utilization', 0.3)),
        ]

    async def train(self, data: List[Dict[str, Any]]):
        """Train the model with historical gas data"""
        if len(data) < 50:
            logger.warning(f'GasPredictor: not enough data ({len(data)} < 50)')
            return

        try:
            X = np.array([self._extract_features(d) for d in data])
            y = np.array([d['actual_gas'] for d in data])

            from sklearn.preprocessing import StandardScaler
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X)
            self.model.fit(X_scaled, y)
            logger.info(f'GasPredictor: trained on {len(data)} samples')
        except Exception as e:
            logger.error(f'GasPredictor train error: {e}')

    async def save_model(self):
        """Persist model to disk"""
        try:
            os.makedirs(os.path.dirname(MODEL_PATH) or '.', exist_ok=True)
            with open(MODEL_PATH, 'wb') as f:
                pickle.dump({'model': self.model, 'scaler': self.scaler}, f)
            logger.info('GasPredictor: model saved')
        except Exception as e:
            logger.error(f'GasPredictor save error: {e}')

    def get_stats(self) -> Dict[str, Any]:
        return {
            'is_loaded': self.is_loaded,
            'predictions_made': self.predictions_made,
            'has_trained_model': hasattr(self.model, 'estimators_') and self.model.estimators_ is not None,
        }
