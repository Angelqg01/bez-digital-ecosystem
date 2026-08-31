import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';

const UserSearch = ({ userManagementContract, onUserSelect }) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({
    verified: false,
    active: true,
    friends: false
  });
  const [sortBy, setSortBy] = useState('relevance'); // relevance, username, lastActive
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const RESULTS_PER_PAGE = 20;

  const searchUsers = useCallback(async (query, page = 0, reset = true) => {
    if (!userManagementContract || !query.trim()) {
      if (reset) setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const offset = page * RESULTS_PER_PAGE;
      const results = await userManagementContract.searchUsers(
        query.trim(),
        offset,
        RESULTS_PER_PAGE + 1 // Get one extra to check if there are more
      );

      const processedResults = await Promise.all(
        results.slice(0, RESULTS_PER_PAGE).map(async (result) => {
          try {
            // Get additional user info
            const profile = await userManagementContract.userProfiles(result.userAddress);
            const isFollowing = user ? await userManagementContract.isFollowing(user.address, result.userAddress) : false;
            const areFriends = user ? await userManagementContract.areFriends(user.address, result.userAddress) : false;
            const isBlocked = user ? await userManagementContract.isBlocked(user.address, result.userAddress) : false;

            return {
              address: result.userAddress,
              username: result.username,
              displayName: result.displayName,
              isVerified: result.isVerified,
              lastActive: result.lastActive,
              bio: profile.bio,
              avatarUrl: profile.avatarUrl,
              followersCount: profile.followersCount,
              followingCount: profile.followingCount,
              isFollowing,
              areFriends,
              isBlocked,
              privacyLevel: profile.privacyLevel
            };
          } catch (error) {
            console.error('Error processing user result:', error);
            return null;
          }
        })
      );

      const validResults = processedResults.filter(result => result !== null);

      // Apply filters
      const filteredResults = validResults.filter(result => {
        if (selectedFilters.verified && !result.isVerified) return false;
        if (selectedFilters.friends && !result.areFriends) return false;
        if (result.isBlocked) return false;
        return true;
      });

      // Sort results
      const sortedResults = [...filteredResults].sort((a, b) => {
        switch (sortBy) {
          case 'username':
            return a.username.localeCompare(b.username);
          case 'lastActive':
            return Number(b.lastActive) - Number(a.lastActive);
          case 'relevance':
          default:
            // Prioritize exact matches, then verified users, then by followers
            const aExact = a.username.toLowerCase() === query.toLowerCase() ? 2 : 0;
            const bExact = b.username.toLowerCase() === query.toLowerCase() ? 2 : 0;
            const aVerified = a.isVerified ? 1 : 0;
            const bVerified = b.isVerified ? 1 : 0;
            const aScore = aExact + aVerified + (Number(a.followersCount) / 1000);
            const bScore = bExact + bVerified + (Number(b.followersCount) / 1000);
            return bScore - aScore;
        }
      });

      if (reset) {
        setSearchResults(sortedResults);
      } else {
        setSearchResults(prev => [...prev, ...sortedResults]);
      }

      setHasMore(results.length > RESULTS_PER_PAGE);
      setCurrentPage(page);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  }, [userManagementContract, user, selectedFilters, sortBy]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery, 0, true);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchQuery, searchUsers]);

  const loadMore = () => {
    if (!loading && hasMore) {
      searchUsers(searchQuery, currentPage + 1, false);
    }
  };

  const handleFilterChange = (filter) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filter]: !prev[filter]
    }));
  };

  const formatLastActive = (timestamp) => {
    const now = Date.now() / 1000;
    const diff = now - Number(timestamp);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  };

  const getPrivacyIcon = (privacyLevel) => {
    switch (privacyLevel) {
      case 0: return '🌐'; // PUBLIC
      case 1: return '👥'; // FRIENDS_ONLY
      case 2: return '🔒'; // PRIVATE
      default: return '🌐';
    }
  };

  return (
    <div className="user-search">
      <div className="search-header">
        <div className="search-input-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by username or display name..."
            className="search-input"
          />
          <div className="search-icon">🔍</div>
        </div>

        <div className="search-filters">
          <div className="filter-group">
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={selectedFilters.verified}
                onChange={() => handleFilterChange('verified')}
              />
              <span>Verified only</span>
            </label>

            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={selectedFilters.friends}
                onChange={() => handleFilterChange('friends')}
              />
              <span>Friends only</span>
            </label>
          </div>

          <div className="sort-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="relevance">Relevance</option>
              <option value="username">Username</option>
              <option value="lastActive">Last Active</option>
            </select>
          </div>
        </div>
      </div>

      <div className="search-results">
        {loading && searchResults.length === 0 && (
          <div className="loading-state">
            <div className="spinner"></div>
            <span>Searching users...</span>
          </div>
        )}

        {!loading && searchQuery && searchResults.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <h3>No users found</h3>
            <p>Try adjusting your search terms or filters</p>
          </div>
        )}

        {searchResults.map((result) => (
          <div
            key={result.address}
            className="user-result"
            onClick={() => onUserSelect && onUserSelect(result)}
          >
            <div className="user-avatar">
              {result.avatarUrl ? (
                <img src={result.avatarUrl} alt={result.displayName} />
              ) : (
                <div className="avatar-placeholder">
                  {result.displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="user-info">
              <div className="user-name">
                <span className="display-name">{result.displayName}</span>
                {result.isVerified && <span className="verified-badge">✓</span>}
                <span className="privacy-indicator">{getPrivacyIcon(result.privacyLevel)}</span>
              </div>

              <div className="username">@{result.username}</div>

              {result.bio && (
                <div className="user-bio">{result.bio}</div>
              )}

              <div className="user-stats">
                <span className="stat">
                  <strong>{Number(result.followersCount).toLocaleString()}</strong> followers
                </span>
                <span className="stat">
                  <strong>{Number(result.followingCount).toLocaleString()}</strong> following
                </span>
                <span className="last-active">
                  {formatLastActive(result.lastActive)}
                </span>
              </div>
            </div>

            <div className="user-actions">
              {result.areFriends && (
                <span className="friend-badge">Friends</span>
              )}
              {result.isFollowing && !result.areFriends && (
                <span className="following-badge">Following</span>
              )}
              {user && result.address !== user.address && (
                <button className="view-profile-button">
                  View Profile
                </button>
              )}
            </div>
          </div>
        ))}

        {hasMore && searchResults.length > 0 && (
          <div className="load-more-container">
            <button
              onClick={loadMore}
              disabled={loading}
              className="load-more-button"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="search-summary">
          Showing {searchResults.length} users
          {searchQuery && ` for "${searchQuery}"`}
        </div>
      )}
    </div>
  );
};

export default UserSearch;
