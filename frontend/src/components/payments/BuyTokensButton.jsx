import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { toast } from 'react-hot-toast';
import axios from 'axios';

/**
 * BuyTokensButton - Componente para compra de tokens BEZ con Stripe
 * Integración completa: Frontend → Backend → Stripe → Blockchain
 */
const BuyTokensButton = ({ tokenAmount = 100, customClass = '' }) => {
    const { address, isConnected } = useAccount();
    const [loading, setLoading] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    // Precio por token: $0.10 USD
    const pricePerToken = 0.10;
    const totalPrice = (tokenAmount * pricePerToken).toFixed(2);

    const handleBuyTokens = async () => {
        if (!isConnected || !address) {
            toast.error('Por favor conecta tu wallet primero');
            return;
        }

        if (tokenAmount < 1) {
            toast.error('Cantidad mínima: 1 BEZ token');
            return;
        }

        setLoading(true);

        try {
            // Obtener token de autenticación
            const authToken = localStorage.getItem('authToken');

            if (!authToken) {
                toast.error('Sesión expirada. Por favor inicia sesión nuevamente.');
                setLoading(false);
                return;
            }

            // Crear sesión de checkout en Stripe
            const response = await axios.post(
                `${API_URL}/api/stripe/create-token-purchase-session`,
                {
                    tokenAmount: tokenAmount,
                    email: localStorage.getItem('userEmail') || `${address}@bezhas.com`
                },
                {
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.success && response.data.url) {
                // Redirigir a Stripe Checkout
                window.location.href = response.data.url;
            } else {
                throw new Error(response.data.error || 'Error creating payment session');
            }

        } catch (error) {
            console.error('Error purchasing tokens:', error);

            const errorMessage = error.response?.data?.error ||
                error.response?.data?.message ||
                error.message ||
                'Error al procesar el pago';

            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleBuyTokens}
            disabled={loading || !isConnected}
            className={`
                ${customClass}
                relative inline-flex items-center justify-center px-6 py-3
                bg-gradient-to-r from-blue-600 to-purple-600
                text-white font-semibold rounded-lg
                hover:from-blue-700 hover:to-purple-700
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200
                transform hover:scale-105
                shadow-lg hover:shadow-xl
            `}
        >
            {loading ? (
                <>
                    <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                    </svg>
                    Procesando...
                </>
            ) : (
                <>
                    <svg
                        className="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                    Comprar {tokenAmount} BEZ - ${totalPrice}
                </>
            )}
        </button>
    );
};

export default BuyTokensButton;
