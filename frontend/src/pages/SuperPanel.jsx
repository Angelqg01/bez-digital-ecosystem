import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import http from '../services/http';

export default function SuperPanel() {
    const [admin, setAdmin] = useState(null);
    const [error, setError] = useState(null);
    const { isConnected, address } = useAccount();

    const fetchAdminAccess = async () => {
        if (!isConnected || !address) {
            setError('Conecta tu wallet para verificar el acceso.');
            return;
        }
        try {
            const resp = await http.post('/api/admin-register/superpanel', {
                walletAddress: address
            });
            if (resp.status !== 200) {
                setError('Acceso denegado o no autorizado.');
                console.error("No se pudo verificar el acceso para", address, resp.data);
            } else {
                setAdmin(resp.data.admin); // Assuming the response data contains an 'admin' object
                console.log("Acceso registrado/verificado para:", address);
            }
        } catch (err) {
            setError('Error al verificar el acceso.');
            console.error("Error fetching admin access:", err);
        }
    };

    useEffect(() => {
        fetchAdminAccess();
    }, [isConnected, address]); // Re-run when connection status or address changes

    if (error) {
        return <div className="flex flex-col items-center justify-center min-h-screen text-red-600">{error}</div>;
    }
    if (!admin) {
        return <div className="flex flex-col items-center justify-center min-h-screen">Verificando acceso...</div>;
    }
    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <h1 className="text-3xl font-bold mb-4 text-red-700">Super Panel Admin</h1>
            <div className="bg-white rounded shadow p-6">
                <p className="mb-2">Bienvenido, <b>{admin.username}</b> ({admin.email})</p>
                <p>Rol: <b>{admin.role}</b></p>
                {/* Aquí puedes renderizar el dashboard admin completo */}
            </div>
        </div>
    );
}
