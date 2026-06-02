'use client';

import React, { useState, useMemo } from 'react';
import {
  Sprout, TrendingUp, Lock, ArrowRight, ShieldCheck, Wallet,
  RefreshCw, AlertTriangle, Zap, Award, LogOut, Gift,
} from 'lucide-react';
import { useWalletConnection } from '@/lib/wallet-hooks';
import {
  useFarmingStats, useFarmingUser, useFarmingDeposit,
  useFarmingClaim, useFarmingWithdraw, useStakingPoolStats,
  useStakerInfo, useStakingActions,
} from '@/lib/defi-hooks';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';

const LOCK_MULTIPLIERS = [
  { days: 0, label: 'Sin lock', mult: 100, boost: 0 },
  { days: 7, label: '7 días', mult: 110, boost: 10 },
  { days: 30, label: '30 días', mult: 125, boost: 25 },
  { days: 90, label: '90 días', mult: 150, boost: 50 },
  { days: 180, label: '180 días', mult: 200, boost: 100 },
  { days: 365, label: '365 días', mult: 300, boost: 200 },
];

const POOL_NAMES: Record<number, { name: string; emoji: string }> = {
  0: { name: 'BEZ Solo', emoji: '🪙' },
  1: { name: 'BEZ-USDT LP', emoji: '💵' },
  2: { name: 'BEZ-MATIC LP', emoji: '🔷' },
  3: { name: 'BEZ-ETH LP', emoji: '⟠' },
};

