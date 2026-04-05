import React, { useState } from 'react';
import http from '../../services/http';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAccount, useWalletClient } from 'wagmi';
import { ShieldCheck, X, ArrowRight, Wallet, CheckCircle2 } from 'lucide-react';
import { ethers } from 'ethers';

/**
 * ConnectWalletModal
 *
 * Shown after email registration to invite the user to link their wallet.
 * If the user has a session token (email-registered), we try to call
 * POST /api/auth/link-wallet after they connect.
 *
 * Props:
 *   isOpen  — boolean
 *   onClose — called when user closes without linking
 *   onSkip  — called when user taps "Lo haré más tarde"
 */
const ConnectWalletModal = ({ isOpen, onClose, onSkip }) => {
    const { open } = useWeb3Modal();
    const { isConnected, address } = useAccount();
    const { data: walletClient } = useWalletClient();

    const [linking, setLinking] = useState(false);
    const [linked, setLinked] = useState(false);
    const [linkError, setLinkError] = useState('');

    if (!isOpen) return null;

    // If wallet just connected and user has a JWT token, attempt linking automatically
    const handleLinkWallet = async () => {
        if (!address) {
            open();
            return;
        }

        const stored = localStorage.getItem('auth');
        if (!stored) {
            // No session (wallet-only user), just close
            onSkip && onSkip();
            return;
        }

        const { token } = JSON.parse(stored);
        if (!token) {
            onSkip && onSkip();
            return;
        }

        setLinking(true);
        setLinkError('');
        try {
            let signer;
            if (walletClient) {
                const provider = new ethers.BrowserProvider(walletClient);
                signer = await provider.getSigner();
            } else if (window.ethereum) {
                const provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
            } else {
                throw new Error('No wallet provider detected');
            }

            const message = `Vincular wallet a mi cuenta BeZhas\nAddress: ${address}\nTimestamp: ${Date.now()}`;
            const signature = await signer.signMessage(message);

            const response = await http.post('/api/auth/link-wallet', {
                walletAddress: address, signature, message
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = response.data;

            if (response.status === 200) {
                // Update local auth with new token containing walletAddress
                const stored2 = JSON.parse(localStorage.getItem('auth') || '{}');
                localStorage.setItem('auth', JSON.stringify({
                    ...stored2,
                    token: data.token,
                    user: { ...stored2.user, walletAddress: data.user.walletAddress }
                }));
                setLinked(true);
            } else {
                setLinkError(data.error || 'Error al vincular la wallet');
            }
        } catch (err) {
            console.error('Error linking wallet:', err);
            setLinkError(err.message || 'Error al firmar el mensaje');
        } finally {
            setLinking(false);
        }
    };

    // Success state — wallet linked
    if (linked) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                <div className="relative bg-[#0f0f16] border border-green-500/20 rounded-2xl max-w-lg w-full p-8 shadow-2xl animate-scaleUp text-center">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6 border border-green-500/30">
                        <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white mb-3">¡Wallet Vinculada!</h2>
                    <p className="text-gray-400 mb-6">
                        Tu wallet <span className="text-purple-300 font-mono text-sm">{address?.slice(0, 6)}...{address?.slice(-4)}</span> ha sido vinculada a tu cuenta. Ya tienes acceso completo a Web3.
                    </p>
                    <button
                        onClick={() => { onClose && onClose(); window.location.href = '/feed'; }}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all"
                    >
                        Ir a la Plataforma →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
            <div className="relative bg-[#0f0f16] border border-purple-500/20 rounded-2xl max-w-lg w-full p-8 shadow-2xl animate-scaleUp">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full mb-6 border border-purple-500/30 relative">
                        <Wallet className="w-10 h-10 text-purple-400" />
                        <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1.5 border-2 border-[#0f0f16]">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-display font-bold text-white mb-3">
                        Desbloquea el Poder de la Web3
                    </h2>
                    <p className="text-gray-400 text-lg leading-relaxed">
                        Has creado tu cuenta exitosamente. Para acceder a pagos instantáneos, RWA y finanzas DeFi, conecta tu billetera digital.
                    </p>
                </div>

                {/* Wallet benefits reminder */}
                <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-4 mb-6 space-y-2">
                    {['Pagos instantáneos con BEZ-Coin', 'Acceso a NFTs, RWA y DeFi', 'Identidad descentralizada verificada'].map(b => (
                        <div key={b} className="flex items-center gap-2 text-sm text-purple-200/70">
                            <CheckCircle2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            {b}
                        </div>
                    ))}
                </div>

                {linkError && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                        {linkError}
                    </div>
                )}

                <div className="space-y-4">
                    {/* If wallet not yet connected, open Web3Modal first */}
                    {!isConnected ? (
                        <button
                            onClick={() => open()}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-bold text-white text-lg shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-3 group"
                        >
                            <Wallet className="w-6 h-6" />
                            Conectar Billetera Ahora
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    ) : (
                        // Wallet connected — offer to sign and link
                        <button
                            onClick={handleLinkWallet}
                            disabled={linking}
                            className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-bold text-white text-lg shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            <ShieldCheck className="w-6 h-6" />
                            {linking ? 'Vinculando...' : 'Vincular Wallet a mi Cuenta'}
                        </button>
                    )}

                    <button
                        onClick={onSkip}
                        className="w-full py-3 bg-transparent hover:bg-white/5 text-gray-400 hover:text-white rounded-xl font-medium transition-colors text-sm"
                    >
                        Lo haré más tarde
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-xs text-gray-500">
                        Al conectar tu wallet, aceptas firmar una transacción gratuita para verificar tu identidad en la Blockchain.
                        <br />
                        <span className="text-yellow-500/70 mt-1 block">
                            💡 Recibirás recordatorios por email si no vinculas tu wallet pronto.
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConnectWalletModal;
