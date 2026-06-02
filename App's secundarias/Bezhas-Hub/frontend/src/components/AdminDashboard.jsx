import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { ethers } from 'ethers';
import './AdminDashboard.css';
import DiagnosticDashboard from './admin/DiagnosticDashboard';

const AdminDashboard = ({
  userAddress,
  securityManagerContract,
  stakingPoolContract,
  liquidityFarmingContract,
  governanceContract,
  marketplaceContract
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    totalStaked: '0',
    totalRewards: '0',
    activeProposals: 0,
    securityAlerts: 0,
    poolUtilization: 0
  });
  const [securityLogs, setSecurityLogs] = useState([]);
  const [blacklistAddress, setBlacklistAddress] = useState('');
  const [transactionLimits, setTransactionLimits] = useState({
    address: '',
    dailyLimit: '',
    transactionLimit: ''
  });
  const [loading, setLoading] = useState(false);

  const loadSystemStats = useCallback(async () => {
    try {
      setLoading(true);

      // Get staking pool stats
      if (stakingPoolContract) {
        const poolStats = await stakingPoolContract.getPoolStats();
        setSystemStats(prev => ({
          ...prev,
          totalStaked: ethers.formatEther(poolStats._totalStaked),
          totalUsers: poolStats._totalUsers.toString(),
          totalRewards: ethers.formatEther(poolStats._totalRewardsDistributed),
          poolUtilization: poolStats._poolUtilization.toString()
        }));
      }

      // Get governance stats
      if (governanceContract) {
        const proposalCount = await governanceContract.proposalCount();
        setSystemStats(prev => ({
          ...prev,
          activeProposals: proposalCount.toString()
        }));
      }

    } catch (error) {
      console.error('Error loading system stats:', error);
      toast.error(`Error loading system stats: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [stakingPoolContract, governanceContract]);

  const loadSecurityLogs = useCallback(async () => {
    try {
      if (securityManagerContract) {
        const currentTime = Math.floor(Date.now() / 1000);
        const oneDayAgo = currentTime - (24 * 60 * 60);

        const logs = await securityManagerContract.getActivityLogs(
          ethers.ZeroAddress, // All users
          oneDayAgo,
          currentTime
        );

        setSecurityLogs(logs.slice(-10)); // Last 10 logs
      }
    } catch (error) {
      console.error('Error loading security logs:', error);
      toast.error(`Error loading security logs: ${error.message}`);
    }
  }, [securityManagerContract]);

  useEffect(() => {
    if (userAddress) {
      loadSystemStats();
      loadSecurityLogs();
    }
  }, [userAddress, loadSystemStats, loadSecurityLogs]);

  const handleBlacklistAddress = async () => {
    if (!blacklistAddress || !securityManagerContract) return;

    try {
      setLoading(true);
      const tx = await securityManagerContract.blacklistAddress(blacklistAddress, true);
      await tx.wait();
      toast.success('Address blacklisted successfully');
      setBlacklistAddress('');
    } catch (error) {
      console.error('Error blacklisting address:', error);
      toast.error(`Error blacklisting address: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSetTransactionLimits = async () => {
    if (!transactionLimits.address || !securityManagerContract) return;

    try {
      setLoading(true);
      const tx = await securityManagerContract.setTransactionLimits(
        transactionLimits.address,
        ethers.parseEther(transactionLimits.dailyLimit),
        ethers.parseEther(transactionLimits.transactionLimit)
      );
      await tx.wait();
      toast.success('Transaction limits set successfully');
      setTransactionLimits({ address: '', dailyLimit: '', transactionLimit: '' });
    } catch (error) {
      console.error('Error setting transaction limits:', error);
      toast.error(`Error setting transaction limits: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const pauseContract = async (contract, contractName) => {
    try {
      setLoading(true);
      const tx = await contract.pause();
      await tx.wait();
      toast.success(`${contractName} paused successfully`);
    } catch (error) {
      console.error(`Error pausing ${contractName}:`, error);
      toast.error(`Error pausing ${contractName}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const unpauseContract = async (contract, contractName) => {
    try {
      setLoading(true);
      const tx = await contract.unpause();
      await tx.wait();
      toast.success(`${contractName} unpaused successfully`);
    } catch (error) {
      console.error(`Error unpausing ${contractName}:`, error);
      toast.error(`Error unpausing ${contractName}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => (
    <div className="admin-overview">
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Users</h3>
          <div className="stat-value">{systemStats.totalUsers}</div>
        </div>
        <div className="stat-card">
          <h3>Total Staked</h3>
          <div className="stat-value">{parseFloat(systemStats.totalStaked).toFixed(2)} BEZ</div>
        </div>
        <div className="stat-card">
          <h3>Total Rewards</h3>
          <div className="stat-value">{parseFloat(systemStats.totalRewards).toFixed(2)} BEZ</div>
        </div>
        <div className="stat-card">
          <h3>Active Proposals</h3>
          <div className="stat-value">{systemStats.activeProposals}</div>
        </div>
        <div className="stat-card">
          <h3>Pool Utilization</h3>
          <div className="stat-value">{(systemStats.poolUtilization / 100).toFixed(1)}%</div>
        </div>
        <div className="stat-card">
          <h3>Security Alerts</h3>
          <div className="stat-value">{systemStats.securityAlerts}</div>
        </div>
      </div>

      <div className="recent-activity">
        <h3>Recent Security Activity</h3>
        <div className="activity-list">
          {securityLogs.map((log, index) => (
            <div key={index} className="activity-item">
              <div className="activity-user">{log.user.slice(0, 10)}...</div>
              <div className="activity-action">{log.action}</div>
              <div className="activity-time">
                {new Date(log.timestamp * 1000).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div className="admin-security">
      <div className="security-controls">
        <div className="control-section">
          <h3>Blacklist Management</h3>
          <div className="input-group">
            <input
              type="text"
              placeholder="Address to blacklist"
              value={blacklistAddress}
              onChange={(e) => setBlacklistAddress(e.target.value)}
            />
            <button onClick={handleBlacklistAddress} disabled={loading}>
              Blacklist Address
            </button>
          </div>
        </div>

        <div className="control-section">
          <h3>Transaction Limits</h3>
          <div className="limits-form">
            <input
              type="text"
              placeholder="User Address"
              value={transactionLimits.address}
              onChange={(e) => setTransactionLimits(prev => ({
                ...prev,
                address: e.target.value
              }))}
            />
            <input
              type="text"
              placeholder="Daily Limit (BEZ)"
              value={transactionLimits.dailyLimit}
              onChange={(e) => setTransactionLimits(prev => ({
                ...prev,
                dailyLimit: e.target.value
              }))}
            />
            <input
              type="text"
              placeholder="Transaction Limit (BEZ)"
              value={transactionLimits.transactionLimit}
              onChange={(e) => setTransactionLimits(prev => ({
                ...prev,
                transactionLimit: e.target.value
              }))}
            />
            <button onClick={handleSetTransactionLimits} disabled={loading}>
              Set Limits
            </button>
          </div>
        </div>
      </div>

      <div className="security-logs">
        <h3>Security Logs</h3>
        <div className="logs-table">
          <div className="table-header">
            <div>User</div>
            <div>Action</div>
            <div>Value</div>
            <div>Time</div>
          </div>
          {securityLogs.map((log, index) => (
            <div key={index} className="table-row">
              <div>{log.user.slice(0, 10)}...</div>
              <div>{log.action}</div>
              <div>{ethers.formatEther(log.value)} BEZ</div>
              <div>{new Date(log.timestamp * 1000).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderContractManagement = () => (
    <div className="admin-contracts">
      <h3>Contract Management</h3>
      <div className="contract-controls">
        <div className="contract-item">
          <h4>Staking Pool</h4>
          <div className="contract-actions">
            <button
              onClick={() => pauseContract(stakingPoolContract, 'Staking Pool')}
              disabled={loading}
            >
              Pause
            </button>
            <button
              onClick={() => unpauseContract(stakingPoolContract, 'Staking Pool')}
              disabled={loading}
            >
              Unpause
            </button>
          </div>
        </div>

        <div className="contract-item">
          <h4>Liquidity Farming</h4>
          <div className="contract-actions">
            <button
              onClick={() => pauseContract(liquidityFarmingContract, 'Liquidity Farming')}
              disabled={loading}
            >
              Pause
            </button>
            <button
              onClick={() => unpauseContract(liquidityFarmingContract, 'Liquidity Farming')}
              disabled={loading}
            >
              Unpause
            </button>
          </div>
        </div>

        <div className="contract-item">
          <h4>Governance System</h4>
          <div className="contract-actions">
            <button
              onClick={() => pauseContract(governanceContract, 'Governance System')}
              disabled={loading}
            >
              Pause
            </button>
            <button
              onClick={() => unpauseContract(governanceContract, 'Governance System')}
              disabled={loading}
            >
              Unpause
            </button>
          </div>
        </div>

        <div className="contract-item">
          <h4>Marketplace</h4>
          <div className="contract-actions">
            <button
              onClick={() => pauseContract(marketplaceContract, 'Marketplace')}
              disabled={loading}
            >
              Pause
            </button>
            <button
              onClick={() => unpauseContract(marketplaceContract, 'Marketplace')}
              disabled={loading}
            >
              Unpause
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSystemMonitoring = () => (
    <div className="admin-monitoring">
      <h3>System Monitoring</h3>
      <div className="monitoring-grid">
        <div className="monitor-card">
          <h4>Network Status</h4>
          <div className="status-indicator online">Online</div>
        </div>
        <div className="monitor-card">
          <h4>Contract Health</h4>
          <div className="health-list">
            <div className="health-item">
              <span>Staking Pool</span>
              <span className="status healthy">Healthy</span>
            </div>
            <div className="health-item">
              <span>Marketplace</span>
              <span className="status healthy">Healthy</span>
            </div>
            <div className="health-item">
              <span>Governance</span>
              <span className="status healthy">Healthy</span>
            </div>
          </div>
        </div>
        <div className="monitor-card">
          <h4>Performance Metrics</h4>
          <div className="metrics-list">
            <div className="metric-item">
              <span>Avg Response Time</span>
              <span>120ms</span>
            </div>
            <div className="metric-item">
              <span>Success Rate</span>
              <span>99.8%</span>
            </div>
            <div className="metric-item">
              <span>Active Connections</span>
              <span>1,247</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="admin-panel">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>BeZhas Admin</h2>
        </div>
        <nav className="sidebar-nav">
          <ul>
            <li className={activeTab === 'overview' ? 'active' : ''}>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('overview'); }}>Dashboard</a>
            </li>
            <li className={activeTab === 'security' ? 'active' : ''}>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('security'); }}>Security</a>
            </li>
            <li className={activeTab === 'contracts' ? 'active' : ''}>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('contracts'); }}>Contracts</a>
            </li>
            <li className={activeTab === 'monitoring' ? 'active' : ''}>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('monitoring'); }}>Monitoring</a>
            </li>
            <li className={activeTab === 'diagnostic' ? 'active' : ''}>
              <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab('diagnostic'); }}>Diagnóstico IA</a>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="main-content">
        <header className="main-header">
          <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <div className="header-actions">
            <input type="search" placeholder="Buscar..." />
            <button className="notifications-btn">🔔</button>
          </div>
        </header>

        {loading && <div className="loading-overlay">Loading...</div>}
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'diagnostic' && <DiagnosticDashboard />}
        {activeTab === 'security' && renderSecurity()}
        {activeTab === 'contracts' && renderContractManagement()}
        {activeTab === 'monitoring' && renderSystemMonitoring()}
      </main>
    </div>
  );
};

export default AdminDashboard;
