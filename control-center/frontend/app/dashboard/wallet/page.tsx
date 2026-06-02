'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import LockScreen from '@/components/LockScreen';
import {
    Wallet, Shield, Users, Fuel, Eye, Copy, CheckCircle,
    AlertTriangle, Clock, Plus, RefreshCw, CreditCard,
    ArrowRight, Check, X, Info, Search, ExternalLink, Link2
} from 'lucide-react';
import { ENG } from '@/lib/sdk/bezhas-pay-engine';
import { toast } from 'sonner';
import {
    useWalletConnection,
    useSmartWallets,
    useCreateSmartWallet,
    useBEZTokenBalance,
    useNativeBalance,
} from '@/lib/wallet-hooks';

interface SmartWallet {
    address: string;
    owner: string;
    guardian: string;
    dailyLimit: string;
    paymasterActive: boolean;
    created_at: string;
}

interface PortfolioData {
    eoa: { address: string; balance: string };
    smartWallets: SmartWallet[];
    totalBalance: string;
}

interface SecurityStatus {
    totalWallets: number;
    guardedWallets: number;
    paused: boolean;
    securityLevel: 'low' | 'medium' | 'high';
}

interface AuditLogEntry {
    id: number;
    action: string;
    wallet: string;
    timestamp: string;
    details: string;
    severity?: 'info' | 'warning' | 'alert';
}

