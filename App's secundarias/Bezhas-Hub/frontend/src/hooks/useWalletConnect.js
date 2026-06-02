import { useEffect, useCallback } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { useAuth } from '../context/AuthContext';
import { secureWalletCleanup } from '../lib/web3/walletStorage';

/**
 * 🎯 Hook Unificado de Conexión de Wallet
 * 
 * Este hook centraliza TODA la lógica de conexión de wallet en la plataforma.
 * Una vez que el usuario conecta su wallet, automáticamente estará conectada
 * en todos los componentes que usen este hook.
 * 
 * Características:
 * - Detección automática de conexión/desconexión
 * - Sincronización con AuthContext
 * - Gestión de storage para persistencia
 * - Eventos globales para notificaciones
 * 
 * Uso:
 * const { 
 *   isConnected, 
 *   address, 
 *   connectWallet, 
 *   disconnectWallet,
 *   isConnecting 
 * } = useWalletConnect();
 */
export const useWalletConnect = () => {
    const { address, isConnected, isConnecting, isReconnecting } = useAccount();
    const { disconnect } = useDisconnect();
    const { open, close } = useWeb3Modal();
    const { user, logout } = useAuth();

    /**
     * 🔐 FUNCIÓN SEGURA PARA CONECTAR WALLET
     * Esta función abre el modal de Web3Modal con manejo de errores robusto
     */
    const connectWallet = useCallback(async () => {
        try {
            if (import.meta.env.DEV) {
                console.log('🔐 Iniciando conexión de wallet...');
            }

            // Abrir modal - esto NO espera a que el usuario conecte
            // La conexión se detectará automáticamente por useAccount
            await open();

            // No esperamos aquí, el useEffect manejará la conexión
            // Retornamos true porque el modal se abrió correctamente
            return true;
        } catch (error) {
            console.error('❌ Error al conectar wallet:', error);

            // Solo mostrar alert si realmente hay un error
            // No mostrar si el usuario cancela
            if (error?.message && !error.message.includes('reject') && !error.message.includes('cancel')) {
                if (typeof window !== 'undefined') {
                    alert('Error al conectar la wallet. Por favor, intenta de nuevo.');
                }
            }

            return false;
        }
    }, [open]);

    /**
     * 🔐 FUNCIÓN SEGURA PARA DESCONECTAR WALLET
     * Proceso de desconexión completa con limpieza de:
     * - localStorage y sessionStorage
     * - Cookies de sesión
     * - IndexedDB (WalletConnect)
     * - Estado de Wagmi
     * - Sesión de usuario
     */
    const disconnectWallet = useCallback(async () => {
        // Confirmación opcional (descomentar si se desea)
        // const confirmed = window.confirm('¿Estás seguro de que deseas desconectar tu wallet?');
        // if (!confirmed) return false;

        try {
            if (import.meta.env.DEV) {
                console.log('🔐 Iniciando desconexión segura de wallet...');
            }

            // 1. Limpieza completa y segura (localStorage, sessionStorage, cookies, IndexedDB)
            const cleanupSuccess = await secureWalletCleanup();

            if (!cleanupSuccess && import.meta.env.DEV) {
                console.warn('⚠️ Limpieza de storage incompleta, continuando...');
            }

            // 2. Desconectar Wagmi
            await disconnect();

            // 3. Si hay usuario autenticado, hacer logout
            if (user) {
                logout();
            }

            // 4. Cerrar modal si está abierto
            close();

            if (import.meta.env.DEV) {
                console.log('✅ Wallet desconectada exitosamente');
            }

            // 5. Emitir evento global de desconexión
            window.dispatchEvent(new CustomEvent('walletDisconnected'));

            return true;
        } catch (error) {
            console.error('❌ Error crítico al desconectar wallet:', error);

            // Limpieza forzada si algo falla
            try {
                await secureWalletCleanup();
                await disconnect();
                close();
            } catch (fallbackError) {
                console.error('❌ Error en limpieza forzada:', fallbackError);
            }

            // Mostrar mensaje de error al usuario
            if (typeof window !== 'undefined') {
                alert('Hubo un problema al desconectar. Por favor, recarga la página.');
            }

            return false;
        }
    }, [disconnect, user, logout, close]);

    /**
     * 📡 Efecto para detectar cambios en la conexión
     * Este efecto se ejecuta cada vez que cambia el estado de conexión
     */
    useEffect(() => {
        if (isConnected && address) {
            if (import.meta.env.DEV) {
                console.log('✅ Wallet conectada:', address);
            }

            // Emitir evento global de conexión
            window.dispatchEvent(new CustomEvent('walletConnected', {
                detail: { address }
            }));

            // Guardar en localStorage para persistencia
            try {
                localStorage.setItem('walletConnected', 'true');
                localStorage.setItem('walletAddress', address);
            } catch (error) {
                console.error('Error saving to localStorage:', error);
            }
        } else if (!isConnected && !isConnecting && !isReconnecting) {
            if (import.meta.env.DEV) {
                console.log('🔌 Wallet desconectada');
            }

            // Limpiar localStorage
            try {
                localStorage.removeItem('walletConnected');
                localStorage.removeItem('walletAddress');
            } catch (error) {
                console.error('Error clearing localStorage:', error);
            }
        }
    }, [isConnected, address, isConnecting, isReconnecting]);

    /**
     * 🔄 Verificar si hay reconexión automática (solo log una vez)
     */
    useEffect(() => {
        let reconnectLogged = false;
        if (isReconnecting && import.meta.env.DEV && !reconnectLogged) {
            console.log('🔄 Reconectando wallet...');
            reconnectLogged = true;
        }
    }, [isReconnecting]);

    return {
        // Estado de conexión
        isConnected,
        address,
        isConnecting: isConnecting || isReconnecting,

        // Funciones de control
        connectWallet,
        disconnectWallet,

        // Utilidades
        shortAddress: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null,

        // Modal controls
        openModal: open,
        closeModal: close,
    };
};

export default useWalletConnect;
