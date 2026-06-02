import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

// Configuración de Axios para usar la URL base correcta
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
});

export const useLogisticsContract = () => {
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchShipments = async () => {
        try {
            const response = await api.get('/logistics/shipments');
            setShipments(response.data);
        } catch (error) {
            // Silence 404 errors — endpoint may not exist yet
            if (error.response?.status !== 404) {
                console.error("Error fetching shipments:", error);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchShipments();
        // Poll every 30s (reduced from 5s to avoid console spam)
        const interval = setInterval(fetchShipments, 30000);
        return () => clearInterval(interval);
    }, []);

    const createShipment = async (data) => {
        setLoading(true);
        try {
            console.log("Creando envío en Blockchain (Simulado via Backend):", data);

            // Preparar payload completo con campos de privacidad
            const payload = {
                origin: data.origin,
                destination: data.destination,
                cargoType: data.cargoType,
                weight: data.weight,
                payout: parseFloat(data.payout),
                visibility: data.privacy?.visibility || 'public',
                accessFee: data.privacy?.accessFee ? parseFloat(data.privacy.accessFee) : 0,
                shipper: user?.address || "0xShipper..."
            };

            const response = await api.post('/logistics/create', payload);
            console.log("Envío creado exitosamente:", response.data);
            await fetchShipments();
            return true;
        } catch (error) {
            console.error("Error al crear envío:", error);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const acceptJob = async (id) => {
        setLoading(true);
        try {
            console.log(`Aceptando trabajo ${id} con wallet ${user?.address}`);
            await api.post(`/logistics/accept/${id}`, { carrier: user?.address || "0xCarrier..." });
            await fetchShipments();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const signDelivery = async (id) => {
        setLoading(true);
        try {
            console.log(`Firmando entrega ${id} (Liberando Escrow)`);
            await api.post(`/logistics/deliver/${id}`);
            await fetchShipments();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return {
        shipments,
        loading,
        createShipment,
        acceptJob,
        signDelivery
    };
};
