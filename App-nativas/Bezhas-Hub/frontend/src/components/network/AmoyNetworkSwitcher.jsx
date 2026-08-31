import React, { useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { AlertCircle, CheckCircle, ExternalLink, Zap } from 'lucide-react';

/**
 * AmoyNetworkSwitcher - Componente para cambiar a Polygon Amoy Testnet
 * Facilita el onboarding de usuarios a la red de prueba
 */
const AmoyNetworkSwitcher = () => {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { chains, error, isPending, switchChain } = useSwitchChain();
    const [showFaucetInfo, setShowFaucetInfo] = useState(false);

    const amoyChainId = 80002;
    const isOnAmoy = chainId === amoyChainId;

    const switchToAmoy = () => {
        if (switchChain) {
            switchChain({ chainId: amoyChainId });
        }
    };

    const addAmoyManually = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0x13882', // 80002 in hex
                        chainName: 'Polygon Amoy Testnet',
                        nativeCurrency: {
                            name: 'MATIC',
                            symbol: 'MATIC',
                            decimals: 18
                        },
                        rpcUrls: ['https://rpc-amoy.polygon.technology'],
                        blockExplorerUrls: ['https://amoy.polygonscan.com']
                    }]
                });
            } catch (error) {
                console.error('Error adding Amoy network:', error);
            }
        }
    };

    if (!isConnected) {
        return (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
                    <div>
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                            Conecta tu Wallet
                        </h3>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                            Necesitas conectar tu wallet para usar Polygon Amoy Testnet
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (isOnAmoy) {
        return (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-600 dark:text-green-400 mt-0.5" size={20} />
                    <div className="flex-1">
                        <h3 className="font-semibold text-green-900 dark:text-green-100">
                            ✅ Conectado a Polygon Amoy
                        </h3>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                            Chain ID: {chainId} | {address?.substring(0, 6)}...{address?.substring(address.length - 4)}
                        </p>

                        {/* Faucet Link */}
                        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-700">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                                💰 ¿Necesitas MATIC de prueba?
                            </p>
                            <a
                                href="https://faucet.polygon.technology/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                Obtener MATIC gratis del faucet
                                <ExternalLink size={14} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
                <Zap className="text-purple-600 dark:text-purple-400 mt-0.5" size={20} />
                <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                        Cambiar a Polygon Amoy Testnet
                    </h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        Actualmente estás en Chain ID: <span className="font-medium">{chainId}</span>
                    </p>

                    {/* Botones de acción */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            onClick={switchToAmoy}
                            disabled={isPending}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isPending ? 'Cambiando...' : 'Cambiar a Amoy'}
                        </button>

                        <button
                            onClick={addAmoyManually}
                            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium text-sm transition-colors"
                        >
                            Agregar Red Manualmente
                        </button>

                        <button
                            onClick={() => setShowFaucetInfo(!showFaucetInfo)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                        >
                            ℹ️ Info de Faucet
                        </button>
                    </div>

                    {/* Error display */}
                    {error && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                            <p className="text-sm text-red-700 dark:text-red-300">
                                Error: {error.message}
                            </p>
                        </div>
                    )}

                    {/* Faucet Info Panel */}
                    {showFaucetInfo && (
                        <div className="mt-3 p-4 bg-white dark:bg-gray-800 rounded border border-purple-200 dark:border-purple-700">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                💰 Obtener MATIC de Testnet
                            </h4>
                            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                <li className="flex items-start gap-2">
                                    <span>1.</span>
                                    <div>
                                        <span>Ve al faucet oficial: </span>
                                        <a
                                            href="https://faucet.polygon.technology/"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                        >
                                            faucet.polygon.technology
                                            <ExternalLink size={12} />
                                        </a>
                                    </div>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span>2.</span>
                                    <span>Selecciona "Polygon Amoy" en el dropdown</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span>3.</span>
                                    <span>Ingresa tu dirección de wallet: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{address?.substring(0, 10)}...</code></span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span>4.</span>
                                    <span>Recibirás 0.2 MATIC (suficiente para ~40 transacciones)</span>
                                </li>
                            </ul>

                            <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                                <strong>Tip:</strong> Si el faucet oficial está lento, prueba:
                                <a
                                    href="https://www.alchemy.com/faucets/polygon-amoy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 underline"
                                >
                                    Alchemy Faucet
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Network Info */}
                    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="font-semibold">Chain ID:</span> 80002
                            </div>
                            <div>
                                <span className="font-semibold">RPC:</span> rpc-amoy.polygon.technology
                            </div>
                            <div>
                                <span className="font-semibold">Explorer:</span>
                                <a
                                    href="https://amoy.polygonscan.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-1 text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                    amoy.polygonscan.com
                                </a>
                            </div>
                            <div>
                                <span className="font-semibold">Moneda:</span> MATIC
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AmoyNetworkSwitcher;
