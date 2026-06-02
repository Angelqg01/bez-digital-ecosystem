import React, { useState, useEffect } from 'react';
import { Wallet, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ethers } from 'ethers';
import { secureWalletCleanup } from '../../lib/web3/walletStorage';

/**
 * Componente de conexión directa a MetaMask
 * Evita problemas de CSP con WalletConnect
 * 🔐 SEGURIDAD: Usa secureWalletCleanup para desconexión completa
 */
export default function DirectWalletConnect({ onConnect, onDisconnect, className = '' }) {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState('');
    const [chainId, setChainId] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        checkMetaMask();

        if (window.ethereum) {
            // Detectar cambios de cuenta
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            // Detectar cambios de red
            window.ethereum.on('chainChanged', handleChainChanged);

            // Verificar si ya está conectado
            checkExistingConnection();
        }

        return () => {
            if (window.ethereum) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }
        };
    }, []);

    const checkMetaMask = () => {
        setIsInstalled(typeof window.ethereum !== 'undefined');
    };

    const checkExistingConnection = async () => {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                setIsConnected(true);
                setAddress(accounts[0]);
                const chain = await window.ethereum.request({ method: 'eth_chainId' });
                setChainId(parseInt(chain, 16));

                if (onConnect) {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner();
                    onConnect({ address: accounts[0], signer, provider });
                }
            }
        } catch (error) {
            console.error('Error checking connection:', error);
        }
    };

    const handleAccountsChanged = (accounts) => {
        if (accounts.length === 0) {
            // Usuario desconectó
            handleDisconnect();
        } else if (accounts[0] !== address) {
            // Usuario cambió de cuenta
            setAddress(accounts[0]);
            toast.success('Cuenta cambiada');
            checkExistingConnection();
        }
    };

    const handleChainChanged = (chainIdHex) => {
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        toast.info(`Red cambiada: ChainID ${newChainId}`);
        window.location.reload();
    };

    const handleConnect = async () => {
        if (!isInstalled) {
            toast.error('MetaMask no está instalada');
            window.open('https://metamask.io/download/', '_blank');
            return;
        }

        try {
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length > 0) {
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const network = await provider.getNetwork();

                setIsConnected(true);
                setAddress(accounts[0]);
                setChainId(Number(network.chainId));

                toast.success(`Conectado: ${formatAddress(accounts[0])}`);

                if (onConnect) {
                    onConnect({
                        address: accounts[0],
                        signer,
                        provider,
                        chainId: Number(network.chainId)
                    });
                }
            }
        } catch (error) {
            console.error('Error connecting:', error);
            if (error.code === 4001) {
                toast.error('Conexión rechazada por el usuario');
            } else {
                toast.error('Error al conectar MetaMask');
            }
        }
    };

    const handleDisconnect = async () => {
        // 🔐 LIMPIEZA SEGURA: Usa secureWalletCleanup
        try {
            await secureWalletCleanup();

            setIsConnected(false);
            setAddress('');
            setChainId(null);

            toast.success('🔐 Wallet desconectada de forma segura');

            if (onDisconnect) {
                onDisconnect();
            }
        } catch (error) {
            console.error('Error al desconectar:', error);
            // Limpieza básica si falla
            setIsConnected(false);
            setAddress('');
            setChainId(null);
            toast.error('Error al desconectar. Por favor, recarga la página.');
        }
    };

    const formatAddress = (addr) => {
        if (!addr) return '';
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const getChainName = (id) => {
        const chains = {
            1: 'Ethereum',
            11155111: 'Sepolia',
            137: 'Polygon',
            80002: 'Polygon Amoy',
            31337: 'Hardhat Local',
        };
        return chains[id] || `Chain ${id}`;
    };

    if (!isInstalled) {
        return (
            <button
                onClick={() => window.open('https://metamask.io/download/', '_blank')}
                className={`flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all ${className}`}
            >
                <ExternalLink size={18} />
                <span>Instalar MetaMask</span>
            </button>
        );
    }

    if (isConnected) {
        return (
            <div className="flex items-center gap-2">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getChainName(chainId)}
                    </span>
                    <span className="font-mono text-sm font-bold">
                        {formatAddress(address)}
                    </span>
                </div>
                <button
                    onClick={handleDisconnect}
                    className={`flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all ${className}`}
                    title="🔐 Desconexión segura"
                >
                    <AlertCircle size={18} />
                    <span>🔐 Desconectar</span>
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleConnect}
            className={`flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl ${className}`}
        >
            <Wallet size={18} />
            <span>Conectar MetaMask</span>
        </button>
    );
}
