import React from 'react';
import { useConnect } from 'wagmi';
import { useWalletConnect } from '../../hooks/useWalletConnect';
import { Shield, Wallet, LogOut } from 'lucide-react';

export default function VIPHeader({ isConnected, address }) {
    const { connect, connectors } = useConnect();
    const { disconnectWallet } = useWalletConnect();

    const formatAddress = (addr) => {
        if (!addr) return '';
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    return (
        <header className="sticky top-0 z-50 backdrop-blur-xl border-b" style={{
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--background-secondary)'
        }}>
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Be-VIP</h1>
                            <p className="text-xs text-gray-400">Tokenomics Calculator</p>
                        </div>
                    </div>

                    {/* Wallet Connection */}
                    <div>
                        {!isConnected ? (
                            <button
                                onClick={() => connect({ connector: connectors[0] })}
                                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 shadow-lg hover:shadow-purple-500/50"
                            >
                                <Wallet className="w-5 h-5" />
                                Connect Wallet
                            </button>
                        ) : (
                            <div className="flex items-center gap-3">
                                <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2">
                                    <p className="text-xs text-gray-400 mb-1">Connected</p>
                                    <p className="text-sm font-mono text-white">{formatAddress(address)}</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        const success = await disconnectWallet();
                                        if (!success) {
                                            alert('Error al desconectar. Por favor, recarga la página.');
                                        }
                                    }}
                                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-lg transition-all duration-300"
                                    title="🔐 Desconexión segura"
                                >
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
