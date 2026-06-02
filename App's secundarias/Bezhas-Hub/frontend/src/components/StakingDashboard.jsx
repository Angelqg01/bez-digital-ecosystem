import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { ethers } from 'ethers';

const StakingDashboard = ({
  userAddress,
  stakingPoolContract,
  liquidityFarmingContract,
  governanceContract,
  bezTokenContract,
  websocket
}) => {
  const [activeTab, setActiveTab] = useState('staking');
  const [stakingData, setStakingData] = useState({
    userStakes: [],
    totalStaked: '0',
    totalRewards: '0',
    availableBalance: '0'
  });
  const [farmingData, setFarmingData] = useState({
    pools: [],
    userPositions: []
  });
  const [governanceData, setGovernanceData] = useState({
    proposals: [],
    votingPower: '0'
  });
  const [stakeForm, setStakeForm] = useState({
    amount: '',
    duration: '30'
  });
  const [loading, setLoading] = useState(false);

  const stakeDurations = [
    { value: '7', label: '1 Week (1x)', multiplier: '1.0x' },
    { value: '30', label: '1 Month (1.2x)', multiplier: '1.2x' },
    { value: '90', label: '3 Months (1.5x)', multiplier: '1.5x' },
    { value: '180', label: '6 Months (2x)', multiplier: '2.0x' },
    { value: '365', label: '1 Year (3x)', multiplier: '3.0x' }
  ];

  useEffect(() => {
    if (userAddress) {
      loadStakingData();
      loadFarmingData();
      loadGovernanceData();
    }
  }, [userAddress]);

  const loadStakingData = async () => {
    try {
      if (stakingPoolContract && bezTokenContract) {
        // Get user stakes
        const stakes = await stakingPoolContract.getUserStakes(userAddress);
        const formattedStakes = stakes.stakeIds.map((id, index) => ({
          id: id.toString(),
          amount: ethers.formatEther(stakes.amounts[index]),
          startTime: new Date(stakes.startTimes[index] * 1000),
          duration: stakes.durations[index].toString(),
          rewards: ethers.formatEther(stakes.rewards[index]),
          isActive: stakes.isActive[index]
        }));

        // Get user balance
        const balance = await bezTokenContract.balanceOf(userAddress);

        setStakingData({
          userStakes: formattedStakes,
          totalStaked: formattedStakes.reduce((sum, stake) =>
            sum + (stake.isActive ? parseFloat(stake.amount) : 0), 0).toString(),
          totalRewards: formattedStakes.reduce((sum, stake) =>
            sum + parseFloat(stake.rewards), 0).toString(),
          availableBalance: ethers.formatEther(balance)
        });
      }
    } catch (error) {
      console.error('Error loading staking data:', error);
    }
  };

  const loadFarmingData = async () => {
    try {
      if (liquidityFarmingContract) {
        const poolLength = await liquidityFarmingContract.poolLength();
        const pools = [];

        for (let i = 0; i < poolLength; i++) {
          const poolInfo = await liquidityFarmingContract.getPoolInfo(i);
          const userInfo = await liquidityFarmingContract.getUserInfo(i, userAddress);
          const pendingReward = await liquidityFarmingContract.pendingReward(i, userAddress);

          pools.push({
            id: i,
            lpToken: poolInfo.lpToken,
            allocPoint: poolInfo.allocPoint.toString(),
            totalStaked: ethers.formatEther(poolInfo.totalStaked),
            isActive: poolInfo.isActive,
            userAmount: ethers.formatEther(userInfo.amount),
            pendingReward: ethers.formatEther(pendingReward),
            lockEndTime: new Date(userInfo.lockEndTime * 1000)
          });
        }

        setFarmingData({ pools, userPositions: pools.filter(p => parseFloat(p.userAmount) > 0) });
      }
    } catch (error) {
      console.error('Error loading farming data:', error);
    }
  };

  const loadGovernanceData = async () => {
    try {
      if (governanceContract) {
        const proposalCount = await governanceContract.proposalCount();
        const votingPower = await governanceContract.getVotingPower(userAddress);
        const proposals = [];

        for (let i = 0; i < Math.min(proposalCount, 10); i++) {
          const proposal = await governanceContract.getProposalDetails(i);
          const state = await governanceContract.getProposalState(i);
          const votes = await governanceContract.getProposalVotes(i);

          proposals.push({
            id: i,
            title: proposal.title,
            description: proposal.description,
            proposer: proposal.proposer,
            startTime: new Date(proposal.startTime * 1000),
            endTime: new Date(proposal.endTime * 1000),
            state: state,
            forVotes: ethers.formatEther(votes.forVotes),
            againstVotes: ethers.formatEther(votes.againstVotes),
            abstainVotes: ethers.formatEther(votes.abstainVotes)
          });
        }

        setGovernanceData({
          proposals: proposals.reverse(),
          votingPower: ethers.formatEther(votingPower)
        });
      }
    } catch (error) {
      console.error('Error loading governance data:', error);
    }
  };

  const handleStake = async () => {
    if (!stakeForm.amount || !stakingPoolContract) return;

    try {
      setLoading(true);

      // First approve tokens
      const amount = ethers.parseEther(stakeForm.amount);
      const duration = parseInt(stakeForm.duration) * 24 * 60 * 60; // Convert days to seconds

      const approveTx = await bezTokenContract.approve(
        await stakingPoolContract.getAddress(),
        amount
      );
      await approveTx.wait();

      // Then stake
      const stakeTx = await stakingPoolContract.stake(amount, duration);
      await stakeTx.wait();

      toast.success('Staked successfully!');
      setStakeForm({ amount: '', duration: '30' });
      loadStakingData();
    } catch (error) {
      console.error('Error staking:', error);
      toast.error(`Error staking tokens: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async (stakeId) => {
    try {
      setLoading(true);
      const tx = await stakingPoolContract.unstake(stakeId);
      await tx.wait();
      toast.success('Emergency withdrawal successful!');
      loadStakingData();
    } catch (error) {
      console.error('Error unstaking:', error);
      toast.error(`Error unstaking tokens: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimRewards = async (stakeId) => {
    try {
      setLoading(true);
      const tx = await stakingPoolContract.claimRewards(stakeId);
      await tx.wait();
      toast.success('Rewards claimed successfully!');
      loadStakingData();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error(`Error claiming rewards: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (proposalId, voteType) => {
    try {
      setLoading(true);
      const tx = await governanceContract.vote(proposalId, voteType);
      await tx.wait();
      toast.success('Vote cast successfully!');
      loadGovernanceData();
    } catch (error) {
      console.error('Error voting:', error);
      toast.error(`Error casting vote: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderStaking = () => (
    <div className="staking-section">
      <div className="staking-overview">
        <div className="overview-cards">
          <div className="overview-card">
            <h3>Available Balance</h3>
            <div className="card-value">{parseFloat(stakingData.availableBalance).toFixed(2)} BEZ</div>
          </div>
          <div className="overview-card">
            <h3>Total Staked</h3>
            <div className="card-value">{parseFloat(stakingData.totalStaked).toFixed(2)} BEZ</div>
          </div>
          <div className="overview-card">
            <h3>Total Rewards</h3>
            <div className="card-value">{parseFloat(stakingData.totalRewards).toFixed(4)} BEZ</div>
          </div>
        </div>
      </div>

      <div className="staking-form">
        <h3>Stake BEZ Tokens</h3>
        <div className="form-group">
          <label>Amount to Stake</label>
          <input
            type="number"
            placeholder="Enter amount"
            value={stakeForm.amount}
            onChange={(e) => setStakeForm(prev => ({ ...prev, amount: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label>Staking Duration</label>
          <select
            value={stakeForm.duration}
            onChange={(e) => setStakeForm(prev => ({ ...prev, duration: e.target.value }))}
          >
            {stakeDurations.map(duration => (
              <option key={duration.value} value={duration.value}>
                {duration.label}
              </option>
            ))}
          </select>
        </div>
        <button
          className="stake-button"
          onClick={handleStake}
          disabled={loading || !stakeForm.amount}
        >
          {loading ? 'Staking...' : 'Stake Tokens'}
        </button>
      </div>

      <div className="user-stakes">
        <h3>Your Stakes</h3>
        <div className="stakes-list">
          {stakingData.userStakes.map(stake => (
            <div key={stake.id} className="stake-item">
              <div className="stake-info">
                <div className="stake-amount">{parseFloat(stake.amount).toFixed(2)} BEZ</div>
                <div className="stake-duration">{Math.floor(stake.duration / (24 * 60 * 60))} days</div>
                <div className="stake-rewards">{parseFloat(stake.rewards).toFixed(4)} BEZ rewards</div>
                <div className="stake-status">
                  {stake.isActive ? 'Active' : 'Completed'}
                </div>
              </div>
              <div className="stake-actions">
                {stake.isActive && (
                  <>
                    <button onClick={() => handleClaimRewards(stake.id)}>
                      Claim Rewards
                    </button>
                    <button onClick={() => handleUnstake(stake.id)}>
                      Unstake
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFarming = () => (
    <div className="farming-section">
      <h3>Liquidity Farming Pools</h3>
      <div className="pools-grid">
        {farmingData.pools.map(pool => (
          <div key={pool.id} className="pool-card">
            <div className="pool-header">
              <h4>Pool #{pool.id}</h4>
              <div className={`pool-status ${pool.isActive ? 'active' : 'inactive'}`}>
                {pool.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            <div className="pool-stats">
              <div className="stat">
                <span>Total Staked:</span>
                <span>{parseFloat(pool.totalStaked).toFixed(2)} LP</span>
              </div>
              <div className="stat">
                <span>Your Position:</span>
                <span>{parseFloat(pool.userAmount).toFixed(4)} LP</span>
              </div>
              <div className="stat">
                <span>Pending Rewards:</span>
                <span>{parseFloat(pool.pendingReward).toFixed(4)} BEZ</span>
              </div>
            </div>
            {parseFloat(pool.userAmount) > 0 && (
              <div className="pool-actions">
                <button>Claim Rewards</button>
                <button>Withdraw</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const renderGovernance = () => (
    <div className="governance-section">
      <div className="governance-overview">
        <div className="voting-power">
          <h3>Your Voting Power</h3>
          <div className="power-value">{parseFloat(governanceData.votingPower).toFixed(2)} BEZ</div>
        </div>
      </div>

      <div className="proposals-list">
        <h3>Active Proposals</h3>
        {governanceData.proposals.map(proposal => (
          <div key={proposal.id} className="proposal-card">
            <div className="proposal-header">
              <h4>{proposal.title}</h4>
              <div className="proposal-state">{proposal.state}</div>
            </div>
            <div className="proposal-description">
              {proposal.description}
            </div>
            <div className="proposal-stats">
              <div className="vote-stat">
                <span>For: {parseFloat(proposal.forVotes).toFixed(2)} BEZ</span>
              </div>
              <div className="vote-stat">
                <span>Against: {parseFloat(proposal.againstVotes).toFixed(2)} BEZ</span>
              </div>
              <div className="vote-stat">
                <span>Abstain: {parseFloat(proposal.abstainVotes).toFixed(2)} BEZ</span>
              </div>
            </div>
            <div className="proposal-actions">
              <button onClick={() => handleVote(proposal.id, 1)}>Vote For</button>
              <button onClick={() => handleVote(proposal.id, 0)}>Vote Against</button>
              <button onClick={() => handleVote(proposal.id, 2)}>Abstain</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderEarnings = () => (
    <div className="earnings-section">
      <h3>Earnings Overview</h3>
      <div className="earnings-summary">
        <div className="earnings-card">
          <h4>Staking Rewards</h4>
          <div className="earnings-value">{stakingData.totalRewards} BEZ</div>
          <div className="earnings-period">All Time</div>
        </div>
        <div className="earnings-card">
          <h4>Farming Rewards</h4>
          <div className="earnings-value">
            {farmingData.userPositions.reduce((sum, pos) =>
              sum + parseFloat(pos.pendingReward), 0).toFixed(4)} BEZ
          </div>
          <div className="earnings-period">Pending</div>
        </div>
        <div className="earnings-card">
          <h4>Total Earnings</h4>
          <div className="earnings-value">
            {(parseFloat(stakingData.totalRewards) +
              farmingData.userPositions.reduce((sum, pos) =>
                sum + parseFloat(pos.pendingReward), 0)).toFixed(4)} BEZ
          </div>
          <div className="earnings-period">All Time + Pending</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="staking-dashboard">
      <div className="dashboard-header">
        <h2>DeFi Dashboard</h2>
        <div className="dashboard-tabs">
          <button
            className={activeTab === 'staking' ? 'active' : ''}
            onClick={() => setActiveTab('staking')}
          >
            Staking
          </button>
          <button
            className={activeTab === 'farming' ? 'active' : ''}
            onClick={() => setActiveTab('farming')}
          >
            Farming
          </button>
          <button
            className={activeTab === 'governance' ? 'active' : ''}
            onClick={() => setActiveTab('governance')}
          >
            Governance
          </button>
          <button
            className={activeTab === 'earnings' ? 'active' : ''}
            onClick={() => setActiveTab('earnings')}
          >
            Earnings
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {loading && <div className="loading-overlay">Loading...</div>}
        {activeTab === 'staking' && renderStaking()}
        {activeTab === 'farming' && renderFarming()}
        {activeTab === 'governance' && renderGovernance()}
        {activeTab === 'earnings' && renderEarnings()}
      </div>
    </div>
  );
};


export default StakingDashboard;
