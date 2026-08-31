import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount } from 'wagmi';
import axios from 'axios';

/**
 * PaymentSuccess - Página de confirmación después de pago exitoso
 * Muestra el estado de la transacción blockchain
 */
const PaymentSuccess = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { address } = useAccount();
    const [sessionData, setSessionData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const sessionId = searchParams.get('session_id');
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    useEffect(() => {
        if (sessionId) {
            fetchSessionData();
        } else {
            setError('No se encontró información de la sesión');
            setLoading(false);
        }
    }, [sessionId]);

    const fetchSessionData = async () => {
        try {
            const authToken = localStorage.getItem('authToken');

            const response = await axios.get(
                `${API_URL}/api/stripe/session/${sessionId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                }
            );

            if (response.data.success) {
                setSessionData(response.data.session);
            } else {
                setError(response.data.error);
            }
        } catch (err) {
            console.error('Error fetching session:', err);
            setError('Error al obtener información del pago');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white text-xl">Verificando tu pago...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-purple-900 flex items-center justify-center p-4">
                <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 text-center border border-red-500">
                    <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
                    <p className="text-gray-300 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-blue-900 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-green-500">
                {/* Success Icon */}
                <div className="text-center mb-6">
                    <div className="bg-green-500 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        ¡Pago Exitoso!
                    </h1>
                    <p className="text-gray-300">
                        Tu compra se ha procesado correctamente
                    </p>
                </div>

                {/* Transaction Details */}
                <div className="bg-gray-800 rounded-lg p-6 space-y-4 mb-6">
                    <h3 className="text-white font-semibold text-lg mb-4 flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Detalles de la Transacción
                    </h3>

                    {sessionData && (
                        <>
                            <div className="flex justify-between py-2 border-b border-gray-700">
                                <span className="text-gray-400">Estado:</span>
                                <span className="text-green-400 font-semibold">
                                    {sessionData.payment_status === 'paid' ? 'Pagado' : sessionData.payment_status}
                                </span>
                            </div>

                            <div className="flex justify-between py-2 border-b border-gray-700">
                                <span className="text-gray-400">Cantidad:</span>
                                <span className="text-white font-semibold">
                                    ${(sessionData.amount_total / 100).toFixed(2)} USD
                                </span>
                            </div>

                            {sessionData.metadata?.tokenAmount && (
                                <div className="flex justify-between py-2 border-b border-gray-700">
                                    <span className="text-gray-400">Tokens BEZ:</span>
                                    <span className="text-blue-400 font-semibold text-xl">
                                        {sessionData.metadata.tokenAmount} BEZ
                                    </span>
                                </div>
                            )}

                            <div className="flex justify-between py-2 border-b border-gray-700">
                                <span className="text-gray-400">Wallet de destino:</span>
                                <span className="text-white font-mono text-sm">
                                    {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : 'No conectada'}
                                </span>
                            </div>

                            <div className="flex justify-between py-2">
                                <span className="text-gray-400">ID de Sesión:</span>
                                <span className="text-gray-500 font-mono text-xs">
                                    {sessionId?.slice(0, 20)}...
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* Token Transfer Status */}
                <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-6 mb-6">
                    <div className="flex items-start">
                        <svg className="w-6 h-6 text-blue-400 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h4 className="text-blue-400 font-semibold mb-2">
                                Transferencia Automática Iniciada
                            </h4>
                            <p className="text-gray-300 text-sm">
                                Tus tokens BEZ están siendo transferidos automáticamente a tu wallet.
                                Este proceso toma aproximadamente 1-3 minutos. Recibirás una notificación
                                cuando los tokens estén disponibles.
                            </p>
                            <div className="mt-3 flex items-center text-yellow-400 text-sm">
                                <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Procesando en blockchain...
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg transition-all transform hover:scale-105 font-semibold"
                    >
                        Ir al Dashboard
                    </button>
                    <button
                        onClick={() => navigate('/')}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors font-semibold"
                    >
                        Volver al Inicio
                    </button>
                </div>

                {/* Help Text */}
                <p className="text-center text-gray-400 text-sm mt-6">
                    ¿No ves tus tokens? Pueden tardar hasta 5 minutos. Si el problema persiste,
                    contacta a soporte con tu ID de sesión.
                </p>
            </div>
        </div>
    );
};

export default PaymentSuccess;
