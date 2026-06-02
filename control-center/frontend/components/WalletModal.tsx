'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
    const [tab, setTab] = useState<'connect' | 'login'>('connect');

    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in zoom-in duration-200">
                <div className="bg-[#0c0d17] border border-white/10 rounded-2xl shadow-2xl shadow-blue-900/30 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0d33f2] to-[#22d3ee] flex items-center justify-center text-white font-black text-lg">B</div>
                            <div>
                                <h2 className="text-white font-bold text-lg">BeZhas Protocol</h2>
                                <p className="text-gray-500 text-[10px] tracking-widest uppercase">Chain 2708 · Mainnet</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-400 text-lg">close</span>
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        <button
                            onClick={() => setTab('connect')}
                            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.3em] transition-all ${tab === 'connect'
                                    ? 'text-[#0d33f2] border-b-2 border-[#0d33f2] bg-[#0d33f2]/5'
                                    : 'text-gray-500 hover:text-white'
                                }`}
                        >
                            Conectar Wallet
                        </button>
                        <button
                            onClick={() => setTab('login')}
                            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-[0.3em] transition-all ${tab === 'login'
                                    ? 'text-[#0d33f2] border-b-2 border-[#0d33f2] bg-[#0d33f2]/5'
                                    : 'text-gray-500 hover:text-white'
                                }`}
                        >
                            Iniciar Sesión
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {tab === 'connect' ? (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-400 text-center mb-6">
                                    Conecta tu wallet Web3 para interactuar con el ecosistema BeZhas.
                                </p>

                                {/* MetaMask */}
                                <Link
                                    href="/login"
                                    onClick={onClose}
                                    className="flex items-center gap-4 w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#0d33f2]/50 rounded-xl transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#f6851b]/10 flex items-center justify-center">
                                        <span className="text-[#f6851b] text-lg">🦊</span>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-white font-bold text-sm block">MetaMask</span>
                                        <span className="text-gray-500 text-[10px] uppercase tracking-widest">Browser Extension</span>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-600 group-hover:text-[#0d33f2] transition-colors">arrow_forward</span>
                                </Link>

                                {/* WalletConnect */}
                                <Link
                                    href="/login"
                                    onClick={onClose}
                                    className="flex items-center gap-4 w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#0d33f2]/50 rounded-xl transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#3b99fc]/10 flex items-center justify-center">
                                        <span className="text-[#3b99fc] text-lg">🔗</span>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-white font-bold text-sm block">WalletConnect</span>
                                        <span className="text-gray-500 text-[10px] uppercase tracking-widest">Mobile & Desktop</span>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-600 group-hover:text-[#0d33f2] transition-colors">arrow_forward</span>
                                </Link>

                                {/* Coinbase Wallet */}
                                <Link
                                    href="/login"
                                    onClick={onClose}
                                    className="flex items-center gap-4 w-full p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#0d33f2]/50 rounded-xl transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-[#0052ff]/10 flex items-center justify-center">
                                        <span className="text-[#0052ff] text-lg">💎</span>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-white font-bold text-sm block">Coinbase Wallet</span>
                                        <span className="text-gray-500 text-[10px] uppercase tracking-widest">Smart Wallet</span>
                                    </div>
                                    <span className="material-symbols-outlined text-gray-600 group-hover:text-[#0d33f2] transition-colors">arrow_forward</span>
                                </Link>

                                <div className="flex items-center gap-3 pt-4">
                                    <span className="w-5 h-5 text-emerald-400 shrink-0">🛡️</span>
                                    <p className="text-[10px] text-emerald-300/60">
                                        Tu clave privada nunca se comparte. La autenticación usa firma criptográfica (SIWE).
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-400 text-center mb-6">
                                    Accede al Control Center con tu wallet ya conectada.
                                </p>

                                <Link
                                    href="/login"
                                    onClick={onClose}
                                    className="flex items-center justify-center gap-3 w-full bg-gradient-to-r from-[#0d33f2] to-[#22d3ee] text-white rounded-xl py-4 px-6 font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/20"
                                >
                                    <span className="material-symbols-outlined">account_balance_wallet</span>
                                    Iniciar sesión con Wallet
                                </Link>

                                <div className="relative my-6">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-white/10"></div>
                                    </div>
                                    <div className="relative flex justify-center text-[10px]">
                                        <span className="bg-[#0c0d17] px-4 text-gray-500 uppercase tracking-[0.3em]">O también</span>
                                    </div>
                                </div>

                                <Link
                                    href="/onboarding"
                                    onClick={onClose}
                                    className="flex items-center justify-center gap-3 w-full bg-white/5 border border-white/10 text-white rounded-xl py-4 px-6 font-bold text-sm transition-all hover:bg-white/10"
                                >
                                    <span className="material-symbols-outlined">rocket_launch</span>
                                    Nuevo Registro (Onboarding)
                                </Link>

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <Link
                                        href="/support"
                                        onClick={onClose}
                                        className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest"
                                    >
                                        <span className="material-symbols-outlined text-sm">support_agent</span>
                                        Soporte
                                    </Link>
                                    <Link
                                        href="/docs"
                                        onClick={onClose}
                                        className="flex items-center justify-center gap-2 p-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-widest"
                                    >
                                        <span className="material-symbols-outlined text-sm">description</span>
                                        Docs
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
