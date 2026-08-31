import { useState, useEffect } from 'react';

const HashtagMentionSystem = ({ contracts, user }) => {
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchType, setSearchType] = useState('hashtags'); // 'hashtags' or 'mentions'
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contracts?.advancedSocialInteractions) {
      loadTrendingHashtags();
    }
  }, [contracts]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const debounceTimer = setTimeout(() => {
        performSearch();
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchType]);

  const loadTrendingHashtags = async () => {
    try {
      const trending = await contracts.advancedSocialInteractions.getTrendingHashtags();
      setTrendingHashtags(trending);
    } catch (error) {
      console.error('Error loading trending hashtags:', error);
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim() || loading) return;

    setLoading(true);
    try {
      if (searchType === 'hashtags') {
        // Search for posts with hashtag
        const posts = await contracts.advancedSocialInteractions.getHashtagPosts(
          searchQuery.replace('#', ''),
          0,
          20
        );
        setSearchResults(posts.map(postId => ({ type: 'post', id: Number(postId) })));
      } else if (searchType === 'mentions') {
        // Search for user mentions
        if (user?.address) {
          const mentions = await contracts.advancedSocialInteractions.getUserMentions(
            user.address,
            0,
            20
          );
          setSearchResults(mentions.map(postId => ({ type: 'mention', id: Number(postId) })));
        }
      }
    } catch (error) {
      console.error('Error performing search:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleHashtagClick = (hashtag) => {
    setSearchQuery(`#${hashtag}`);
    setSearchType('hashtags');
  };

  return (
    <div className="hashtag-mention-system">
      <div className="search-section">
        <div className="search-controls">
          <div className="search-type-selector">
            <button 
              className={`search-type-btn ${searchType === 'hashtags' ? 'active' : ''}`}
              onClick={() => setSearchType('hashtags')}
            >
              # Hashtags
            </button>
            <button 
              className={`search-type-btn ${searchType === 'mentions' ? 'active' : ''}`}
              onClick={() => setSearchType('mentions')}
            >
              @ Mentions
            </button>
          </div>

          <div className="search-input-container">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchType === 'hashtags' ? 'Search hashtags...' : 'Your mentions will appear here'}
              className="search-input"
              disabled={searchType === 'mentions'}
            />
            {loading && <div className="search-loading">🔍</div>}
          </div>
        </div>

        {searchResults.length > 0 && (
          <div className="search-results">
            <h4>Search Results</h4>
            <div className="results-list">
              {searchResults.map((result, index) => (
                <div key={index} className="result-item">
                  <span className="result-type">
                    {result.type === 'post' ? '📝' : '@'} Post #{result.id}
                  </span>
                  <button className="view-result-btn">
                    View Post
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="trending-section">
        <h3>Trending Hashtags</h3>
        <div className="trending-hashtags">
          {trendingHashtags.length > 0 ? (
            trendingHashtags.map((hashtag, index) => (
              <button
                key={index}
                className="trending-hashtag"
                onClick={() => handleHashtagClick(hashtag)}
              >
                #{hashtag}
              </button>
            ))
          ) : (
            <p className="no-trending">No trending hashtags yet</p>
          )}
        </div>
      </div>

      <div className="hashtag-guide">
        <h4>How to use hashtags and mentions:</h4>
        <ul>
          <li><strong>Hashtags:</strong> Use #hashtag to categorize your posts</li>
          <li><strong>Mentions:</strong> Use @0x... to mention other users</li>
          <li>Click on trending hashtags to explore popular topics</li>
          <li>Hashtags help others discover your content</li>
        </ul>
      </div>
    </div>
  );
};

export default HashtagMentionSystem;
