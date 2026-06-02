import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
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
import priceService from '../services/PriceService';

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

const AnalyticsDashboard = ({ 
  provider, 
  signer, 
  account, 
  contracts,
  onError 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');
  
  // Analytics data
  const [platformStats, setPlatformStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalVolume: 0,
    activeUsers: 0
  });

  const [nftAnalytics, setNftAnalytics] = useState({
    totalNFTs: 0,
    totalSales: 0,
    averagePrice: 0,
    topCollections: [],
    priceHistory: []
  });

  const [tokenAnalytics, setTokenAnalytics] = useState({
    totalSupply: 0,
    circulatingSupply: 0,
    holders: 0,
    transfers: 0,
    priceData: null
  });

  const [userActivity, setUserActivity] = useState({
    dailyActiveUsers: [],
    transactionVolume: [],
    newUsers: []
  });

  const [financialReports, setFinancialReports] = useState({
    revenue: 0,
    fees: 0,
    stakingRewards: 0,
    liquidityProvision: 0
  });

  useEffect(() => {
    if (contracts && account) {
      loadAnalyticsData();
    }
  }, [contracts, account, timeRange]);

  const loadAnalyticsData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadPlatformStats(),
        loadNFTAnalytics(),
        loadTokenAnalytics(),
        loadUserActivity(),
        loadFinancialReports()
      ]);
    } catch (error) {
      console.error('Error loading analytics:', error);
      onError('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlatformStats = async () => {
    try {
      // Mock data - in production, fetch from backend API
      const stats = {
        totalUsers: 15420,
        totalTransactions: 89350,
        totalVolume: 2450000,
        activeUsers: 3240
      };

      // If UserManagement contract is available
      if (contracts.userManagement) {
        try {
          // Get actual user count from contract
          const userCount = await contracts.userManagement.getUserCount();
          stats.totalUsers = userCount.toNumber();
        } catch (error) {
          console.warn('Could not fetch user count from contract:', error);
        }
      }

      setPlatformStats(stats);
    } catch (error) {
      console.error('Error loading platform stats:', error);
    }
  };

  const loadNFTAnalytics = async () => {
    try {
      const analytics = {
        totalNFTs: 8950,
        totalSales: 12340,
        averagePrice: 0.25,
        topCollections: [
          { name: 'BeZhas Art', volume: 450, floor: 0.1 },
          { name: 'Digital Collectibles', volume: 320, floor: 0.05 },
          { name: 'Gaming Assets', volume: 280, floor: 0.08 }
        ],
        priceHistory: generateMockPriceHistory()
      };

      // If marketplace contract is available
      if (contracts.marketplace) {
        try {
          // Get actual NFT data from contract
          const totalListings = await contracts.marketplace.getTotalListings();
          analytics.totalNFTs = totalListings.toNumber();
        } catch (error) {
          console.warn('Could not fetch NFT data from contract:', error);
        }
      }

      setNftAnalytics(analytics);
    } catch (error) {
      console.error('Error loading NFT analytics:', error);
    }
  };

  const loadTokenAnalytics = async () => {
    try {
      let analytics = {
        totalSupply: 1000000,
        circulatingSupply: 750000,
        holders: 2340,
        transfers: 45600,
        priceData: null
      };

      // Get token data from contract
      if (contracts.bezhasToken) {
        try {
          const totalSupply = await contracts.bezhasToken.totalSupply();
          analytics.totalSupply = parseFloat(ethers.utils.formatEther(totalSupply));
        } catch (error) {
          console.warn('Could not fetch token supply:', error);
        }
      }

      // Get price data from external API
      try {
        const priceData = await priceService.getAggregatedPrice('BEZ', 'bezhas');
        analytics.priceData = priceData;
      } catch (error) {
        console.warn('Could not fetch price data:', error);
      }

      setTokenAnalytics(analytics);
    } catch (error) {
      console.error('Error loading token analytics:', error);
    }
  };

  const loadUserActivity = async () => {
    try {
      const activity = {
        dailyActiveUsers: generateMockTimeSeries('users'),
        transactionVolume: generateMockTimeSeries('volume'),
        newUsers: generateMockTimeSeries('new_users')
      };

      setUserActivity(activity);
    } catch (error) {
      console.error('Error loading user activity:', error);
    }
  };

  const loadFinancialReports = async () => {
    try {
      let reports = {
        revenue: 125000,
        fees: 8500,
        stakingRewards: 45000,
        liquidityProvision: 32000
      };

      // Get staking data if available
      if (contracts.stakingPool) {
        try {
          const totalStaked = await contracts.stakingPool.getTotalStaked();
          reports.stakingRewards = parseFloat(ethers.utils.formatEther(totalStaked)) * 0.1; // 10% APY estimate
        } catch (error) {
          console.warn('Could not fetch staking data:', error);
        }
      }

      setFinancialReports(reports);
    } catch (error) {
      console.error('Error loading financial reports:', error);
    }
  };

  const generateMockTimeSeries = (type) => {
    const days = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      let value;
      switch (type) {
        case 'users':
          value = Math.floor(Math.random() * 500) + 2000;
          break;
        case 'volume':
          value = Math.floor(Math.random() * 50000) + 10000;
          break;
        case 'new_users':
          value = Math.floor(Math.random() * 100) + 50;
          break;
        default:
          value = Math.floor(Math.random() * 1000);
      }
      
      data.push({
        date: date.toISOString().split('T')[0],
        value
      });
    }
    
    return data;
  };

  const generateMockPriceHistory = () => {
    const data = [];
    let price = 0.15;
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      price += (Math.random() - 0.5) * 0.02;
      price = Math.max(0.05, Math.min(0.5, price));
      
      data.push({
        date: date.toISOString().split('T')[0],
        price: parseFloat(price.toFixed(4))
      });
    }
    
    return data;
  };

  const formatNumber = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toLocaleString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const userActivityChartData = {
    labels: userActivity.dailyActiveUsers.map(d => d.date),
    datasets: [
      {
        label: 'Daily Active Users',
        data: userActivity.dailyActiveUsers.map(d => d.value),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  };

  const volumeChartData = {
    labels: userActivity.transactionVolume.map(d => d.date),
    datasets: [
      {
        label: 'Transaction Volume ($)',
        data: userActivity.transactionVolume.map(d => d.value),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
      },
    ],
  };

  const nftPriceChartData = {
    labels: nftAnalytics.priceHistory.map(d => d.date),
    datasets: [
      {
        label: 'Average NFT Price (ETH)',
        data: nftAnalytics.priceHistory.map(d => d.price),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.1,
      },
    ],
  };

  const revenueDistributionData = {
    labels: ['Platform Fees', 'Staking Rewards', 'Liquidity Provision', 'Other'],
    datasets: [
      {
        data: [
          financialReports.fees,
          financialReports.stakingRewards,
          financialReports.liquidityProvision,
          financialReports.revenue - financialReports.fees - financialReports.stakingRewards - financialReports.liquidityProvision
        ],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
        ],
      },
    ],
  };

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h2>📊 Analytics Dashboard</h2>
        <div className="dashboard-controls">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-selector"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button onClick={loadAnalyticsData} disabled={isLoading}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="tab-navigation">
        <button 
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={activeTab === 'nfts' ? 'active' : ''}
          onClick={() => setActiveTab('nfts')}
        >
          NFTs
        </button>
        <button 
          className={activeTab === 'tokens' ? 'active' : ''}
          onClick={() => setActiveTab('tokens')}
        >
          Tokens
        </button>
        <button 
          className={activeTab === 'financial' ? 'active' : ''}
          onClick={() => setActiveTab('financial')}
        >
          Financial
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="overview-section">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Users</h3>
              <div className="stat-value">{formatNumber(platformStats.totalUsers)}</div>
              <div className="stat-change positive">+12.5%</div>
            </div>
            <div className="stat-card">
              <h3>Total Transactions</h3>
              <div className="stat-value">{formatNumber(platformStats.totalTransactions)}</div>
              <div className="stat-change positive">+8.3%</div>
            </div>
            <div className="stat-card">
              <h3>Total Volume</h3>
              <div className="stat-value">{formatCurrency(platformStats.totalVolume)}</div>
              <div className="stat-change positive">+15.7%</div>
            </div>
            <div className="stat-card">
              <h3>Active Users</h3>
              <div className="stat-value">{formatNumber(platformStats.activeUsers)}</div>
              <div className="stat-change negative">-2.1%</div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-container">
              <h3>Daily Active Users</h3>
              <Line data={userActivityChartData} options={chartOptions} />
            </div>
            <div className="chart-container">
              <h3>Transaction Volume</h3>
              <Bar data={volumeChartData} options={chartOptions} />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="users-section">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Registered</h3>
              <div className="stat-value">{formatNumber(platformStats.totalUsers)}</div>
            </div>
            <div className="stat-card">
              <h3>Active Today</h3>
              <div className="stat-value">{formatNumber(platformStats.activeUsers)}</div>
            </div>
            <div className="stat-card">
              <h3>New This Week</h3>
              <div className="stat-value">{formatNumber(userActivity.newUsers.reduce((sum, d) => sum + d.value, 0))}</div>
            </div>
            <div className="stat-card">
              <h3>Retention Rate</h3>
              <div className="stat-value">78.5%</div>
            </div>
          </div>

          <div className="chart-container">
            <h3>User Growth Over Time</h3>
            <Line 
              data={{
                labels: userActivity.newUsers.map(d => d.date),
                datasets: [{
                  label: 'New Users',
                  data: userActivity.newUsers.map(d => d.value),
                  borderColor: 'rgb(75, 192, 192)',
                  backgroundColor: 'rgba(75, 192, 192, 0.2)',
                }]
              }} 
              options={chartOptions} 
            />
          </div>
        </div>
      )}

      {activeTab === 'nfts' && (
        <div className="nfts-section">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total NFTs</h3>
              <div className="stat-value">{formatNumber(nftAnalytics.totalNFTs)}</div>
            </div>
            <div className="stat-card">
              <h3>Total Sales</h3>
              <div className="stat-value">{formatNumber(nftAnalytics.totalSales)}</div>
            </div>
            <div className="stat-card">
              <h3>Average Price</h3>
              <div className="stat-value">{nftAnalytics.averagePrice} ETH</div>
            </div>
            <div className="stat-card">
              <h3>Volume (24h)</h3>
              <div className="stat-value">125.4 ETH</div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="chart-container">
              <h3>NFT Price Trends</h3>
              <Line data={nftPriceChartData} options={chartOptions} />
            </div>
            <div className="chart-container">
              <h3>Top Collections</h3>
              <div className="collections-list">
                {nftAnalytics.topCollections.map((collection, index) => (
                  <div key={index} className="collection-item">
                    <div className="collection-name">{collection.name}</div>
                    <div className="collection-stats">
                      <span>Volume: {collection.volume} ETH</span>
                      <span>Floor: {collection.floor} ETH</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tokens' && (
        <div className="tokens-section">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Supply</h3>
              <div className="stat-value">{formatNumber(tokenAnalytics.totalSupply)} BEZ</div>
            </div>
            <div className="stat-card">
              <h3>Circulating Supply</h3>
              <div className="stat-value">{formatNumber(tokenAnalytics.circulatingSupply)} BEZ</div>
            </div>
            <div className="stat-card">
              <h3>Holders</h3>
              <div className="stat-value">{formatNumber(tokenAnalytics.holders)}</div>
            </div>
            <div className="stat-card">
              <h3>Total Transfers</h3>
              <div className="stat-value">{formatNumber(tokenAnalytics.transfers)}</div>
            </div>
          </div>

          {tokenAnalytics.priceData && (
            <div className="price-info">
              <h3>BEZ Token Price</h3>
              <div className="price-grid">
                {Object.entries(tokenAnalytics.priceData.prices).map(([source, data]) => (
                  <div key={source} className="price-source">
                    <div className="source-name">{source}</div>
                    <div className="price-value">{formatCurrency(data.price)}</div>
                    <div className={`price-change ${data.change24h >= 0 ? 'positive' : 'negative'}`}>
                      {data.change24h >= 0 ? '+' : ''}{data.change24h?.toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="financial-section">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Revenue</h3>
              <div className="stat-value">{formatCurrency(financialReports.revenue)}</div>
            </div>
            <div className="stat-card">
              <h3>Platform Fees</h3>
              <div className="stat-value">{formatCurrency(financialReports.fees)}</div>
            </div>
            <div className="stat-card">
              <h3>Staking Rewards</h3>
              <div className="stat-value">{formatCurrency(financialReports.stakingRewards)}</div>
            </div>
            <div className="stat-card">
              <h3>Liquidity Provision</h3>
              <div className="stat-value">{formatCurrency(financialReports.liquidityProvision)}</div>
            </div>
          </div>

          <div className="chart-container">
            <h3>Revenue Distribution</h3>
            <div className="chart-wrapper">
              <Doughnut data={revenueDistributionData} />
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner">Loading analytics...</div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
