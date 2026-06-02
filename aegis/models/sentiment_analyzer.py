"""
Sentiment Analyzer Model - FASE 6A Upgrade
Hybrid approach: TF-IDF + MultinomialNB when trained, lexicon fallback otherwise.
Analyzes sentiment in user feedback, logs, dispute text, and reviews.
"""

import logging
import pickle
import os
from typing import Dict, Any, List
import re
import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = os.getenv('SENTIMENT_MODEL_PATH', 'models/sentiment_model.pkl')


class SentimentAnalyzer:
    """
    Hybrid sentiment analysis:
      - TF-IDF + MultinomialNB (trained) for high-accuracy classification
      - Lexicon fallback when model is untrained
    """

    def __init__(self):
        self.is_loaded = False
        self.vectorizer = None   # TfidfVectorizer
        self.classifier = None   # MultinomialNB
        self.ml_ready = False    # True when classifier has been fit

        # Expanded lexicons (fallback mode)
        self.positive_words = {
            'good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'perfect',
            'wonderful', 'fantastic', 'best', 'happy', 'enjoy', 'like', 'thanks',
            'helpful', 'easy', 'fast', 'smooth', 'clean', 'beautiful', 'nice',
            'reliable', 'efficient', 'secure', 'approved', 'success', 'resolved',
            'optimal', 'compliant', 'verified', 'valid', 'accepted',
        }

        self.negative_words = {
            'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'slow',
            'broken', 'error', 'bug', 'crash', 'fail', 'problem', 'issue',
            'difficult', 'hard', 'confusing', 'complicated', 'frustrating',
            'annoying', 'useless', 'poor', 'disappointed', 'denied', 'rejected',
            'breach', 'violation', 'exploit', 'suspicious', 'anomaly', 'overdue',
        }

        self.error_keywords = {
            'exception', 'error', 'fail', 'crash', 'fatal', 'critical',
            'timeout', 'denied', 'invalid', 'refused', 'rejected',
            'revert', 'outofgas', 'overflow', 'underflow', 'panic',
        }

        self.stats = {'analyses': 0, 'positive': 0, 'negative': 0, 'neutral': 0}

    async def load_model(self):
        """Load trained TF-IDF + NB model or initialize fresh"""
        try:
            if os.path.exists(MODEL_PATH):
                with open(MODEL_PATH, 'rb') as f:
                    data = pickle.load(f)
                self.vectorizer = data['vectorizer']
                self.classifier = data['classifier']
                self.ml_ready = True
                logger.info('SentimentAnalyzer: loaded trained model')
            else:
                self._init_fresh()
                logger.info('SentimentAnalyzer: initialized (lexicon mode)')
            self.is_loaded = True
        except Exception as e:
            logger.error(f'SentimentAnalyzer load failed: {e}')
            self._init_fresh()
            self.is_loaded = True

    def _init_fresh(self):
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.naive_bayes import MultinomialNB
        self.vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2))
        self.classifier = MultinomialNB(alpha=0.1)
        self.ml_ready = False
    
    def preprocess_text(self, text: str) -> List[str]:
        text = text.lower()
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        return text.split()

    async def analyze(self, text: str) -> Dict[str, Any]:
        """Analyze sentiment — ML when trained, lexicon fallback otherwise"""
        try:
            if not text:
                return {'sentiment': 'neutral', 'score': 0.0, 'confidence': 0.0}

            # Try ML path first
            if self.ml_ready:
                return self._ml_analyze(text)

            # Lexicon fallback
            return self._lexicon_analyze(text)
        except Exception as e:
            logger.error(f'Sentiment analysis failed: {e}')
            return {'sentiment': 'neutral', 'score': 0.0, 'confidence': 0.0}

    def _ml_analyze(self, text: str) -> Dict[str, Any]:
        vec = self.vectorizer.transform([text])
        proba = self.classifier.predict_proba(vec)[0]
        classes = self.classifier.classes_
        idx = int(np.argmax(proba))
        sentiment = classes[idx]
        score = float(proba[idx])
        # map to -1..1
        if sentiment == 'positive':
            mapped = score
        elif sentiment == 'negative':
            mapped = -score
        else:
            mapped = 0.0

        self.stats['analyses'] += 1
        self.stats[sentiment] += 1

        return {
            'sentiment': sentiment,
            'score': round(mapped, 4),
            'confidence': round(score, 4),
            'method': 'ml',
        }

    def _lexicon_analyze(self, text: str) -> Dict[str, Any]:
        words = self.preprocess_text(text)
        if not words:
            return {'sentiment': 'neutral', 'score': 0.0, 'confidence': 0.0}

        positive_count = sum(1 for w in words if w in self.positive_words)
        negative_count = sum(1 for w in words if w in self.negative_words)
        error_count = sum(1 for w in words if w in self.error_keywords)

        total = positive_count + negative_count + error_count
        if total == 0:
            sentiment, score, confidence = 'neutral', 0.0, 0.0
        else:
            score = (positive_count - negative_count - error_count * 2) / len(words)
            confidence = total / len(words)
            sentiment = 'positive' if score > 0.1 else ('negative' if score < -0.1 else 'neutral')

        self.stats['analyses'] += 1
        self.stats[sentiment] += 1

        return {
            'sentiment': sentiment,
            'score': float(score),
            'confidence': float(confidence),
            'positive_words': positive_count,
            'negative_words': negative_count,
            'error_words': error_count,
            'method': 'lexicon',
        }

    async def analyze_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        return [await self.analyze(t) for t in texts]

    async def train(self, texts: List[str], labels: List[str]):
        """Train TF-IDF + NB on labeled data. Labels: positive/negative/neutral"""
        if len(texts) < 20:
            logger.warning(f'SentimentAnalyzer: not enough data ({len(texts)} < 20)')
            return
        try:
            X = self.vectorizer.fit_transform(texts)
            self.classifier.fit(X, labels)
            self.ml_ready = True
            logger.info(f'SentimentAnalyzer: trained on {len(texts)} samples')
        except Exception as e:
            logger.error(f'SentimentAnalyzer train error: {e}')

    async def save_model(self):
        try:
            os.makedirs(os.path.dirname(MODEL_PATH) or '.', exist_ok=True)
            with open(MODEL_PATH, 'wb') as f:
                pickle.dump({'vectorizer': self.vectorizer, 'classifier': self.classifier}, f)
            logger.info('SentimentAnalyzer: model saved')
        except Exception as e:
            logger.error(f'SentimentAnalyzer save error: {e}')

    def detect_critical_errors(self, text: str) -> List[str]:
        words = self.preprocess_text(text)
        return [w for w in words if w in self.error_keywords]

    def get_stats(self) -> Dict[str, Any]:
        return {**self.stats, 'ml_ready': self.ml_ready, 'is_loaded': self.is_loaded}
