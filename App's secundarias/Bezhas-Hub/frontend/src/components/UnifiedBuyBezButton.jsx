/**
 * UnifiedBuyBezButton.jsx
 * 
 * Botón reutilizable para "Comprar BEZ" en toda la plataforma.
 * Ahora usa useBezPay() hooks en lugar del UnifiedPaymentModal independiente.
 * El BezPayModal está registrado globalmente en App.jsx vía BezPayProvider.
 */

import { Shield, ShoppingBag } from 'lucide-react';
import { useBezPay } from '../context/BezPayContext';

export default function UnifiedBuyBezButton({
    variant = 'primary', // 'primary' | 'secondary' | 'icon' | 'text'
    size = 'md', // 'sm' | 'md' | 'lg'
    className = '',
    children,
    amount, // Opcional: monto predefinido en USDC
    onSuccess
}) {
    const { openBuyBez } = useBezPay();

    const handleClick = () => {
        openBuyBez(amount || null, {
            onSuccess: (result) => {
                onSuccess?.(result);
            }
        });
    };

    // Estilos por variante
    const variantStyles = {
        primary: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 shadow-lg hover:shadow-xl',
        secondary: 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700',
        icon: 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-500/30',
        text: 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/10'
    };

    // Estilos por tamaño
    const sizeStyles = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2.5 text-base',
        lg: 'px-6 py-3 text-lg'
    };

    return (
        <button
            onClick={handleClick}
            className={`
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                rounded-xl font-semibold transition-all 
                flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${className}
            `}
        >
            {variant === 'icon' ? (
                <Shield size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
            ) : (
                <>
                    <ShoppingBag size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
                    {children || 'Comprar BEZ'}
                </>
            )}
        </button>
    );
}
