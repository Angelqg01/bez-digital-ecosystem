import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useWeb3 } from '../../../context/Web3Context';
import { Wallet, TrendingUp, Gift } from 'lucide-react';
import useUserStore from '../../../stores/userStore';

const MetricCard = ({ icon, title, value, link, isLoading }) => (
  <Link to={link} className="bg-dark-surface dark:bg-light-surface p-6 rounded-2xl flex-1 hover:shadow-lg transition-shadow duration-300">
    <div className="flex items-start justify-between">
      <div className="flex items-center justify-center bg-dark-primary/10 dark:bg-light-primary/10 p-3 rounded-xl">
        {icon}
      </div>
    </div>
    <div className="mt-4">
      <p className="text-sm text-dark-text-muted dark:text-light-text-muted">{title}</p>
      {isLoading ? (
        <div className="h-8 w-3/4 bg-dark-background/50 dark:bg-light-background/50 rounded-md animate-pulse mt-1"></div>
      ) : (
        <p className="text-2xl font-bold text-dark-text dark:text-light-text truncate">{value}</p>
      )}
    </div>
  </Link>
);

const KeyMetricsWidget = () => {
  const { stakingPool, bezhasToken, isConnected, address } = useWeb3();
  const { tokenBalance } = useUserStore();
  const [metrics, setMetrics] = useState({
    stakedBalance: '0',
    rewards: '0',
    bezBalance: '0',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!isConnected || !stakingPool || !bezhasToken || !address) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [staked, rewards] = await Promise.all([
          stakingPool.stakedBalance(address),
          stakingPool.earned(address),
        ]);
        
        setMetrics({
          stakedBalance: parseFloat(ethers.formatEther(staked)).toFixed(4),
          rewards: parseFloat(ethers.formatEther(rewards)).toFixed(4),
          bezBalance: parseFloat(tokenBalance).toFixed(4),
        });
      } catch (error) {
        console.error('Error al obtener las métricas clave:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [isConnected, stakingPool, bezhasToken, address, tokenBalance]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <MetricCard
        icon={<Wallet className="w-6 h-6 text-dark-primary dark:text-light-primary" />}
        title="Saldo BEZ"
        value={`${metrics.bezBalance} BEZ`}
        link="/wallet"
        isLoading={isLoading}
      />
      <MetricCard
        icon={<TrendingUp className="w-6 h-6 text-dark-primary dark:text-light-primary" />}
        title="En Staking"
        value={`${metrics.stakedBalance} BEZ`}
        link="/staking"
        isLoading={isLoading}
      />
      <MetricCard
        icon={<Gift className="w-6 h-6 text-dark-primary dark:text-light-primary" />}
        title="Recompensas"
        value={`${metrics.rewards} BEZ`}
        link="/rewards"
        isLoading={isLoading}
      />
    </div>
  );
};

export default KeyMetricsWidget;
