import React, { useState, useEffect, useCallback } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useBezCoin } from '../context/BezCoinContext';
import { useAccount, useBalance, useDisconnect } from 'wagmi';
import { useWalletConnect } from '../hooks/useWalletConnect';
import useUserStore from '../stores/userStore';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
    User, Copy, Check, Edit, Image as ImageIcon, Activity, Info,
    Wallet, ExternalLink, TrendingUp, Send, ArrowDownToLine,
    LayoutDashboard, CreditCard, History, Settings as SettingsIcon,
    BarChart3, Users, MessageSquare, TrendingUp as TrendingUpIcon, RefreshCw,
    Shield, Bell, Save, AlertCircle, Grid, ShoppingBag, Gift, MessageCircle, Eye, EyeOff
} from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { toast } from 'react-hot-toast';
import axios from 'axios';

// Import Dashboard Widgets
import UserProfileWidget from '../components/dashboard/widgets/UserProfileWidget';
import KeyMetricsWidget from '../components/dashboard/widgets/KeyMetricsWidget';
import MainEventWidget from '../components/dashboard/widgets/MainEventWidget';
import ActivityGraphWidget from '../components/dashboard/widgets/ActivityGraphWidget';
import SocialWidget from '../components/dashboard/widgets/SocialWidget';
import DonateButton from '../components/DonateButton';
import MoonPayQuickActions from '../components/moonpay/MoonPayQuickActions';
import WalletDiagnosticPanel from '../components/wallet/WalletDiagnosticPanel';
import ProfileNFTGrid from '../components/profile/ProfileNFTGrid'; // Added NFT Grid

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ProfilePage = () => {
    const { address: connectedAddress, isConnected } = useAccount();
    const { address: routeAddress } = useParams();
    const navigate = useNavigate();

    // Determine which profile to show
    const address = routeAddress || connectedAddress;
    const isOwnProfile = connectedAddress && address && connectedAddress.toLowerCase() === address.toLowerCase();

    const { disconnect } = useDisconnect();
    const { data: ethBalance, isLoading: ethBalanceLoading } = useBalance({ address });
    const { profile: web3Profile, fetchUserData, userProfile: userProfileContract, bezhasToken } = useWeb3();
    const { setShowBuyModal, balanceVisible, toggleBalanceVisibility } = useBezCoin();
    const { tokenBalance, userProfile: storeUserProfile } = useUserStore();

    // Tab state
    const [activeTab, setActiveTab] = useState('overview');

    // Profile states
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [checkingAccess, setCheckingAccess] = useState(false); // For chat

    // Wallet states
    const [bzhBalance, setBzhBalance] = useState(0);
    const [transactions, setTransactions] = useState([]);
    const [walletLoading, setWalletLoading] = useState(false);

    // Settings states
    const [editUsername, setEditUsername] = useState('');
    const [editBio, setEditBio] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (address) {
            loadProfileData();
            if (isOwnProfile) {
                loadWalletData();
            }
        }
    }, [address, isOwnProfile]);

    // Sync edit fields when profile loads
    // Load profile data con timeout
    const loadProfileData = useCallback(async () => {
        if (!address) return;

        setProfileLoading(true);
        try {
            // Timeout de 3 segundos
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const response = await axios.get(`${API_URL}/api/profile/${address}`, {
                signal: controller.signal
            });
            clearTimeout(timeout);
            setProfile(response.data);
        } catch (error) {
            if (error.name !== 'CanceledError') {
                console.error('Error loading profile:', error);
            }

            // Use fallback profile
            const fallbackProfile = storeUserProfile || web3Profile || {
                username: `User_${address?.slice(2, 8)}`,
                bio: 'Este usuario aún no ha añadido una biografía.',
                avatar: `https://ui-avatars.com/api/?name=${address?.slice(2, 8)}&background=random&size=128`,
                email: '',
                role: 'user',
                postsCount: 0,
                followersCount: 0,
                followingCount: 0,
                createdAt: Date.now()
            };
            setProfile(fallbackProfile);

            // Only show error if it's not a 404
            if (error.response?.status !== 404) {
                toast.error('Error al cargar el perfil. Usando datos por defecto.');
            }
        } finally {
            setProfileLoading(false);
        }
    }, [address, storeUserProfile, web3Profile]);

    // Load wallet data
    const loadWalletData = useCallback(async () => {
        if (!address) return;

        setWalletLoading(true);
        try {
            // Fetch token balance
            const tokenRes = await axios.get(`${API_URL}/api/wallet/${address}/balance`);
            setBzhBalance(tokenRes.data.balance || 0);

            // Fetch transactions
            const txRes = await axios.get(`${API_URL}/api/wallet/${address}/transactions`);
            const txData = Array.isArray(txRes.data) ? txRes.data : [];
            setTransactions(txData);
        } catch (error) {
            console.error('Error loading wallet data:', error);

            // Set default values
            setBzhBalance(parseFloat(tokenBalance || 0));
            setTransactions([]);

            // Only show error if it's not a 404
            if (error.response?.status !== 404) {
                toast.error('Error al cargar datos de la wallet');
            }
        } finally {
            setWalletLoading(false);
        }
    }, [address, tokenBalance]);

    // Effects
    useEffect(() => {
        if (isConnected && address) {
            loadProfileData();
            loadWalletData();
        }
    }, [isConnected, address, loadProfileData, loadWalletData]);

    // Sync edit fields when profile loads
    useEffect(() => {
        if (profile) {
            setEditUsername(profile.username || '');
            setEditBio(profile.bio || '');
        }
    }, [profile]);

    // Handlers
    const handleCopyAddress = useCallback(() => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            toast.success('Dirección copiada al portapapeles');
            setTimeout(() => setCopied(false), 2000);
        }
    }, [address]);

    const formatAddress = useCallback((addr) => {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }, []);

    const formatDate = useCallback((timestamp) => {
        try {
            return new Date(timestamp).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return 'Fecha no disponible';
        }
    }, []);

    const handleUpdateProfile = async () => {
        if (!editUsername.trim()) {
            return toast.error('El nombre de usuario no puede estar vacío.');
        }

        if (editBio.length > 500) {
            return toast.error('La biografía no puede exceder 500 caracteres.');
        }

        setIsSaving(true);
        try {
            // Update via API
            await axios.put(`${API_URL}/api/profile/${address}`, {
                username: editUsername,
                bio: editBio
            });

            toast.success('Perfil actualizado en el servidor');

            // Update on blockchain if contract is available
            if (userProfileContract && address) {
                try {
                    const tx = await userProfileContract.updateProfile(editUsername, editBio);
                    toast.loading('Actualizando perfil en blockchain...', { id: 'blockchain-update' });
                    await tx.wait();
                    toast.success('Perfil actualizado en blockchain', { id: 'blockchain-update' });

                    // Refresh data from blockchain
                    if (bezhasToken) {
                        await fetchUserData(address, userProfileContract, bezhasToken);
                    }
                } catch (blockchainError) {
                    console.error('Blockchain update failed:', blockchainError);
                    toast.error('Error al actualizar en blockchain, pero los datos se guardaron en el servidor');
                }
            }

            // Reload profile data
            await loadProfileData();
            toast.success('¡Perfil actualizado con éxito!');
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error(error?.response?.data?.message || error?.shortMessage || 'Error al actualizar el perfil');
        } finally {
            setIsSaving(false);
        }
    };

    const handleMessage = async () => {
        if (!connectedAddress) {
            toast.error('Conecta tu wallet para enviar mensajes');
            return;
        }

        setCheckingAccess(true);
        try {
            // Check access
            const response = await axios.get(`${API_URL}/api/chat/check-access/${address}?userAddress=${connectedAddress}`);

            if (response.data.hasAccess) {
                // Start chat
                const chatRes = await axios.post(`${API_URL}/api/chat/start-chat`, {
                    userAddress: connectedAddress,
                    targetId: address,
                    targetType: 'user'
                });

                if (chatRes.data.success) {
                    navigate(`/chat?id=${chatRes.data.chat.id}`);
                }
            } else {
                // Requires payment
                const confirmPayment = window.confirm(
                    `Este usuario requiere un pago de ${response.data.price} BEZ para chatear. ¿Deseas pagar ahora?`
                );

                if (confirmPayment) {
                    // Process payment (Mock)
                    const payRes = await axios.post(`${API_URL}/api/chat/pay-access`, {
                        userAddress: connectedAddress,
                        targetId: address,
                        amount: response.data.price,
                        txHash: '0x_mock_tx_hash_' + Date.now()
                    });

                    if (payRes.data.success) {
                        toast.success('¡Pago exitoso! Acceso concedido.');
                        // Start chat after payment
                        const chatRes = await axios.post(`${API_URL}/api/chat/start-chat`, {
                            userAddress: connectedAddress,
                            targetId: address,
                            targetType: 'user'
                        });
                        navigate(`/chat?id=${chatRes.data.chat.id}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking chat access:', error);
            toast.error('Error al iniciar chat');
        } finally {
            setCheckingAccess(false);
        }
    };

    // 🔐 DESCONEXIÓN SEGURA DE WALLET
    const { disconnectWallet } = useWalletConnect();

    const handleSecureDisconnect = useCallback(async () => {
        const success = await disconnectWallet();
        if (success) {
            toast.success('🔐 Wallet desconectada de forma segura');
        } else {
            toast.error('Error al desconectar. Intenta recargar la página.');
        }
    }, [disconnectWallet]);

    // Not connected state
    if (!isConnected) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                <div className="text-center p-8 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 max-w-md">
                    <Wallet className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Conecta tu Wallet</h2>
                    <p className="text-gray-400 mb-6">
                        Conecta tu wallet para acceder a tu perfil y todas las funcionalidades
                    </p>
                    <w3m-button />
                </div>
            </div>
        );
    }

    // Loading state
    if (profileLoading && !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
                <div className="text-center">
                    <Spinner size="lg" />
                    <p className="text-gray-400 mt-4">Cargando perfil...</p>
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
        { id: 'nfts', label: 'NFTs', icon: Grid },
        { id: 'activity', label: 'Actividad', icon: Activity },
    ];

    if (isOwnProfile) {
        tabs.push(
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'wallet', label: 'Wallet', icon: Wallet },
            { id: 'settings', label: 'Configuración', icon: SettingsIcon }
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Profile Header */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-700 mb-6 shadow-xl">
                    <div className="h-48 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600"></div>
                    <div className="p-6">
                        <div className="flex flex-col lg:flex-row items-start lg:items-end -mt-20 gap-6">
                            <img
                                src={profile?.avatar || `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=random&size=128`}
                                alt="Avatar"
                                className="w-32 h-32 rounded-full border-4 border-gray-800 shadow-xl"
                                onError={(e) => {
                                    e.target.src = `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=random&size=128`;
                                }}
                            />
                            <div className="flex-1 mb-2">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:items-between gap-4">
                                    <div>
                                        <h1 className="text-3xl font-bold text-white">
                                            {profile?.username || 'Usuario Anónimo'}
                                        </h1>
                                        <div className="flex items-center gap-2 text-gray-400 mt-1 flex-wrap">
                                            <span className="font-mono text-sm">{formatAddress(address)}</span>
                                            <button
                                                onClick={handleCopyAddress}
                                                className="hover:text-blue-400 transition-colors"
                                                title="Copiar dirección"
                                            >
                                                {copied ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                            <a
                                                href={`https://etherscan.io/address/${address}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-blue-400 transition-colors"
                                                title="Ver en Etherscan"
                                            >
                                                <ExternalLink size={16} />
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {!isOwnProfile && (
                                            <button
                                                onClick={handleMessage}
                                                disabled={checkingAccess}
                                                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                {checkingAccess ? <Spinner size="sm" /> : <MessageSquare size={16} />}
                                                <span>Mensaje</span>
                                            </button>
                                        )}
                                        <DonateButton
                                            recipientAddress={address}
                                            recipientName={profile?.username || 'Usuario Anónimo'}
                                            size="md"
                                        />
                                        {isOwnProfile && (
                                            <button
                                                onClick={() => setActiveTab('settings')}
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg flex items-center gap-2 transition-colors"
                                            >
                                                <SettingsIcon size={16} />
                                                <span>Configuración</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="mt-4 text-gray-400 max-w-3xl">
                            {profile?.bio || 'Este usuario aún no ha añadido una biografía.'}
                        </p>

                        {/* Quick Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                            {/* BEZ Balance - SOLO VISIBLE PARA EL PROPIO USUARIO (PRIVACIDAD) */}
                            {isOwnProfile ? (
                                <div className="bg-gray-900/50 rounded-lg p-4 group relative overflow-hidden border border-cyan-500/30">
                                    <div className="relative z-10 flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm text-cyan-400 flex items-center gap-1">
                                                    💰 Mi Balance BEZ
                                                </p>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleBalanceVisibility();
                                                    }}
                                                    className="text-cyan-400 hover:text-white transition-colors"
                                                    title={balanceVisible ? "Ocultar balance" : "Mostrar balance"}
                                                >
                                                    {balanceVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                                                </button>
                                            </div>
                                            <p className="text-2xl font-bold text-white mt-1">
                                                {balanceVisible ? (
                                                    parseFloat(tokenBalance || bzhBalance || 0).toFixed(2)
                                                ) : (
                                                    <span className="tracking-widest">••••••</span>
                                                )}
                                            </p>
                                            {balanceVisible && parseFloat(tokenBalance || bzhBalance || 0) < 10 && (
                                                <p className="text-xs text-orange-400 mt-1">⚠️ Balance bajo</p>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setShowBuyModal(true)}
                                            className="p-2 bg-blue-600/20 hover:bg-blue-600 rounded-lg text-blue-400 hover:text-white transition-all transform hover:scale-110"
                                            title="Comprar BEZ"
                                        >
                                            <ShoppingBag size={18} />
                                        </button>
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/0 via-cyan-600/5 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                </div>
                            ) : (
                                /* Para otros perfiles: mostrar indicador sin balance */
                                <div className="bg-gray-900/50 rounded-lg p-4 group relative overflow-hidden">
                                    <div className="relative z-10">
                                        <p className="text-sm text-gray-400">💎 Tokens BEZ</p>
                                        <p className="text-lg font-medium text-gray-500 mt-1">
                                            Información privada
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* ETH Balance - SOLO VISIBLE PARA EL PROPIO USUARIO */}
                            {isOwnProfile ? (
                                <div className="bg-gray-900/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400">ETH Balance</p>
                                    <p className="text-2xl font-bold text-white">
                                        {ethBalanceLoading ? (
                                            <Spinner size="sm" />
                                        ) : ethBalance ? (
                                            parseFloat(ethBalance.formatted).toFixed(4)
                                        ) : (
                                            '0.00'
                                        )}
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-gray-900/50 rounded-lg p-4">
                                    <p className="text-sm text-gray-400">⛽ ETH</p>
                                    <p className="text-lg font-medium text-gray-500 mt-1">
                                        Información privada
                                    </p>
                                </div>
                            )}

                            <div className="bg-gray-900/50 rounded-lg p-4">
                                <p className="text-sm text-gray-400">Posts</p>
                                <p className="text-2xl font-bold text-white">{profile?.postsCount || 0}</p>
                            </div>
                            <div className="bg-gray-900/50 rounded-lg p-4">
                                <p className="text-sm text-gray-400">Seguidores</p>
                                <p className="text-2xl font-bold text-white">{profile?.followersCount || 0}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-2 mb-6">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/50'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                                        }`}
                                >
                                    <Icon size={18} />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="space-y-6">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Profile Info */}
                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <User className="text-blue-400" size={22} />
                                        Información Personal
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-sm text-gray-400">Email</p>
                                            <p className="text-white">{profile?.email || 'No configurado'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Miembro desde</p>
                                            <p className="text-white">
                                                {profile?.createdAt ? formatDate(profile.createdAt) : 'Hoy'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Rol</p>
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${profile?.role === 'admin'
                                                ? 'bg-purple-900/50 text-purple-300'
                                                : 'bg-gray-700 text-gray-300'
                                                }`}>
                                                {profile?.role || 'Usuario'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Wallet Summary */}
                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Wallet className="text-green-400" size={22} />
                                        Resumen Wallet
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-gray-400">Balance Total</p>
                                            <p className="text-2xl font-bold text-white">
                                                {parseFloat(tokenBalance || bzhBalance || 0).toFixed(2)} BZH
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-400">Transacciones</p>
                                            <p className="text-white">{transactions.length} operaciones</p>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('wallet')}
                                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                                        >
                                            Ver Wallet Completa
                                        </button>
                                    </div>
                                </div>

                                {/* Quick Access - Páginas Principales */}
                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <Activity className="text-cyan-400" size={22} />
                                        Acceso Rápido
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Link
                                            to="/social"
                                            className="bg-gradient-to-br from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-semibold py-3 px-4 rounded-lg transition-all flex flex-col items-center gap-2 shadow-lg hover:shadow-pink-600/50"
                                        >
                                            <MessageCircle size={24} />
                                            <span className="text-sm">BeHistory</span>
                                        </Link>
                                        <Link
                                            to="/chat"
                                            className="bg-gradient-to-br from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 px-4 rounded-lg transition-all flex flex-col items-center gap-2 shadow-lg hover:shadow-purple-600/50"
                                        >
                                            <MessageSquare size={24} />
                                            <span className="text-sm">Chat IA</span>
                                        </Link>
                                        <Link
                                            to="/notifications"
                                            className="bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold py-3 px-4 rounded-lg transition-all flex flex-col items-center gap-2 shadow-lg hover:shadow-blue-600/50"
                                        >
                                            <Bell size={24} />
                                            <span className="text-sm">Notificaciones</span>
                                        </Link>
                                        <Link
                                            to="/rewards"
                                            className="bg-gradient-to-br from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white font-semibold py-3 px-4 rounded-lg transition-all flex flex-col items-center gap-2 shadow-lg hover:shadow-yellow-600/50"
                                        >
                                            <Gift size={24} />
                                            <span className="text-sm">Recompensas</span>
                                        </Link>
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                        <TrendingUpIcon className="text-yellow-400" size={22} />
                                        Acciones Rápidas
                                    </h3>
                                    <div className="space-y-3">
                                        {/* MoonPay Buy/Sell Crypto */}
                                        <MoonPayQuickActions />

                                        <Link to="/staking" className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-center transition-colors">
                                            Staking
                                        </Link>
                                        <Link to="/marketplace" className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded-lg text-center transition-colors">
                                            Marketplace
                                        </Link>
                                        <button
                                            onClick={handleSecureDisconnect}
                                            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors group"
                                            title="Desconexión segura de wallet"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                🔐 Desconectar Wallet
                                                <span className="text-xs opacity-75 group-hover:opacity-100">(seguro)</span>
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <Link to="/ad-center" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-blue-600/50 transition-all">
                                    <span role="img" aria-label="ads">📢</span> Centro de Anuncios
                                </Link>
                            </div>
                        </>
                    )}

                    {/* NFTS TAB */}
                    {activeTab === 'nfts' && (
                        <div className="space-y-6">
                            <ProfileNFTGrid address={address} isOwnProfile={isOwnProfile} />
                        </div>
                    )}

                    {/* DASHBOARD TAB */}
                    {isOwnProfile && activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            <MainEventWidget />
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-6">
                                    <KeyMetricsWidget />
                                    <ActivityGraphWidget />
                                </div>
                                <div className="lg:col-span-1 space-y-6">
                                    <UserProfileWidget />
                                    <SocialWidget />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* WALLET TAB */}
                    {isOwnProfile && activeTab === 'wallet' && (
                        <>
                            {/* Balance Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 shadow-xl">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white text-lg font-semibold">Balance BZH</h3>
                                        <Wallet className="text-blue-200" size={24} />
                                    </div>
                                    <p className="text-4xl font-bold text-white mb-2">
                                        {parseFloat(bzhBalance || tokenBalance || 0).toFixed(2)}
                                    </p>
                                    <p className="text-blue-200 text-sm">BeZhas Tokens</p>
                                </div>

                                <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-xl p-6 shadow-xl">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white text-lg font-semibold">Balance ETH</h3>
                                        <TrendingUp className="text-purple-200" size={24} />
                                    </div>
                                    {ethBalanceLoading ? (
                                        <div className="py-4">
                                            <Spinner size="md" />
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-4xl font-bold text-white mb-2">
                                                {ethBalance ? parseFloat(ethBalance.formatted).toFixed(4) : '0.00'}
                                            </p>
                                            <p className="text-purple-200 text-sm">Ethereum</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <button className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:bg-gray-700/50 transition-colors text-left">
                                    <Send className="text-blue-400 mb-2" size={24} />
                                    <h4 className="text-white font-semibold">Enviar</h4>
                                    <p className="text-gray-400 text-sm">Transferir tokens</p>
                                </button>
                                <button className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:bg-gray-700/50 transition-colors text-left">
                                    <ArrowDownToLine className="text-green-400 mb-2" size={24} />
                                    <h4 className="text-white font-semibold">Recibir</h4>
                                    <p className="text-gray-400 text-sm">Obtener tokens</p>
                                </button>
                                <button className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-4 hover:bg-gray-700/50 transition-colors text-left">
                                    <TrendingUp className="text-yellow-400 mb-2" size={24} />
                                    <h4 className="text-white font-semibold">Swap</h4>
                                    <p className="text-gray-400 text-sm">Intercambiar tokens</p>
                                </button>
                            </div>

                            {/* Transaction History */}
                            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                        <History className="text-blue-400" size={22} />
                                        Historial de Transacciones
                                    </h3>
                                    <button
                                        onClick={loadWalletData}
                                        className="text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                                        disabled={walletLoading}
                                        title="Recargar transacciones"
                                    >
                                        <RefreshCw size={18} className={walletLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>

                                {walletLoading ? (
                                    <div className="text-center py-8">
                                        <Spinner size="lg" />
                                    </div>
                                ) : transactions.length > 0 ? (
                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {transactions.slice(0, 20).map((tx, index) => (
                                            <div key={tx.hash || index} className="bg-gray-900/50 rounded-lg p-4 hover:bg-gray-900/70 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'send' ? 'bg-red-900/50' : 'bg-green-900/50'
                                                            }`}>
                                                            {tx.type === 'send' ? (
                                                                <Send size={18} className="text-red-300" />
                                                            ) : (
                                                                <ArrowDownToLine size={18} className="text-green-300" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-white font-semibold">
                                                                {tx.type === 'send' ? 'Enviado' : 'Recibido'}
                                                            </p>
                                                            <p className="text-gray-400 text-sm">
                                                                {formatAddress(tx.from)} → {formatAddress(tx.to)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`font-bold ${tx.type === 'send' ? 'text-red-400' : 'text-green-400'
                                                            }`}>
                                                            {tx.type === 'send' ? '-' : '+'}{tx.amount} BZH
                                                        </p>
                                                        <p className="text-gray-400 text-sm">
                                                            {formatDate(tx.timestamp)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                        <p className="text-gray-400">No hay transacciones todavía</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* ACTIVITY TAB */}
                    {activeTab === 'activity' && (
                        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Activity className="text-purple-400" size={22} />
                                Actividad Reciente
                            </h3>
                            <div className="text-center py-12">
                                <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400">Tu actividad aparecerá aquí</p>
                            </div>
                        </div>
                    )}

                    {/* SETTINGS TAB */}
                    {isOwnProfile && activeTab === 'settings' && (
                        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
                            {/* Settings Header */}
                            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 p-6 border-b border-gray-700">
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <SettingsIcon className="text-purple-400" size={28} />
                                    Configuración de Perfil
                                </h3>
                                <p className="text-gray-400 mt-2">
                                    Gestiona la información de tu cuenta y preferencias
                                </p>
                            </div>

                            {/* Settings Sections */}
                            <div className="p-6 space-y-8">
                                {/* Account Settings Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 pb-3 border-b border-gray-700">
                                        <User className="text-blue-400" size={24} />
                                        <h4 className="text-xl font-semibold text-white">Información de Cuenta</h4>
                                    </div>

                                    {/* Username Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">
                                            Nombre de Usuario
                                        </label>
                                        <input
                                            type="text"
                                            value={editUsername}
                                            onChange={(e) => setEditUsername(e.target.value)}
                                            placeholder="Ingresa tu nombre de usuario"
                                            maxLength={50}
                                            className="w-full bg-gray-900/70 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Este nombre se mostrará en tu perfil público
                                        </p>
                                    </div>

                                    {/* Bio Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">
                                            Biografía
                                        </label>
                                        <textarea
                                            value={editBio}
                                            onChange={(e) => setEditBio(e.target.value)}
                                            rows={4}
                                            maxLength={500}
                                            placeholder="Cuéntanos sobre ti..."
                                            className="w-full bg-gray-900/70 text-white border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            {editBio.length}/500 caracteres
                                        </p>
                                    </div>

                                    {/* Wallet Address (Read-only) */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">
                                            Dirección de Wallet
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={address || ''}
                                                readOnly
                                                className="flex-1 bg-gray-900/50 text-gray-400 border border-gray-700 rounded-lg px-4 py-3 cursor-not-allowed"
                                            />
                                            <button
                                                onClick={handleCopyAddress}
                                                className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg transition-colors"
                                                title="Copiar dirección"
                                            >
                                                {copied ? <Check size={20} /> : <Copy size={20} />}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Tu dirección de wallet no puede ser modificada
                                        </p>
                                    </div>

                                    {/* Save Button */}
                                    <div className="flex justify-end pt-4">
                                        <button
                                            onClick={handleUpdateProfile}
                                            disabled={isSaving || !editUsername.trim()}
                                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-8 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-900/50"
                                        >
                                            {isSaving ? (
                                                <>
                                                    <Spinner size="sm" />
                                                    <span>Guardando...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Save size={20} />
                                                    <span>Guardar Cambios</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Payment Methods Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 pb-3 border-b border-gray-700">
                                        <CreditCard className="text-purple-400" size={24} />
                                        <h4 className="text-xl font-semibold text-white">Métodos de Pago</h4>
                                    </div>

                                    {/* Wallet Connection */}
                                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                                <Wallet className="w-6 h-6 text-purple-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h5 className="text-lg font-semibold text-white mb-1">Crypto Wallet</h5>
                                                <p className="text-sm text-gray-400 mb-3">
                                                    Conecta tu wallet para pagos con criptomonedas
                                                </p>
                                                {address ? (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full flex items-center gap-1">
                                                                <Check size={14} />
                                                                Conectada
                                                            </span>
                                                            <span className="text-sm text-gray-400">
                                                                {address.slice(0, 6)}...{address.slice(-4)}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                if (window.ethereum) {
                                                                    try {
                                                                        await window.ethereum.request({
                                                                            method: 'wallet_requestPermissions',
                                                                            params: [{ eth_accounts: {} }],
                                                                        });
                                                                    } catch (error) {
                                                                        console.error('Error cambiando wallet:', error);
                                                                    }
                                                                }
                                                            }}
                                                            className="text-xs text-purple-400 hover:text-purple-300 underline"
                                                        >
                                                            Cambiar wallet
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={async () => {
                                                            if (window.ethereum) {
                                                                try {
                                                                    await window.ethereum.request({ method: 'eth_requestAccounts' });
                                                                    window.location.reload();
                                                                } catch (error) {
                                                                    console.error('Error conectando wallet:', error);
                                                                }
                                                            } else {
                                                                alert('Por favor instala MetaMask u otra wallet compatible');
                                                            }
                                                        }}
                                                        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                                                    >
                                                        Conectar Wallet
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stripe Connection */}
                                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                <CreditCard className="w-6 h-6 text-blue-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h5 className="text-lg font-semibold text-white mb-1">Stripe</h5>
                                                <p className="text-sm text-gray-400 mb-3">
                                                    Conecta Stripe para pagos con tarjeta de crédito/débito
                                                </p>
                                                {localStorage.getItem('stripe_connected') === 'true' ? (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full flex items-center gap-1">
                                                                <Check size={14} />
                                                                Conectado
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('¿Deseas desconectar Stripe?')) {
                                                                    localStorage.removeItem('stripe_connected');
                                                                    window.location.reload();
                                                                }
                                                            }}
                                                            className="text-xs text-red-400 hover:text-red-300 underline"
                                                        >
                                                            Desconectar Stripe
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            // Simulación de conexión con Stripe
                                                            localStorage.setItem('stripe_connected', 'true');
                                                            alert('Stripe conectado exitosamente');
                                                            window.location.reload();
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                                                    >
                                                        Conectar Stripe
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm text-blue-300 font-medium mb-1">
                                                    Actualización Automática
                                                </p>
                                                <p className="text-xs text-blue-400">
                                                    Los cambios en tus métodos de pago se actualizan inmediatamente en todo el marketplace. No necesitas reconfigurar tus productos.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Security Section (Coming Soon) */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 pb-3 border-b border-gray-700">
                                        <Shield className="text-green-400" size={24} />
                                        <h4 className="text-xl font-semibold text-white">Seguridad</h4>
                                    </div>
                                    <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 rounded-full bg-blue-500/20">
                                                <Shield className="w-8 h-8 text-blue-400" />
                                            </div>
                                            <div className="flex-1">
                                                <h5 className="text-lg font-semibold text-white mb-2">
                                                    Protege tu cuenta
                                                </h5>
                                                <p className="text-gray-400 text-sm mb-4">
                                                    Activa la autenticación de dos factores (2FA) y passkeys biométricas para máxima seguridad.
                                                </p>
                                                <div className="flex flex-wrap gap-3">
                                                    <a
                                                        href="/settings"
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                                                    >
                                                        <Shield size={18} />
                                                        Configurar Seguridad
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Notifications Section (Coming Soon) */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 pb-3 border-b border-gray-700">
                                        <Bell className="text-yellow-400" size={24} />
                                        <h4 className="text-xl font-semibold text-white">Notificaciones</h4>
                                    </div>
                                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-center">
                                        <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-400">
                                            Preferencias de notificaciones disponibles próximamente
                                        </p>
                                    </div>
                                </div>

                                {/* Wallet Diagnostics (Dev Tool) */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 pb-3 border-b border-gray-700">
                                        <Activity className="text-purple-400" size={24} />
                                        <h4 className="text-xl font-semibold text-white">Diagnóstico de Wallet</h4>
                                    </div>
                                    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                                        <p className="text-sm text-gray-400 mb-4">
                                            Herramienta para desarrolladores para verificar el estado de la conexión Web3.
                                        </p>
                                        <div className="relative">
                                            <WalletDiagnosticPanel />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
};

export default ProfilePage;
