"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Bell, Sun, Moon, Wallet, User, LogOut } from 'lucide-react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useUserStore } from '../../stores/userStore';
import { SUBAPPS, subappUrl } from '../../config/subapps';

export default function Navbar() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Hooks
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { open } = useWeb3Modal();
  const { user, logout } = useUserStore();

  // Scroll effect
  useEffect(() => {
    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 10) setIsVisible(true);
      else if (currentScrollY > lastScrollY) setIsVisible(false);
      else setIsVisible(true);
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', controlHeader);
    return () => window.removeEventListener('scroll', controlHeader);
  }, [lastScrollY]);

  const handleDisconnect = async () => {
    disconnect();
    logout();
    setShowUserMenu(false);
  };

  const getUnifiedButtonConfig = () => {
    if (isConnected && address) {
      return {
        text: `${address.slice(0, 6)}...${address.slice(-4)}`,
        icon: <Wallet size={18} />,
        className: 'from-primary-600 to-primary-800'
      };
    }
    if (user) {
      return {
        text: user.name || 'Mi Perfil',
        icon: <User size={18} />,
        className: 'from-cyan-500 to-blue-500'
      };
    }
    return {
      text: 'Conectar',
      icon: <Wallet size={18} />,
      className: 'from-primary-500 to-accent-600'
    };
  };

  const unifiedButton = getUnifiedButtonConfig();

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md border-b border-light-border dark:border-gray-800 transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="flex justify-between items-center px-6 h-16">
        
        {/* Left Section - Logo + Search */}
        <div className="flex items-center gap-6 flex-1 max-w-2xl">
          <Link href="/" className="text-xl font-display font-bold text-primary-900 dark:text-primary-100 flex items-center gap-2">
            <span className="bg-gradient-primary text-transparent bg-clip-text">BeZhas</span>
          </Link>
          <div className="hidden lg:flex items-center gap-6">
            <Link href="/feed" className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Feed</Link>
            <a href={subappUrl('capital', '/marketplace')} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Marketplace</a>
            <a href={subappUrl('capital', '/rwa')} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">RWA</a>
            <a href={SUBAPPS.wallet.url} className="text-sm font-semibold text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Wallet</a>
            <a href={subappUrl('capital', '/tokenomics')} className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 transition-colors">DeFi</a>
            <a href={SUBAPPS.pay.url} className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 transition-colors">BezPay</a>
          </div>
          <div className="hidden xl:flex items-center bg-light-muted dark:bg-gray-800 rounded-full px-4 py-2 w-full max-w-xs transition-colors border border-transparent focus-within:border-primary-300">
            <Search size={18} className="text-text-muted" />
            <input type="text" placeholder="Buscar en Web3..." className="bg-transparent focus:outline-none ml-2 w-full text-sm text-text-primary dark:text-white" />
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-3">
          
          <Link href="/notifications" className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 transition-all text-text-secondary relative">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-accent-500 rounded-full" />
          </Link>
          
          <button className="p-2 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 transition-all text-text-secondary">
            <Sun size={20} className="hidden dark:block text-yellow-400" />
            <Moon size={20} className="block dark:hidden" />
          </button>

          {/* Unified Connect Button */}
          <div className="relative z-50">
            <button
              onClick={() => isConnected ? setShowUserMenu(!showUserMenu) : open()}
              className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${unifiedButton.className} hover:opacity-90 text-white rounded-lg text-sm font-semibold transition-all shadow-button`}
            >
              {unifiedButton.icon}
              <span className="hidden md:inline">{unifiedButton.text}</span>
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && isConnected && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 rounded-xl shadow-soft-lg border border-light-border z-50 overflow-hidden animate-fade-in">
                  <div className="p-4 bg-gradient-primary text-white">
                    <p className="text-xs font-semibold mb-1 opacity-90">Wallet Conectada</p>
                    <p className="font-mono text-sm">{address}</p>
                  </div>
                  <div className="p-2 space-y-0.5">
                    <Link href={`/profile/${address}`} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <User size={16} /> <span className="font-semibold">Mi Perfil</span>
                    </Link>
                    <Link href="/settings" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <span>⚙️</span> <span className="font-semibold">Configuración</span>
                    </Link>
                    <Link href="/developer-console" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <span>🛠️</span> <span className="font-semibold">Developer Console</span>
                    </Link>
                    <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                    <a href={subappUrl('capital', '/staking')} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <span>🔒</span> <span className="font-semibold">Staking</span>
                    </a>
                    <a href={subappUrl('capital', '/farming')} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <span>🌱</span> <span className="font-semibold">Yield Farming</span>
                    </a>
                    <a href={subappUrl('wallet', '/dao')} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <span>🏛️</span> <span className="font-semibold">DAO Governance</span>
                    </a>
                    <a href={subappUrl('wallet', '/bridge')} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <span>🌉</span> <span className="font-semibold">Bridge</span>
                    </a>
                    <a href={subappUrl('capital', '/treasury')} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <span>🏦</span> <span className="font-semibold">Treasury</span>
                    </a>
                    <a href={SUBAPPS.nodes.url} onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 p-3 rounded-lg hover:bg-light-hover dark:hover:bg-gray-800 text-sm text-text-primary dark:text-gray-300 transition-colors">
                      <span>🖥️</span> <span className="font-semibold">Edge Node</span>
                    </a>
                    <div className="border-t border-gray-100 dark:border-gray-800 my-1" />
                    <button onClick={handleDisconnect} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent-50 dark:hover:bg-red-900/20 text-accent-700 dark:text-red-400 text-sm font-semibold transition-colors">
                      <LogOut size={16} /> Desconectar Segura
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
