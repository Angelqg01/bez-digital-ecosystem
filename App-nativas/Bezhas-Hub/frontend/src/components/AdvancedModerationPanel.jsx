import { useState, useEffect, useCallback } from 'react';

const AdvancedModerationPanel = ({ 
  contract, 
  userAddress, 
  websocket,
  isAdmin = false 
}) => {
  const [pendingReports, setPendingReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('reports');
  const [moderationActions, setModerationActions] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [contentFilters, setContentFilters] = useState([]);
  const [reputationData, setReputationData] = useState([]);
  const [newFilter, setNewFilter] = useState({ keyword: '', severity: 5 });
  const [blockForm, setBlockForm] = useState({
    user: '',
    blockType: '0', // TEMPORARY
    duration: 24,
    reason: ''
  });

  const reportCategories = [
    'SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE_CONTENT',
    'COPYRIGHT_VIOLATION', 'SCAM', 'FAKE_NEWS', 'VIOLENCE', 'OTHER'
  ];

  const reportStatuses = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED'];
  const blockTypes = ['TEMPORARY', 'PERMANENT', 'SHADOW_BAN', 'CONTENT_RESTRICTION', 'INTERACTION_BAN'];

  const loadPendingReports = useCallback(async () => {
    try {
      const pendingIds = await contract.getPendingReports();
      const reportsData = await Promise.all(
        pendingIds.map(async (id) => {
          const report = await contract.getReport(id);
          return {
            id: id.toNumber(),
            reporter: report.reporter,
            reported: report.reported,
            contentId: report.contentId.toNumber(),
            contentType: report.contentType,
            category: reportCategories[report.category],
            description: report.description,
            evidence: report.evidence,
            timestamp: report.timestamp.toNumber(),
            status: reportStatuses[report.status],
            severity: report.severity.toNumber()
          };
        })
      );
      setPendingReports(reportsData);
    } catch (error) {
      console.error('Error loading pending reports:', error);
    }
  }, [contract, reportCategories, reportStatuses]);

  const loadModerationActions = useCallback(async () => {
    try {
      // This would need to be implemented in the contract or tracked off-chain
      // For now, we'll use a placeholder
      setModerationActions([]);
    } catch (error) {
      console.error('Error loading moderation actions:', error);
    }
  }, []);

  const loadBlockedUsers = useCallback(async () => {
    try {
      // This would need additional contract methods to get all blocked users
      // For now, we'll use a placeholder
      setBlockedUsers([]);
    } catch (error) {
      console.error('Error loading blocked users:', error);
    }
  }, []);

  const loadReputationData = useCallback(async () => {
    try {
      // This would need additional contract methods to get reputation data
      // For now, we'll use a placeholder
      setReputationData([]);
    } catch (error) {
      console.error('Error loading reputation data:', error);
    }
  }, []);

  const loadModerationData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPendingReports(),
        loadModerationActions(),
        loadBlockedUsers(),
        loadReputationData()
      ]);
    } catch (error) {
      console.error('Error loading moderation data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadPendingReports, loadModerationActions, loadBlockedUsers, loadReputationData]);

  useEffect(() => {
    if (contract && userAddress && isAdmin) {
      loadModerationData();
    }
  }, [contract, userAddress, isAdmin, loadModerationData]);

  useEffect(() => {
    if (websocket) {
      const handleModerationUpdate = (data) => {
        if (data.type === 'report_submitted' || data.type === 'report_resolved') {
          loadPendingReports();
        }
        if (data.type === 'user_blocked' || data.type === 'user_unblocked') {
          loadBlockedUsers();
        }
      };

      websocket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);
        handleModerationUpdate(data);
      });
    }
  }, [websocket, loadPendingReports, loadBlockedUsers]);

  const resolveReport = async (reportId, status, resolution) => {
    if (!contract) return;

    setLoading(true);
    try {
      const statusIndex = reportStatuses.indexOf(status);
      const tx = await contract.resolveReport(reportId, statusIndex, resolution);
      await tx.wait();
      
      await loadPendingReports();
      
      // Send WebSocket notification
      if (websocket) {
        websocket.send(JSON.stringify({
          type: 'report_resolved',
          reportId,
          status,
          moderator: userAddress
        }));
      }
    } catch (error) {
      console.error('Error resolving report:', error);
    } finally {
      setLoading(false);
    }
  };

  const blockUser = async () => {
    if (!contract || !blockForm.user) return;

    setLoading(true);
    try {
      const duration = blockForm.blockType === '0' ? blockForm.duration * 3600 : 0; // Convert hours to seconds
      const tx = await contract.blockUser(
        blockForm.user,
        parseInt(blockForm.blockType),
        duration,
        blockForm.reason
      );
      await tx.wait();
      
      await loadBlockedUsers();
      setBlockForm({ user: '', blockType: '0', duration: 24, reason: '' });
      
      // Send WebSocket notification
      if (websocket) {
        websocket.send(JSON.stringify({
          type: 'user_blocked',
          user: blockForm.user,
          blockType: blockTypes[parseInt(blockForm.blockType)],
          moderator: userAddress
        }));
      }
    } catch (error) {
      console.error('Error blocking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (userToUnblock) => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.unblockUser(userToUnblock);
      await tx.wait();
      
      await loadBlockedUsers();
      
      // Send WebSocket notification
      if (websocket) {
        websocket.send(JSON.stringify({
          type: 'user_unblocked',
          user: userToUnblock,
          moderator: userAddress
        }));
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
    } finally {
      setLoading(false);
    }
  };

  const addContentFilter = async () => {
    if (!contract || !newFilter.keyword) return;

    setLoading(true);
    try {
      const tx = await contract.addContentFilter(newFilter.keyword, newFilter.severity);
      await tx.wait();
      
      setNewFilter({ keyword: '', severity: 5 });
      // Reload filters if we had a method to get them
    } catch (error) {
      console.error('Error adding content filter:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateReputation = async (user, newScore, reason) => {
    if (!contract) return;

    setLoading(true);
    try {
      const tx = await contract.updateReputation(user, newScore, reason);
      await tx.wait();
      
      await loadReputationData();
    } catch (error) {
      console.error('Error updating reputation:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getSeverityColor = (severity) => {
    if (severity >= 8) return '#dc3545'; // Red
    if (severity >= 6) return '#fd7e14'; // Orange
    if (severity >= 4) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  };

  if (!isAdmin) {
    return (
      <div className="moderation-panel">
        <div className="access-denied">
          <h3>Access Denied</h3>
          <p>You don&apos;t have permission to access the moderation panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="moderation-panel">
      <div className="panel-header">
        <h2>Moderation Panel</h2>
        <div className="panel-stats">
          <div className="stat-item">
            <span className="stat-number">{pendingReports.length}</span>
            <span className="stat-label">Pending Reports</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{blockedUsers.length}</span>
            <span className="stat-label">Blocked Users</span>
          </div>
        </div>
      </div>

      <div className="panel-tabs">
        <button
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports ({pendingReports.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'blocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocks')}
        >
          User Blocks
        </button>
        <button
          className={`tab-btn ${activeTab === 'filters' ? 'active' : ''}`}
          onClick={() => setActiveTab('filters')}
        >
          Content Filters
        </button>
        <button
          className={`tab-btn ${activeTab === 'reputation' ? 'active' : ''}`}
          onClick={() => setActiveTab('reputation')}
        >
          Reputation
        </button>
        <button
          className={`tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          Recent Actions
        </button>
      </div>

      <div className="panel-content">
        {loading && (
          <div className="loading-overlay">
            <p>Loading...</p>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="reports-section">
            <div className="reports-list">
              {pendingReports.length === 0 ? (
                <div className="no-data">
                  <p>No pending reports</p>
                </div>
              ) : (
                pendingReports.map((report) => (
                  <div key={report.id} className="report-card">
                    <div className="report-header">
                      <div className="report-info">
                        <span className="report-id">#{report.id}</span>
                        <span 
                          className="report-category"
                          style={{ backgroundColor: getSeverityColor(report.severity) }}
                        >
                          {report.category}
                        </span>
                        <span className="report-severity">
                          Severity: {report.severity}/10
                        </span>
                      </div>
                      <div className="report-time">
                        {formatTimestamp(report.timestamp)}
                      </div>
                    </div>
                    
                    <div className="report-details">
                      <p><strong>Reporter:</strong> {report.reporter}</p>
                      <p><strong>Reported:</strong> {report.reported}</p>
                      <p><strong>Content ID:</strong> {report.contentId}</p>
                      <p><strong>Description:</strong> {report.description}</p>
                      {report.evidence && (
                        <p><strong>Evidence:</strong> <a href={report.evidence} target="_blank" rel="noopener noreferrer">View</a></p>
                      )}
                    </div>

                    <div className="report-actions">
                      <button
                        className="resolve-btn resolved"
                        onClick={() => resolveReport(report.id, 'RESOLVED', 'Report validated and action taken')}
                      >
                        Resolve
                      </button>
                      <button
                        className="resolve-btn dismissed"
                        onClick={() => resolveReport(report.id, 'DISMISSED', 'Report dismissed as invalid')}
                      >
                        Dismiss
                      </button>
                      <button
                        className="resolve-btn escalated"
                        onClick={() => resolveReport(report.id, 'ESCALATED', 'Report escalated for further review')}
                      >
                        Escalate
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'blocks' && (
          <div className="blocks-section">
            <div className="block-form">
              <h3>Block User</h3>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="User address"
                  value={blockForm.user}
                  onChange={(e) => setBlockForm(prev => ({ ...prev, user: e.target.value }))}
                />
                <select
                  value={blockForm.blockType}
                  onChange={(e) => setBlockForm(prev => ({ ...prev, blockType: e.target.value }))}
                >
                  {blockTypes.map((type, index) => (
                    <option key={index} value={index}>{type}</option>
                  ))}
                </select>
              </div>
              
              {blockForm.blockType === '0' && (
                <div className="form-row">
                  <input
                    type="number"
                    placeholder="Duration (hours)"
                    value={blockForm.duration}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                  />
                </div>
              )}
              
              <div className="form-row">
                <textarea
                  placeholder="Reason for block"
                  value={blockForm.reason}
                  onChange={(e) => setBlockForm(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>
              
              <button
                className="block-user-btn"
                onClick={blockUser}
                disabled={!blockForm.user || !blockForm.reason}
              >
                Block User
              </button>
            </div>

            <div className="blocked-users-list">
              <h3>Blocked Users</h3>
              {blockedUsers.length === 0 ? (
                <p>No blocked users</p>
              ) : (
                blockedUsers.map((block, index) => (
                  <div key={index} className="blocked-user-card">
                    <div className="block-info">
                      <p><strong>User:</strong> {block.user}</p>
                      <p><strong>Type:</strong> {blockTypes[block.blockType]}</p>
                      <p><strong>Reason:</strong> {block.reason}</p>
                      <p><strong>Moderator:</strong> {block.moderator}</p>
                    </div>
                    <button
                      className="unblock-btn"
                      onClick={() => unblockUser(block.user)}
                    >
                      Unblock
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'filters' && (
          <div className="filters-section">
            <div className="filter-form">
              <h3>Add Content Filter</h3>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Keyword or phrase"
                  value={newFilter.keyword}
                  onChange={(e) => setNewFilter(prev => ({ ...prev, keyword: e.target.value }))}
                />
                <input
                  type="number"
                  min="1"
                  max="10"
                  placeholder="Severity (1-10)"
                  value={newFilter.severity}
                  onChange={(e) => setNewFilter(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                />
                <button
                  className="add-filter-btn"
                  onClick={addContentFilter}
                  disabled={!newFilter.keyword}
                >
                  Add Filter
                </button>
              </div>
            </div>

            <div className="filters-list">
              <h3>Active Filters</h3>
              {contentFilters.length === 0 ? (
                <p>No content filters configured</p>
              ) : (
                contentFilters.map((filter, index) => (
                  <div key={index} className="filter-card">
                    <div className="filter-info">
                      <span className="filter-keyword">{filter.keyword}</span>
                      <span 
                        className="filter-severity"
                        style={{ backgroundColor: getSeverityColor(filter.severity) }}
                      >
                        {filter.severity}/10
                      </span>
                    </div>
                    <div className="filter-stats">
                      <span>Matches: {filter.matchCount}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'reputation' && (
          <div className="reputation-section">
            <h3>User Reputation Management</h3>
            {reputationData.length === 0 ? (
              <p>No reputation data available</p>
            ) : (
              <div className="reputation-list">
                {reputationData.map((user, index) => (
                  <div key={index} className="reputation-card">
                    <div className="user-info">
                      <p><strong>User:</strong> {user.address}</p>
                      <p><strong>Score:</strong> {user.score}/1000</p>
                      <p><strong>Trust Level:</strong> {user.trustLevel}/5</p>
                      <p><strong>Valid Reports:</strong> {user.validReports}</p>
                      <p><strong>False Reports:</strong> {user.falseReports}</p>
                    </div>
                    <div className="reputation-actions">
                      <button
                        className="reputation-btn increase"
                        onClick={() => updateReputation(user.address, Math.min(1000, user.score + 50), 'Manual increase')}
                      >
                        +50
                      </button>
                      <button
                        className="reputation-btn decrease"
                        onClick={() => updateReputation(user.address, Math.max(0, user.score - 50), 'Manual decrease')}
                      >
                        -50
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="actions-section">
            <h3>Recent Moderation Actions</h3>
            {moderationActions.length === 0 ? (
              <p>No recent actions</p>
            ) : (
              <div className="actions-list">
                {moderationActions.map((action, index) => (
                  <div key={index} className="action-card">
                    <div className="action-info">
                      <p><strong>Action:</strong> {action.actionType}</p>
                      <p><strong>Target:</strong> {action.target}</p>
                      <p><strong>Moderator:</strong> {action.moderator}</p>
                      <p><strong>Reason:</strong> {action.reason}</p>
                      <p><strong>Time:</strong> {formatTimestamp(action.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdvancedModerationPanel;