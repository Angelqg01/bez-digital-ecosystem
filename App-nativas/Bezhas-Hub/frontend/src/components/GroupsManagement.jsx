import { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

const GroupsManagement = ({ contracts, user, wsConnection }) => {
  const [groups, setGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [featuredGroups, setFeaturedGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [activeTab, setActiveTab] = useState('discover');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    imageUrl: '',
    bannerUrl: '',
    groupType: 0, // PUBLIC
    tags: [],
    rules: '',
    maxMembers: 1000
  });

  const handleNewGroupChange = (field, value) => {
    const sanitizedValue = typeof value === 'string' ? DOMPurify.sanitize(value) : value;
    setNewGroup(prev => ({ ...prev, [field]: sanitizedValue }));
  };

  const groupTypes = ['Public', 'Private', 'Secret'];
  const memberRoles = ['Member', 'Moderator', 'Admin', 'Owner'];

  useEffect(() => {
    if (contracts?.groupsAndCommunities && user?.address) {
      loadUserGroups();
      loadFeaturedGroups();
    }
  }, [contracts, user]);

  const loadUserGroups = async () => {
    try {
      const userGroupIds = await contracts.groupsAndCommunities.getUserGroups(user.address);
      const groupsData = await Promise.all(
        userGroupIds.map(async (groupId) => {
          const group = await contracts.groupsAndCommunities.getGroup(Number(groupId));
          return {
            id: Number(group.id),
            name: group.name,
            description: group.description,
            imageUrl: group.imageUrl,
            bannerUrl: group.bannerUrl,
            owner: group.owner,
            groupType: Number(group.groupType),
            tags: group.tags,
            createdAt: Number(group.createdAt) * 1000,
            memberCount: Number(group.memberCount),
            postCount: Number(group.postCount),
            isActive: group.isActive,
            isVerified: group.isVerified,
            rules: group.rules,
            maxMembers: Number(group.maxMembers)
          };
        })
      );
      setUserGroups(groupsData);
    } catch (error) {
      console.error('Error loading user groups:', error);
    }
  };

  const loadFeaturedGroups = async () => {
    try {
      // This would load featured groups from the contract
      setFeaturedGroups([]);
    } catch (error) {
      console.error('Error loading featured groups:', error);
    }
  };

  const createGroup = async () => {
    if (!user?.address || loading) return;

    setLoading(true);
    try {
      await contracts.groupsAndCommunities.createGroup(
        newGroup.name,
        newGroup.description,
        newGroup.imageUrl,
        newGroup.bannerUrl,
        newGroup.groupType,
        newGroup.tags,
        newGroup.rules,
        newGroup.maxMembers
      );

      setShowCreateModal(false);
      setNewGroup({
        name: '',
        description: '',
        imageUrl: '',
        bannerUrl: '',
        groupType: 0,
        tags: [],
        rules: '',
        maxMembers: 1000
      });

      await loadUserGroups();

      // Send WebSocket notification
      if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
          type: 'group_created',
          data: {
            name: newGroup.name,
            creator: user.address
          }
        }));
      }
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinGroup = async (groupId) => {
    if (!user?.address || loading) return;

    setLoading(true);
    try {
      await contracts.groupsAndCommunities.joinGroup(groupId);
      await loadUserGroups();
    } catch (error) {
      console.error('Error joining group:', error);
    } finally {
      setLoading(false);
    }
  };

  const leaveGroup = async (groupId) => {
    if (!user?.address || loading) return;

    setLoading(true);
    try {
      await contracts.groupsAndCommunities.leaveGroup(groupId);
      await loadUserGroups();
    } catch (error) {
      console.error('Error leaving group:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTag = (tag) => {
    const sanitizedTag = DOMPurify.sanitize(tag).trim();
    if (sanitizedTag && !newGroup.tags.includes(sanitizedTag)) {
      setNewGroup(prev => ({
        ...prev,
        tags: [...prev.tags, sanitizedTag]
      }));
    }
  };

  const removeTag = (tagToRemove) => {
    setNewGroup(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const GroupCard = ({ group, showJoinButton = false, showLeaveButton = false }) => (
    <div className="group-card">
      {group.bannerUrl && (
        <div className="group-banner">
          <img src={group.bannerUrl} alt={`${group.name} banner`} />
        </div>
      )}
      
      <div className="group-card-content">
        <div className="group-header">
          {group.imageUrl && (
            <img src={group.imageUrl} alt={group.name} className="group-avatar" />
          )}
          <div className="group-info">
            <h3 className="group-name">
              {group.name}
              {group.isVerified && <span className="verified-badge">✓</span>}
            </h3>
            <span className="group-type">{groupTypes[group.groupType]}</span>
          </div>
        </div>

        <p className="group-description">{group.description}</p>

        <div className="group-stats">
          <span className="stat">👥 {group.memberCount} members</span>
          <span className="stat">📝 {group.postCount} posts</span>
          <span className="stat">📅 {formatTimestamp(group.createdAt)}</span>
        </div>

        {group.tags.length > 0 && (
          <div className="group-tags">
            {group.tags.map((tag, index) => (
              <span key={index} className="group-tag">#{tag}</span>
            ))}
          </div>
        )}

        <div className="group-actions">
          {showJoinButton && (
            <button 
              className="join-group-btn"
              onClick={() => joinGroup(group.id)}
              disabled={loading}
            >
              Join Group
            </button>
          )}
          {showLeaveButton && group.owner !== user?.address && (
            <button 
              className="leave-group-btn"
              onClick={() => leaveGroup(group.id)}
              disabled={loading}
            >
              Leave Group
            </button>
          )}
          <button 
            className="view-group-btn"
            onClick={() => setSelectedGroup(group)}
          >
            View Group
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="groups-management">
      <div className="groups-header">
        <h2>Groups & Communities</h2>
        <button 
          className="create-group-btn"
          onClick={() => setShowCreateModal(true)}
        >
          + Create Group
        </button>
      </div>

      <div className="groups-tabs">
        <button 
          className={`tab-btn ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          Discover
        </button>
        <button 
          className={`tab-btn ${activeTab === 'my-groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-groups')}
        >
          My Groups ({userGroups.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'featured' ? 'active' : ''}`}
          onClick={() => setActiveTab('featured')}
        >
          Featured
        </button>
      </div>

      <div className="groups-filters">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search groups..."
          className="search-input"
        />
        <select 
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Groups</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div className="groups-content">
        {activeTab === 'my-groups' && (
          <div className="groups-grid">
            {userGroups.map(group => (
              <GroupCard 
                key={group.id} 
                group={group} 
                showLeaveButton={true}
              />
            ))}
            {userGroups.length === 0 && (
              <div className="no-groups">
                <p>You haven't joined any groups yet.</p>
                <button onClick={() => setActiveTab('discover')}>
                  Discover Groups
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'discover' && (
          <div className="groups-grid">
            {/* This would show discoverable groups */}
            <div className="no-groups">
              <p>Connect your wallet to discover groups</p>
            </div>
          </div>
        )}

        {activeTab === 'featured' && (
          <div className="groups-grid">
            {featuredGroups.map(group => (
              <GroupCard 
                key={group.id} 
                group={group} 
                showJoinButton={true}
              />
            ))}
            {featuredGroups.length === 0 && (
              <div className="no-groups">
                <p>No featured groups available</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-group-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Group</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label>Group Name *</label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => handleNewGroupChange('name', e.target.value)}
                  placeholder="Enter group name"
                  maxLength={50}
                />
              </div>

              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => handleNewGroupChange('description', e.target.value)}
                  placeholder="Describe your group"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label>Group Type</label>
                <select
                  value={newGroup.groupType}
                  onChange={(e) => handleNewGroupChange('groupType', parseInt(e.target.value))}
                >
                  <option value={0}>Public - Anyone can join</option>
                  <option value={1}>Private - Requires approval</option>
                  <option value={2}>Secret - Invite only</option>
                </select>
              </div>

              <div className="form-group">
                <label>Maximum Members</label>
                <input
                  type="number"
                  value={newGroup.maxMembers}
                  onChange={(e) => handleNewGroupChange('maxMembers', parseInt(e.target.value))}
                  min={1}
                  max={10000}
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <div className="tags-input">
                  <input
                    type="text"
                    placeholder="Add tags (press Enter)"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag(e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className="tags-list">
                    {newGroup.tags.map((tag, index) => (
                      <span key={index} className="tag">
                        #{tag}
                        <button onClick={() => removeTag(tag)}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Group Rules</label>
                <textarea
                  value={newGroup.rules}
                  onChange={(e) => handleNewGroupChange('rules', e.target.value)}
                  placeholder="Set group rules and guidelines"
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Group Image URL</label>
                <input
                  type="url"
                  value={newGroup.imageUrl}
                  onChange={(e) => handleNewGroupChange('imageUrl', e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="form-group">
                <label>Banner Image URL</label>
                <input
                  type="url"
                  value={newGroup.bannerUrl}
                  onChange={(e) => handleNewGroupChange('bannerUrl', e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                />
              </div>
            </div>

            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button 
                className="create-btn"
                onClick={createGroup}
                disabled={!newGroup.name || !newGroup.description || loading}
              >
                {loading ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Detail Modal */}
      {selectedGroup && (
        <div className="modal-overlay" onClick={() => setSelectedGroup(null)}>
          <div className="group-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedGroup.name}</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setSelectedGroup(null)}
              >
                ✕
              </button>
            </div>

            <div className="group-detail-content">
              <p>{selectedGroup.description}</p>
              
              {selectedGroup.rules && (
                <div className="group-rules">
                  <h4>Group Rules</h4>
                  <p>{selectedGroup.rules}</p>
                </div>
              )}

              <div className="group-stats-detailed">
                <div className="stat">
                  <span className="stat-label">Members:</span>
                  <span className="stat-value">{selectedGroup.memberCount}/{selectedGroup.maxMembers}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Posts:</span>
                  <span className="stat-value">{selectedGroup.postCount}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Created:</span>
                  <span className="stat-value">{formatTimestamp(selectedGroup.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupsManagement;
