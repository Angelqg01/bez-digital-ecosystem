"""
UX Optimizer Model
Uses reinforcement learning to optimize user experience
Analyzes interaction patterns and suggests improvements
"""

import numpy as np
import logging
from typing import Dict, Any, List, Tuple
from collections import defaultdict
import pickle
from pathlib import Path

logger = logging.getLogger(__name__)


class UXOptimizer:
    """
    Q-Learning based UX optimizer
    Learns optimal UI/UX patterns from user behavior
    """
    
    def __init__(self, model_path: str = "models/checkpoints/ux_optimizer.pkl"):
        self.model_path = Path(model_path)
        self.is_loaded = False
        
        # Q-Learning parameters
        self.q_table = defaultdict(lambda: defaultdict(float))
        self.learning_rate = 0.1
        self.discount_factor = 0.95
        self.epsilon = 0.1  # Exploration rate
        
        # State/Action definitions
        self.states = []  # User interaction states
        self.actions = [
            'optimize_layout',
            'reduce_clicks',
            'improve_loading',
            'enhance_navigation',
            'simplify_flow'
        ]
        
        # Statistics
        self.stats = {
            'updates': 0,
            'states_learned': 0,
            'recommendations': 0,
            'avg_reward': 0.0
        }
    
    async def load_model(self):
        """Load pre-trained Q-table"""
        try:
            if self.model_path.exists():
                logger.info(f"📦 Loading UX optimizer from {self.model_path}")
                with open(self.model_path, 'rb') as f:
                    checkpoint = pickle.load(f)
                    self.q_table = checkpoint['q_table']
                    self.states = checkpoint['states']
                logger.info("✅ UX optimizer loaded")
            else:
                logger.warning("⚠️  No pre-trained model found, initializing new model")
                await self.initialize_model()
            
            self.is_loaded = True
            
        except Exception as e:
            logger.error(f"❌ Failed to load UX optimizer: {str(e)}")
            await self.initialize_model()
    
    async def initialize_model(self):
        """Initialize new Q-table"""
        logger.info("🔧 Initializing new UX optimizer")
        self.q_table = defaultdict(lambda: defaultdict(float))
        self.states = []
        self.is_loaded = True
        logger.info("✅ New UX optimizer initialized")
    
    def extract_state(self, event: Dict[str, Any]) -> str:
        """
        Extract state representation from telemetry event
        """
        perf = event.get('performance', {})
        event_type = event.get('eventType', 'unknown')
        
        # Create state representation
        load_time = perf.get('loadTime', 0)
        interactions = perf.get('interactions', 0)
        
        # Discretize continuous values
        load_category = 'fast' if load_time < 1000 else 'medium' if load_time < 3000 else 'slow'
        interaction_category = 'low' if interactions < 5 else 'medium' if interactions < 15 else 'high'
        
        state = f"{event_type}_{load_category}_{interaction_category}"
        
        if state not in self.states:
            self.states.append(state)
            self.stats['states_learned'] += 1
        
        return state
    
    def calculate_reward(self, event: Dict[str, Any]) -> float:
        """
        Calculate reward based on user engagement
        """
        perf = event.get('performance', {})
        metadata = event.get('metadata', {})
        
        # Positive factors
        reward = 0.0
        
        # Fast loading is good
        load_time = perf.get('loadTime', 0)
        if load_time < 1000:
            reward += 1.0
        elif load_time < 3000:
            reward += 0.5
        else:
            reward -= 0.5
        
        # High interaction is good (engagement)
        interactions = perf.get('interactions', 0)
        reward += min(interactions / 10, 1.0)
        
        # Low error rate is good
        error_rate = perf.get('errorRate', 0)
        reward -= error_rate * 2
        
        # Session duration (positive but not too long)
        session_duration = metadata.get('sessionDuration', 0)
        if 60 < session_duration < 600:  # 1-10 minutes is good
            reward += 0.5
        
        return reward
    
    async def update(self, events: List[Dict[str, Any]]):
        """
        Update Q-table with new telemetry data
        """
        try:
            for event in events:
                state = self.extract_state(event)
                reward = self.calculate_reward(event)
                
                # Get best action for current state
                best_action = self.get_best_action(state)
                
                # Update Q-value
                current_q = self.q_table[state][best_action]
                max_future_q = max(self.q_table[state].values()) if self.q_table[state] else 0
                
                new_q = current_q + self.learning_rate * (
                    reward + self.discount_factor * max_future_q - current_q
                )
                
                self.q_table[state][best_action] = new_q
                
                # Update stats
                self.stats['updates'] += 1
                self.stats['avg_reward'] = (
                    (self.stats['avg_reward'] * (self.stats['updates'] - 1) + reward)
                    / self.stats['updates']
                )
            
            # Periodically save model
            if self.stats['updates'] % 100 == 0:
                await self.save_model()
            
        except Exception as e:
            logger.error(f"❌ Update failed: {str(e)}")
    
    def get_best_action(self, state: str) -> str:
        """
        Get best action for a given state (with epsilon-greedy exploration)
        """
        if np.random.random() < self.epsilon:
            # Explore: random action
            return np.random.choice(self.actions)
        else:
            # Exploit: best known action
            if state in self.q_table and self.q_table[state]:
                return max(self.q_table[state], key=self.q_table[state].get)
            else:
                return np.random.choice(self.actions)
    
    async def recommend_optimization(self, current_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recommend UX optimization based on current state
        """
        try:
            state = self.extract_state(current_state)
            best_action = self.get_best_action(state)
            confidence = self.q_table[state][best_action] if state in self.q_table else 0
            
            self.stats['recommendations'] += 1
            
            return {
                'action': best_action,
                'confidence': float(confidence),
                'state': state,
                'all_actions': dict(self.q_table[state]) if state in self.q_table else {}
            }
            
        except Exception as e:
            logger.error(f"❌ Recommendation failed: {str(e)}")
            return {'action': 'no_action', 'confidence': 0.0}
    
    async def save_model(self):
        """Save Q-table to disk"""
        try:
            self.model_path.parent.mkdir(parents=True, exist_ok=True)
            
            checkpoint = {
                'q_table': dict(self.q_table),
                'states': self.states,
                'stats': self.stats
            }
            
            with open(self.model_path, 'wb') as f:
                pickle.dump(checkpoint, f)
            
            logger.info(f"💾 UX optimizer saved to {self.model_path}")
            
        except Exception as e:
            logger.error(f"❌ Failed to save model: {str(e)}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get model statistics"""
        return {
            'is_loaded': self.is_loaded,
            'updates': self.stats['updates'],
            'states_learned': self.stats['states_learned'],
            'recommendations': self.stats['recommendations'],
            'avg_reward': self.stats['avg_reward'],
            'q_table_size': len(self.q_table)
        }
