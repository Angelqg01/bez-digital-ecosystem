import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Spinner } from '../ui/Spinner';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Lista de wallets admin autorizadas (Equipo Fundador y Asesores - Polygon)
// Ref: PLATFORM_PAGES.md → Wallets Autorizadas para Admin
export const ADMIN_WALLETS = [
  '0x52Df82920CBAE522880dD7657e43d1A754eD044E', // Super Admin - Wallet principal equipo fundador
  '0x3EfC42095E8503d41Ad8001328FC23388E00e8a3', // Super Admin - BeZhas Wallet 1
  '0x89c23890c742d710265dd61be789c71dc8999b12', // Treasury - Tesorería y Desarrollo DAO
  '0xc0ec3b1fcb7dc0c764371919837c13b58cdc330a', // Community - Fondo de Comunidad/Recompensas
].map(addr => addr.toLowerCase());

/**
 * @dev AdminRoute - Protects admin routes
 * Opciones de acceso:
 * 1. Token demo: localStorage.setItem('adminToken', 'demo-admin-token-123')
 * 2. Wallet autorizada en ADMIN_WALLETS
 * 3. Backend API (si está disponible)
 */
const AdminRoute = () => {
  const { address, isConnecting, isReconnecting } = useAccount();
  const [isAdmin, setIsAdmin] = useState(null); // null = loading, true = admin, false = not admin
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      // OPCIÓN 1: Check for demo token
      const demoToken = localStorage.getItem('adminToken');
      if (demoToken === 'demo-admin-token-123') {
        console.log('✅ AdminRoute: Demo token found, granting access');
        setIsAdmin(true);
        setIsLoading(false);
        return;
      }

      if (!address) {
        console.log('❌ AdminRoute: No wallet connected');
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      const addressLower = address.toLowerCase();

      // OPCIÓN 2: Check if wallet is in hardcoded admin list
      if (ADMIN_WALLETS.includes(addressLower)) {
        console.log('✅ AdminRoute: Wallet is in admin list', address);
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminWalletAddress', address);
        setIsAdmin(true);
        setIsLoading(false);
        return;
      }

      // OPCIÓN 3: Try backend API (verify-permissions endpoint)
      try {
        const response = await fetch(`${API_URL}/admin/verify-permissions`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-wallet-address': address,
          },
        });

        if (response.ok) {
          const data = await response.json();

          // verify-permissions returns { authorized, role, permissions, ... }
          if (data.authorized) {
            const hasAdminAccess = ['SUPER_ADMIN', 'ADMIN', 'DEVELOPER', 'TREASURY', 'DAO', 'COMMUNITY'].includes(data.role);

            console.log('✅ AdminRoute: Backend verification', { role: data.role, hasAccess: hasAdminAccess });
            setIsAdmin(hasAdminAccess);

            if (hasAdminAccess) {
              localStorage.setItem('isAdmin', 'true');
              localStorage.setItem('adminWalletAddress', address);
            } else {
              toast.error('Acceso denegado. Se requieren permisos de administrador.');
            }
          } else {
            console.log('⚠️ AdminRoute: Not authorized by backend');
            setIsAdmin(false);
            toast.error('Acceso denegado. Se requieren permisos de administrador.');
          }
        } else {
          console.log('⚠️ AdminRoute: Backend returned error', response.status);
          setIsAdmin(false);
          toast.error('No se pudo verificar permisos. Intenta de nuevo.');
        }
      } catch (error) {
        console.error('⚠️ AdminRoute: Backend error', error);
        setIsAdmin(false);
        toast.error('Error de conexión al verificar permisos de admin.');
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [address]);

  // Loading states
  if (isConnecting || isReconnecting || isLoading) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-gray-900">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-400">Verificando permisos...</p>
        </div>
      </div>
    );
  }

  // No wallet connected
  if (!address) {
    return <Navigate to="/admin-login" replace />;
  }

  // Not an admin
  if (isAdmin === false) {
    return <Navigate to="/admin-login" replace />;
  }

  // Admin verified - render protected content
  return <Outlet />;
};

export default AdminRoute;
