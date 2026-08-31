/**
 * useBEZCoin Hook
 * Hook React para interactuar fácilmente con BEZ-Coin
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useEthersProvider, useEthersSigner } from '../utils/ethers-adapters';
import bezCoinService from '../services/bezCoin.service';

export const useBEZCoin = () => {
    const { address, isConnected } = useAccount();
    const provider = useEthersProvider();
    const signer = useEthersSigner();

    const [balance, setBalance] = useState({
        raw: '0',
        formatted: '0',
        display: '0.00',
        symbol: 'BEZ'
    });
    const [tokenInfo, setTokenInfo] = useState(bezCoinService.BEZ_COIN_INFO);
    const [networkStatus, setNetworkStatus] = useState({
        isCorrectNetwork: false,
        currentChainId: null,
        requiredChainId: 137,
        networkName: 'Desconocida'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Verificar red
    const checkNetwork = useCallback(async () => {
        if (!provider) return;

        try {
            const status = await bezCoinService.checkNetwork(provider);
            setNetworkStatus(status);
            return status;
        } catch (err) {
            console.error('Error verificando red:', err);
            setError(err.message);
        }
    }, [provider]);

    // Cargar balance
    const loadBalance = useCallback(async () => {
        if (!address || !provider) return;

        try {
            setLoading(true);
            const bal = await bezCoinService.getBEZBalance(address, provider);
            setBalance(bal);
            setError(null);
        } catch (err) {
            console.error('Error cargando balance:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [address, provider]);

    // Cargar información del token
    const loadTokenInfo = useCallback(async () => {
        if (!provider) return;

        try {
            const info = await bezCoinService.getTokenInfo(provider);
            setTokenInfo(info);
        } catch (err) {
            console.error('Error cargando info del token:', err);
        }
    }, [provider]);

    // Transferir BEZ
    const transfer = useCallback(async (toAddress, amount) => {
        if (!signer) {
            throw new Error('Wallet no conectada');
        }

        try {
            setLoading(true);
            const result = await bezCoinService.transferBEZ(toAddress, amount, signer);

            if (result.success) {
                // Recargar balance después de transferir
                setTimeout(() => loadBalance(), 2000);
            }

            setError(null);
            return result;
        } catch (err) {
            console.error('Error transfiriendo BEZ:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [signer, loadBalance]);

    // Aprobar gasto
    const approve = useCallback(async (spenderAddress, amount) => {
        if (!signer) {
            throw new Error('Wallet no conectada');
        }

        try {
            setLoading(true);
            const result = await bezCoinService.approveBEZ(spenderAddress, amount, signer);
            setError(null);
            return result;
        } catch (err) {
            console.error('Error aprobando BEZ:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [signer]);

    // Obtener allowance
    const getAllowance = useCallback(async (spenderAddress) => {
        if (!address || !provider) return null;

        try {
            return await bezCoinService.getAllowance(address, spenderAddress, provider);
        } catch (err) {
            console.error('Error obteniendo allowance:', err);
            setError(err.message);
            return null;
        }
    }, [address, provider]);

    // Quemar tokens
    const burn = useCallback(async (amount) => {
        if (!signer) {
            throw new Error('Wallet no conectada');
        }

        try {
            setLoading(true);
            const result = await bezCoinService.burnBEZ(amount, signer);

            if (result.success) {
                setTimeout(() => loadBalance(), 2000);
            }

            setError(null);
            return result;
        } catch (err) {
            console.error('Error quemando BEZ:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [signer, loadBalance]);

    // Cambiar a Polygon
    const switchToPolygon = useCallback(async () => {
        try {
            setLoading(true);
            const success = await bezCoinService.switchToPolygon();

            if (success) {
                setTimeout(() => {
                    checkNetwork();
                    loadBalance();
                }, 1000);
            }

            return success;
        } catch (err) {
            console.error('Error cambiando a Polygon:', err);
            setError(err.message);
            return false;
        } finally {
            setLoading(false);
        }
    }, [checkNetwork, loadBalance]);

    // Agregar token a wallet
    const addToWallet = useCallback(async () => {
        try {
            return await bezCoinService.addBEZToWallet();
        } catch (err) {
            console.error('Error agregando BEZ a wallet:', err);
            setError(err.message);
            return false;
        }
    }, []);

    // Refrescar todo
    const refresh = useCallback(async () => {
        await Promise.all([
            checkNetwork(),
            loadBalance(),
            loadTokenInfo()
        ]);
    }, [checkNetwork, loadBalance, loadTokenInfo]);

    // Efectos
    useEffect(() => {
        if (isConnected && provider) {
            checkNetwork();
            loadTokenInfo();
        }
    }, [isConnected, provider, checkNetwork, loadTokenInfo]);

    useEffect(() => {
        if (isConnected && address && provider && networkStatus.isCorrectNetwork) {
            loadBalance();
        }
    }, [isConnected, address, provider, networkStatus.isCorrectNetwork, loadBalance]);

    // Auto-refresh cada 30 segundos
    useEffect(() => {
        if (!isConnected || !networkStatus.isCorrectNetwork) return;

        const interval = setInterval(() => {
            loadBalance();
        }, 30000);

        return () => clearInterval(interval);
    }, [isConnected, networkStatus.isCorrectNetwork, loadBalance]);

    return {
        // Estado
        balance,
        tokenInfo,
        networkStatus,
        loading,
        error,
        isConnected,
        address,

        // Acciones
        transfer,
        approve,
        getAllowance,
        burn,
        switchToPolygon,
        addToWallet,
        refresh,

        // Utilidades
        needsNetworkSwitch: isConnected && !networkStatus.isCorrectNetwork,
        canTransact: isConnected && networkStatus.isCorrectNetwork && !loading
    };
};

export default useBEZCoin;
