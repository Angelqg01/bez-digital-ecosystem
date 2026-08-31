import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useNavigate } from 'react-router-dom';
import http from '../services/http';
import toast from 'react-hot-toast';

/**
 * Admin Role Colors for UI
 */
export const ADMIN_ROLE_COLORS = {
    SUPER_ADMIN: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white',
    ADMIN: 'bg-blue-500 text-white',
    DEVELOPER: 'bg-purple-500 text-white',
    TREASURY: 'bg-green-500 text-white',
    DAO: 'bg-cyan-500 text-white',
    COMMUNITY: 'bg-orange-500 text-white'
};

/**
 * Hook para verificar permisos de administrador
 * Soporta roles: Super Admin, Admin, Developer, Treasury, DAO, Community
 */
export function useAdminAuth() {
    const { address, isConnected } = useAccount();
    const navigate = useNavigate();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);
    const [roleLabel, setRoleLabel] = useState(null);
    const [permissions, setPermissions] = useState([]);
    const [roleColor, setRoleColor] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkAdminPermissions();
    }, [address, isConnected]);

    const checkAdminPermissions = async () => {
        // Si no está conectado, no autorizar
        if (!isConnected || !address) {
            setIsAuthorized(false);
            setIsLoading(false);
            setError('Wallet no conectada');
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            // Verificar permisos con el backend
            const response = await http.get('/api/admin/verify-permissions', {
                headers: {
                    'x-wallet-address': address
                }
            });

            if (response.data.authorized) {
                setIsAuthorized(true);
                setUserRole(response.data.role);
                setRoleLabel(response.data.roleLabel || response.data.role);
                setPermissions(response.data.permissions || []);
                setRoleColor(response.data.roleColor);
                console.log(`✅ Admin autorizado: ${response.data.roleLabel || response.data.role}`);
            } else {
                setIsAuthorized(false);
                setUserRole(null);
                setRoleLabel(null);
                setPermissions([]);
                setError('No tienes permisos de administrador');
                toast.error('Acceso denegado: Se requieren permisos de Admin');

                // Redirigir después de 2 segundos
                setTimeout(() => {
                    navigate('/');
                }, 2000);
            }
        } catch (err) {
            console.error('Error verificando permisos admin:', err);
            setIsAuthorized(false);
            setUserRole(null);
            setRoleLabel(null);
            setPermissions([]);

            if (err.response?.status === 403 || err.response?.status === 401) {
                setError(err.response.data?.message || 'No autorizado');
                toast.error('Acceso denegado: Permisos insuficientes');
                setTimeout(() => {
                    navigate('/');
                }, 2000);
            } else {
                setError('Error verificando permisos');
                toast.error('Error verificando permisos de administrador');
            }
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Check if user has a specific permission
     */
    const hasPermission = (permission) => {
        if (permissions.includes('*')) return true; // Super Admin
        return permissions.includes(permission);
    };

    return {
        isAuthorized,
        isLoading,
        userRole,
        roleLabel,
        permissions,
        roleColor,
        error,
        hasPermission,
        revalidate: checkAdminPermissions
    };
}

/**
 * Hook simplificado para verificar si el usuario es Super Admin
 */
export function useSuperAdminCheck() {
    const { address } = useAccount();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        const checkSuperAdmin = async () => {
            if (!address) {
                setIsSuperAdmin(false);
                return;
            }

            try {
                const response = await http.get('/api/admin/check-super-admin', {
                    headers: {
                        'x-wallet-address': address
                    }
                });
                setIsSuperAdmin(response.data.isSuperAdmin);
            } catch (err) {
                setIsSuperAdmin(false);
            }
        };

        checkSuperAdmin();
    }, [address]);

    return isSuperAdmin;
}