export default function FarmingDashboard() {
  const { user, openLoginModal } = useAuth() as any;
  const isGuest = !user;

  const [selectedPool, setSelectedPool] = useState(0);
  const [stakeAmount, setStakeAmount] = useState('500');
  const [lockDays, setLockDays] = useState(30);
  const [stakingAmount, setStakingAmount] = useState('1000');
  const [activeTab, setActiveTab] = useState<'farming' | 'staking'>('farming');

  // ── Wallet ──
  const wallet = useWalletConnection();

  // ── Farming on-chain ──
  const { stats: realFarmingStats, pools: realPools, loading: farmingLoading, refetch: refetchFarming } = useFarmingStats();
  const { info: realFarmingUser } = useFarmingUser(selectedPool, wallet.address);
  const farmingDeposit = useFarmingDeposit(wallet.signer);
  const farmingClaim = useFarmingClaim(wallet.signer);
  const farmingWithdraw = useFarmingWithdraw(wallet.signer);

  // ── Staking on-chain ──
  const { stats: realStakingStats } = useStakingPoolStats();
  const { info: realStakerInfo } = useStakerInfo(wallet.address);
  const stakingActions = useStakingActions(wallet.signer);

  // Mock data for guests
  const mockPools = useMemo(() => [
      { pid: 0, lpToken: '0x0', tvl: '154000', allocPoint: 100, isLP: false },
      { pid: 1, lpToken: '0x1', tvl: '425000', allocPoint: 400, isLP: true },
      { pid: 2, lpToken: '0x2', tvl: '189000', allocPoint: 200, isLP: true },
      { pid: 3, lpToken: '0x3', tvl: '312000', allocPoint: 300, isLP: true }
  ], []);

  const mockFarmingStats = useMemo(() => ({
      poolCount: 4,
      totalAllocPoint: 1000,
      bezPerBlock: '2.5',
      totalTvls: 1080000
  }), []);

  const mockFarmingUser = useMemo(() => ({
      amount: '5000.0000',
      multiplier: 150,
      pendingReward: '24.512400',
      lockEndTimestamp: Math.floor(Date.now() / 1000) + 86400 * 15
  }), []);

  const mockStakingStats = useMemo(() => ({
      totalStaked: '850000',
      rewardRate: '0.05'
  }), []);

  const mockStakerInfo = useMemo(() => ({
      stakedAmount: '12500.0000',
      baseEarned: '14.250450',
      boostedEarned: '28.500900',
      boostBps: 20000,
      isValidator: true,
      validatorTier: 4
  }), []);

  const pools = isGuest ? mockPools : (realPools.length > 0 ? realPools : mockPools);
  const farmingStats = isGuest ? mockFarmingStats : realFarmingStats;
  const farmingUser = isGuest ? mockFarmingUser : realFarmingUser;
  const stakingStats = isGuest ? mockStakingStats : realStakingStats;
  const stakerInfo = isGuest ? mockStakerInfo : realStakerInfo;

  const activePool = pools[selectedPool];
  const activeMult = LOCK_MULTIPLIERS.find(m => m.days === lockDays) || LOCK_MULTIPLIERS[0];
  const poolMeta = POOL_NAMES[selectedPool] || { name: `Pool ${selectedPool}`, emoji: '🔹' };

  // ── Handlers ──
  const handleDeposit = async () => {
    if (isGuest) { openLoginModal(); return; }
    if (!wallet.connected) { wallet.connect(); return; }
    if (!activePool) { toast.error('Pool no disponible'); return; }
    const tx = await farmingDeposit.deposit(selectedPool, stakeAmount, lockDays, activePool.lpToken);
    if (tx) { toast.success(`✅ Deposited — ${tx.slice(0, 14)}...`); refetchFarming(); }
    else if (farmingDeposit.error) toast.error(farmingDeposit.error);
  };

  const handleClaim = async () => {
    if (isGuest) { openLoginModal(); return; }
    if (!wallet.connected) { wallet.connect(); return; }
    const tx = await farmingClaim.claim(selectedPool);
    if (tx) toast.success('🎁 Rewards claimed!');
    else if (farmingClaim.error) toast.error(farmingClaim.error);
  };

  const handleWithdraw = async () => {
    if (isGuest) { openLoginModal(); return; }
    if (!wallet.connected || !farmingUser) return;
    const tx = await farmingWithdraw.withdraw(selectedPool, farmingUser.amount);
    if (tx) { toast.success('💸 Withdrawn!'); refetchFarming(); }
    else if (farmingWithdraw.error) toast.error(farmingWithdraw.error);
  };

  const handleEmergency = async () => {
    if (isGuest) { openLoginModal(); return; }
    if (!wallet.connected) return;
    const tx = await farmingWithdraw.emergencyWithdraw(selectedPool);
    if (tx) { toast.success('🚨 Emergency withdraw done'); refetchFarming(); }
  };

  const handleStake = async () => {
    if (isGuest) { openLoginModal(); return; }
    if (!wallet.connected) { wallet.connect(); return; }
    const tx = await stakingActions.stake(stakingAmount);
    if (tx) toast.success(`✅ Staked ${stakingAmount} BEZ`);
    else if (stakingActions.error) toast.error(stakingActions.error);
  };

  const handleStakingClaim = async () => {
    if (isGuest) { openLoginModal(); return; }
    if (!wallet.connected) return;
    const tx = await stakingActions.getReward();
    if (tx) toast.success('🎁 Staking reward claimed!');
  };

  const handleStakingExit = async () => {
    if (isGuest) { openLoginModal(); return; }
    if (!wallet.connected) return;
    const tx = await stakingActions.exit();
    if (tx) toast.success('💸 Exited staking pool');
  };

  const isBusy = farmingDeposit.loading || farmingClaim.loading || farmingWithdraw.loading || stakingActions.loading;

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8">
      {/* Tab Switcher */}
      <div className="flex items-center gap-3">
        <button onClick={() => setActiveTab('farming')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'farming' ? 'bg-bezhas-blue text-white shadow-lg shadow-blue-500/20' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}>
          <Sprout size={16} /> Liquidity Farming
        </button>
        <button onClick={() => setActiveTab('staking')}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all ${activeTab === 'staking' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'}`}>
          <Award size={16} /> Single-Side Staking
        </button>
        <div className="ml-auto">
          {wallet.connected ? (
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
            </span>
          ) : (
            <button onClick={() => isGuest ? openLoginModal() : wallet.connect()} className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800">
              <Wallet size={14} /> Conectar Wallet
            </button>
          )}
        </div>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <StatCard title="TVL Farming" value={farmingStats ? `${pools.reduce((s, p) => s + parseFloat(p.tvl), 0).toLocaleString()} BEZ` : '...'} icon={<ShieldCheck size={20} className="text-emerald-500" />} />
        <StatCard title="Pools Activos" value={farmingStats?.poolCount?.toString() ?? '...'} icon={<Sprout size={20} className="text-bezhas-blue" />} />
        <StatCard title="BEZ/Block" value={farmingStats?.bezPerBlock ? `${parseFloat(farmingStats.bezPerBlock).toFixed(2)}` : '...'} icon={<Zap size={20} className="text-amber-500" />} />
        <StatCard title="Staking TVL" value={stakingStats ? `${parseFloat(stakingStats.totalStaked).toLocaleString()} BEZ` : '...'} icon={<TrendingUp size={20} className="text-rose-500" />} />
      </div>

      {/* Daily Cap */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
        <div className="text-sm">
          <span className="font-bold text-amber-800">Tope Diario:</span>
          <span className="text-amber-700 ml-1">Farming: 25,000 BEZ/día • Staking: 50,000 BEZ/día. Las APYs se ajustan dinámicamente.</span>
        </div>
        <span className="ml-auto text-[10px] font-bold text-amber-500 uppercase">ON-CHAIN</span>
      </div>

      {/* ═══ FARMING TAB ═══ */}
      {activeTab === 'farming' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pools List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight px-2">Liquidity Pools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(pools.length > 0 ? pools : [0, 1, 2, 3].map(pid => ({ pid, tvl: '0', allocPoint: 0, isLP: pid > 0, lpToken: '', lastRewardBlock: 0, accBezPerShare: '0' }))).map(pool => {
                const meta = POOL_NAMES[pool.pid] || { name: `Pool ${pool.pid}`, emoji: '🔹' };
                const weight = farmingStats?.totalAllocPoint ? ((pool.allocPoint / farmingStats.totalAllocPoint) * 100).toFixed(0) : '—';
                return (
                  <button key={pool.pid} onClick={() => setSelectedPool(pool.pid)}
                    className={`flex flex-col text-left p-6 rounded-3xl border-2 transition-all ${selectedPool === pool.pid ? 'border-bezhas-blue bg-blue-50/50 shadow-md scale-[1.02]' : 'border-slate-100 bg-white hover:border-slate-200'}`}>
                    <div className="flex justify-between items-start w-full mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl shadow-inner">{meta.emoji}</div>
                        <div>
                          <h3 className="font-extrabold text-slate-900 tracking-tight leading-none">{meta.name}</h3>
                          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase">TVL: {parseFloat(pool.tvl).toLocaleString()} BEZ</p>
                        </div>
                      </div>
                      <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-black">{weight}% Weight</div>
                    </div>
                    <div className="flex justify-between w-full text-xs font-bold text-slate-500 border-t border-slate-100 pt-4 mt-2">
                      <span>{pool.isLP ? 'LP Token' : 'Single Asset'}</span>
                      <span className="flex items-center text-bezhas-blue">Seleccionar <ArrowRight size={14} className="ml-1" /></span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Deposit Form */}
          <div>
            <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-bezhas-blue opacity-20 blur-3xl" />
              <h3 className="text-lg font-black uppercase tracking-widest text-bezhas-blue mb-6">Procesar Staking</h3>

              {/* User info on-chain */}
              {farmingUser && wallet.connected && (
                <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Tu Posición (On-Chain)</p>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Staked</span><span className="font-bold">{parseFloat(farmingUser.amount).toFixed(4)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Multiplier</span><span className="font-bold text-emerald-400">{farmingUser.multiplier / 100}x</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Rewards</span><span className="font-bold text-amber-400">{parseFloat(farmingUser.pendingReward).toFixed(6)} BEZ</span></div>
                  {farmingUser.lockEndTimestamp > 0 && (
                    <div className="flex justify-between text-sm"><span className="text-slate-400">Lock hasta</span><span className="font-bold">{new Date(farmingUser.lockEndTimestamp * 1000).toLocaleDateString()}</span></div>
                  )}
                </div>
              )}

              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">Pool</label>
                <div className="bg-white/10 rounded-2xl p-4 flex justify-between items-center border border-white/5">
                  <span className="font-bold">{poolMeta.emoji} {poolMeta.name}</span>
                </div>
              </div>

              <div className="mb-6">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">Cantidad</label>
                <input type="number" value={stakeAmount} onChange={e => setStakeAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-2xl font-black text-white focus:outline-none focus:border-bezhas-blue transition placeholder:text-slate-600" placeholder="0.00" />
              </div>

              <div className="mb-8">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center"><Lock size={12} className="mr-1.5" /> Periodo de Bloqueo</label>
                <div className="grid grid-cols-3 gap-2">
                  {LOCK_MULTIPLIERS.map(m => (
                    <button key={m.days} onClick={() => setLockDays(m.days)}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border ${lockDays === m.days ? 'bg-bezhas-blue text-white border-bezhas-blue shadow-[0_0_15px_rgba(0,194,255,0.4)]' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}>
                      {m.label}
                      {m.boost > 0 && <span className="block text-[9px] text-emerald-400 mt-0.5">+{m.boost}%</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-black/40 rounded-2xl p-4 mb-6 border border-white/5">
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-slate-400 font-bold uppercase">Multiplicador</span>
                  <span className="text-sm font-black text-emerald-400">{activeMult.mult / 100}x</span>
                </div>
              </div>

              <button onClick={handleDeposit} disabled={isBusy || !stakeAmount}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_20px_rgba(0,194,255,0.3)] ${isBusy ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-bezhas-blue text-slate-900 hover:bg-white'}`}>
                {farmingDeposit.loading ? <><RefreshCw size={14} className="inline animate-spin mr-2" />Confirmando...</> : `Depositar ${stakeAmount} ${poolMeta.name.split(' ')[0]}`}
              </button>

              <div className="flex gap-2 mt-3">
                <button onClick={handleClaim} disabled={isBusy} className="flex-1 flex items-center justify-center gap-1 bg-emerald-500/90 hover:bg-emerald-600 text-white rounded-xl px-3 py-2 text-xs font-bold transition"><Gift size={12} /> Claim</button>
                <button onClick={handleWithdraw} disabled={isBusy} className="flex-1 flex items-center justify-center gap-1 bg-yellow-400/90 hover:bg-yellow-500 text-slate-900 rounded-xl px-3 py-2 text-xs font-bold transition"><LogOut size={12} /> Withdraw</button>
                <button onClick={handleEmergency} disabled={isBusy} className="flex-1 flex items-center justify-center gap-1 bg-rose-500/90 hover:bg-rose-600 text-white rounded-xl px-3 py-2 text-xs font-bold transition"><AlertTriangle size={12} /> Emergency</button>
              </div>

              {(farmingDeposit.txHash || farmingClaim.txHash || farmingWithdraw.txHash) && (
                <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-400 text-xs font-bold text-center">
                  <ShieldCheck size={14} className="inline mr-2" /> TX: {(farmingDeposit.txHash || farmingClaim.txHash || farmingWithdraw.txHash)?.slice(0, 20)}...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ STAKING TAB ═══ */}
      {activeTab === 'staking' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Staking Info */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-3xl p-8 text-white">
              <h2 className="text-xl font-black uppercase tracking-widest mb-6 text-emerald-300">Single-Side Staking</h2>
              <p className="text-sm text-emerald-200/80 mb-6">Deposita $BEZ para recibir retornos y fortalecer la seguridad económica de la red L2. Los validadores activos reciben boost automático según su tier.</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] font-bold text-emerald-300/60 uppercase">TVL Total</p>
                  <p className="text-2xl font-black">{stakingStats ? parseFloat(stakingStats.totalStaked).toLocaleString() : '...'} BEZ</p>
                </div>
                <div className="bg-white/10 rounded-2xl p-4 border border-white/5">
                  <p className="text-[10px] font-bold text-emerald-300/60 uppercase">Reward Rate</p>
                  <p className="text-2xl font-black">{stakingStats ? `${parseFloat(stakingStats.rewardRate).toFixed(4)}` : '...'} BEZ/s</p>
                </div>
              </div>

              {/* User Staker Info */}
              {stakerInfo && wallet.connected && (
                <div className="mt-6 bg-black/20 rounded-2xl p-5 border border-white/10 space-y-2">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase mb-2">Tu Posición (On-Chain)</p>
                  <div className="flex justify-between text-sm"><span className="text-emerald-300/70">Staked</span><span className="font-bold">{parseFloat(stakerInfo.stakedAmount).toFixed(4)} BEZ</span></div>
                  <div className="flex justify-between text-sm"><span className="text-emerald-300/70">Base Earned</span><span className="font-bold">{parseFloat(stakerInfo.baseEarned).toFixed(6)} BEZ</span></div>
                  <div className="flex justify-between text-sm"><span className="text-emerald-300/70">Boosted Earned</span><span className="font-bold text-amber-400">{parseFloat(stakerInfo.boostedEarned).toFixed(6)} BEZ</span></div>
                  <div className="flex justify-between text-sm"><span className="text-emerald-300/70">Boost</span><span className="font-bold">{(stakerInfo.boostBps / 100).toFixed(0)}%</span></div>
                  {stakerInfo.isValidator && (
                    <div className="flex justify-between text-sm"><span className="text-emerald-300/70">Validator Tier</span><span className="font-bold text-cyan-400">Tier {stakerInfo.validatorTier}</span></div>
                  )}
                </div>
              )}
            </div>

            {/* Tier Boost Table */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Validator Boost Tiers</h3>
              <div className="space-y-2">
                {[{ tier: 'No Validator', boost: '1.0x', color: 'slate' }, { tier: 'Bronze', boost: '1.0x', color: 'amber' }, { tier: 'Silver', boost: '1.25x', color: 'gray' }, { tier: 'Gold', boost: '1.5x', color: 'yellow' }, { tier: 'Platinum', boost: '2.0x', color: 'cyan' }].map(t => (
                  <div key={t.tier} className="flex justify-between items-center px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-sm font-bold text-slate-700">{t.tier}</span>
                    <span className={`text-sm font-black text-${t.color}-600`}>{t.boost}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Staking Form */}
          <div className="bg-slate-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden h-fit">
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-emerald-500 opacity-15 blur-3xl" />
            <h3 className="text-lg font-black uppercase tracking-widest text-emerald-400 mb-6">Stake BEZ</h3>

            <div className="mb-6">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 block">Cantidad (BEZ)</label>
              <input type="number" value={stakingAmount} onChange={e => setStakingAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-2xl font-black text-white focus:outline-none focus:border-emerald-500 transition placeholder:text-slate-600" placeholder="0.00" />
            </div>

            <button onClick={handleStake} disabled={isBusy || !stakingAmount}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all ${isBusy ? 'bg-slate-700 text-slate-400' : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]'}`}>
              {stakingActions.loading ? <><RefreshCw size={14} className="inline animate-spin mr-2" />Procesando...</> : `Stake ${stakingAmount} BEZ`}
            </button>

            <div className="flex gap-2 mt-3">
              <button onClick={handleStakingClaim} disabled={isBusy} className="flex-1 bg-amber-500/90 hover:bg-amber-600 text-white rounded-xl px-3 py-2 text-xs font-bold transition">Claim Reward</button>
              <button onClick={handleStakingExit} disabled={isBusy} className="flex-1 bg-rose-500/90 hover:bg-rose-600 text-white rounded-xl px-3 py-2 text-xs font-bold transition">Exit (All)</button>
            </div>

            {stakingActions.txHash && (
              <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-400 text-xs font-bold text-center">
                TX: {stakingActions.txHash.slice(0, 20)}...
              </div>
            )}
            {stakingActions.error && (
              <div className="mt-3 p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-400 text-xs font-bold">{stakingActions.error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex items-center justify-between">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">{value}</p>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner">{icon}</div>
    </div>
  );
}
