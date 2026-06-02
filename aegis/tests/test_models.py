"""Tests for ML models (unit level — no external dependencies)."""
import pytest
import numpy as np
from unittest.mock import AsyncMock, patch

pytestmark = pytest.mark.asyncio


class TestAnomalyDetector:
    @pytest.fixture
    def detector(self):
        from models.anomaly_detector import AnomalyDetector
        d = AnomalyDetector()
        return d

    def test_extract_features_returns_array(self, detector):
        event = {
            "performance": {"responseTime": 200},
            "metadata": {"errorRate": 0.01, "requestCount": 50, "cpuUsage": 40,
                          "memoryUsage": 60, "networkLatency": 30}
        }
        features = detector.extract_features(event)
        assert isinstance(features, np.ndarray)
        assert features.shape == (1, 8)

    def test_extract_features_handles_missing(self, detector):
        features = detector.extract_features({})
        assert isinstance(features, np.ndarray)
        assert features.shape == (1, 8)

    def test_get_stats_before_loading(self, detector):
        stats = detector.get_stats()
        assert stats["is_loaded"] is False
        assert stats["predictions"] == 0

    async def test_predict_returns_score(self, detector):
        await detector.initialize_model()
        # Train with some dummy data to make predict work
        events = [{"performance": {"responseTime": i * 10}, "metadata": {}} for i in range(50)]
        await detector.train(events)
        score = await detector.predict({"performance": {"responseTime": 200}, "metadata": {}})
        assert isinstance(score, float)
        assert 0.0 <= score <= 1.0


class TestGasPredictor:
    @pytest.fixture
    def predictor(self):
        from models.gas_predictor import GasPredictor
        return GasPredictor()

    def test_heuristic_predict(self, predictor):
        ctx = {"avg_gas_1h": 10.0, "avg_gas_6h": 12.0}
        result = predictor._heuristic_predict(ctx)
        assert "predicted_gas" in result
        assert "confidence" in result
        assert "recommendation" in result

    def test_get_stats(self, predictor):
        stats = predictor.get_stats()
        assert "is_loaded" in stats
        assert "predictions_made" in stats


class TestSentimentAnalyzer:
    @pytest.fixture
    def analyzer(self):
        from models.sentiment_analyzer import SentimentAnalyzer
        return SentimentAnalyzer()

    def test_preprocess_text(self, analyzer):
        tokens = analyzer.preprocess_text("Hello World! This is a TEST.")
        assert all(t.islower() for t in tokens)
        assert "hello" in tokens

    def test_detect_critical_errors(self, analyzer):
        errors = analyzer.detect_critical_errors("FATAL: database connection failed, exception thrown")
        assert len(errors) > 0

    def test_lexicon_analyze(self, analyzer):
        result = analyzer._lexicon_analyze("This is great and excellent!")
        assert result["sentiment"] in ("positive", "negative", "neutral")
        assert "score" in result

    async def test_analyze(self, analyzer):
        result = await analyzer.analyze("Everything is working perfectly fine")
        assert "sentiment" in result
        assert "score" in result
        assert result["method"] == "lexicon"

    async def test_analyze_batch(self, analyzer):
        results = await analyzer.analyze_batch(["good", "bad", "neutral"])
        assert len(results) == 3

    def test_get_stats(self, analyzer):
        stats = analyzer.get_stats()
        assert "is_loaded" in stats


class TestUXOptimizer:
    @pytest.fixture
    def optimizer(self):
        from models.ux_optimizer import UXOptimizer
        return UXOptimizer()

    def test_extract_state(self, optimizer):
        event = {"eventType": "page_view",
                 "performance": {"loadTime": 500},
                 "metadata": {"clickCount": 3}}
        state = optimizer.extract_state(event)
        assert isinstance(state, str)
        assert "page_view" in state

    def test_calculate_reward(self, optimizer):
        event = {"performance": {"loadTime": 200}, "metadata": {"clickCount": 5},
                 "error": None, "sessionDuration": 60}
        reward = optimizer.calculate_reward(event)
        assert isinstance(reward, float)

    async def test_initialize_and_recommend(self, optimizer):
        await optimizer.initialize_model()
        event = {"eventType": "page_view", "performance": {"loadTime": 500}, "metadata": {}}
        rec = await optimizer.recommend_optimization(event)
        assert "action" in rec
        assert rec["action"] in ["optimize_layout", "reduce_clicks", "improve_loading",
                                   "enhance_navigation", "simplify_flow", "no_action"]

    def test_get_stats(self, optimizer):
        stats = optimizer.get_stats()
        assert "is_loaded" in stats
