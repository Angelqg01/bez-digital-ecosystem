import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook principal para interactuar con el sistema de Farming
 * Proporciona métodos y estado para pools, stakes y recompensas
 */
export const useFarming = () => {
    const { address, isConnected } = useAccount();
    const [pools, setPools] = useState([]);
    const [userFarming, setUserFarming] = useState(null);
    const [farmingStats, setFarmingStats] = useState(null);
    const [lockMultipliers, setLockMultipliers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Cargar pools de farming
    const loadPools = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`${API_URL}/api/farming/pools`);
            setPools(response.data.data || []);
            return response.data.data;
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Error al cargar pools';
            setError(errorMsg);
            toast.error(errorMsg);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    // Cargar estadísticas globales de farming
    const loadStats = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/farming/stats`);
            setFarmingStats(response.data.data);
            return response.data.data;
        } catch (err) {
            console.error('Error loading stats:', err);
            return null;
        }
    }, []);

    // Cargar multiplicadores de bloqueo
    const loadMultipliers = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/farming/multipliers`);
            setLockMultipliers(response.data.data || []);
            return response.data.data;
        } catch (err) {
            console.error('Error loading multipliers:', err);
            return [];
        }
    }, []);

    // Cargar datos de farming del usuario
    const loadUserFarming = useCallback(async (userAddress) => {
        if (!userAddress) return null;

        try {
            const token = localStorage.getItem('token');
            if (!token) return null;

            const response = await axios.get(
                `${API_URL}/api/farming/user/${userAddress}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setUserFarming(response.data.data);
            return response.data.data;
        } catch (err) {
            console.error('Error loading user farming:', err);
            return null;
        }
    }, []);

    // Obtener información de un pool específico
    const getPoolInfo = useCallback(async (poolId) => {
        try {
            const response = await axios.get(`${API_URL}/api/farming/pool/${poolId}`);
            return response.data.data;
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Error al cargar pool';
            toast.error(errorMsg);
            return null;
        }
    }, []);

    // Validar si se puede hacer stake
    const validateStake = useCallback(async (poolId, amount, userAddress) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                toast.error('Debes iniciar sesión');
                return { canStake: false, reason: 'No autenticado' };
            }

            const response = await axios.post(
                `${API_URL}/api/farming/validate-stake`,
                { poolId, amount, userAddress },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            return response.data.data;
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Error al validar stake';
            toast.error(errorMsg);
            return { canStake: false, reason: errorMsg };
        }
    }, []);

    // Refrescar todos los datos
    const refreshAllData = useCallback(async () => {
        await Promise.all([
            loadPools(),
            loadStats(),
            loadMultipliers(),
            isConnected && address ? loadUserFarming(address) : Promise.resolve()
        ]);
    }, [loadPools, loadStats, loadMultipliers, loadUserFarming, isConnected, address]);

    // Cargar datos iniciales
    useEffect(() => {
        refreshAllData();
    }, [refreshAllData]);

    return {
        // Estado
        pools,
        userFarming,
        farmingStats,
        lockMultipliers,
        loading,
        error,

        // Métodos
        loadPools,
        loadStats,
        loadMultipliers,
        loadUserFarming,
        getPoolInfo,
        validateStake,
        refreshAllData
    };
};

/**
 * Hook para obtener información de un pool específico
 */
export const usePool = (poolId) => {
    const [pool, setPool] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadPool = useCallback(async () => {
        if (!poolId && poolId !== 0) return;

        try {
            setLoading(true);
            setError(null);
            const response = await axios.get(`${API_URL}/api/farming/pool/${poolId}`);
            setPool(response.data.data);
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Error al cargar pool';
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, [poolId]);

    useEffect(() => {
        loadPool();
    }, [loadPool]);

    return { pool, loading, error, reload: loadPool };
};

/**
 * Hook para obtener datos de farming de un usuario
 */
export const useUserStakes = (userAddress) => {
    const [stakes, setStakes] = useState([]);
    const [totalRewards, setTotalRewards] = useState('0');
    const [totalStaked, setTotalStaked] = useState('0');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadUserStakes = useCallback(async () => {
        if (!userAddress) {
            setStakes([]);
            setTotalRewards('0');
            setTotalStaked('0');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const token = localStorage.getItem('token');
            if (!token) {
                setError('No autenticado');
                return;
            }

            const response = await axios.get(
                `${API_URL}/api/farming/user/${userAddress}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const data = response.data.data;
            setStakes(data.pools || []);
            setTotalRewards(data.totalRewards || '0');
            setTotalStaked(data.totalStaked || '0');
        } catch (err) {
            const errorMsg = err.response?.data?.message || 'Error al cargar stakes';
            setError(errorMsg);
            console.error('Error loading user stakes:', err);
        } finally {
            setLoading(false);
        }
    }, [userAddress]);

    useEffect(() => {
        loadUserStakes();
    }, [loadUserStakes]);

    return {
        stakes,
        totalRewards,
        totalStaked,
        loading,
        error,
        reload: loadUserStakes
    };
};

export default useFarming;