export default function WalletPage() {
    const { user, openLoginModal } = useAuth() as any;
    const isGuest = !user;

    const [activeTab, setActiveTab] = useState<'portfolio' | 'multisig' | 'security' | 'payment'>('portfolio');
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    const [multiSigAddress, setMultiSigAddress] = useState('');
    const [guardianInput, setGuardianInput] = useState('');

    // ── Web3 Connection (on-chain) ──────────────────────────────────────
    const wallet = useWalletConnection();
    const { wallets: onChainWallets, loading: loadingOnChain, error: onChainError, refetch: refetchWallets } = useSmartWallets(wallet.address);
    const createWallet = useCreateSmartWallet(wallet.signer);
    const { balance: bezBalanceOnChain } = useBEZTokenBalance(wallet.address);
    const { balance: nativeBalanceOnChain } = useNativeBalance(wallet.address);

    // ── API Data (off-chain enrichment) ─────────────────────────────────
    const { data: portfolio, isLoading: loadingPortfolio, error: portfolioError, mutate: mutatePortfolio } = useSWR<PortfolioData>(
        user ? '/wallet/portfolio' : null, fetcher,
    );

    const { data: securityStatusApi, error: securityError } = useSWR<SecurityStatus>(
        user ? '/wallet/security/status' : null, fetcher,
    );

    const { data: auditDataApi, isLoading: loadingAudit, error: auditError } = useSWR<{ auditLogs: AuditLogEntry[] }>(
        user && activeTab === 'security' ? '/wallet/security/audit-log?count=10' : null, fetcher,
    );

    // Mock data for Investor/Guest demo
    const mockSmartWallets = useMemo(() => [
        {
            address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            owner: '0x0000000000000000000000000000000000000000',
            guardian: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            dailyLimit: '500.0000',
            paymasterActive: true,
            created_at: '2026-05-30T10:00:00Z'
        },
        {
            address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
            owner: '0x0000000000000000000000000000000000000000',
            guardian: 'Sin guardian',
            dailyLimit: '1000.0000',
            paymasterActive: false,
            created_at: '2026-05-30T11:30:00Z'
        }
    ], []);

    const bezBalance = isGuest ? '15420.2500' : (wallet.connected ? bezBalanceOnChain : (portfolio?.eoa?.balance || '0'));
    const nativeBalance = isGuest ? '2.4500' : (wallet.connected ? nativeBalanceOnChain : '0');

    // Merge on-chain wallets with API data (on-chain takes priority)
    const smartWallets = useMemo(() => {
        if (isGuest) return mockSmartWallets;
        if (onChainWallets.length > 0) return onChainWallets;
        return portfolio?.smartWallets ?? [];
    }, [isGuest, onChainWallets, portfolio, mockSmartWallets]);

    const totalBalance = useMemo(() => {
        if (isGuest) return '15420.2500';
        if (wallet.connected) return `${parseFloat(bezBalanceOnChain || '0').toFixed(4)}`;
        return portfolio?.totalBalance || '0';
    }, [isGuest, wallet.connected, bezBalanceOnChain, portfolio]);

    const securityStatus = useMemo<SecurityStatus | undefined>(() => {
        if (isGuest) return { totalWallets: 2, guardedWallets: 1, paused: false, securityLevel: 'high' };
        return securityStatusApi;
    }, [isGuest, securityStatusApi]);

    const auditData = useMemo(() => {
        if (isGuest) {
            return {
                auditLogs: [
                    { id: 1, action: 'NODE_SIGNATURE', wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', timestamp: '2026-05-30 18:12:05', details: 'Sensor telemetry verified successfully via SIFT', severity: 'info' as const },
                    { id: 2, action: 'GAS_RECHARGE', wallet: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', timestamp: '2026-05-30 17:45:00', details: 'Auto paymaster gas refill (+250 BEZ)', severity: 'info' as const },
                    { id: 3, action: 'GUARDIAN_CHANGED', wallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', timestamp: '2026-05-30 16:30:12', details: 'Social recovery guardian configured', severity: 'warning' as const }
                ]
            };
        }
        return auditDataApi;
    }, [isGuest, auditDataApi]);

    const copyAddress = (addr: string) => {
        navigator.clipboard.writeText(addr);
        setCopiedStates(prev => ({ ...prev, [addr]: true }));
        setTimeout(() => setCopiedStates(prev => ({ ...prev, [addr]: false })), 2000);
        toast.success('Dirección copiada');
    };

    // ── Create Smart Wallet (ON-CHAIN via SmartWalletFactory.sol) ────────
    const handleCreateWallet = async () => {
        if (isGuest) {
            openLoginModal();
            return;
        }
        if (!wallet.connected) {
            wallet.connect();
            return;
        }
        const newAddr = await createWallet.create(guardianInput || undefined);
        if (newAddr) {
            toast.success(`✅ Smart Wallet creada: ${newAddr.slice(0, 10)}...`);
            refetchWallets();
            mutatePortfolio();
            setGuardianInput('');
        } else if (createWallet.error) {
            toast.error(`Error: ${createWallet.error}`);
        }
    };

    const shortAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

    const getSecurityLevelInfo = (level: string) => {
        const mapping: Record<string, { label: string, color: string }> = {
            high: { label: 'Alto', color: 'text-emerald-500' },
            medium: { label: 'Medio', color: 'text-amber-500' },
            low: { label: 'Bajo', color: 'text-rose-500' },
        };
        return mapping[level] || { label: level, color: 'text-slate-500' };
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Wallet System</h1>
                <p className="text-slate-500 mt-1">SmartWallet (AA), MultiSig, Paymaster y Guardian</p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    icon={<Wallet className="text-bezhas-accent" size={20} />}
                    label="Balance BEZ"
                    value={wallet.connected ? `${parseFloat(bezBalance || '0').toFixed(4)} BEZ` : portfolioError ? 'Error' : '—'}
                />
                <StatCard
                    icon={<Shield className="text-emerald-500" size={20} />}
                    label="Smart Wallets"
                    value={wallet.connected ? smartWallets.length.toString() : portfolioError ? '!' : '—'}
                />
                <StatCard
                    icon={<Users className="text-indigo-500" size={20} />}
                    label="Guardians Activos"
                    value={securityStatus ? securityStatus.guardedWallets.toString() : securityError ? '!' : '—'}
                />
                <StatCard
                    icon={<Fuel className="text-amber-500" size={20} />}
                    label="Nivel de Seguridad"
                    value={securityStatus ? (
                        <span className={getSecurityLevelInfo(securityStatus.securityLevel).color}>
                            {getSecurityLevelInfo(securityStatus.securityLevel).label}
                        </span>
                    ) : '—'}
                />
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-slate-200 pb-0">
                {(['portfolio', 'multisig', 'security', 'payment'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-5 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-all -mb-px flex items-center gap-2 ${activeTab === tab
                                ? 'border-bezhas-accent text-bezhas-accent'
                                : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        {tab === 'portfolio' && <Wallet size={16} />}
                        {tab === 'multisig' && <Users size={16} />}
                        {tab === 'security' && <Shield size={16} />}
                        {tab === 'payment' && <CreditCard size={16} />}
                        {tab === 'portfolio' ? 'Portfolio' : tab === 'multisig' ? 'MultiSig' : tab === 'security' ? 'Seguridad' : 'BeZhas Pay'}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {isGuest && activeTab !== 'portfolio' ? (
                <LockScreen title={`Módulo de ${activeTab === 'multisig' ? 'MultiSig' : activeTab === 'security' ? 'Seguridad' : 'Pagos'} Bloqueado`} />
            ) : (
                <>
                    {activeTab === 'portfolio' && (
                        <div className="space-y-6">
                    {/* Wallet Connection Banner */}
                    {!wallet.connected && (
                        <div className="bg-gradient-to-r from-bezhas-accent/5 to-violet-50 border border-bezhas-accent/20 rounded-2xl p-6 text-center">
                            <Link2 className="w-8 h-8 text-bezhas-accent mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Conecta tu Wallet</h3>
                            <p className="text-sm text-slate-500 mb-4">Conecta MetaMask para interactuar directamente con los Smart Contracts de BeZhas L2</p>
                            <button
                                onClick={() => wallet.connect()}
                                disabled={wallet.connecting}
                                className="px-6 py-3 bg-bezhas-accent text-white rounded-xl text-sm font-bold hover:bg-bezhas-accent/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                            >
                                {wallet.connecting ? <RefreshCw size={16} className="animate-spin" /> : <Wallet size={16} />}
                                {wallet.connecting ? 'Conectando...' : 'Conectar MetaMask'}
                            </button>
                            {wallet.error && <p className="text-xs text-rose-500 mt-2">{wallet.error}</p>}
                        </div>
                    )}

                    {/* EOA Wallet (on-chain) */}
                    {wallet.connected && (
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-bezhas-cyan rounded-full blur-[100px] opacity-10 -mr-20 -mt-20" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-400 rounded-full blur-[80px] opacity-5 -ml-10 -mb-10" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Wallet Principal (EOA) — On-Chain</p>
                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" /> Chain {wallet.chainId}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <code className="text-lg font-mono text-white">{shortAddr(wallet.address!)}</code>
                                    <button onClick={() => copyAddress(wallet.address!)} className="text-slate-400 hover:text-white transition-colors">
                                        {copiedStates[wallet.address!] ? <CheckCircle size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                                <div className="flex items-baseline gap-6 mt-4">
                                    <div>
                                        <p className="text-4xl font-black tracking-tight">
                                            {parseFloat(bezBalance || '0').toFixed(4)} <span className="text-lg text-slate-400">BEZ</span>
                                        </p>
                                    </div>
                                    <div className="border-l border-white/10 pl-6">
                                        <p className="text-xs text-slate-400">Nativo (Gas)</p>
                                        <p className="text-lg font-bold">{parseFloat(nativeBalance || '0').toFixed(4)} <span className="text-xs text-slate-500">ETH</span></p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EOA from API fallback */}
                    {!wallet.connected && portfolio?.eoa && (
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-bezhas-cyan rounded-full blur-[100px] opacity-10 -mr-20 -mt-20" />
                            <div className="relative z-10">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Wallet Principal (EOA)</p>
                                <div className="flex items-center gap-3 mt-2">
                                    <code className="text-lg font-mono text-white">{shortAddr(portfolio.eoa.address)}</code>
                                    <button onClick={() => copyAddress(portfolio.eoa.address)} className="text-slate-400 hover:text-white transition-colors">
                                        {copiedStates[portfolio.eoa.address] ? <CheckCircle size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                    </button>
                                </div>
                                <p className="text-4xl font-black mt-4 tracking-tight">
                                    {parseFloat(portfolio.eoa.balance || '0').toFixed(4)} <span className="text-lg text-slate-400">BEZ</span>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Smart Wallets */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-slate-800">Smart Wallets (Account Abstraction)</h3>
                                <span title="Wallets desplegadas on-chain via SmartWalletFactory.sol con recuperación social, límites diarios y gas subsidiado.">
                                    <Info size={14} className="text-slate-400 cursor-help" />
                                </span>
                                {wallet.connected && (
                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        ON-CHAIN
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {wallet.connected && (
                                    <input
                                        type="text"
                                        value={guardianInput}
                                        onChange={e => setGuardianInput(e.target.value)}
                                        placeholder="0x... Guardian (opcional)"
                                        className="w-48 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-bezhas-accent/20"
                                    />
                                )}
                                <button
                                    onClick={handleCreateWallet}
                                    disabled={createWallet.creating}
                                    className="flex items-center gap-2 px-4 py-2 bg-bezhas-accent text-white rounded-xl text-sm font-bold hover:bg-bezhas-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {createWallet.creating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                                    {wallet.connected ? 'Crear Wallet' : 'Conectar y Crear'}
                                </button>
                            </div>
                        </div>

                        {/* TX Hash indicator */}
                        {createWallet.txHash && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2 text-xs">
                                <RefreshCw size={14} className={`text-blue-500 ${createWallet.creating ? 'animate-spin' : ''}`} />
                                <span className="text-blue-700 font-medium">TX:</span>
                                <code className="text-blue-600 font-mono">{createWallet.txHash.slice(0, 20)}...</code>
                                {createWallet.walletAddress && (
                                    <span className="ml-auto text-emerald-600 font-bold flex items-center gap-1">
                                        <CheckCircle size={12} /> Desplegada: {createWallet.walletAddress.slice(0, 10)}...
                                    </span>
                                )}
                            </div>
                        )}

                        {(loadingPortfolio || loadingOnChain) && smartWallets.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <RefreshCw className="w-8 h-8 text-bezhas-accent animate-spin mb-3" />
                                <p className="text-slate-500 font-medium">Cargando tus wallets...</p>
                            </div>
                        )}

                        {portfolioError && (
                            <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-100">
                                <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                                <p className="text-rose-800 font-bold">Error al cargar datos</p>
                                <p className="text-rose-600 text-sm mb-4">No pudimos conectar con el servidor de wallets.</p>
                                <button onClick={() => mutatePortfolio()} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600 transition-colors">
                                    Reintentar
                                </button>
                            </div>
                        )}

                        {smartWallets.length === 0 && !loadingPortfolio && !loadingOnChain && (
                            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                                <Wallet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-500 font-medium">No tienes Smart Wallets creadas</p>
                                <p className="text-sm text-slate-400 mt-1">Crea una para disfrutar de Account Abstraction</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {smartWallets.map((sw: any, i: number) => (
                                <div key={sw.address} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${sw.paymasterActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                            Paymaster: {sw.paymasterActive ? 'Activo' : 'Inactivo'}
                                        </div>
                                    </div>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Smart Wallet #{i + 1}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <code className="text-sm font-mono text-slate-700">{shortAddr(sw.address)}</code>
                                                <button onClick={() => copyAddress(sw.address)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                                    {copiedStates[sw.address] ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                        <Eye className="text-slate-300 group-hover:text-bezhas-accent transition-colors cursor-pointer" size={18} />
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                                Límite Diario <Info size={10} />
                                            </p>
                                            <p className="font-bold text-slate-700">{sw.dailyLimit || '0.0000'} BEZ</p>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase">Guardian</p>
                                            <p className="font-bold text-slate-700">{sw.guardian ? shortAddr(sw.guardian) : 'Sin guardian'}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'multisig' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center max-w-2xl mx-auto">
                        <Users className="w-12 h-12 text-bezhas-accent mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-800 mb-2">MultiSig Enterprise</h3>
                        <p className="text-slate-500 mb-6">
                            Gestiona wallets multi-firma para operaciones empresariales que requieren multiples aprobaciones.
                        </p>

                        <div className="flex gap-2 max-w-md mx-auto">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    type="text"
                                    value={multiSigAddress}
                                    onChange={(e) => setMultiSigAddress(e.target.value)}
                                    placeholder="0x... Dirección del contrato MultiSig"
                                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-bezhas-accent/20 transition-all"
                                />
                            </div>
                            <button className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors">
                                Monitorear
                            </button>
                        </div>
                    </div>

                    {multiSigAddress && (
                        <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center animate-in slide-in-from-bottom-4 duration-500">
                            <p className="text-slate-400 text-sm italic">Cargando transacciones pendientes para {shortAddr(multiSigAddress)}...</p>
                            <div className="mt-4 flex justify-center">
                                <RefreshCw className="animate-spin text-slate-300" />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'security' && (
                <div className="space-y-6">
                    {/* Security Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl p-6 border border-slate-100">
                            <div className="flex items-center gap-3 mb-3">
                                <Shield className="text-emerald-500" size={20} />
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Estado</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900">
                                {securityStatus?.paused ? 'Pausado' : 'Activo'}
                            </p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-100">
                            <div className="flex items-center gap-3 mb-3">
                                <Wallet className="text-bezhas-accent" size={20} />
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Wallets Protegidas</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900">{securityStatus?.totalWallets || 0}</p>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-slate-100">
                            <div className="flex items-center gap-3 mb-3">
                                <Users className="text-indigo-500" size={20} />
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Con Guardian</span>
                            </div>
                            <p className="text-2xl font-black text-slate-900">{securityStatus?.guardedWallets || 0}</p>
                        </div>
                    </div>

                    {/* Audit Log */}
                    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800">Audit Log</h3>
                            <div className="flex items-center gap-2">
                                {loadingAudit && <RefreshCw size={14} className="text-bezhas-accent animate-spin" />}
                                <Clock className="text-slate-400" size={18} />
                            </div>
                        </div>
                        <div className="divide-y divide-slate-50">
                            {loadingAudit && !auditData && (
                                <div className="p-12 text-center">
                                    <RefreshCw className="w-8 h-8 text-slate-200 animate-spin mx-auto mb-2" />
                                    <p className="text-slate-400 text-sm">Cargando registros...</p>
                                </div>
                            )}
                            {auditError && (
                                <div className="p-8 text-center text-rose-500 text-sm">Error al cargar el log de auditoría</div>
                            )}
                            {auditData?.auditLogs?.length === 0 && !loadingAudit && (
                                <div className="p-8 text-center text-slate-400 font-medium">No hay registros de auditoria</div>
                            )}
                            {auditData?.auditLogs?.map((log, i) => {
                                const isAlert = log.action.toUpperCase().includes('ALERT') || log.action.toUpperCase().includes('ALERTA');
                                const isWarning = log.action.toUpperCase().includes('WARN') || log.action.toUpperCase().includes('AVISO');
                                
                                return (
                                    <div key={log.id || i} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${isAlert ? 'bg-rose-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">{log.action}</p>
                                                <p className="text-xs text-slate-400">{log.details}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-slate-400 font-mono block">{log.timestamp}</span>
                                            <span className="text-[10px] text-slate-300 font-mono">{shortAddr(log.wallet)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
            {activeTab === 'payment' && <PaymentTab wallet={portfolio?.eoa} />}
                </>
            )}
        </div>
    );
}

// ── PAYMENT COMPONENTS ──────────────────────────────────────────────────

function PaymentTab({ wallet }: { wallet: any }) {
    const [payMode, setPayMode] = useState<'crypto' | 'fiat'>('crypto');
    const [amount, setAmount] = useState('10');
    const [fiatCurrency, setFiatCurrency] = useState<'EUR' | 'USD'>('EUR');
    const [walletAddr, setWalletAddr] = useState(wallet?.address || '');

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Mode Selector */}
            <div className="flex gap-3 bg-slate-100 p-1 rounded-2xl w-fit">
                <button
                    onClick={() => setPayMode('crypto')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${payMode === 'crypto' ? 'bg-white text-bezhas-accent shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    🪙 Pagar con Cripto
                </button>
                <button
                    onClick={() => setPayMode('fiat')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${payMode === 'fiat' ? 'bg-white text-bezhas-accent shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    💳 Pagar con Fiat (BeZhas Pay)
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className={`bg-white rounded-3xl p-8 border border-slate-100 shadow-xl relative overflow-hidden transition-all ${payMode === 'fiat' ? 'ring-2 ring-bezhas-accent/20' : ''}`}>
                        <div className="flex items-center gap-4 mb-8">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${payMode === 'fiat' ? 'bg-bezhas-accent/10 text-bezhas-accent' : 'bg-amber-100 text-amber-600'}`}>
                                {payMode === 'fiat' ? <CreditCard size={24} /> : <Wallet size={24} />}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900">
                                    {payMode === 'fiat' ? 'BeZhas Pay - Pago Fiat' : 'Pago con Criptoactivos'}
                                </h3>
                                <p className="text-slate-400 text-sm">
                                    {payMode === 'fiat' ? 'Tarjeta · PayPal · Transferencia' : 'BEZ · USDT · MATIC'}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cantidad ({payMode === 'fiat' ? fiatCurrency : 'BEZ'})</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-2xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-bezhas-accent/20 transition-all"
                                    />
                                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                                        ≈ ${(parseFloat(amount) * (fiatCurrency === 'EUR' ? 1.09 : 1)).toFixed(2)} USD
                                    </span>
                                </div>
                            </div>

                            {payMode === 'fiat' && (
                                <>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Moneda</label>
                                        <div className="flex gap-2">
                                            {(['EUR', 'USD'] as const).map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setFiatCurrency(c)}
                                                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${fiatCurrency === c ? 'border-bezhas-accent bg-bezhas-accent/5 text-bezhas-accent' : 'border-slate-100 bg-slate-50 text-slate-400'}`}
                                                >
                                                    {c === 'EUR' ? '€ Euro' : '$ USD'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Wallet Destino (Polygon)</label>
                                        <div className="flex gap-2">
                                            <input
                                                value={walletAddr}
                                                onChange={e => setWalletAddr(e.target.value)}
                                                placeholder="0x... o dejar vacío para crear una nueva"
                                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-mono text-slate-600 focus:outline-none"
                                            />
                                            {!walletAddr && (
                                                <button
                                                    onClick={() => setWalletAddr(`0x${Math.random().toString(16).slice(2, 42)}`)}
                                                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                                                >
                                                    + Generar
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <FiatPaymentForm
                                        amount={amount}
                                        currency={fiatCurrency}
                                        walletAddress={walletAddr}
                                        onSuccess={(sess) => {
                                            toast.success(`Pago completado: +${sess.bezAmount} BEZ`);
                                        }}
                                    />
                                </>
                            )}

                            {payMode === 'crypto' && (
                                <button className="w-full py-4 bg-bezhas-accent text-white rounded-2xl text-lg font-black hover:bg-bezhas-accent/90 transition-all shadow-lg shadow-bezhas-accent/20">
                                    Pagar {amount} BEZ
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="bg-slate-900 rounded-3xl p-6 text-white overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-bezhas-cyan rounded-full blur-[60px] opacity-20 -mr-16 -mt-16" />
                        <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                            <Info size={16} className="text-bezhas-cyan" /> Información
                        </h4>
                        <ul className="space-y-3 text-xs text-slate-300">
                            <li className="flex items-start gap-2">
                                <Check size={14} className="text-emerald-400 shrink-0" />
                                <span>Los pagos fiat se procesan vía Stripe/PayPal de forma segura.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check size={14} className="text-emerald-400 shrink-0" />
                                <span>Conversión automática a BEZ basada en el precio de mercado actual.</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check size={14} className="text-emerald-400 shrink-0" />
                                <span>Los fondos se envían a la red Polygon (BeZhas Mainnet).</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function FiatPaymentForm({ amount, currency, walletAddress, onSuccess }: { amount: string, currency: string, walletAddress: string, onSuccess?: (sess: any) => void }) {
    const [provider, setProvider] = useState<'stripe' | 'paypal'>('stripe');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'form' | 'processing' | 'completed'>('form');

    const handlePay = async () => {
        if (!walletAddress) {
            toast.error('Dirección de wallet requerida');
            return;
        }
        setLoading(true);
        try {
            const sess = await ENG.initiateFiatPayment({
                amount: parseFloat(amount),
                currency,
                provider,
                walletAddress,
            });
            setStatus('processing');
            
            // Simulation polling
            const checkInterval = setInterval(() => {
                const updated = ENG.getFiatSession(sess.sessionId);
                if (updated?.status === 'completed') {
                    clearInterval(checkInterval);
                    setStatus('completed');
                    onSuccess && onSuccess(updated);
                }
            }, 500);
        } catch (err: any) {
            toast.error(err.message);
            setStatus('form');
        } finally {
            setLoading(false);
        }
    };

    if (status === 'completed') {
        return (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center animate-in zoom-in-95 duration-500">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={24} />
                </div>
                <h4 className="text-emerald-500 font-black text-lg">¡Pago completado!</h4>
                <p className="text-slate-500 text-sm mt-1">Los BEZ han sido enviados a tu wallet.</p>
                <button
                    onClick={() => setStatus('form')}
                    className="mt-4 px-6 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold"
                >
                    Nuevo Pago
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Método de Pago</label>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { id: 'stripe', name: 'Tarjeta', icon: <CreditCard size={18} />, color: 'blue' },
                        { id: 'paypal', name: 'PayPal', icon: <span className="font-black">P</span>, color: 'indigo' },
                    ].map(p => (
                        <button
                            key={p.id}
                            onClick={() => setProvider(p.id as any)}
                            className={`flex items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all ${provider === p.id ? 'border-bezhas-accent bg-bezhas-accent/5' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'}`}
                        >
                            <span className={provider === p.id ? 'text-bezhas-accent' : 'text-slate-400'}>{p.icon}</span>
                            <span className={`font-bold ${provider === p.id ? 'text-slate-900' : 'text-slate-400'}`}>{p.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {status === 'processing' ? (
                <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100">
                    <RefreshCw className="w-8 h-8 text-bezhas-accent animate-spin mx-auto mb-4" />
                    <h4 className="font-bold text-slate-900">Procesando pago fiat...</h4>
                    <p className="text-slate-400 text-xs mt-1">
                        {provider === 'stripe' ? 'Verificando tarjeta...' : 'Conectando con PayPal...'}
                    </p>
                </div>
            ) : (
                <button
                    onClick={handlePay}
                    disabled={loading}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl text-lg font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50"
                >
                    {loading ? <RefreshCw className="animate-spin" /> : <CreditCard />}
                    Pagar {amount} {currency}
                </button>
            )}
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <p className="text-xl font-extrabold text-slate-900 mt-1">{value}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                {icon}
            </div>
        </div>
    );
}
