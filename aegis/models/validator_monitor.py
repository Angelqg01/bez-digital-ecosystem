"""
Validator Monitor Model
Monitors validator health: heartbeat freshness, downtime, contribution anomalies.
Works alongside AnomalyDetector to flag underperforming or malicious validators.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ValidatorMonitor:
    """
    Tracks validator health using heartbeat telemetry, contribution frequency,
    and uptime patterns. Triggers alerts for the DecisionEngine/AutoHealer.
    """

    # Thresholds
    HEARTBEAT_MAX_AGE_S = 10800      # 3 hours
    HEARTBEAT_WARN_AGE_S = 7200      # 2 hours
    MIN_UPTIME_PCT = 90.0
    MIN_CONTRIBUTIONS_24H = 1
    ANOMALY_SCORE_THRESHOLD = 0.7

    def __init__(self):
        self.is_loaded = True
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.stats = {
            'evaluations': 0,
            'alerts_raised': 0,
            'validators_tracked': 0,
            'last_evaluation': None,
        }

    async def load_model(self):
        """No ML model to load — rule-based monitor."""
        logger.info("ValidatorMonitor initialized (rule-based)")

    # ─────────────────────────────────────────────────────
    #  Core evaluation
    # ─────────────────────────────────────────────────────

    async def evaluate(self, validator_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate a single validator's health.

        Args:
            validator_data: dict with keys:
              - operator (str): address
              - is_active (bool)
              - uptime_pct (float)
              - last_heartbeat (ISO str or None)
              - contribution_points (int)
              - tier (int, 1-4)
              - staked_bez (float)

        Returns:
            dict with health_score (0-100), status, alerts list.
        """
        self.stats['evaluations'] += 1
        self.stats['last_evaluation'] = datetime.utcnow().isoformat()

        operator = str(validator_data.get('operator', ''))[:42]
        is_active = validator_data.get('is_active', False)
        uptime = float(validator_data.get('uptime_pct', 0))
        last_hb_str = validator_data.get('last_heartbeat')
        contribution = int(validator_data.get('contribution_points', 0))
        tier = int(validator_data.get('tier', 1))
        staked = float(validator_data.get('staked_bez', 0))

        alerts: List[str] = []
        score = 100.0

        # 1. Active check
        if not is_active:
            alerts.append('validator_inactive')
            score -= 40

        # 2. Heartbeat freshness
        hb_age_s = None
        if last_hb_str:
            try:
                last_hb = datetime.fromisoformat(last_hb_str.replace('Z', '+00:00'))
                hb_age_s = (datetime.now(last_hb.tzinfo) - last_hb).total_seconds()
            except Exception:
                hb_age_s = None

        if hb_age_s is None:
            alerts.append('heartbeat_never_seen')
            score -= 30
        elif hb_age_s > self.HEARTBEAT_MAX_AGE_S:
            alerts.append('heartbeat_expired')
            score -= 30
        elif hb_age_s > self.HEARTBEAT_WARN_AGE_S:
            alerts.append('heartbeat_stale')
            score -= 15

        # 3. Uptime
        if uptime < self.MIN_UPTIME_PCT:
            alerts.append('low_uptime')
            score -= max(0, (self.MIN_UPTIME_PCT - uptime) * 0.5)

        # 4. Contribution activity (only warn for Silver+ tiers)
        if tier >= 2 and contribution == 0:
            alerts.append('zero_contributions')
            score -= 10

        # 5. Stake sanity (should match tier minimums)
        tier_mins = {1: 10_000, 2: 50_000, 3: 250_000, 4: 1_000_000}
        expected_min = tier_mins.get(tier, 0)
        if staked < expected_min:
            alerts.append('stake_below_tier_minimum')
            score -= 15

        score = max(0, min(100, score))
        status = 'healthy' if score >= 80 else 'degraded' if score >= 50 else 'critical'

        if alerts:
            self.stats['alerts_raised'] += len(alerts)

        # Track
        self._cache[operator.lower()] = {
            'score': score,
            'status': status,
            'alerts': alerts,
            'evaluated_at': datetime.utcnow().isoformat(),
        }
        self.stats['validators_tracked'] = len(self._cache)

        return {
            'operator': operator,
            'health_score': round(score, 1),
            'status': status,
            'alerts': alerts,
            'heartbeat_age_seconds': round(hb_age_s) if hb_age_s is not None else None,
            'evaluated_at': self.stats['last_evaluation'],
        }

    async def evaluate_batch(self, validators: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Evaluate multiple validators in one call."""
        results = []
        for v in validators:
            results.append(await self.evaluate(v))
        return results

    def get_critical_validators(self) -> List[Dict[str, Any]]:
        """Return cached validators in critical status."""
        return [
            {**v, 'operator': k}
            for k, v in self._cache.items()
            if v.get('status') == 'critical'
        ]

    def get_stats(self) -> Dict[str, Any]:
        return {**self.stats}
