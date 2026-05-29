import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useConnect } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { toast } from 'react-hot-toast';
import { stakingAbi, tokenAbi, contractAddresses } from '../../lib/blockchain/contracts';
import { useBezCoin } from '../../context/BezCoinContext';
import { TrendingUp, DollarSign, Zap, Gift, Droplets, Lock, Waves, Flame } from 'lucide-react';
import { Spinner } from '../../components/ui/Spinner';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import GlobalStatsBar from '../../components/GlobalStatsBar';
import { useBezPay } from '../../hooks/useBezPay';

// Componente para una tarjeta de estadísticas
const StatCard = ({ icon, title, value, isLoading }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl shadow-sm">
    <div className="flex items-center gap-4">
      <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-xl">{icon}</div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
        {isLoading ? (
          <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse mt-1"></div>
        ) : (
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        )}
      </div>
    </div>
  </div>
);

// Componente de Pestañas
const TabButton = ({ active, onClick, icon, children }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${active
      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
      }`}
  >
    {icon}
    {children}
  </button>
);

// Tab: Simple Staking (Staking de BEZ tokens)
const SimpleStakingTab = ({ address, isConnected, balance, setShowBuyModal }) => {
  const { connect, connectors } = useConnect();
  const { openBuyBez } = useBezPay();
  const [amount, setAmount] = useState('');

  // Hooks de wagmi para leer datos del contrato con timeout
  const { data, isLoading: isLoadingStats, refetch } = useReadContracts({
    contracts: [
      { address: contractAddresses.stakingPool, abi: stakingAbi, functionName: 'totalStaked' },
      { address: contractAddresses.stakingPool, abi: stakingAbi, functionName: 'staked', args: [address] },
      { address: contractAddresses.stakingPool, abi: stakingAbi, functionName: 'earned', args: [address] },
      { address: contractAddresses.bezhasToken, abi: tokenAbi, functionName: 'allowance', args: [address, contractAddresses.stakingPool] },
    ],
    query: {
      enabled: !!isConnected && !!address,
      retry: 2,
      retryDelay: 1000,
      staleTime: 30000 // Cache de 30 segundos
    },
  });

  const [totalStaked, userStaked, rewardsEarned, allowance] = data?.map(d => d.result) || [];

  // Hooks de wagmi para escribir en el contrato
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash,
    onSuccess: () => {
      toast.success('Transacción completada con éxito');
      refetch();
      setAmount('');
    },
    onError: (err) => toast.error(`La transacción falló: ${err.shortMessage || err.message}`),
  });

  const isLoadingAction = isPending || isConfirming;

  const handleAction = useCallback(async (actionType) => {
    // 1. Conectar wallet si no está conectada
    if (!isConnected) {
      try {
        const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
        if (injectedConnector) {
          toast.loading('Conectando wallet...', { id: 'connect-wallet' });
          await connect({ connector: injectedConnector });
          toast.success('¡Wallet conectada!', { id: 'connect-wallet' });
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          toast.error('Por favor instala MetaMask u otra wallet Web3');
          return;
        }
      } catch (error) {
        console.error('Error connecting wallet:', error);
        toast.error('Error al conectar wallet. Intenta de nuevo.');
        return;
      }
    }

    if (actionType !== 'claim' && (!amount || parseFloat(amount) <= 0)) {
      return toast.error('Por favor, introduce una cantidad válida.');
    }

    const parsedAmount = actionType !== 'claim' ? parseEther(amount) : 0n;

    // 2. Verificar balance BEZ antes de hacer stake
    if (actionType === 'stake') {
      const currentBalance = parseFloat(balance || '0');
      const requiredAmount = parseFloat(amount);

      if (currentBalance < requiredAmount) {
        const deficit = requiredAmount - currentBalance;
        toast.error(`Balance insuficiente. Necesitas ${deficit.toFixed(2)} BEZ más.`, {
          duration: 5000,
          icon: '⚠️'
        });

        setShowBuyModal(true);
        openBuyBez();
        return;
      }
    }

    if (actionType === 'stake' && allowance < parsedAmount) {
      toast.info('Aprobando el token para staking...');
      writeContract({
        address: contractAddresses.bezhasToken,
        abi: tokenAbi,
        functionName: 'approve',
        args: [contractAddresses.stakingPool, parsedAmount]
      });
      return;
    }

    const functions = { stake: 'stake', unstake: 'unstake', claim: 'claimReward' };
    const args = actionType === 'claim' ? [] : [parsedAmount];

    writeContract({
      address: contractAddresses.stakingPool,
      abi: stakingAbi,
      functionName: functions[actionType],
      args
    });
  }, [isConnected, connectors, connect, amount, allowance, writeContract, balance, setShowBuyModal, openBuyBez]);

  return (
    <div className="space-y-8">
      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<DollarSign size={24} className="text-purple-600 dark:text-purple-400" />}
          title="Total en Staking"
          value={`${formatEther(totalStaked || 0n)} BEZ`}
          isLoading={isLoadingStats}
        />
        <StatCard
          icon={<Zap size={24} className="text-blue-600 dark:text-blue-400" />}
          title="APY Estimado"
          value="12.5%"
          isLoading={false}
        />
        <StatCard
          icon={<TrendingUp size={24} className="text-green-600 dark:text-green-400" />}
          title="Tu Staking"
          value={`${formatEther(userStaked || 0n)} BEZ`}
          isLoading={isLoadingStats}
        />
        <StatCard
          icon={<Gift size={24} className="text-pink-600 dark:text-pink-400" />}
          title="Recompensas"
          value={`${formatEther(rewardsEarned || 0n)} BEZ`}
          isLoading={isLoadingStats}
        />
      </div>

      {/* Panel de Acciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl space-y-4 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Gestionar Staking</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 pb-2">
            Introduce la cantidad de BEZ que quieres depositar o retirar.
          </p>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ej: 100.0"
            className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
          />
          <div className="flex gap-4">
            <button
              onClick={() => handleAction('stake')}
              disabled={isLoadingAction}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center shadow-md"
            >
              {isLoadingAction ? <Spinner size="sm" /> : !isConnected ? '🔗 Conectar & Stake' : 'Stake'}
            </button>
            <button
              onClick={() => handleAction('unstake')}
              disabled={isLoadingAction}
              className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex justify-center items-center"
            >
              {isLoadingAction ? <Spinner size="sm" /> : 'Unstake'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl space-y-4 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Reclamar Recompensas</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tus recompensas ganadas hasta ahora. ¡Reclámalas cuando quieras!
          </p>
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 py-4">
            {formatEther(rewardsEarned || 0n)} BEZ
          </div>
          <button
            onClick={() => handleAction('claim')}
            disabled={isLoadingAction}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center shadow-md"
          >
            {isLoadingAction ? <Spinner size="sm" /> : 'Reclamar'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Tab: Liquidity Farming (LP tokens)
const LiquidityFarmingTab = ({ farmingContract, lpTokenContract, user }) => {
  const [addLiquidityAmount, setAddLiquidityAmount] = useState('');
  const [removeLiquidityAmount, setRemoveLiquidityAmount] = useState('');
  const [stats, setStats] = useState({
    totalLiquidity: '0',
    apr: '45.5',
    userLiquidity: '0',
    rewardsEarned: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for display when contract not available
  const displayStats = useMemo(() =>
    farmingContract ? stats : {
      totalLiquidity: '2,500,000',
      apr: '45.5',
      userLiquidity: '0',
      rewardsEarned: 0
    }, [farmingContract, stats]
  );

  const handleAddLiquidity = useCallback(async () => {
    if (!farmingContract || !lpTokenContract || parseFloat(addLiquidityAmount) <= 0) {
      toast.error('Por favor, conecta tu wallet y verifica el contrato');
      return;
    }
    try {
      setIsLoading(true);
      const amountInWei = parseEther(addLiquidityAmount);
      const farmingContractAddress = await farmingContract.getAddress();

      // Approve spending LP tokens
      const approveTx = await lpTokenContract.approve(farmingContractAddress, amountInWei);
      await approveTx.wait();
      toast.success('Aprobación completada');

      // Deposit LP tokens
      const depositTx = await farmingContract.deposit(amountInWei);
      await depositTx.wait();
      toast.success('Liquidez añadida con éxito');

      setAddLiquidityAmount('');
    } catch (error) {
      console.error("Adding liquidity failed:", error);
      toast.error(`Error al añadir liquidez: ${error.reason || error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [farmingContract, lpTokenContract, addLiquidityAmount]);

  const handleRemoveLiquidity = useCallback(async () => {
    if (!farmingContract || parseFloat(removeLiquidityAmount) <= 0) {
      toast.error('Por favor, introduce una cantidad válida');
      return;
    }
    try {
      setIsLoading(true);
      const amountInWei = parseEther(removeLiquidityAmount);
      const withdrawTx = await farmingContract.withdraw(amountInWei);
      await withdrawTx.wait();
      toast.success('Liquidez retirada con éxito');
      setRemoveLiquidityAmount('');
    } catch (error) {
      console.error("Removing liquidity failed:", error);
      toast.error(`Error al retirar liquidez: ${error.reason || error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [farmingContract, removeLiquidityAmount]);

  const handleClaimRewards = useCallback(async () => {
    if (!farmingContract) {
      toast.error('Contrato no disponible');
      return;
    }
    try {
      setIsLoading(true);
      const claimTx = await farmingContract.claimReward();
      await claimTx.wait();
      toast.success('Recompensas reclamadas con éxito');
    } catch (error) {
      console.error("Failed to claim farming rewards:", error);
      toast.error(`Error al reclamar recompensas: ${error.reason || error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [farmingContract]);

  return (
    <div className="space-y-8">
      {/* Grid de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Droplets size={24} className="text-blue-600 dark:text-blue-400" />}
          title="Liquidez Total"
          value={`${displayStats.totalLiquidity} LP`}
          isLoading={false}
        />
        <StatCard
          icon={<Zap size={24} className="text-yellow-500 dark:text-yellow-400" />}
          title="APR Estimado"
          value={`${displayStats.apr}%`}
          isLoading={false}
        />
        <StatCard
          icon={<Waves size={24} className="text-cyan-600 dark:text-cyan-400" />}
          title="Tu Liquidez"
          value={`${displayStats.userLiquidity} LP`}
          isLoading={false}
        />
        <StatCard
          icon={<Gift size={24} className="text-pink-600 dark:text-pink-400" />}
          title="Recompensas"
          value={`${displayStats.rewardsEarned.toFixed(2)} BEZ`}
          isLoading={false}
        />
      </div>

      {/* Panel de Acciones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl shadow-sm">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Aportar Liquidez</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Añade LP tokens del par BEZ/ETH para empezar a ganar recompensas.
            </p>
            <div className="space-y-4">
              <input
                type="number"
                placeholder="Cantidad de LP Tokens"
                value={addLiquidityAmount}
                onChange={(e) => setAddLiquidityAmount(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
              />
              <Button
                variant="primary"
                onClick={handleAddLiquidity}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center shadow-md"
              >
                {isLoading ? <Spinner size="sm" /> : 'Aportar'}
              </Button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl shadow-sm">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Retirar Liquidez</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Retira tus LP tokens cuando lo desees.
            </p>
            <div className="space-y-4">
              <input
                type="number"
                placeholder="Cantidad de LP Tokens"
                value={removeLiquidityAmount}
                onChange={(e) => setRemoveLiquidityAmount(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
              />
              <Button
                variant="secondary"
                onClick={handleRemoveLiquidity}
                disabled={isLoading}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white font-semibold py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex justify-center items-center"
              >
                {isLoading ? <Spinner size="sm" /> : 'Retirar'}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-2xl shadow-sm">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Tus Recompensas de Farming</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  LP Tokens en Farming
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {displayStats.userLiquidity} LP
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Recompensas Ganadas
                </div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {displayStats.rewardsEarned.toFixed(2)} BEZ
                </div>
              </div>
              <Button
                variant="primary"
                onClick={handleClaimRewards}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex justify-center items-center shadow-md"
              >
                <Gift size={16} className="mr-2" />
                {isLoading ? <Spinner size="sm" /> : 'Reclamar Recompensas'}
              </Button>
            </div>
          </div>

          {/* Removed RelatedQuests component */}
        </div>
      </div>
    </div>
  );
};

// Componente Principal Unificado
const StakingPageUnifiedV2 = ({ farmingContract, lpTokenContract }) => {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  // Manejo seguro del contexto BezCoin
  let balance, showBuyModal, setShowBuyModal;
  try {
    const bezCoinContext = useBezCoin();
    balance = bezCoinContext?.balance || '0';
    showBuyModal = bezCoinContext?.showBuyModal || false;
    setShowBuyModal = bezCoinContext?.setShowBuyModal || (() => { });
  } catch (error) {
    console.warn('BezCoin context not available:', error);
    balance = '0';
    showBuyModal = false;
    setShowBuyModal = () => { };
  }

  const [activeTab, setActiveTab] = useState('staking'); // 'staking' or 'farming'

  // 🔥 Auto-conectar wallet al cargar la página
  useEffect(() => {
    if (!isConnected && connectors?.length > 0) {
      const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
      if (injectedConnector) {
        const connectPromise = connect({ connector: injectedConnector });
        if (connectPromise && typeof connectPromise.catch === 'function') {
          connectPromise.catch(err => {
            if (import.meta.env.DEV) {
              console.log('Auto-connect skipped:', err.message || err);
            }
          });
        }
      }
    }
  }, [isConnected, connect, connectors]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Lock size={64} className="text-purple-600 dark:text-purple-400 mb-4" />
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">DeFi - Staking & Farming</h1>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          Por favor, conecta tu billetera para acceder a las funciones de Staking y Farming.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* GLOBAL STATS BAR */}
      <GlobalStatsBar />

      {/* Header */}
      <header className="px-4">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          DeFi Hub
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Maximiza tus ganancias con Staking de BEZ y Liquidity Farming. Real Yield del comercio real.
        </p>
      </header>

      {/* Pestañas */}
      <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700 pb-4">
        <TabButton
          active={activeTab === 'staking'}
          onClick={() => setActiveTab('staking')}
          icon={<TrendingUp size={20} />}
        >
          Staking
        </TabButton>
        <TabButton
          active={activeTab === 'farming'}
          onClick={() => setActiveTab('farming')}
          icon={<Droplets size={20} />}
        >
          Liquidity Farming
        </TabButton>
      </div>

      {/* Contenido según pestaña activa */}
      {activeTab === 'staking' && (
        <SimpleStakingTab address={address} isConnected={isConnected} balance={balance} setShowBuyModal={setShowBuyModal} />
      )}
      {activeTab === 'farming' && (
        <LiquidityFarmingTab
          farmingContract={farmingContract}
          lpTokenContract={lpTokenContract}
          user={{ address }}
        />
      )}

    </div>
  );
};

// Export con manejo de errores
const StakingPageWithErrorBoundary = (props) => {
  try {
    return <StakingPageUnifiedV2 {...props} />;
  } catch (error) {
    console.error('Error rendering StakingPage:', error);
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="text-red-600 dark:text-red-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
          Error al cargar Staking
        </h2>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-4">
          Hubo un problema al cargar la página de staking. Por favor, recarga la página.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          Recargar Página
        </button>
      </div>
    );
  }
};

export default StakingPageWithErrorBoundary;
