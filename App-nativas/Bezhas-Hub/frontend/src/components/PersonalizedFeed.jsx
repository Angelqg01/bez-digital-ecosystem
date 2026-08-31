import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const PersonalizedFeed = ({ 
  contract, 
  userAddress, 
  posts, 
  onPostClick,
  websocket 
}) => {
  const [feed, setFeed] = useState([]);
  const [preferences, setPreferences] = useState({
    preferredTopics: [],
    blockedTopics: [],
    contentFreshness: 70,
    socialWeight: 60,
    engagementWeight: 80,
    enablePersonalization: true
  });
  const [loading, setLoading] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [trendingContent, setTrendingContent] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [newTopic, setNewTopic] = useState('');
  const [feedType, setFeedType] = useState('personalized'); // 'personalized', 'trending', 'recent'

  // Load user preferences on component mount
  useEffect(() => {
    if (contract && userAddress) {
      loadUserPreferences();
      loadTrendingContent();
    }
  }, [contract, userAddress]);

  // Generate feed when preferences or posts change
  useEffect(() => {
    if (contract && userAddress && posts.length > 0) {
      generateFeed();
    }
  }, [contract, userAddress, posts, preferences, feedType]);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    if (websocket) {
      const handleFeedUpdate = (data) => {
        if (data.type === 'feed_updated' && data.userId === userAddress) {
          generateFeed();
        }
      };

      const handleTrendingUpdate = (data) => {
        if (data.type === 'trending_updated') {
          loadTrendingContent();
        }
      };

      websocket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        handleFeedUpdate(data);
        handleTrendingUpdate(data);
      });
    }
  }, [websocket, userAddress]);

  const loadUserPreferences = async () => {
    try {
      const userPrefs = await contract.getUserPreferences(userAddress);
      setPreferences({
        preferredTopics: userPrefs.preferredTopics || [],
        blockedTopics: userPrefs.blockedTopics || [],
        contentFreshness: userPrefs.contentFreshness?.toNumber() || 70,
        socialWeight: userPrefs.socialWeight?.toNumber() || 60,
        engagementWeight: userPrefs.engagementWeight?.toNumber() || 80,
        enablePersonalization: userPrefs.enablePersonalization || true
      });
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const loadTrendingContent = async () => {
    try {
      const [contentIds, topics] = await contract.getTrendingContent();
      setTrendingContent(contentIds.map(id => id.toNumber()));
      setTrendingTopics(topics);
    } catch (error) {
      console.error('Error loading trending content:', error);
    }
  };

  const generateFeed = async () => {
    if (!contract || !userAddress || posts.length === 0) return;

    setLoading(true);
    try {
      if (feedType === 'recent') {
        // Show recent posts sorted by timestamp
        const sortedPosts = [...posts].sort((a, b) => b.timestamp - a.timestamp);
        setFeed(sortedPosts);
      } else if (feedType === 'trending') {
        // Show trending posts
        const trendingPosts = posts.filter(post => 
          trendingContent.includes(post.id)
        );
        setFeed(trendingPosts);
      } else {
        // Generate personalized feed
        const contentIds = posts.map(post => post.id);
        const feedItems = posts.map(post => ({
          contentId: post.id,
          author: post.author,
          contentType: 'post',
          topics: post.hashtags || [],
          score: 0,
          timestamp: post.timestamp,
          engagementCount: (post.likes || 0) + (post.comments || 0) + (post.shares || 0),
          isPromoted: post.isPromoted || false
        }));

        const personalizedFeed = await contract.generatePersonalizedFeed(
          userAddress,
          contentIds,
          feedItems
        );

        const feedPosts = personalizedFeed.map(id => 
          posts.find(post => post.id === id.toNumber())
        ).filter(Boolean);

        setFeed(feedPosts);
      }
    } catch (error) {
      console.error('Error generating feed:', error);
      // Fallback to recent posts
      const sortedPosts = [...posts].sort((a, b) => b.timestamp - a.timestamp);
      setFeed(sortedPosts);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async () => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.updateUserPreferences(
        preferences.preferredTopics,
        preferences.blockedTopics,
        preferences.contentFreshness,
        preferences.socialWeight,
        preferences.engagementWeight,
        preferences.enablePersonalization
      );
      await tx.wait();
      
      setShowPreferences(false);
      generateFeed();
      
      // Send WebSocket notification
      if (websocket) {
        websocket.send(JSON.stringify({
          type: 'preferences_updated',
          userId: userAddress,
          preferences
        }));
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const recordInteraction = async (postId, interactionType, timeSpent = 0) => {
    if (!contract) return;

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      await contract.recordInteraction(
        userAddress,
        postId,
        interactionType,
        timeSpent,
        post.hashtags || [],
        post.author
      );
    } catch (error) {
      console.error('Error recording interaction:', error);
    }
  };

  const addPreferredTopic = () => {
    if (newTopic.trim() && !preferences.preferredTopics.includes(newTopic.trim())) {
      setPreferences(prev => ({
        ...prev,
        preferredTopics: [...prev.preferredTopics, newTopic.trim()]
      }));
      setNewTopic('');
    }
  };

  const removePreferredTopic = (topic) => {
    setPreferences(prev => ({
      ...prev,
      preferredTopics: prev.preferredTopics.filter(t => t !== topic)
    }));
  };

  const addBlockedTopic = () => {
    if (newTopic.trim() && !preferences.blockedTopics.includes(newTopic.trim())) {
      setPreferences(prev => ({
        ...prev,
        blockedTopics: [...prev.blockedTopics, newTopic.trim()]
      }));
      setNewTopic('');
    }
  };

  const removeBlockedTopic = (topic) => {
    setPreferences(prev => ({
      ...prev,
      blockedTopics: prev.blockedTopics.filter(t => t !== topic)
    }));
  };

  const handlePostClick = (post) => {
    recordInteraction(post.id, 'view', 5); // Record 5 seconds view time
    if (onPostClick) {
      onPostClick(post);
    }
  };

  const handlePostLike = (post) => {
    recordInteraction(post.id, 'like');
  };

  const handlePostComment = (post) => {
    recordInteraction(post.id, 'comment');
  };

  const handlePostShare = (post) => {
    recordInteraction(post.id, 'share');
  };

  return (
    <div className="personalized-feed">
      <div className="feed-header">
        <h2>Your Feed</h2>
        <div className="feed-controls">
          <div className="feed-type-selector">
            <button
              className={`feed-type-btn ${feedType === 'personalized' ? 'active' : ''}`}
              onClick={() => setFeedType('personalized')}
            >
              For You
            </button>
            <button
              className={`feed-type-btn ${feedType === 'trending' ? 'active' : ''}`}
              onClick={() => setFeedType('trending')}
            >
              Trending
            </button>
            <button
              className={`feed-type-btn ${feedType === 'recent' ? 'active' : ''}`}
              onClick={() => setFeedType('recent')}
            >
              Recent
            </button>
          </div>
          <button
            className="preferences-btn"
            onClick={() => setShowPreferences(true)}
          >
            ⚙️ Preferences
          </button>
        </div>
      </div>

      {loading && (
        <div className="feed-loading">
          <p>Generating your personalized feed...</p>
        </div>
      )}

      {trendingTopics.length > 0 && (
        <div className="trending-topics">
          <h3>Trending Topics</h3>
          <div className="trending-tags">
            {trendingTopics.map((topic, index) => (
              <span key={index} className="trending-tag">
                #{topic}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="feed-content">
        {feed.length === 0 && !loading ? (
          <div className="no-content">
            <p>No content available for your feed.</p>
            <p>Try adjusting your preferences or following more users.</p>
          </div>
        ) : (
          <div className="posts-list">
            {feed.map((post, index) => (
              <div key={post.id} className="feed-post">
                <div className="post-header">
                  <div className="post-author">
                    <strong>{post.author}</strong>
                  </div>
                  <div className="post-time">
                    {new Date(post.timestamp * 1000).toLocaleString()}
                  </div>
                </div>
                
                <div className="post-content" onClick={() => handlePostClick(post)}>
                  <p>{post.content}</p>
                  {post.hashtags && post.hashtags.length > 0 && (
                    <div className="post-hashtags">
                      {post.hashtags.map((tag, tagIndex) => (
                        <span key={tagIndex} className="hashtag">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="post-actions">
                  <button 
                    className="action-btn like-btn"
                    onClick={() => handlePostLike(post)}
                  >
                    👍 {post.likes || 0}
                  </button>
                  <button 
                    className="action-btn comment-btn"
                    onClick={() => handlePostComment(post)}
                  >
                    💬 {post.comments || 0}
                  </button>
                  <button 
                    className="action-btn share-btn"
                    onClick={() => handlePostShare(post)}
                  >
                    🔄 {post.shares || 0}
                  </button>
                </div>

                {feedType === 'personalized' && (
                  <div className="personalization-info">
                    <small>Recommended based on your interests</small>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showPreferences && (
        <div className="modal-overlay">
          <div className="modal-content preferences-modal">
            <div className="modal-header">
              <h3>Feed Preferences</h3>
              <button
                className="close-modal-btn"
                onClick={() => setShowPreferences(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="preference-section">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.enablePersonalization}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      enablePersonalization: e.target.checked
                    }))}
                  />
                  Enable Personalized Feed
                </label>
              </div>

              <div className="preference-section">
                <h4>Content Preferences</h4>
                <div className="slider-group">
                  <label>Content Freshness: {preferences.contentFreshness}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={preferences.contentFreshness}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      contentFreshness: parseInt(e.target.value)
                    }))}
                  />
                  <small>Higher values prefer newer content</small>
                </div>

                <div className="slider-group">
                  <label>Social Weight: {preferences.socialWeight}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={preferences.socialWeight}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      socialWeight: parseInt(e.target.value)
                    }))}
                  />
                  <small>Higher values prefer content from your connections</small>
                </div>

                <div className="slider-group">
                  <label>Engagement Weight: {preferences.engagementWeight}%</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={preferences.engagementWeight}
                    onChange={(e) => setPreferences(prev => ({
                      ...prev,
                      engagementWeight: parseInt(e.target.value)
                    }))}
                  />
                  <small>Higher values prefer highly engaged content</small>
                </div>
              </div>

              <div className="preference-section">
                <h4>Preferred Topics</h4>
                <div className="topic-input">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="Add preferred topic..."
                    onKeyPress={(e) => e.key === 'Enter' && addPreferredTopic()}
                  />
                  <button onClick={addPreferredTopic}>Add</button>
                </div>
                <div className="topics-list">
                  {preferences.preferredTopics.map((topic, index) => (
                    <span key={index} className="topic-tag preferred">
                      {topic}
                      <button onClick={() => removePreferredTopic(topic)}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="preference-section">
                <h4>Blocked Topics</h4>
                <div className="topic-input">
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    placeholder="Add blocked topic..."
                    onKeyPress={(e) => e.key === 'Enter' && addBlockedTopic()}
                  />
                  <button onClick={addBlockedTopic}>Block</button>
                </div>
                <div className="topics-list">
                  {preferences.blockedTopics.map((topic, index) => (
                    <span key={index} className="topic-tag blocked">
                      {topic}
                      <button onClick={() => removeBlockedTopic(topic)}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowPreferences(false)}
              >
                Cancel
              </button>
              <button
                className="submit-btn"
                onClick={updatePreferences}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalizedFeed;
