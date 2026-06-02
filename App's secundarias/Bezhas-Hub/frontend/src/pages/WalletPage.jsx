import React, { useState, useEffect, useCallback } from 'react';
import { useBezCoin } from '../context/BezCoinContext';
import { useBezPay } from '../context/BezPayContext';
import { LOGOS } from '../config/cryptoLogos';
import { Wallet, Copy, ExternalLink, TrendingUp, Send, ArrowDownToLine } from 'lucide-react';
import { useAccount, useBalance } from 'wagmi';
import { useWalletConnect } from '../hooks/useWalletConnect';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { clearWalletStorage } from '../lib/web3/walletStorage';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const WalletPage = () => {
    const { address, isConnected } = useAccount();
    const { disconnectWallet } = useWalletConnect();
    const { data: balance } = useBalance({ address });

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const { balance: bezBalance, verifyAndProceed } = useBezCoin();
    const { openBuyBez } = useBezPay();

    const fetchWalletData = useCallback(async () => {
        if (!address) return;
        setLoading(true);
        try {
            // Fetch transaction history (el saldo BEZ viene del contexto)
            const txRes = await axios.get(`${API_URL}/wallet/${address}/transactions`);
            setTransactions(txRes.data || []);
        } catch (error) {
            console.error('Error fetching wallet data:', error);
            // Silent error or toast if critical
        } finally {
            setLoading(false);
        }
    }, [address]);

    useEffect(() => {
        if (isConnected && address) {
            fetchWalletData();
        }
    }, [isConnected, address, fetchWalletData]);

    function copyAddress() {
        if (address) {
            navigator.clipboard.writeText(address);
            toast.success('Dirección copiada al portapapeles');
        }
    }

    function formatAddress(addr) {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }

    function formatBalance(bal) {
        if (!bal) return '0.00';
        return parseFloat(bal).toFixed(4);
    }

    if (!isConnected) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center max-w-md">
                    <Wallet className="w-24 h-24 mx-auto mb-6 text-gray-600" />
                    <h2 className="text-3xl font-bold mb-4">Conecta tu Wallet</h2>
                    <p className="text-gray-400 mb-8">
                        Conecta tu wallet para ver tu balance, realizar transacciones y acceder a todas las funciones de BeZhas.
                    </p>
                    <w3m-button />
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                    <Wallet className="w-10 h-10" />
                    Mi Wallet
                </h1>
                <p className="text-gray-400">Gestiona tus activos y transacciones</p>
            </div>

            {/* Wallet Address Card */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm opacity-80">Tu Dirección</span>
                    <button
                        onClick={async () => {
                            const success = await disconnectWallet();
                            if (success) {
                                toast.success('🔐 Wallet desconectada de forma segura');
                            }
                        }}
                        className="text-sm bg-white/20 hover:bg-white/30 px-4 py-1 rounded-lg transition-colors"
                        title="Desconexión segura"
                    >
                        🔐 Desconectar
                    </button>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-2xl font-mono">{formatAddress(address)}</span>
                    <button
                        onClick={copyAddress}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                    <a
                        href={`https://etherscan.io/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <ExternalLink className="w-5 h-5" />
                    </a>
                </div>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* ETH Balance */}
                <div className="bg-dark-surface rounded-lg p-6 border border-dark-border">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400">Balance ETH</span>
                        <TrendingUp className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold mb-2">
                        {formatBalance(balance?.formatted)} ETH
                    </div>
                    <div className="text-sm text-gray-400">
                        ≈ ${(parseFloat(balance?.formatted || 0) * 2000).toFixed(2)} USD
                    </div>
                </div>

                {/* BEZ-Coin Balance */}
                <div className="bg-dark-surface rounded-lg p-6 border border-dark-border">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400">Balance BEZ-Coin</span>
                        <img src={LOGOS.bezcoin} alt="BEZ-Coin" className="w-7 h-7 rounded-full" />
                    </div>
                    <div className="text-3xl font-bold mb-2">
                        {parseFloat(bezBalance).toLocaleString(undefined, { maximumFractionDigits: 4 })} BEZ
                    </div>
                    <div className="text-sm text-gray-400 flex items-center gap-2">
                        Token principal de la plataforma
                        <button
                            type="button"
                            className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-semibold"
                            onClick={() => openBuyBez()}
                        >
                            Comprar BEZ-Coin
                        </button>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <button
                    className="flex items-center justify-center gap-2 p-4 bg-primary hover:bg-primary/80 rounded-lg transition-colors"
                    onClick={async () => {
                        // Simular envío de 1 BEZ para demo, en real pedir cantidad y dirección
                        const hasFunds = await verifyAndProceed('1', 'enviar BEZ-Coin', () => {}  /*BezPayModal auto-cierra*/);
                        if (!hasFunds) return;
                        toast.success('Función de envío BEZ-Coin (demo)');
                    }}
                >
                    <Send className="w-5 h-5" />
                    Enviar
                </button>
                <button className="flex items-center justify-center gap-2 p-4 bg-dark-surface border border-dark-border hover:border-primary rounded-lg transition-colors">
                    <ArrowDownToLine className="w-5 h-5" />
                    Recibir
                </button>
                <button
                    className="flex items-center justify-center gap-2 p-4 bg-dark-surface border border-dark-border hover:border-primary rounded-lg transition-colors"
                    onClick={() => openBuyBez()}
                >
                    <ExternalLink className="w-5 h-5" />
                    Comprar
                </button>
            </div>

            {/* Transaction History */}
            <div className="bg-dark-surface rounded-lg border border-dark-border">
                <div className="p-6 border-b border-dark-border">
                    <h2 className="text-2xl font-bold">Historial de Transacciones</h2>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <p>No hay transacciones aún</p>
                    </div>
                ) : (
                    <div className="divide-y divide-dark-border">
                        {transactions.map((tx, index) => (
                            <div key={index} className="p-4 hover:bg-dark-bg transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${tx.type === 'send' ? 'bg-red-500/10' : 'bg-green-500/10'
                                            }`}>
                                            {tx.type === 'send' ? (
                                                <Send className="w-5 h-5 text-red-500" />
                                            ) : (
                                                <ArrowDownToLine className="w-5 h-5 text-green-500" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-medium">
                                                {tx.type === 'send' ? 'Enviado' : 'Recibido'}
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                {new Date(tx.timestamp).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-bold ${tx.type === 'send' ? 'text-red-500' : 'text-green-500'
                                            }`}>
                                            {tx.type === 'send' ? '-' : '+'}{tx.amount} {tx.token}
                                        </div>
                                        <a
                                            href={`https://etherscan.io/tx/${tx.hash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-primary hover:underline flex items-center gap-1 justify-end"
                                        >
                                            Ver en Etherscan
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WalletPage;
