import React, { useEffect, useRef } from 'react';
import { Wallet, Loader, LogOut, CheckCircle2 } from 'lucide-react';
import { useWalletConnect } from '../../hooks/useWalletConnect';

/**
 * 🎯 Botón Inteligente Unificado de Conexión/Desconexión de Wallet
 * 
 * Este componente automáticamente cambia entre "Conectar" y "Desconectar"
 * según el estado de la wallet. Todos los botones comparten el mismo estado
 * de conexión gracias al hook useWalletConnect.
 * 
 * Props:
 * - variant: 'primary' | 'secondary' | 'outline' | 'minimal' | 'danger'
 * - size: 'sm' | 'md' | 'lg'
 * - showAddress: boolean - Mostrar dirección cuando está conectada
 * - showIcon: boolean - Mostrar ícono (default: true)
 * - connectText: string - Texto personalizado para conectar
 * - disconnectText: string - Texto personalizado para desconectar
 * - onConnect: callback - Función que se ejecuta después de conectar
 * - onDisconnect: callback - Función que se ejecuta después de desconectar
 * - className: string - Clases adicionales
 * - children: ReactNode - Contenido personalizado (sobrescribe texto por defecto)
 * - fullWidth: boolean - Botón de ancho completo
 */
const ConnectWalletButton = ({
    variant = 'primary',
    size = 'md',
    showAddress = false,
    showIcon = true,
    connectText = 'Conectar Wallet',
    disconnectText = 'Desconectar',
    onConnect,
    onDisconnect,
    className = '',
    children,
    fullWidth = false,
    ...props
}) => {
    const { isConnected, address, isConnecting, connectWallet, disconnectWallet, shortAddress } = useWalletConnect();
    const prevConnected = useRef(isConnected);

    // Efecto para llamar onConnect cuando la wallet se conecta
    useEffect(() => {
        // Si cambió de no conectado a conectado
        if (!prevConnected.current && isConnected && address && onConnect) {
            onConnect(address);
        }
        prevConnected.current = isConnected;
    }, [isConnected, address, onConnect]);

    // Manejador de click
    const handleClick = async () => {
        if (isConnected) {
            // Si está conectada, desconectar
            const success = await disconnectWallet();
            if (success && onDisconnect) {
                onDisconnect();
            }
        } else {
            // Si no está conectada, conectar
            await connectWallet();
            // No llamamos onConnect aquí porque address puede no estar disponible todavía
            // El callback se debe manejar escuchando el evento 'walletConnected' o usando useEffect
        }
    };

    // Estilos por variante
    const variants = {
        primary: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl',
        secondary: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg hover:shadow-xl',
        outline: 'border-2 border-purple-500 text-purple-500 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20',
        minimal: 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200',
        danger: 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl',
    };

    // Estilos por tamaño
    const sizes = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };

    // Tamaño del ícono según el size
    const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;

    // Contenido del botón
    const buttonContent = () => {
        // Si hay children personalizados, usarlos
        if (children) {
            return children;
        }

        // Estado: Conectando
        if (isConnecting) {
            return (
                <>
                    {showIcon && <Loader className="animate-spin" size={iconSize} />}
                    <span>Conectando...</span>
                </>
            );
        }

        // Estado: Conectado
        if (isConnected) {
            return (
                <>
                    {showIcon && <CheckCircle2 size={iconSize} className="text-green-300" />}
                    {showAddress ? (
                        <span className="font-mono">{shortAddress}</span>
                    ) : (
                        <>
                            <span>{disconnectText}</span>
                            {showIcon && <LogOut size={iconSize - 2} className="opacity-70" />}
                        </>
                    )}
                </>
            );
        }

        // Estado: No conectado
        return (
            <>
                {showIcon && <Wallet size={iconSize} />}
                <span>{connectText}</span>
            </>
        );
    };

    return (
        <button
            onClick={handleClick}
            disabled={isConnecting}
            className={`
                flex items-center justify-center gap-2 rounded-lg font-semibold
                transition-all duration-200 transform hover:scale-105
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                ${variants[variant]}
                ${sizes[size]}
                ${fullWidth ? 'w-full' : ''}
                ${className}
            `}
            title={isConnected ? 'Desconectar Wallet' : 'Conectar Wallet'}
            {...props}
        >
            {buttonContent()}
        </button>
    );
};

/**
 * 🎨 Variantes predefinidas del botón para uso rápido
 */
export const WalletButtonPrimary = (props) => (
    <ConnectWalletButton variant="primary" {...props} />
);

export const WalletButtonSecondary = (props) => (
    <ConnectWalletButton variant="secondary" {...props} />
);

export const WalletButtonOutline = (props) => (
    <ConnectWalletButton variant="outline" {...props} />
);

export const WalletButtonMinimal = (props) => (
    <ConnectWalletButton variant="minimal" {...props} />
);

export const WalletButtonDanger = (props) => (
    <ConnectWalletButton variant="danger" {...props} />
);

/**
 * 🔘 Botón compacto solo con ícono (para espacios reducidos)
 */
export const WalletButtonIcon = ({ className = '', size = 20, ...props }) => {
    const { isConnected, isConnecting, connectWallet, disconnectWallet } = useWalletConnect();

    const handleClick = async () => {
        if (isConnected) {
            await disconnectWallet();
        } else {
            await connectWallet();
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={isConnecting}
            className={`
                p-2 rounded-lg transition-all
                ${isConnected
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                }
                text-white shadow-lg hover:shadow-xl
                disabled:opacity-50 disabled:cursor-not-allowed
                ${className}
            `}
            title={isConnected ? 'Desconectar Wallet' : 'Conectar Wallet'}
            {...props}
        >
            {isConnecting ? (
                <Loader className="animate-spin" size={size} />
            ) : isConnected ? (
                <CheckCircle2 size={size} />
            ) : (
                <Wallet size={size} />
            )}
        </button>
    );
};

/**
 * 💎 Botón con dirección de wallet visible (para perfiles)
 */
export const WalletAddressButton = ({ className = '', ...props }) => (
    <ConnectWalletButton
        variant="outline"
        showAddress={true}
        showIcon={true}
        className={className}
        {...props}
    />
);

/**
 * 🎯 Botón de ancho completo (para modales y formularios)
 */
export const WalletButtonFull = ({ variant = 'primary', ...props }) => (
    <ConnectWalletButton
        variant={variant}
        fullWidth={true}
        size="lg"
        {...props}
    />
);

export default ConnectWalletButton;
