import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';

const SocialConnections = ({ userManagementContract, targetUser, onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('followers');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [relationshipStatus, setRelationshipStatus] = useState({
    isFollowing: false,
    areFriends: false,
    isBlocked: false
  });

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    if (targetUser && userManagementContract) {
      loadRelationshipStatus();
      loadConnections();
    }
  }, [targetUser, userManagementContract, activeTab]);

  const loadRelationshipStatus = async () => {
    if (!user || !targetUser || user.address === targetUser.address) return;

    try {
      const [isFollowing, areFriends, isBlocked] = await Promise.all([
        userManagementContract.isFollowing(user.address, targetUser.address),
        userManagementContract.areFriends(user.address, targetUser.address),
        userManagementContract.isBlocked(user.address, targetUser.address)
      ]);

      setRelationshipStatus({ isFollowing, areFriends, isBlocked });
    } catch (error) {
      console.error('Error loading relationship status:', error);
    }
  };

  const loadConnections = async (page = 0, reset = true) => {
    setLoading(true);
    try {
      let connections = [];

      if (activeTab === 'followers') {
        const addresses = await userManagementContract.getFollowers(
          targetUser.address,
          page * ITEMS_PER_PAGE,
          ITEMS_PER_PAGE + 1
        );
        connections = await loadUserProfiles(addresses.slice(0, ITEMS_PER_PAGE));
        setHasMore(addresses.length > ITEMS_PER_PAGE);

        if (reset) {
          setFollowers(connections);
        } else {
          setFollowers(prev => [...prev, ...connections]);
        }
      } else if (activeTab === 'following') {
        const addresses = await userManagementContract.getFollowing(
          targetUser.address,
          page * ITEMS_PER_PAGE,
          ITEMS_PER_PAGE + 1
        );
        connections = await loadUserProfiles(addresses.slice(0, ITEMS_PER_PAGE));
        setHasMore(addresses.length > ITEMS_PER_PAGE);

        if (reset) {
          setFollowing(connections);
        } else {
          setFollowing(prev => [...prev, ...connections]);
        }
      } else if (activeTab === 'friends') {
        const addresses = await userManagementContract.getFriends(targetUser.address);
        connections = await loadUserProfiles(addresses);
        setHasMore(false);

        if (reset) {
          setFriends(connections);
        }
      }

      setCurrentPage(page);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfiles = async (addresses) => {
    const profiles = await Promise.all(
      addresses.map(async (address) => {
        try {
          const profile = await userManagementContract.userProfiles(address);
          const isFollowing = user ? await userManagementContract.isFollowing(user.address, address) : false;
          const areFriends = user ? await userManagementContract.areFriends(user.address, address) : false;

          return {
            address,
            username: profile.username,
            displayName: profile.displayName,
            bio: profile.bio,
            avatarUrl: profile.avatarUrl,
            isVerified: profile.verificationStatus === 2, // VERIFIED
            followersCount: profile.followersCount,
            followingCount: profile.followingCount,
            lastActive: profile.lastActive,
            isFollowing,
            areFriends
          };
        } catch (error) {
          console.error('Error loading profile for', address, error);
          return null;
        }
      })
    );

    return profiles.filter(profile => profile !== null);
  };

  const handleFollow = async (userAddress) => {
    if (!user || !userManagementContract) return;

    try {
      const tx = await userManagementContract.followUser(userAddress);
      await tx.wait();

      // Update local state
      updateConnectionStatus(userAddress, 'follow');
      loadRelationshipStatus(); // Refresh main relationship status
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const handleUnfollow = async (userAddress) => {
    if (!user || !userManagementContract) return;

    try {
      const tx = await userManagementContract.unfollowUser(userAddress);
      await tx.wait();

      // Update local state
      updateConnectionStatus(userAddress, 'unfollow');
      loadRelationshipStatus(); // Refresh main relationship status
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const updateConnectionStatus = (userAddress, action) => {
    const updateConnection = (connection) => {
      if (connection.address === userAddress) {
        return {
          ...connection,
          isFollowing: action === 'follow',
          areFriends: action === 'follow' && connection.isFollowing
        };
      }
      return connection;
    };

    setFollowers(prev => prev.map(updateConnection));
    setFollowing(prev => prev.map(updateConnection));
    setFriends(prev => prev.map(updateConnection));
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadConnections(currentPage + 1, false);
    }
  };

  const formatLastActive = (timestamp) => {
    const now = Date.now() / 1000;
    const diff = now - Number(timestamp);

    if (diff < 60) return 'Active now';
    if (diff < 3600) return `Active ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Active ${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `Active ${Math.floor(diff / 86400)}d ago`;
    return `Last seen ${new Date(Number(timestamp) * 1000).toLocaleDateString()}`;
  };

  const getCurrentConnections = () => {
    switch (activeTab) {
      case 'followers': return followers;
      case 'following': return following;
      case 'friends': return friends;
      default: return [];
    }
  };

  const getTabCount = (tab) => {
    switch (tab) {
      case 'followers': return Number(targetUser.followersCount || 0);
      case 'following': return Number(targetUser.followingCount || 0);
      case 'friends': return friends.length;
      default: return 0;
    }
  };

  return (
    <div className="social-connections">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content large" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{targetUser.displayName}'s Connections</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>

          <div className="connections-tabs">
            <button
              className={`tab ${activeTab === 'followers' ? 'active' : ''}`}
              onClick={() => setActiveTab('followers')}
            >
              Followers ({getTabCount('followers').toLocaleString()})
            </button>
            <button
              className={`tab ${activeTab === 'following' ? 'active' : ''}`}
              onClick={() => setActiveTab('following')}
            >
              Following ({getTabCount('following').toLocaleString()})
            </button>
            <button
              className={`tab ${activeTab === 'friends' ? 'active' : ''}`}
              onClick={() => setActiveTab('friends')}
            >
              Friends ({getTabCount('friends').toLocaleString()})
            </button>
          </div>

          <div className="connections-content">
            {loading && getCurrentConnections().length === 0 && (
              <div className="loading-state">
                <div className="spinner"></div>
                <span>Loading connections...</span>
              </div>
            )}

            {!loading && getCurrentConnections().length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>No {activeTab} yet</h3>
                <p>
                  {activeTab === 'followers' && "This user doesn't have any followers yet."}
                  {activeTab === 'following' && "This user isn't following anyone yet."}
                  {activeTab === 'friends' && "This user doesn't have any friends yet."}
                </p>
              </div>
            )}

            <div className="connections-list">
              {getCurrentConnections().map((connection) => (
                <div key={connection.address} className="connection-item">
                  <div className="connection-avatar">
                    {connection.avatarUrl ? (
                      <img src={connection.avatarUrl} alt={connection.displayName} />
                    ) : (
                      <div className="avatar-placeholder">
                        {connection.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="connection-info">
                    <div className="connection-name">
                      <span className="display-name">{connection.displayName}</span>
                      {connection.isVerified && <span className="verified-badge">✓</span>}
                    </div>

                    <div className="username">@{connection.username}</div>

                    {connection.bio && (
                      <div className="connection-bio">{connection.bio}</div>
                    )}

                    <div className="connection-stats">
                      <span className="stat">
                        {Number(connection.followersCount).toLocaleString()} followers
                      </span>
                      <span className="last-active">
                        {formatLastActive(connection.lastActive)}
                      </span>
                    </div>
                  </div>

                  <div className="connection-actions">
                    {connection.areFriends && (
                      <span className="friend-badge">Friends</span>
                    )}

                    {user && connection.address !== user.address && (
                      <>
                        {connection.isFollowing ? (
                          <button
                            onClick={() => handleUnfollow(connection.address)}
                            className="unfollow-button"
                          >
                            Unfollow
                          </button>
                        ) : (
                          <button
                            onClick={() => handleFollow(connection.address)}
                            className="follow-button"
                          >
                            Follow
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {hasMore && getCurrentConnections().length > 0 && (
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
        </div>
      </div>
    </div>
  );
};

export default SocialConnections;
