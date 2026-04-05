import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { clearWalletStorage, secureWalletCleanup } from '../../lib/web3/walletStorage';

// Helper to format time ago
function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return 'Justo ahora';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

import { Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Sun, Moon, Wallet, ShoppingBag, LogIn, UserPlus, User, LogOut, Coins, Sparkles, ExternalLink, Globe, Eye, EyeOff } from 'lucide-react';
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useBezCoin } from '../../context/BezCoinContext';
import InsufficientFundsModal from '../modals/InsufficientFundsModal';
import AuthModal from '../modals/AuthModal';
// BuyBezCoinModal ELIMINADO – ahora se usa BezPayModal vía useBezPay() hook global
import { useBezPay } from '../../context/BezPayContext';
import WalletHeaderButton from '../common/WalletHeaderButton';
import UnifiedBuyBezButton from '../UnifiedBuyBezButton';
import { ethers } from 'ethers';
import { BezhasTokenAddress, TokenSaleAddress, TokenSaleABI, BezhasTokenABI } from '../../contract-config';
import { FaCoins } from 'react-icons/fa';

const Header = () => {

  // Notification popup state
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const {
    notifications,
    loading: notificationsLoading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotifications();

  // Close popup on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useWeb3Modal();
  const navigate = useNavigate();
  const { openBuyBez } = useBezPay(); // BezPay v2 – reemplaza BuyBezCoinModal
  const {
    balance,
    showBuyModal,
    setShowBuyModal,
    insufficientFundsModal,
    setInsufficientFundsModal,
    balanceVisible,
    toggleBalanceVisibility
  } = useBezCoin();

  // Cuando BezCoinContext quiere abrir el modal de compra, usar BezPayModal
  // (Este effect puente permite migración gradual sin romper BezCoinContext)
  useEffect(() => {
    if (showBuyModal) {
      setShowBuyModal(false);      // cerrar el flag del contexto
      openBuyBez();                // abrir el nuevo BezPayModal
    }
  }, [showBuyModal]);

  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [bezBalance, setBezBalance] = useState('0');

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Función para leer balance del contrato BEZ
  const fetchBezBalance = async () => {
    if (!isConnected || !address || !BezhasTokenAddress) return;

    try {
      let provider;
      if (window.ethereum) {
        provider = new ethers.BrowserProvider(window.ethereum);
        const network = await provider.getNetwork();
        if (network.chainId !== 137n && network.chainId !== 80002n && network.chainId !== 31337n) {
          provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
        }
      } else {
          provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
      }

      // Verificar si el contrato existe en la red
      const code = await provider.getCode(BezhasTokenAddress);
      if (code === '0x') {
        console.warn("BezhasToken contract not deployed at address:", BezhasTokenAddress);
        setBezBalance('0');
        return;
      }

      const contract = new ethers.Contract(BezhasTokenAddress, BezhasTokenABI, provider);

      // Llamada al contrato
      const balance = await contract.balanceOf(address);
      const formatted = ethers.formatUnits(balance, 18); // Asumiendo 18 decimales
      setBezBalance(parseFloat(formatted).toFixed(2));
    } catch (error) {
      console.error("Error fetching BEZ balance:", error);
      setBezBalance('0');
    }
  };

  // Actualizar cuando cambia la cuenta o la red
  useEffect(() => {
    if (isConnected) {
      fetchBezBalance();
    }
  }, [isConnected, address]);

  // Auto-refresh balance every 10 seconds when connected
  useEffect(() => {
    if (!isConnected || !address) return;

    const refreshInterval = setInterval(() => {
      // El BezCoinContext ya tiene su propio polling, pero forzamos un refresh visual
      // Silencioso para no saturar la consola
    }, 10000); // 10 segundos

    return () => clearInterval(refreshInterval);
  }, [isConnected, address]);

  // Auto-hide header on scroll
  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };


    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  // 🔐 FUNCIÓN SEGURA PARA CONECTAR WALLET
  const handleConnectWallet = async () => {
    try {
      // Cerrar cualquier menú abierto
      setShowUserMenu(false);
      setShowAuthModal(false);

      // Abrir el modal de Web3Modal
      await open();

      // Log para debugging (en producción se puede comentar)
      if (import.meta.env.DEV) {
        console.log('🔐 Iniciando conexión de wallet...');
      }
    } catch (error) {
      console.error('❌ Error al conectar wallet:', error);

      // Mostrar mensaje de error al usuario
      alert('Error al conectar la wallet. Por favor, intenta de nuevo.');
    }
  };

  // 🔐 FUNCIÓN SEGURA PARA DESCONECTAR WALLET
  const handleDisconnect = async () => {
    try {
      // Confirmar desconexión para mayor seguridad (opcional - puedes descomentar)
      // const confirmed = window.confirm('¿Estás seguro de que deseas desconectar tu wallet?');
      // if (!confirmed) return;

      // Log para debugging
      if (import.meta.env.DEV) {
        console.log('🔓 Iniciando desconexión segura de wallet...');
      }

      // 1. Limpiar storage de forma segura y completa
      await secureWalletCleanup();

      // 2. Desconectar de Wagmi
      await disconnect();

      // 3. Cerrar menú dropdown
      setShowUserMenu(false);

      // 4. Logout del usuario si está autenticado
      if (user) {
        logout();
      }

      // Mensaje de confirmación
      if (import.meta.env.DEV) {
        console.log('✅ Wallet desconectada exitosamente de forma segura');
      }

      // Notificar al usuario visualmente (opcional)
      // alert('✅ Wallet desconectada correctamente');

    } catch (error) {
      console.error('❌ Error al desconectar wallet:', error);

      // Intentar limpieza forzada en caso de error
      try {
        clearWalletStorage();
        await disconnect();
        setShowUserMenu(false);
        if (import.meta.env.DEV) {
          console.log('⚠️ Limpieza forzada completada');
        }
      } catch (cleanupError) {
        console.error('❌ Error en limpieza forzada:', cleanupError);
        // Mostrar mensaje al usuario
        alert('Hubo un problema al desconectar. Por favor, recarga la página.');
      }
    }
  };

  const formatAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // 🎯 Configuración del botón unificado inteligente
  const getUnifiedButtonConfig = () => {
    // Prioridad 1: Wallet Conectada (Web3)
    if (isConnected && address) {
      return {
        type: 'wallet',
        text: formatAddress(address),
        icon: <Wallet size={18} />,
        className: 'from-purple-600 to-indigo-600',
        onClick: () => setShowUserMenu(!showUserMenu)
      };
    }

    // Prioridad 2: Usuario Logueado (Auth tradicional)
    if (user) {
      return {
        type: 'user',
        text: user.name || user.email?.split('@')[0] || 'Mi Perfil',
        icon: <User size={18} />,
        className: 'from-cyan-500 to-blue-500',
        onClick: () => setShowUserMenu(!showUserMenu)
      };
    }

    // Prioridad 3: Usuario NO Autenticado - Abre dropdown para conectar
    return {
      type: 'guest',
      text: 'Conectar',
      icon: <Wallet size={18} />,
      className: 'from-purple-500 to-pink-500',
      onClick: () => setShowUserMenu(!showUserMenu) // Abre dropdown en lugar de modal
    };
  };

  const unifiedButton = getUnifiedButtonConfig();

  return (
    <>
      <header
        className={`header-float bg-white dark:bg-gray-900 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 ${isVisible ? 'header-show' : 'header-hide'
          }`}
      >
        <div className="flex justify-between items-center px-6 h-16">
          {/* Left Section - Search */}
          <div className="flex items-center gap-6 flex-1 max-w-2xl">
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-3 w-full max-w-xl transition-colors">
              <Search size={22} className="text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                className="bg-transparent focus:outline-none ml-3 w-full placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-3">
            {/* 🔐 BEZ Balance Display - Privado con toggle para mostrar/ocultar */}
            {isConnected && (
              <div
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                title={balanceVisible ? "Click para ocultar balance" : "Click para mostrar balance"}
              >
                <FaCoins className="text-yellow-300 group-hover:animate-bounce" size={18} />

                {balanceVisible ? (
                  <>
                    <span className="font-bold hidden sm:inline">
                      {parseFloat(balance).toFixed(2)} BEZ
                    </span>
                    <span className="font-bold sm:hidden">
                      {parseFloat(balance).toFixed(0)}
                    </span>
                  </>
                ) : (
                  <span className="font-bold tracking-wider">
                    ••••••
                  </span>
                )}

                {/* Toggle de visibilidad */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBalanceVisibility();
                  }}
                  className="ml-1 p-1 rounded-full hover:bg-white/20 transition-colors"
                  title={balanceVisible ? "Ocultar balance" : "Mostrar balance"}
                  aria-label={balanceVisible ? "Ocultar balance de BEZ" : "Mostrar balance de BEZ"}
                >
                  {balanceVisible ? (
                    <Eye size={14} className="opacity-80 hover:opacity-100" />
                  ) : (
                    <EyeOff size={14} className="opacity-80 hover:opacity-100" />
                  )}
                </button>
              </div>
            )}

            {/* Buy BEZ Tokens Button */}
            {isConnected && (
              <UnifiedBuyBezButton
                variant="primary"
                size="md"
                className="shadow-lg hover:shadow-xl"
              />
            )}

            {/* Language Switcher */}
            <button
              onClick={() => {
                const translateElement = document.getElementById('google_translate_element');
                if (translateElement) {
                  const select = translateElement.querySelector('select');
                  if (select) {
                    select.dispatchEvent(new MouseEvent('mousedown'));
                  }
                }
              }}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              aria-label="Cambiar idioma"
              title="Traducir página"
            >
              <Globe size={24} className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              aria-label={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            >
              {theme === 'light' ? (
                <Moon size={24} className="text-gray-600" />
              ) : (
                <Sun size={24} className="text-yellow-500" />
              )}
            </button>

            {/* 🔐 NUEVO: Botón Inteligente de Wallet (ELIMINADO POR DUPLICIDAD) */}
            {/* <WalletHeaderButton /> */}

            {/* 🎯 BOTÓN UNIFICADO INTELIGENTE con Dropdown */}
            <div className="relative z-50">
              <button
                onClick={unifiedButton.onClick}
                className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${unifiedButton.className} 
                           hover:opacity-90 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl`}
                title={unifiedButton.type === 'guest' ? 'Conectar o Iniciar Sesión' : unifiedButton.text}
              >
                {unifiedButton.icon}
                <span className="hidden md:inline">{unifiedButton.text}</span>
              </button>

              {/* User Dropdown Menu - Visible para conectados y no conectados */}
              {showUserMenu && (
                <>
                  {/* Overlay para cerrar menú al hacer clic fuera */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />

                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50 animate-fadeIn">

                    {/* Contenido para wallet NO conectada */}
                    {!isConnected && (
                      <>
                        <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500">
                          <p className="text-white text-sm font-semibold flex items-center gap-2">
                            <Wallet size={16} />
                            Wallet Conectada
                          </p>
                          <p className="text-white/90 text-xs mt-1">No hay wallet conectada</p>
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="text-center py-4">
                            <div className="text-6xl mb-3 animate-pulse">🔐</div>
                            <h3 className="font-bold text-xl text-gray-800 dark:text-white mb-2">Conecta tu Wallet</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                              Conecta tu wallet MetaMask o WalletConnect para acceder a todas las funciones de BeZhas
                            </p>
                          </div>

                          {/* Botón Conectar Wallet */}
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              open();
                            }}
                            className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <Wallet size={20} />
                            <span>Conectar Wallet</span>
                          </button>

                          <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-3">
                            Soportamos MetaMask, WalletConnect y más
                          </div>
                        </div>
                      </>
                    )}

                    {/* Contenido para wallet CONECTADA */}
                    {isConnected && (
                      <>
                        {/* Header del Dropdown */}
                        <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-500">
                          <p className="text-white text-sm font-semibold flex items-center gap-2">
                            <Wallet size={16} />
                            Wallet Conectada
                          </p>
                          <p className="text-white/90 text-xs font-mono mt-1 break-all">{address}</p>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(address);
                              // Feedback silencioso
                            }}
                            className="text-white/80 hover:text-white text-xs mt-2 flex items-center gap-1 transition-colors"
                            title="Copiar dirección"
                          >
                            📋 Copiar dirección
                          </button>
                        </div>

                        <div className="p-4 space-y-3">
                          {/* Balances */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-default border border-blue-200 dark:border-blue-800">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">💰 ETH Balance:</span>
                              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {ethBalance ? parseFloat(ethBalance.formatted).toFixed(4) : '0.0000'} ETH
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-lg border-2 border-cyan-400 dark:border-cyan-600 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all cursor-default">
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1">
                                <FaCoins className="text-yellow-500" /> BEZ Balance:
                              </span>
                              <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                                {bezBalance} BEZ
                              </span>
                            </div>
                          </div>

                          <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>

                          {/* Menu Items */}
                          <Link
                            to="/profile"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all group cursor-pointer border border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                          >
                            <User size={18} className="text-gray-600 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                            <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">Mi Perfil</span>
                            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 group-hover:text-purple-500">→</span>
                          </Link>

                          <Link
                            to="/logistics"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all group cursor-pointer border border-transparent hover:border-blue-300 dark:hover:border-blue-700"
                          >
                            <span className="text-lg">🚢</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">Logística (Demo)</span>
                            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 group-hover:text-blue-500">→</span>
                          </Link>

                          <Link
                            to="/wallet"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all group cursor-pointer border border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                          >
                            <Wallet size={18} className="text-gray-600 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                            <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">Mi Wallet</span>
                            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 group-hover:text-purple-500">→</span>
                          </Link>

                          <Link
                            to="/marketplace"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all group cursor-pointer border border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                          >
                            <ShoppingBag size={18} className="text-gray-600 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                            <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">Marketplace</span>
                            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 group-hover:text-purple-500">→</span>
                          </Link>

                          <Link
                            to="/settings"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all group cursor-pointer border border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                          >
                            <Coins size={18} className="text-gray-600 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                            <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">Configuración</span>
                            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 group-hover:text-purple-500">→</span>
                          </Link>

                          <a
                            href={`https://polygonscan.com/address/${address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all group cursor-pointer border border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                          >
                            <ExternalLink size={18} className="text-gray-600 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors" />
                            <span className="font-semibold text-gray-700 dark:text-gray-200 group-hover:text-purple-600 dark:group-hover:text-purple-400">Ver en PolygonScan</span>
                            <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 group-hover:text-purple-500">↗</span>
                          </a>

                          <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>

                          {/* Disconnect Button con icono de seguridad */}
                          <button
                            onClick={() => {
                              handleDisconnect();
                              setShowUserMenu(false);
                            }}
                            className="w-full flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg transition-all font-semibold group cursor-pointer border border-red-200 dark:border-red-800 hover:border-red-400 dark:hover:border-red-600"
                            title="Desconectar wallet de forma segura"
                          >
                            <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
                            <span>🔐 Desconectar Wallet</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 relative transition-all"
                aria-label="Notificaciones"
                onClick={() => setShowNotifications((v) => !v)}
              >
                <Bell size={24} className="text-gray-500 dark:text-gray-400" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              {showNotifications && (
                <div
                  ref={notificationRef}
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 p-4"
                  style={{ minHeight: '80px' }}
                >
                  <div className="font-semibold text-lg mb-2 text-gray-900 dark:text-white">Notificaciones</div>
                  {notificationsLoading ? (
                    <div className="text-center text-gray-400 py-6">Cargando notificaciones...</div>
                  ) : !Array.isArray(notifications) || notifications.length === 0 || unreadCount === 0 ? (
                    <div className="text-center text-gray-500 py-6">Por ahora estas actualizado</div>
                  ) : (
                    <ul className="space-y-2 max-h-60 overflow-y-auto">
                      {notifications.filter(n => !n.read).slice(0, 5).map(n => (
                        <li key={n.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                          <span className="text-xl">🔔</span>
                          <div className="flex-1">
                            <div className="font-semibold text-sm text-gray-900 dark:text-white">{n.title || 'Notificación'}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">{n.message}</div>
                          </div>
                          <span className="text-xs text-gray-400">{formatTimeAgo(n.timestamp)}</span>
                          <button
                            className="ml-2 text-xs text-purple-600 hover:underline"
                            onClick={() => markAsRead(n.id)}
                            title="Marcar como leída"
                          >✓</button>
                          <button
                            className="ml-1 text-xs text-red-400 hover:text-red-600"
                            onClick={() => deleteNotification(n.id)}
                            title="Eliminar"
                          >✕</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* BuyBezCoinModal ELIMINADO – ahora gestionado por BezPayModal global en App.jsx */}
      {/* InsufficientFundsModal se mantiene para UX de fondos insuficientes */}
      <InsufficientFundsModal
        isOpen={insufficientFundsModal.show}
        onClose={() => setInsufficientFundsModal({ show: false, requiredAmount: 0, actionName: '', onPurchaseComplete: null })}
        requiredAmount={insufficientFundsModal.requiredAmount}
        currentBalance={balance}
        actionName={insufficientFundsModal.actionName}
        onPurchaseComplete={insufficientFundsModal.onPurchaseComplete}
      />

      {/* Auth Modal - Opciones de Conexión */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onConnectWallet={handleConnectWallet}
      />
    </>
  );
};

export default Header;
