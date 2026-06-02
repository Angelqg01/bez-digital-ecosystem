import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/realestate` : 'http://localhost:3001/api/realestate';

export const useRealEstateContract = () => {
    const [properties, setProperties] = useState([]);
    const [portfolio, setPortfolio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [propsRes, portRes] = await Promise.all([
                axios.get(`${API_URL}/properties`),
                axios.get(`${API_URL}/portfolio`)
            ]);
            setProperties(propsRes.data);
            setPortfolio(portRes.data);
            setError(null);
        } catch (err) {
            console.error("Error fetching Real Estate data:", err);
            // Fallback si el backend no responde para que la UI no rompa
            setError("No se pudo conectar con el mercado inmobiliario.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000); // Actualizar cada 10s
        return () => clearInterval(interval);
    }, [fetchData]);

    const investInProperty = async (propertyId, amountTokens) => {
        setLoading(true);
        try {
            await axios.post(`${API_URL}/invest`, { propertyId, amountTokens });
            await fetchData(); // Recargar datos
            return { success: true };
        } catch (err) {
            return { success: false, error: err.response?.data?.error || "Error en la transacción" };
        } finally {
            setLoading(false);
        }
    };

    const claimRent = async (propertyId) => {
        try {
            const res = await axios.post(`${API_URL}/claim`, { propertyId });
            return res.data;
        } catch (err) {
            console.error(err);
            return { success: false };
        }
    };

    const stakeTokens = async (amount) => {
        try {
            const res = await axios.post(`${API_URL}/stake`, { amount });
            return res.data;
        } catch (err) {
            console.error("Error staking:", err);
            return { success: false, error: "Error al conectar con el servidor de Staking" };
        }
    };

    return {
        properties,
        portfolio,
        loading,
        error,
        investInProperty,
        claimRent,
        stakeTokens
    };
};
