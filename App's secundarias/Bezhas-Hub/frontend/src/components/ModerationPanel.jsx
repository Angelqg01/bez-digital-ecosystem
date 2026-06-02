import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const ModerationPanel = ({ moderationContract, authContract }) => {
  const { user, isModerator, isAdmin } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [moderationActions, setModerationActions] = useState([]);
  const [stats, setStats] = useState({
    totalReports: 0,
    pendingReports: 0,
    totalActions: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isModerator() && moderationContract) {
      loadModerationData();
      setupEventListeners();
    }
  }, [isModerator, moderationContract]);

  const setupEventListeners = () => {
    if (!moderationContract) return;

    moderationContract.on('ReportSubmitted', (reportId, reporter, reportedUser, contentType, contentId) => {
      loadPendingReports();
      loadStats();
    });

    moderationContract.on('ReportResolved', (reportId, status, moderator) => {
      loadPendingReports();
      loadStats();
    });

    return () => {
      moderationContract.removeAllListeners();
    };
  };

  const loadModerationData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadPendingReports(),
        loadStats(),
        loadRecentActions()
      ]);
    } catch (error) {
      console.error('Error loading moderation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingReports = async () => {
    try {
      const pendingReportIds = await moderationContract.getPendingReports(0, 20);
      const reportsData = await Promise.all(
        pendingReportIds.map(async (id) => {
          const report = await moderationContract.reports(id);
          return {
            id: Number(report.id),
            reporter: report.reporter,
            reportedUser: report.reportedUser,
            contentType: Number(report.contentType),
            contentId: Number(report.contentId),
            reason: Number(report.reason),
            description: report.description,
            timestamp: Number(report.timestamp) * 1000,
            status: Number(report.status),
            assignedModerator: report.assignedModerator
          };
        })
      );
      setReports(reportsData);
    } catch (error) {
      console.error('Error loading pending reports:', error);
    }
  };

  const loadStats = async () => {
    try {
      const moderationStats = await moderationContract.getModerationStats();
      setStats({
        totalReports: Number(moderationStats.totalReportsCount),
        pendingReports: Number(moderationStats.pendingReportsCount),
        totalActions: Number(moderationStats.totalActionsCount)
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentActions = async () => {
    try {
      // Load recent moderation actions (this would need to be implemented in the contract)
      setModerationActions([]);
    } catch (error) {
      console.error('Error loading recent actions:', error);
    }
  };

  const assignReport = async (reportId) => {
    try {
      const tx = await moderationContract.assignReport(reportId);
      await tx.wait();
      loadPendingReports();
    } catch (error) {
      console.error('Error assigning report:', error);
      toast.error(`Error assigning report: ${error.message}`);
    }
  };

  const resolveReport = async (reportId, status, notes, actionType, duration = 0) => {
    try {
      const tx = await moderationContract.resolveReport(
        reportId,
        status, // 2 = RESOLVED, 3 = DISMISSED
        notes,
        actionType, // 0 = WARNING, 1 = CONTENT_REMOVAL, 2 = TEMPORARY_BAN, 3 = PERMANENT_BAN, 4 = ACCOUNT_RESTRICTION
        duration
      );
      await tx.wait();

      setSelectedReport(null);
      loadPendingReports();
      loadStats();
    } catch (error) {
      console.error('Error resolving report:', error);
      toast.error(`Error resolving report: ${error.message}`);
    }
  };

  const hideContent = async (contentType, contentId) => {
    try {
      const tx = await moderationContract.hideContent(contentType, contentId);
      await tx.wait();
      toast.success('Content hidden successfully');
    } catch (error) {
      console.error('Error hiding content:', error);
      toast.error(`Error hiding content: ${error.message}`);
    }
  };

  const blockUser = async (userAddress, duration) => {
    try {
      if (!authContract) {
        toast.error('Authentication contract not available');
        return;
      }

      const tx = await authContract.blockUser(userAddress, duration);
      await tx.wait();
      toast.success('User blocked successfully');
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error(`Error blocking user: ${error.message}`);
    }
  };

  const getContentTypeName = (type) => {
    const types = ['POST', 'COMMENT', 'MESSAGE', 'PROFILE', 'NFT'];
    return types[type] || 'UNKNOWN';
  };

  const getReasonName = (reason) => {
    const reasons = ['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE_CONTENT', 'SCAM', 'COPYRIGHT', 'OTHER'];
    return reasons[reason] || 'UNKNOWN';
  };

  const getStatusName = (status) => {
    const statuses = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
    return statuses[status] || 'UNKNOWN';
  };

  if (!isModerator()) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access the moderation panel.</p>
      </div>
    );
  }

  return (
    <div className="moderation-panel">
      <div className="moderation-header">
        <h2>Moderation Panel</h2>
        <div className="moderation-stats">
          <div className="stat-card">
            <h3>{stats.totalReports}</h3>
            <p>Total Reports</p>
          </div>
          <div className="stat-card pending">
            <h3>{stats.pendingReports}</h3>
            <p>Pending Reports</p>
          </div>
          <div className="stat-card">
            <h3>{stats.totalActions}</h3>
            <p>Actions Taken</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading moderation data...</p>
        </div>
      ) : (
        <div className="moderation-content">
          <div className="reports-section">
            <h3>Pending Reports</h3>
            {reports.length === 0 ? (
              <p>No pending reports</p>
            ) : (
              <div className="reports-list">
                {reports.map(report => (
                  <div key={report.id} className="report-card">
                    <div className="report-header">
                      <span className="report-id">#{report.id}</span>
                      <span className={`report-reason reason-${report.reason}`}>
                        {getReasonName(report.reason)}
                      </span>
                      <span className="report-type">
                        {getContentTypeName(report.contentType)}
                      </span>
                    </div>

                    <div className="report-details">
                      <p><strong>Reporter:</strong> {report.reporter.substring(0, 10)}...</p>
                      <p><strong>Reported User:</strong> {report.reportedUser.substring(0, 10)}...</p>
                      <p><strong>Content ID:</strong> {report.contentId}</p>
                      <p><strong>Description:</strong> {report.description}</p>
                      <p><strong>Date:</strong> {new Date(report.timestamp).toLocaleString()}</p>
                    </div>

                    <div className="report-actions">
                      {report.assignedModerator === '0x0000000000000000000000000000000000000000' ? (
                        <button
                          onClick={() => assignReport(report.id)}
                          className="assign-btn"
                        >
                          Assign to Me
                        </button>
                      ) : report.assignedModerator.toLowerCase() === user?.address?.toLowerCase() ? (
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="review-btn"
                        >
                          Review
                        </button>
                      ) : (
                        <span className="assigned-to">
                          Assigned to: {report.assignedModerator.substring(0, 10)}...
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedReport && (
            <div className="report-review-modal">
              <div className="modal-content">
                <div className="modal-header">
                  <h3>Review Report #{selectedReport.id}</h3>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="close-btn"
                  >
                    ✕
                  </button>
                </div>

                <div className="report-full-details">
                  <p><strong>Type:</strong> {getContentTypeName(selectedReport.contentType)}</p>
                  <p><strong>Reason:</strong> {getReasonName(selectedReport.reason)}</p>
                  <p><strong>Reporter:</strong> {selectedReport.reporter}</p>
                  <p><strong>Reported User:</strong> {selectedReport.reportedUser}</p>
                  <p><strong>Content ID:</strong> {selectedReport.contentId}</p>
                  <p><strong>Description:</strong> {selectedReport.description}</p>
                </div>

                <div className="moderation-actions">
                  <h4>Take Action</h4>

                  <div className="action-buttons">
                    <button
                      onClick={() => resolveReport(selectedReport.id, 3, 'Report dismissed - no violation found', 0)}
                      className="dismiss-btn"
                    >
                      Dismiss Report
                    </button>

                    <button
                      onClick={() => {
                        const notes = prompt('Enter warning notes:');
                        if (notes) resolveReport(selectedReport.id, 2, notes, 0);
                      }}
                      className="warning-btn"
                    >
                      Issue Warning
                    </button>

                    <button
                      onClick={() => hideContent(selectedReport.contentType, selectedReport.contentId)}
                      className="hide-content-btn"
                    >
                      Hide Content
                    </button>

                    <button
                      onClick={() => {
                        const hours = prompt('Enter ban duration in hours:');
                        if (hours && !isNaN(hours)) {
                          const duration = parseInt(hours) * 3600; // Convert to seconds
                          blockUser(selectedReport.reportedUser, duration);
                          resolveReport(selectedReport.id, 2, `Temporary ban: ${hours} hours`, 2, duration);
                        }
                      }}
                      className="temp-ban-btn"
                    >
                      Temporary Ban
                    </button>

                    {isAdmin() && (
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to permanently ban this user?')) {
                            const notes = prompt('Enter ban reason:');
                            if (notes) {
                              blockUser(selectedReport.reportedUser, 999999999); // Very long duration
                              resolveReport(selectedReport.id, 2, notes, 3);
                            }
                          }
                        }}
                        className="perm-ban-btn"
                      >
                        Permanent Ban
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModerationPanel;
