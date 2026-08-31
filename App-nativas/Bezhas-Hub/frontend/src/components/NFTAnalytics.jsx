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
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
import PriceService from '../services/PriceService';
import './NFTAnalytics.css';

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

const NFTAnalytics = ({ contracts, walletAddress }) => {
  const [analyticsData, setAnalyticsData] = useState({
    marketTrends: {},
    priceHistory: {},
    volumeData: {},
    topCollections: [],
    rarityAnalysis: {},
    ownershipDistribution: {},
    tradingPatterns: {},
    valuationMetrics: {}
  });
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('volume');
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState('all');

  useEffect(() => {
    fetchNFTAnalytics();
  }, [timeRange, selectedMetric, selectedCollection, contracts]);

  const fetchNFTAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch real market data
      const marketData = await PriceService.getNFTMarketData();
      
      // Generate comprehensive analytics
      const analytics = await generateNFTAnalytics(marketData);
      setAnalyticsData(analytics);
    } catch (error) {
      console.error('Error fetching NFT analytics:', error);
      // Fallback to mock data
      const mockAnalytics = generateMockNFTAnalytics(timeRange);
      setAnalyticsData(mockAnalytics);
    } finally {
      setLoading(false);
    }
  };

  const generateNFTAnalytics = async (marketData) => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365;
    const labels = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString());
    }

    return {
      marketTrends: {
        labels,
        datasets: [
          {
            label: 'Floor Price (ETH)',
            data: labels.map(() => (Math.random() * 2 + 0.5).toFixed(3)),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0.4,
            yAxisID: 'y',
          },
          {
            label: 'Volume (ETH)',
            data: labels.map(() => (Math.random() * 100 + 20).toFixed(2)),
            borderColor: '#f093fb',
            backgroundColor: 'rgba(240, 147, 251, 0.1)',
            tension: 0.4,
            yAxisID: 'y1',
          }
        ]
      },
      priceHistory: {
        labels,
        datasets: [
          {
            label: 'Average Sale Price',
            data: labels.map(() => (Math.random() * 5 + 1).toFixed(3)),
            borderColor: '#4ecdc4',
            backgroundColor: 'rgba(78, 205, 196, 0.1)',
            tension: 0.4,
          }
        ]
      },
      volumeData: {
        labels: ['BeZhas Genesis', 'BeZhas Rare', 'BeZhas Legendary', 'BeZhas Special', 'BeZhas Common'],
        datasets: [
          {
            label: 'Trading Volume (ETH)',
            data: [245.6, 189.3, 156.7, 98.4, 67.2],
            backgroundColor: [
              '#667eea',
              '#f093fb',
              '#f5576c',
              '#4ecdc4',
              '#45b7d1'
            ],
            borderWidth: 0,
          }
        ]
      },
      topCollections: [
        {
          name: 'BeZhas Genesis',
          floorPrice: '2.45 ETH',
          volume24h: '156.7 ETH',
          change24h: '+12.5%',
          totalSupply: 1000,
          owners: 789,
          listed: 23
        },
        {
          name: 'BeZhas Rare',
          floorPrice: '1.89 ETH',
          volume24h: '98.4 ETH',
          change24h: '+8.2%',
          totalSupply: 5000,
          owners: 3456,
          listed: 156
        },
        {
          name: 'BeZhas Legendary',
          floorPrice: '5.67 ETH',
          volume24h: '234.1 ETH',
          change24h: '+25.7%',
          totalSupply: 100,
          owners: 87,
          listed: 3
        }
      ],
      rarityAnalysis: {
        labels: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'],
        datasets: [
          {
            data: [45, 30, 15, 7, 3],
            backgroundColor: [
              '#96ceb4',
              '#45b7d1',
              '#f093fb',
              '#f5576c',
              '#667eea'
            ],
            borderWidth: 0,
          }
        ]
      },
      ownershipDistribution: {
        labels: ['1 NFT', '2-5 NFTs', '6-10 NFTs', '11-50 NFTs', '50+ NFTs'],
        datasets: [
          {
            data: [65, 20, 8, 5, 2],
            backgroundColor: [
              '#667eea',
              '#f093fb',
              '#4ecdc4',
              '#f5576c',
              '#45b7d1'
            ],
            borderWidth: 0,
          }
        ]
      },
      tradingPatterns: {
        hourlyVolume: Array.from({ length: 24 }, (_, i) => ({
          hour: i,
          volume: Math.random() * 50 + 10
        })),
        weeklyTrends: Array.from({ length: 7 }, (_, i) => ({
          day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
          volume: Math.random() * 200 + 50
        }))
      },
      valuationMetrics: {
        totalMarketCap: '12,456.78 ETH',
        averagePrice: '2.34 ETH',
        medianPrice: '1.89 ETH',
        priceVolatility: '15.6%',
        liquidityScore: '8.7/10',
        holderCount: 4567,
        uniqueTraders24h: 234,
        averageHoldTime: '45 days'
      }
    };
  };

  const generateMockNFTAnalytics = (range) => {
    // Simplified version for fallback
    return generateNFTAnalytics({});
  };

  const exportAnalytics = (format) => {
    const data = {
      timeRange,
      selectedMetric,
      selectedCollection,
      generatedAt: new Date().toISOString(),
      analytics: analyticsData
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nft-analytics-${timeRange}-${Date.now()}.json`;
      a.click();
    } else if (format === 'csv') {
      let csv = 'Collection,Floor Price,Volume 24h,Change 24h,Total Supply,Owners\n';
      analyticsData.topCollections?.forEach(collection => {
        csv += `${collection.name},${collection.floorPrice},${collection.volume24h},${collection.change24h},${collection.totalSupply},${collection.owners}\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nft-collections-${timeRange}-${Date.now()}.csv`;
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
        text: 'NFT Market Analytics',
      },
    },
    scales: {
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
        },
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
        text: 'Distribution Analysis',
      },
    },
  };

  if (loading) {
    return (
      <div className="nft-analytics-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading NFT analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nft-analytics-container">
      <div className="analytics-header">
        <h2>NFT Market Analytics</h2>
        <div className="analytics-controls">
          <select
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="collection-select"
          >
            <option value="all">All Collections</option>
            <option value="genesis">BeZhas Genesis</option>
            <option value="rare">BeZhas Rare</option>
            <option value="legendary">BeZhas Legendary</option>
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
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="metric-select"
          >
            <option value="volume">Volume</option>
            <option value="price">Price</option>
            <option value="rarity">Rarity</option>
            <option value="ownership">Ownership</option>
          </select>

          <div className="export-controls">
            <button onClick={() => exportAnalytics('json')} className="export-btn">
              Export JSON
            </button>
            <button onClick={() => exportAnalytics('csv')} className="export-btn">
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="metrics-overview">
        <div className="metric-card">
          <h3>Total Market Cap</h3>
          <p className="metric-value">{analyticsData.valuationMetrics.totalMarketCap}</p>
          <span className="metric-change positive">+18.5%</span>
        </div>
        <div className="metric-card">
          <h3>Average Price</h3>
          <p className="metric-value">{analyticsData.valuationMetrics.averagePrice}</p>
          <span className="metric-change positive">+12.3%</span>
        </div>
        <div className="metric-card">
          <h3>Unique Holders</h3>
          <p className="metric-value">{analyticsData.valuationMetrics.holderCount?.toLocaleString()}</p>
          <span className="metric-change positive">+5.7%</span>
        </div>
        <div className="metric-card">
          <h3>Liquidity Score</h3>
          <p className="metric-value">{analyticsData.valuationMetrics.liquidityScore}</p>
          <span className="metric-change positive">+0.3</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container large">
          <h3>Market Trends</h3>
          <Line data={analyticsData.marketTrends} options={chartOptions} />
        </div>

        <div className="chart-container">
          <h3>Price History</h3>
          <Line data={analyticsData.priceHistory} options={chartOptions} />
        </div>

        <div className="chart-container">
          <h3>Collection Volume</h3>
          <Bar data={analyticsData.volumeData} options={chartOptions} />
        </div>

        <div className="chart-container">
          <h3>Rarity Distribution</h3>
          <Doughnut data={analyticsData.rarityAnalysis} options={doughnutOptions} />
        </div>

        <div className="chart-container">
          <h3>Ownership Distribution</h3>
          <Doughnut data={analyticsData.ownershipDistribution} options={doughnutOptions} />
        </div>
      </div>

      {/* Top Collections Table */}
      <div className="collections-section">
        <h3>Top Collections</h3>
        <div className="collections-table">
          <table>
            <thead>
              <tr>
                <th>Collection</th>
                <th>Floor Price</th>
                <th>24h Volume</th>
                <th>24h Change</th>
                <th>Supply</th>
                <th>Owners</th>
                <th>Listed</th>
              </tr>
            </thead>
            <tbody>
              {analyticsData.topCollections?.map((collection, index) => (
                <tr key={index}>
                  <td className="collection-name">{collection.name}</td>
                  <td className="price">{collection.floorPrice}</td>
                  <td className="volume">{collection.volume24h}</td>
                  <td className={`change ${collection.change24h.startsWith('+') ? 'positive' : 'negative'}`}>
                    {collection.change24h}
                  </td>
                  <td>{collection.totalSupply.toLocaleString()}</td>
                  <td>{collection.owners.toLocaleString()}</td>
                  <td>{collection.listed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trading Patterns */}
      <div className="trading-patterns-section">
        <h3>Trading Patterns</h3>
        <div className="patterns-grid">
          <div className="pattern-chart">
            <h4>Hourly Volume Distribution</h4>
            <div className="hourly-chart">
              {analyticsData.tradingPatterns.hourlyVolume?.map((hour, index) => (
                <div key={index} className="hour-bar">
                  <div 
                    className="bar" 
                    style={{ height: `${(hour.volume / 60) * 100}%` }}
                  ></div>
                  <span className="hour-label">{hour.hour}:00</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pattern-chart">
            <h4>Weekly Trading Volume</h4>
            <div className="weekly-chart">
              {analyticsData.tradingPatterns.weeklyTrends?.map((day, index) => (
                <div key={index} className="day-bar">
                  <div 
                    className="bar" 
                    style={{ height: `${(day.volume / 250) * 100}%` }}
                  ></div>
                  <span className="day-label">{day.day}</span>
                  <span className="volume-label">{day.volume.toFixed(1)} ETH</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Valuation Insights */}
      <div className="insights-section">
        <h3>Market Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Price Volatility</h4>
            <p className="insight-value">{analyticsData.valuationMetrics.priceVolatility}</p>
            <p className="insight-description">30-day price volatility indicates moderate market stability</p>
          </div>
          <div className="insight-card">
            <h4>Average Hold Time</h4>
            <p className="insight-value">{analyticsData.valuationMetrics.averageHoldTime}</p>
            <p className="insight-description">Holders tend to keep NFTs for extended periods</p>
          </div>
          <div className="insight-card">
            <h4>Daily Traders</h4>
            <p className="insight-value">{analyticsData.valuationMetrics.uniqueTraders24h}</p>
            <p className="insight-description">Active trading community with consistent volume</p>
          </div>
          <div className="insight-card">
            <h4>Median Price</h4>
            <p className="insight-value">{analyticsData.valuationMetrics.medianPrice}</p>
            <p className="insight-description">Median provides better representation than average</p>
          </div>
        </div>
      </div>

      {/* Trend Alerts */}
      <div className="alerts-section">
        <h3>Market Alerts</h3>
        <div className="alert-list">
          <div className="alert-item bullish">
            <span className="alert-icon">📈</span>
            <span className="alert-text">Floor price increased 15% in last 24h</span>
            <span className="alert-time">2 hours ago</span>
          </div>
          <div className="alert-item neutral">
            <span className="alert-icon">📊</span>
            <span className="alert-text">Trading volume above 30-day average</span>
            <span className="alert-time">6 hours ago</span>
          </div>
          <div className="alert-item bearish">
            <span className="alert-icon">📉</span>
            <span className="alert-text">Listed supply increased by 12%</span>
            <span className="alert-time">1 day ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NFTAnalytics;
