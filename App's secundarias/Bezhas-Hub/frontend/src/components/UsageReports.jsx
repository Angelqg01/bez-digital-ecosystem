import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import './UsageReports.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const UsageReports = ({ contracts, walletAddress }) => {
  const [reportData, setReportData] = useState({
    userActivity: {},
    platformMetrics: {},
    transactionVolume: {},
    featureUsage: {},
    geographicData: {},
    deviceData: {},
    timeRangeData: {}
  });
  const [timeRange, setTimeRange] = useState('7d');
  const [reportType, setReportType] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    fetchUsageData();
  }, [timeRange, reportType, contracts]);

  const checkAdminStatus = async () => {
    try {
      if (contracts.userManagement && walletAddress) {
        const adminRole = await contracts.userManagement.ADMIN_ROLE();
        const hasRole = await contracts.userManagement.hasRole(adminRole, walletAddress);
        setIsAdmin(hasRole);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchUsageData = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from your analytics backend
      // For now, we'll generate mock data based on the time range
      const mockData = generateMockUsageData(timeRange);
      setReportData(mockData);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockUsageData = (range) => {
    const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const labels = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString());
    }

    return {
      userActivity: {
        labels,
        datasets: [
          {
            label: 'Daily Active Users',
            data: labels.map(() => Math.floor(Math.random() * 1000) + 500),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
          },
          {
            label: 'New Users',
            data: labels.map(() => Math.floor(Math.random() * 100) + 20),
            borderColor: '#f093fb',
            backgroundColor: 'rgba(240, 147, 251, 0.1)',
            tension: 0.4,
          }
        ]
      },
      platformMetrics: {
        totalUsers: 12547,
        activeUsers24h: 2341,
        activeUsers7d: 8923,
        totalTransactions: 45678,
        totalVolume: '1,234.56 ETH',
        averageSessionTime: '12m 34s',
        bounceRate: '23.4%',
        retentionRate: '76.8%'
      },
      transactionVolume: {
        labels,
        datasets: [
          {
            label: 'Transaction Volume (ETH)',
            data: labels.map(() => (Math.random() * 100 + 50).toFixed(2)),
            backgroundColor: '#667eea',
            borderColor: '#667eea',
            borderWidth: 1,
          }
        ]
      },
      featureUsage: {
        labels: ['NFT Trading', 'Staking', 'Messaging', 'Governance', 'DeFi', 'Analytics'],
        datasets: [
          {
            data: [35, 25, 15, 10, 10, 5],
            backgroundColor: [
              '#667eea',
              '#f093fb',
              '#f5576c',
              '#4ecdc4',
              '#45b7d1',
              '#96ceb4'
            ],
            borderWidth: 0,
          }
        ]
      },
      geographicData: {
        regions: [
          { name: 'North America', users: 4521, percentage: 36.1 },
          { name: 'Europe', users: 3876, percentage: 30.9 },
          { name: 'Asia', users: 2834, percentage: 22.6 },
          { name: 'South America', users: 891, percentage: 7.1 },
          { name: 'Africa', users: 298, percentage: 2.4 },
          { name: 'Oceania', users: 127, percentage: 1.0 }
        ]
      },
      deviceData: {
        labels: ['Desktop', 'Mobile', 'Tablet'],
        datasets: [
          {
            data: [65, 30, 5],
            backgroundColor: ['#667eea', '#f093fb', '#4ecdc4'],
            borderWidth: 0,
          }
        ]
      },
      timeRangeData: {
        peakHours: [
          { hour: '00:00', users: 234 },
          { hour: '04:00', users: 156 },
          { hour: '08:00', users: 567 },
          { hour: '12:00', users: 892 },
          { hour: '16:00', users: 1234 },
          { hour: '20:00', users: 1456 },
        ]
      }
    };
  };

  const exportReport = (format) => {
    const data = {
      reportType,
      timeRange,
      generatedAt: new Date().toISOString(),
      data: reportData
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-report-${timeRange}-${Date.now()}.json`;
      a.click();
    } else if (format === 'csv') {
      // Convert data to CSV format
      let csv = 'Metric,Value\n';
      Object.entries(reportData.platformMetrics).forEach(([key, value]) => {
        csv += `${key},${value}\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-report-${timeRange}-${Date.now()}.csv`;
      a.click();
    }
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Platform Usage Analytics',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Feature Usage Distribution',
      },
    },
  };

  if (loading) {
    return (
      <div className="usage-reports-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading usage reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="usage-reports-container">
      <div className="reports-header">
        <h2>Platform Usage Reports</h2>
        <div className="reports-controls">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="report-type-select"
          >
            <option value="overview">Overview</option>
            <option value="detailed">Detailed</option>
            <option value="comparative">Comparative</option>
          </select>

          {isAdmin && (
            <div className="export-controls">
              <button onClick={() => exportReport('json')} className="export-btn">
                Export JSON
              </button>
              <button onClick={() => exportReport('csv')} className="export-btn">
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="metrics-overview">
        <div className="metric-card">
          <h3>Total Users</h3>
          <p className="metric-value">{reportData.platformMetrics.totalUsers?.toLocaleString()}</p>
          <span className="metric-change positive">+12.5%</span>
        </div>
        <div className="metric-card">
          <h3>Active Users (24h)</h3>
          <p className="metric-value">{reportData.platformMetrics.activeUsers24h?.toLocaleString()}</p>
          <span className="metric-change positive">+8.2%</span>
        </div>
        <div className="metric-card">
          <h3>Transaction Volume</h3>
          <p className="metric-value">{reportData.platformMetrics.totalVolume}</p>
          <span className="metric-change positive">+15.7%</span>
        </div>
        <div className="metric-card">
          <h3>Retention Rate</h3>
          <p className="metric-value">{reportData.platformMetrics.retentionRate}</p>
          <span className="metric-change positive">+2.1%</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h3>User Activity Trends</h3>
          <Line data={reportData.userActivity} options={chartOptions} />
        </div>

        <div className="chart-container">
          <h3>Transaction Volume</h3>
          <Bar data={reportData.transactionVolume} options={chartOptions} />
        </div>

        <div className="chart-container">
          <h3>Feature Usage</h3>
          <Doughnut data={reportData.featureUsage} options={doughnutOptions} />
        </div>

        <div className="chart-container">
          <h3>Device Distribution</h3>
          <Doughnut data={reportData.deviceData} options={doughnutOptions} />
        </div>
      </div>

      {/* Geographic Distribution */}
      <div className="geographic-section">
        <h3>Geographic Distribution</h3>
        <div className="geographic-table">
          <table>
            <thead>
              <tr>
                <th>Region</th>
                <th>Users</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {reportData.geographicData.regions?.map((region, index) => (
                <tr key={index}>
                  <td>{region.name}</td>
                  <td>{region.users.toLocaleString()}</td>
                  <td>{region.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Peak Usage Hours */}
      <div className="peak-hours-section">
        <h3>Peak Usage Hours (UTC)</h3>
        <div className="peak-hours-chart">
          {reportData.timeRangeData.peakHours?.map((hour, index) => (
            <div key={index} className="hour-bar">
              <div 
                className="bar" 
                style={{ height: `${(hour.users / 1500) * 100}%` }}
              ></div>
              <span className="hour-label">{hour.hour}</span>
              <span className="user-count">{hour.users}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Statistics */}
      {reportType === 'detailed' && (
        <div className="detailed-stats">
          <h3>Detailed Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <label>Average Session Time</label>
              <value>{reportData.platformMetrics.averageSessionTime}</value>
            </div>
            <div className="stat-item">
              <label>Bounce Rate</label>
              <value>{reportData.platformMetrics.bounceRate}</value>
            </div>
            <div className="stat-item">
              <label>Total Transactions</label>
              <value>{reportData.platformMetrics.totalTransactions?.toLocaleString()}</value>
            </div>
            <div className="stat-item">
              <label>Active Users (7d)</label>
              <value>{reportData.platformMetrics.activeUsers7d?.toLocaleString()}</value>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Updates */}
      <div className="realtime-section">
        <h3>Real-time Activity</h3>
        <div className="realtime-metrics">
          <div className="realtime-metric">
            <span className="metric-label">Users Online</span>
            <span className="metric-value live">1,234</span>
          </div>
          <div className="realtime-metric">
            <span className="metric-label">Active Transactions</span>
            <span className="metric-value">23</span>
          </div>
          <div className="realtime-metric">
            <span className="metric-label">Messages Sent</span>
            <span className="metric-value">456</span>
          </div>
        </div>
      </div>

      {/* Alerts and Notifications */}
      {isAdmin && (
        <div className="alerts-section">
          <h3>System Alerts</h3>
          <div className="alert-list">
            <div className="alert-item warning">
              <span className="alert-icon">⚠️</span>
              <span className="alert-text">High transaction volume detected</span>
              <span className="alert-time">2 minutes ago</span>
            </div>
            <div className="alert-item info">
              <span className="alert-icon">ℹ️</span>
              <span className="alert-text">New user registration spike</span>
              <span className="alert-time">15 minutes ago</span>
            </div>
            <div className="alert-item success">
              <span className="alert-icon">✅</span>
              <span className="alert-text">System performance optimal</span>
              <span className="alert-time">1 hour ago</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageReports;
