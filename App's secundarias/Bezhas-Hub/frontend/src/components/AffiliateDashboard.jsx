import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import http from '../services/http';

// Simulated API client. In a real app, this would be in a separate api.js file.
const apiClient = {
  getAffiliateData: async (walletAddress) => {
    // This simulates the auth middleware where we pass the user identifier.
    const response = await http.get('/api/affiliate/me', {
      headers: {
        'x-wallet-address': walletAddress
      }
    });
    if (response.status !== 200) {
      throw new Error('Failed to fetch affiliate data');
    }
    return response.data;
  }
};

const AffiliateDashboard = ({ walletAddress }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!walletAddress) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await apiClient.getAffiliateData(walletAddress);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [walletAddress]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Affiliate link copied to clipboard!');
    });
  };

  if (loading) {
    return <div>Loading Affiliate Dashboard...</div>;
  }

  if (error) {
    return <div style={{ color: 'red' }}>Error: {error}</div>;
  }

  if (!data) {
    return <div>No affiliate data available.</div>;
  }

  return (
    <div className="affiliate-dashboard-container section-card">
      <h2>Affiliate Dashboard</h2>

      <div className="referral-link-section">
        <h3>Your Referral Link</h3>
        <p>Share this link with your friends to earn Bez-Coin when they join!</p>
        <div className="referral-input-group">
          <input type="text" value={data.referralLink} readOnly />
          <button onClick={() => copyToClipboard(data.referralLink)}>Copy</button>
        </div>
      </div>

      <div className="stats-section">
        <h3>Your Stats</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Clicks</h4>
            <p>{data.stats.clicks}</p>
          </div>
          <div className="stat-card">
            <h4>Sign-ups</h4>
            <p>{data.stats.signups}</p>
          </div>
          <div className="stat-card">
            <h4>Total Earned (Coming Soon)</h4>
            <p>--</p>
          </div>
        </div>
      </div>

      <div className="rewards-history-section">
        <h3>Rewards History</h3>
        {data.rewardsHistory && data.rewardsHistory.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Event</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.rewardsHistory.map((reward, index) => (
                <tr key={index}>
                  <td>{new Date(reward.date).toLocaleDateString()}</td>
                  <td>{reward.event}</td>
                  <td>{reward.amount} Bez-Coin</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No rewards earned yet. Start sharing your link!</p>
        )}
      </div>
    </div>
  );
};

export default AffiliateDashboard;
