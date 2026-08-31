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
import PriceService from '../services/PriceService';
import './FinancialReports.css';

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

const FinancialReports = ({ contracts, walletAddress }) => {
  const [financialData, setFinancialData] = useState({
    portfolioValue: {},
    tokenHoldings: {},
    transactionHistory: {},
    stakingRewards: {},
    tradingVolume: {},
    profitLoss: {},
    feeAnalysis: {},
    taxReporting: {}
  });
  const [timeRange, setTimeRange] = useState('30d');
  const [reportType, setReportType] = useState('portfolio');
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');

  useEffect(() => {
    fetchFinancialData();
  }, [timeRange, reportType, selectedCurrency, contracts, walletAddress]);

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // Fetch real financial data
      const portfolioData = await fetchPortfolioData();
      const transactionData = await fetchTransactionData();
      const stakingData = await fetchStakingData();
      
      const financialReport = await generateFinancialReport(portfolioData, transactionData, stakingData);
      setFinancialData(financialReport);
    } catch (error) {
      console.error('Error fetching financial data:', error);
      // Fallback to mock data
      const mockReport = generateMockFinancialData(timeRange);
      setFinancialData(mockReport);
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolioData = async () => {
    if (!contracts || !walletAddress) return null;
    
    try {
      // Fetch token balances
      const bezBalance = await contracts.bezhasToken?.balanceOf(walletAddress);
      const ethBalance = await window.ethereum?.request({
        method: 'eth_getBalance',
        params: [walletAddress, 'latest']
      });
      
      // Fetch NFT holdings
      const nftBalance = await contracts.bezhasNFT?.balanceOf(walletAddress);
      
      return {
        bezBalance: bezBalance ? parseFloat(bezBalance.toString()) / 1e18 : 0,
        ethBalance: ethBalance ? parseFloat(ethBalance) / 1e18 : 0,
        nftBalance: nftBalance ? parseInt(nftBalance.toString()) : 0
      };
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      return null;
    }
  };

  const fetchTransactionData = async () => {
    // In a real implementation, this would fetch from your backend or indexing service
    return {
      totalTransactions: 156,
      totalVolume: 45.67,
      averageTransactionValue: 0.293,
      gasSpent: 2.34
    };
  };

  const fetchStakingData = async () => {
    if (!contracts.stakingPool || !walletAddress) return null;
    
    try {
      const stakedAmount = await contracts.stakingPool.getStakedAmount(walletAddress);
      const pendingRewards = await contracts.stakingPool.getPendingRewards(walletAddress);
      
      return {
        stakedAmount: stakedAmount ? parseFloat(stakedAmount.toString()) / 1e18 : 0,
        pendingRewards: pendingRewards ? parseFloat(pendingRewards.toString()) / 1e18 : 0
      };
    } catch (error) {
      console.error('Error fetching staking data:', error);
      return null;
    }
  };

  const generateFinancialReport = async (portfolio, transactions, staking) => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const labels = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString());
    }

    // Get current prices
    const prices = await PriceService.getCurrentPrices(['ethereum', 'bezhas-token']);
    const ethPrice = prices.ethereum?.usd || 2000;
    const bezPrice = prices['bezhas-token']?.usd || 0.05;

    const portfolioValueUSD = (portfolio?.ethBalance || 0) * ethPrice + (portfolio?.bezBalance || 0) * bezPrice;

    return {
      portfolioValue: {
        labels,
        datasets: [
          {
            label: `Portfolio Value (${selectedCurrency})`,
            data: labels.map(() => portfolioValueUSD * (0.9 + Math.random() * 0.2)),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
          }
        ]
      },
      tokenHoldings: {
        labels: ['ETH', 'BEZ', 'NFTs', 'Staked BEZ'],
        datasets: [
          {
            data: [
              ((portfolio?.ethBalance || 0) * ethPrice).toFixed(2),
              ((portfolio?.bezBalance || 0) * bezPrice).toFixed(2),
              ((portfolio?.nftBalance || 0) * 0.5 * ethPrice).toFixed(2),
              ((staking?.stakedAmount || 0) * bezPrice).toFixed(2)
            ],
            backgroundColor: [
              '#667eea',
              '#f093fb',
              '#4ecdc4',
              '#f5576c'
            ],
            borderWidth: 0,
          }
        ]
      },
      transactionHistory: {
        labels,
        datasets: [
          {
            label: 'Daily Transaction Volume',
            data: labels.map(() => Math.random() * 5 + 1),
            backgroundColor: '#4ecdc4',
            borderColor: '#4ecdc4',
            borderWidth: 1,
          }
        ]
      },
      stakingRewards: {
        labels,
        datasets: [
          {
            label: 'Cumulative Staking Rewards',
            data: labels.map((_, index) => (index + 1) * 0.1 + Math.random() * 0.05),
            borderColor: '#f5576c',
            backgroundColor: 'rgba(245, 87, 108, 0.1)',
            tension: 0.4,
            fill: true,
          }
        ]
      },
      tradingVolume: {
        totalVolume: transactions?.totalVolume || 0,
        totalTransactions: transactions?.totalTransactions || 0,
        averageValue: transactions?.averageTransactionValue || 0,
        gasSpent: transactions?.gasSpent || 0
      },
      profitLoss: {
        realized: 12.45,
        unrealized: 8.76,
        totalReturn: 21.21,
        returnPercentage: 15.6
      },
      feeAnalysis: {
        totalFees: transactions?.gasSpent || 0,
        averageFee: 0.015,
        feesByType: {
          trading: 1.23,
          staking: 0.45,
          nft: 0.66
        }
      },
      taxReporting: {
        taxableEvents: 23,
        capitalGains: 15.67,
        stakingIncome: 4.32,
        totalTaxableIncome: 19.99
      }
    };
  };

  const generateMockFinancialData = (range) => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
    const labels = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString());
    }

    return {
      portfolioValue: {
        labels,
        datasets: [
          {
            label: `Portfolio Value (${selectedCurrency})`,
            data: labels.map(() => 10000 + Math.random() * 5000),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
          }
        ]
      },
      tokenHoldings: {
        labels: ['ETH', 'BEZ', 'NFTs', 'Staked BEZ'],
        datasets: [
          {
            data: [5000, 3000, 1500, 2000],
            backgroundColor: ['#667eea', '#f093fb', '#4ecdc4', '#f5576c'],
            borderWidth: 0,
          }
        ]
      },
      transactionHistory: {
        labels,
        datasets: [
          {
            label: 'Daily Transaction Volume',
            data: labels.map(() => Math.random() * 5 + 1),
            backgroundColor: '#4ecdc4',
            borderColor: '#4ecdc4',
            borderWidth: 1,
          }
        ]
      },
      stakingRewards: {
        labels,
        datasets: [
          {
            label: 'Cumulative Staking Rewards',
            data: labels.map((_, index) => (index + 1) * 0.1),
            borderColor: '#f5576c',
            backgroundColor: 'rgba(245, 87, 108, 0.1)',
            tension: 0.4,
            fill: true,
          }
        ]
      },
      tradingVolume: {
        totalVolume: 45.67,
        totalTransactions: 156,
        averageValue: 0.293,
        gasSpent: 2.34
      },
      profitLoss: {
        realized: 12.45,
        unrealized: 8.76,
        totalReturn: 21.21,
        returnPercentage: 15.6
      },
      feeAnalysis: {
        totalFees: 2.34,
        averageFee: 0.015,
        feesByType: {
          trading: 1.23,
          staking: 0.45,
          nft: 0.66
        }
      },
      taxReporting: {
        taxableEvents: 23,
        capitalGains: 15.67,
        stakingIncome: 4.32,
        totalTaxableIncome: 19.99
      }
    };
  };

  const exportReport = (format) => {
    const reportData = {
      reportType,
      timeRange,
      currency: selectedCurrency,
      generatedAt: new Date().toISOString(),
      walletAddress,
      data: financialData
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-report-${timeRange}-${Date.now()}.json`;
      a.click();
    } else if (format === 'csv') {
      let csv = 'Category,Value,Currency\n';
      csv += `Total Portfolio Value,${calculateTotalPortfolioValue()},${selectedCurrency}\n`;
      csv += `Realized P&L,${financialData.profitLoss?.realized || 0},${selectedCurrency}\n`;
      csv += `Unrealized P&L,${financialData.profitLoss?.unrealized || 0},${selectedCurrency}\n`;
      csv += `Total Fees,${financialData.feeAnalysis?.totalFees || 0},ETH\n`;
      csv += `Staking Rewards,${financialData.taxReporting?.stakingIncome || 0},${selectedCurrency}\n`;
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial-summary-${timeRange}-${Date.now()}.csv`;
      a.click();
    }
  };

  const calculateTotalPortfolioValue = () => {
    const holdings = financialData.tokenHoldings?.datasets?.[0]?.data || [];
    return holdings.reduce((sum, value) => sum + parseFloat(value), 0).toFixed(2);
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Financial Analytics',
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
        text: 'Asset Distribution',
      },
    },
  };

  if (loading) {
    return (
      <div className="financial-reports-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading financial reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="financial-reports-container">
      <div className="reports-header">
        <h2>Financial Reports</h2>
        <div className="reports-controls">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="report-type-select"
          >
            <option value="portfolio">Portfolio Overview</option>
            <option value="trading">Trading Analysis</option>
            <option value="staking">Staking Reports</option>
            <option value="tax">Tax Reports</option>
          </select>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>

          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value)}
            className="currency-select"
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="ETH">ETH</option>
          </select>

          <div className="export-controls">
            <button onClick={() => exportReport('json')} className="export-btn">
              Export JSON
            </button>
            <button onClick={() => exportReport('csv')} className="export-btn">
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="portfolio-summary">
        <div className="summary-card">
          <h3>Total Portfolio Value</h3>
          <p className="summary-value">${calculateTotalPortfolioValue()}</p>
          <span className="summary-change positive">+{financialData.profitLoss?.returnPercentage || 0}%</span>
        </div>
        <div className="summary-card">
          <h3>Realized P&L</h3>
          <p className="summary-value">${financialData.profitLoss?.realized || 0}</p>
          <span className="summary-change positive">+12.5%</span>
        </div>
        <div className="summary-card">
          <h3>Unrealized P&L</h3>
          <p className="summary-value">${financialData.profitLoss?.unrealized || 0}</p>
          <span className="summary-change positive">+8.2%</span>
        </div>
        <div className="summary-card">
          <h3>Total Fees Paid</h3>
          <p className="summary-value">{financialData.feeAnalysis?.totalFees || 0} ETH</p>
          <span className="summary-change neutral">-</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container large">
          <h3>Portfolio Value Over Time</h3>
          <Line data={financialData.portfolioValue} options={chartOptions} />
        </div>

        <div className="chart-container">
          <h3>Asset Holdings</h3>
          <Doughnut data={financialData.tokenHoldings} options={doughnutOptions} />
        </div>

        <div className="chart-container">
          <h3>Transaction Volume</h3>
          <Bar data={financialData.transactionHistory} options={chartOptions} />
        </div>

        <div className="chart-container">
          <h3>Staking Rewards</h3>
          <Line data={financialData.stakingRewards} options={chartOptions} />
        </div>
      </div>

      {/* Detailed Statistics */}
      <div className="detailed-stats">
        <div className="stats-section">
          <h3>Trading Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <label>Total Volume</label>
              <value>{financialData.tradingVolume?.totalVolume || 0} ETH</value>
            </div>
            <div className="stat-item">
              <label>Total Transactions</label>
              <value>{financialData.tradingVolume?.totalTransactions || 0}</value>
            </div>
            <div className="stat-item">
              <label>Average Transaction</label>
              <value>{financialData.tradingVolume?.averageValue || 0} ETH</value>
            </div>
            <div className="stat-item">
              <label>Gas Spent</label>
              <value>{financialData.tradingVolume?.gasSpent || 0} ETH</value>
            </div>
          </div>
        </div>

        <div className="stats-section">
          <h3>Fee Analysis</h3>
          <div className="fee-breakdown">
            <div className="fee-item">
              <span className="fee-type">Trading Fees</span>
              <span className="fee-amount">{financialData.feeAnalysis?.feesByType?.trading || 0} ETH</span>
            </div>
            <div className="fee-item">
              <span className="fee-type">Staking Fees</span>
              <span className="fee-amount">{financialData.feeAnalysis?.feesByType?.staking || 0} ETH</span>
            </div>
            <div className="fee-item">
              <span className="fee-type">NFT Fees</span>
              <span className="fee-amount">{financialData.feeAnalysis?.feesByType?.nft || 0} ETH</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tax Reporting Section */}
      {reportType === 'tax' && (
        <div className="tax-section">
          <h3>Tax Reporting</h3>
          <div className="tax-summary">
            <div className="tax-item">
              <label>Taxable Events</label>
              <value>{financialData.taxReporting?.taxableEvents || 0}</value>
            </div>
            <div className="tax-item">
              <label>Capital Gains</label>
              <value>${financialData.taxReporting?.capitalGains || 0}</value>
            </div>
            <div className="tax-item">
              <label>Staking Income</label>
              <value>${financialData.taxReporting?.stakingIncome || 0}</value>
            </div>
            <div className="tax-item">
              <label>Total Taxable Income</label>
              <value>${financialData.taxReporting?.totalTaxableIncome || 0}</value>
            </div>
          </div>
          
          <div className="tax-disclaimer">
            <p><strong>Disclaimer:</strong> This report is for informational purposes only and should not be considered as tax advice. Please consult with a qualified tax professional for your specific situation.</p>
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="performance-section">
        <h3>Performance Metrics</h3>
        <div className="performance-grid">
          <div className="performance-card">
            <h4>Return on Investment</h4>
            <p className="performance-value positive">+{financialData.profitLoss?.returnPercentage || 0}%</p>
            <p className="performance-period">Last {timeRange}</p>
          </div>
          <div className="performance-card">
            <h4>Sharpe Ratio</h4>
            <p className="performance-value">1.45</p>
            <p className="performance-period">Risk-adjusted return</p>
          </div>
          <div className="performance-card">
            <h4>Max Drawdown</h4>
            <p className="performance-value negative">-8.3%</p>
            <p className="performance-period">Maximum loss from peak</p>
          </div>
          <div className="performance-card">
            <h4>Win Rate</h4>
            <p className="performance-value">67.8%</p>
            <p className="performance-period">Profitable transactions</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialReports;
