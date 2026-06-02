"""
Sentiment Analyzer Model
Analyzes sentiment in user feedback, logs, and text data
Uses VADER and simple NLP techniques
"""

import logging
from typing import Dict, Any, List
import re
from collections import Counter

logger = logging.getLogger(__name__)


class SentimentAnalyzer:
    """
    Lightweight sentiment analysis using lexicon-based approach
    """
    
    def __init__(self):
        self.is_loaded = False
        
        # Simple sentiment lexicons
        self.positive_words = {
            'good', 'great', 'excellent', 'amazing', 'awesome', 'love', 'perfect',
            'wonderful', 'fantastic', 'best', 'happy', 'enjoy', 'like', 'thanks',
            'helpful', 'easy', 'fast', 'smooth', 'clean', 'beautiful', 'nice'
        }
        
        self.negative_words = {
            'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'slow',
            'broken', 'error', 'bug', 'crash', 'fail', 'problem', 'issue',
            'difficult', 'hard', 'confusing', 'complicated', 'frustrating',
            'annoying', 'useless', 'poor', 'disappointed'
        }
        
        # Error keywords
        self.error_keywords = {
            'exception', 'error', 'fail', 'crash', 'fatal', 'critical',
            'timeout', 'denied', 'invalid', 'refused', 'rejected'
        }
        
        # Statistics
        self.stats = {
            'analyses': 0,
            'positive': 0,
            'negative': 0,
            'neutral': 0
        }
    
    async def load_model(self):
        """Initialize sentiment analyzer"""
        try:
            logger.info("📦 Loading sentiment analyzer")
            # Lexicon-based model is ready immediately
            self.is_loaded = True
            logger.info("✅ Sentiment analyzer loaded")
            
        except Exception as e:
            logger.error(f"❌ Failed to load sentiment analyzer: {str(e)}")
    
    def preprocess_text(self, text: str) -> List[str]:
        """
        Preprocess text for analysis
        """
        # Lowercase and split
        text = text.lower()
        
        # Remove special characters but keep alphanumeric
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        
        # Split into words
        words = text.split()
        
        return words
    
    async def analyze(self, text: str) -> Dict[str, Any]:
        """
        Analyze sentiment of text
        Returns sentiment score and category
        """
        try:
            if not text:
                return {'sentiment': 'neutral', 'score': 0.0, 'confidence': 0.0}
            
            words = self.preprocess_text(text)
            
            # Count positive and negative words
            positive_count = sum(1 for word in words if word in self.positive_words)
            negative_count = sum(1 for word in words if word in self.negative_words)
            error_count = sum(1 for word in words if word in self.error_keywords)
            
            # Calculate sentiment score (-1 to 1)
            total_sentiment_words = positive_count + negative_count + error_count
            
            if total_sentiment_words == 0:
                score = 0.0
                sentiment = 'neutral'
                confidence = 0.0
            else:
                score = (positive_count - negative_count - error_count * 2) / len(words)
                confidence = total_sentiment_words / len(words)
                
                if score > 0.1:
                    sentiment = 'positive'
                elif score < -0.1:
                    sentiment = 'negative'
                else:
                    sentiment = 'neutral'
            
            # Update stats
            self.stats['analyses'] += 1
            self.stats[sentiment] += 1
            
            return {
                'sentiment': sentiment,
                'score': float(score),
                'confidence': float(confidence),
                'positive_words': positive_count,
                'negative_words': negative_count,
                'error_words': error_count
            }
            
        except Exception as e:
            logger.error(f"❌ Sentiment analysis failed: {str(e)}")
            return {'sentiment': 'neutral', 'score': 0.0, 'confidence': 0.0}
    
    async def analyze_batch(self, texts: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze multiple texts
        """
        results = []
        for text in texts:
            result = await self.analyze(text)
            results.append(result)
        
        return results
    
    def get_dominant_sentiment(self, texts: List[str]) -> str:
        """
        Get dominant sentiment from multiple texts
        """
        sentiments = []
        for text in texts:
            words = self.preprocess_text(text)
            positive = sum(1 for w in words if w in self.positive_words)
            negative = sum(1 for w in words if w in self.negative_words)
            
            if positive > negative:
                sentiments.append('positive')
            elif negative > positive:
                sentiments.append('negative')
            else:
                sentiments.append('neutral')
        
        # Count occurrences
        counter = Counter(sentiments)
        dominant = counter.most_common(1)[0][0] if sentiments else 'neutral'
        
        return dominant
    
    async def detect_critical_errors(self, log_message: str) -> bool:
        """
        Detect if log message contains critical errors
        """
        words = self.preprocess_text(log_message)
        
        critical_keywords = {'fatal', 'critical', 'emergency', 'panic', 'crash'}
        has_critical = any(word in critical_keywords for word in words)
        
        return has_critical
    
    def get_stats(self) -> Dict[str, Any]:
        """Get analyzer statistics"""
        return {
            'is_loaded': self.is_loaded,
            'analyses': self.stats['analyses'],
            'positive': self.stats['positive'],
            'negative': self.stats['negative'],
            'neutral': self.stats['neutral'],
            'positive_rate': (
                self.stats['positive'] / self.stats['analyses']
                if self.stats['analyses'] > 0 else 0
            )
        }
