import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useAuth } from '../context/AuthContext';
import DOMPurify from 'dompurify';
import SocialConnections from './SocialConnections';
import TwoFactorAuth from './TwoFactorAuth';

const UserProfile = ({ userManagementContract, authContract, targetAddress, onClose }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [relationshipStatus, setRelationshipStatus] = useState({
    isFollowing: false,
    areFriends: false,
    isBlocked: false,
    blockedBy: false
  });
  const [editForm, setEditForm] = useState({
    displayName: '',
    bio: '',
    avatarUrl: '',
    bannerUrl: '',
    privacyLevel: 0,
    allowDirectMessages: true,
    showOnlineStatus: true
  });
  const [verificationRequest, setVerificationRequest] = useState('');
  const [showVerificationForm, setShowVerificationForm] = useState(false);

  const handleEditFormChange = (field, value) => {
    const sanitizedValue = typeof value === 'string' ? DOMPurify.sanitize(value) : value;
    setEditForm(prev => ({ ...prev, [field]: sanitizedValue }));
  };

  const isOwnProfile = user && targetAddress === user.address;

  useEffect(() => {
    if (userManagementContract && targetAddress) {
      loadProfile();
      if (!isOwnProfile) {
        loadRelationshipStatus();
      }
    }
  }, [userManagementContract, targetAddress, user]);

  const loadProfile = async () => {
    try {
      const profileData = await userManagementContract.userProfiles(targetAddress);

      if (profileData.userId.toString() === '0') {
        setProfile(null);
        return;
      }

      const profile = {
        address: targetAddress,
        userId: profileData.userId,
        username: profileData.username,
        displayName: profileData.displayName,
        bio: profileData.bio,
        avatarUrl: profileData.avatarUrl,
        bannerUrl: profileData.bannerUrl,
        isActive: profileData.isActive,
        createdAt: profileData.createdAt,
        lastActive: profileData.lastActive,
        verificationStatus: profileData.verificationStatus,
        verificationBadge: profileData.verificationBadge,
        privacyLevel: profileData.privacyLevel,
        allowDirectMessages: profileData.allowDirectMessages,
        showOnlineStatus: profileData.showOnlineStatus,
        followersCount: profileData.followersCount,
        followingCount: profileData.followingCount,
        postsCount: profileData.postsCount
      };

      setProfile(profile);
      setEditForm({
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        bannerUrl: profile.bannerUrl,
        privacyLevel: profile.privacyLevel,
        allowDirectMessages: profile.allowDirectMessages,
        showOnlineStatus: profile.showOnlineStatus
      });
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRelationshipStatus = async () => {
    if (!user) return;

    try {
      const [isFollowing, areFriends, isBlocked, blockedBy] = await Promise.all([
        userManagementContract.isFollowing(user.address, targetAddress),
        userManagementContract.areFriends(user.address, targetAddress),
        userManagementContract.isBlocked(user.address, targetAddress),
        userManagementContract.isBlocked(targetAddress, user.address)
      ]);

      setRelationshipStatus({ isFollowing, areFriends, isBlocked, blockedBy });
    } catch (error) {
      console.error('Error loading relationship status:', error);
    }
  };

  const handleFollow = async () => {
    if (!user || !userManagementContract) return;

    try {
      const tx = await userManagementContract.followUser(targetAddress);
      await tx.wait();

      await loadRelationshipStatus();
      await loadProfile(); // Refresh follower count
    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const handleUnfollow = async () => {
    if (!user || !userManagementContract) return;

    try {
      const tx = await userManagementContract.unfollowUser(targetAddress);
      await tx.wait();

      await loadRelationshipStatus();
      await loadProfile(); // Refresh follower count
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  };

  const handleBlock = async () => {
    if (!user || !userManagementContract) return;

    if (!confirm('Are you sure you want to block this user?')) return;

    try {
      const tx = await userManagementContract.blockUser(targetAddress);
      await tx.wait();

      await loadRelationshipStatus();
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  };

  const handleUnblock = async () => {
    if (!user || !userManagementContract) return;

    try {
      const tx = await userManagementContract.unblockUser(targetAddress);
      await tx.wait();

      await loadRelationshipStatus();
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!userManagementContract) return;

    try {
      const tx = await userManagementContract.updateProfile(
        editForm.displayName,
        editForm.bio,
        editForm.avatarUrl,
        editForm.bannerUrl
      );
      await tx.wait();

      await loadProfile();
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleUpdatePrivacy = async () => {
    if (!userManagementContract) return;

    try {
      const tx = await userManagementContract.updatePrivacySettings(
        editForm.privacyLevel,
        editForm.allowDirectMessages,
        editForm.showOnlineStatus
      );
      await tx.wait();

      await loadProfile();
    } catch (error) {
      console.error('Error updating privacy settings:', error);
    }
  };

  const handleRequestVerification = async () => {
    if (!userManagementContract || !verificationRequest.trim()) return;

    try {
      const tx = await userManagementContract.requestVerification(verificationRequest);
      await tx.wait();

      await loadProfile();
      setShowVerificationForm(false);
      setVerificationRequest('');
    } catch (error) {
      console.error('Error requesting verification:', error);
    }
  };

  const formatDate = (timestamp) => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  };

  const formatLastActive = (timestamp) => {
    const now = Date.now() / 1000;
    const diff = now - Number(timestamp);

    if (diff < 60) return 'Active now';
    if (diff < 3600) return `Active ${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `Active ${Math.floor(diff / 3600)}h ago`;
    return `Last seen ${formatDate(timestamp)}`;
  };

  const getVerificationStatusText = (status) => {
    switch (status) {
      case 0: return 'Not verified';
      case 1: return 'Verification pending';
      case 2: return 'Verified';
      case 3: return 'Verification rejected';
      default: return 'Unknown';
    }
  };

  const getPrivacyLevelText = (level) => {
    switch (level) {
      case 0: return 'Public';
      case 1: return 'Friends only';
      case 2: return 'Private';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="user-profile">
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="loading-state">
              <div className="spinner"></div>
              <span>Loading profile...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="user-profile">
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Profile</h2>
              <button className="close-button" onClick={onClose}>×</button>
            </div>
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <h3>User not found</h3>
              <p>This user hasn't registered on the platform yet.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-profile">
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content large" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{profile.displayName}'s Profile</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>

          <div className="profile-content">
            {/* Banner */}
            <div className="profile-banner">
              {profile.bannerUrl ? (
                <img src={profile.bannerUrl} alt="Profile banner" />
              ) : (
                <div className="banner-placeholder"></div>
              )}
            </div>

            {/* Profile Header */}
            <div className="profile-header">
              <div className="profile-avatar">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt={profile.displayName} />
                ) : (
                  <div className="avatar-placeholder large">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="profile-info">
                <div className="profile-name">
                  <h1>{profile.displayName}</h1>
                  {profile.verificationStatus === 2 && (
                    <span className="verified-badge" title={profile.verificationBadge}>
                      ✓
                    </span>
                  )}
                </div>

                <div className="username">@{profile.username}</div>

                {profile.bio && <div className="bio">{profile.bio}</div>}

                <div className="profile-meta">
                  <span>Joined {formatDate(profile.createdAt)}</span>
                  {profile.showOnlineStatus && (
                    <span>{formatLastActive(profile.lastActive)}</span>
                  )}
                </div>

                <div className="profile-stats">
                  <button
                    className="stat-button"
                    onClick={() => setShowConnections(true)}
                  >
                    <strong>{Number(profile.followersCount).toLocaleString()}</strong>
                    <span>Followers</span>
                  </button>

                  <button
                    className="stat-button"
                    onClick={() => setShowConnections(true)}
                  >
                    <strong>{Number(profile.followingCount).toLocaleString()}</strong>
                    <span>Following</span>
                  </button>

                  <div className="stat">
                    <strong>{Number(profile.postsCount).toLocaleString()}</strong>
                    <span>Posts</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="profile-actions">
                {isOwnProfile ? (
                  <>
                    <button
                      onClick={() => setEditing(!editing)}
                      className="edit-profile-button"
                    >
                      {editing ? 'Cancel' : 'Edit Profile'}
                    </button>

                    {user && (user.isAdmin || user.isModerator) && (
                      <button
                        onClick={() => setShow2FA(true)}
                        className="security-button"
                      >
                        2FA Settings
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {!relationshipStatus.blockedBy && (
                      <>
                        {relationshipStatus.isFollowing ? (
                          <button onClick={handleUnfollow} className="unfollow-button">
                            Unfollow
                          </button>
                        ) : (
                          <button onClick={handleFollow} className="follow-button">
                            Follow
                          </button>
                        )}

                        {relationshipStatus.areFriends && (
                          <span className="friend-badge">Friends</span>
                        )}
                      </>
                    )}

                    {relationshipStatus.isBlocked ? (
                      <button onClick={handleUnblock} className="unblock-button">
                        Unblock
                      </button>
                    ) : (
                      <button onClick={handleBlock} className="block-button">
                        Block
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Edit Form */}
            {editing && isOwnProfile && (
              <div className="edit-profile-form">
                <h3>Edit Profile</h3>

                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    value={editForm.displayName}
                    onChange={(e) => handleEditFormChange('displayName', e.target.value)}
                    maxLength="50"
                  />
                </div>

                <div className="form-group">
                  <label>Bio</label>
                  <textarea
                    value={editForm.bio}
                    onChange={(e) => handleEditFormChange('bio', e.target.value)}
                    maxLength="200"
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label>Avatar URL</label>
                  <input
                    type="url"
                    value={editForm.avatarUrl}
                    onChange={(e) => handleEditFormChange('avatarUrl', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Banner URL</label>
                  <input
                    type="url"
                    value={editForm.bannerUrl}
                    onChange={(e) => handleEditFormChange('bannerUrl', e.target.value)}
                  />
                </div>

                <h4>Privacy Settings</h4>

                <div className="form-group">
                  <label>Profile Visibility</label>
                  <select
                    value={editForm.privacyLevel}
                    onChange={(e) => setEditForm({ ...editForm, privacyLevel: parseInt(e.target.value) })}
                  >
                    <option value={0}>Public</option>
                    <option value={1}>Friends Only</option>
                    <option value={2}>Private</option>
                  </select>
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={editForm.allowDirectMessages}
                      onChange={(e) => setEditForm({ ...editForm, allowDirectMessages: e.target.checked })}
                    />
                    Allow direct messages
                  </label>
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={editForm.showOnlineStatus}
                      onChange={(e) => setEditForm({ ...editForm, showOnlineStatus: e.target.checked })}
                    />
                    Show online status
                  </label>
                </div>

                <div className="form-actions">
                  <button onClick={handleUpdateProfile} className="save-button">
                    Save Profile
                  </button>
                  <button onClick={handleUpdatePrivacy} className="save-button">
                    Save Privacy
                  </button>
                </div>
              </div>
            )}

            {/* Verification Section */}
            {isOwnProfile && profile.verificationStatus === 0 && (
              <div className="verification-section">
                <h3>Account Verification</h3>
                <p>Get verified to show others you're authentic.</p>

                {!showVerificationForm ? (
                  <button
                    onClick={() => setShowVerificationForm(true)}
                    className="request-verification-button"
                  >
                    Request Verification
                  </button>
                ) : (
                  <div className="verification-form">
                    <textarea
                      value={verificationRequest}
                      onChange={(e) => setVerificationRequest(DOMPurify.sanitize(e.target.value))}
                      placeholder="Provide evidence for verification (social media links, website, etc.)"
                      rows="4"
                    />
                    <div className="form-actions">
                      <button onClick={handleRequestVerification} className="submit-button">
                        Submit Request
                      </button>
                      <button
                        onClick={() => setShowVerificationForm(false)}
                        className="cancel-button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verification Status */}
            {isOwnProfile && profile.verificationStatus !== 0 && (
              <div className="verification-status">
                <h3>Verification Status</h3>
                <div className={`status-badge ${profile.verificationStatus === 2 ? 'verified' : profile.verificationStatus === 1 ? 'pending' : 'rejected'}`}>
                  {getVerificationStatusText(profile.verificationStatus)}
                </div>
                {profile.verificationBadge && (
                  <p>Badge: {profile.verificationBadge}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showConnections && (
        <SocialConnections
          userManagementContract={userManagementContract}
          targetUser={profile}
          onClose={() => setShowConnections(false)}
        />
      )}

      {show2FA && (
        <TwoFactorAuth
          userAddress={user?.address}
          authContract={authContract}
          onClose={() => setShow2FA(false)}
        />
      )}
    </div>
  );
};

export default UserProfile;
