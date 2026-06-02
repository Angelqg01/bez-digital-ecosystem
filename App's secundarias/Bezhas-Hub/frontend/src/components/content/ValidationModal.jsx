import React, { useState, useEffect } from 'react';
import http from '../../services/http';
import { useAccount, useContractWrite, useWaitForTransaction } from 'wagmi';
import { parseEther, parseUnits } from 'ethers';
import { Shield, Check, X, AlertCircle, CreditCard, Wallet, Lock } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { CONTENT_VALIDATOR_CONTRACT } from '../../contracts/config';
import ContentValidatorABI from '../../contracts/ContentValidator.json';

/**
 * Modal de Validación de Contenido
 * Aparece antes de publicar para ofrecer certificación blockchain
 */
export default function ValidationModal({
    content,
    contentType = 'post',
    onValidate,
    onSkip,
    isOpen
}) {
    const { address, isConnected } = useAccount();
    const [step, setStep] = useState('selection'); // selection, crypto-payment, fiat-payment, processing, success
    const [paymentMethod, setPaymentMethod] = useState(null); // 'crypto' | 'fiat'
    const [contentHash, setContentHash] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);

    // Generar hash del contenido
    useEffect(() => {
        if (content && isOpen) {
            generateContentHash(content);
        }
    }, [content, isOpen]);

    /**
     * Genera SHA-256 hash del contenido
     */
    const generateContentHash = async (contentData) => {
        try {
            // Normalizar contenido a string JSON
            const contentString = JSON.stringify({
                ...contentData,
                timestamp: Date.now(), // Añadir timestamp para unicidad
                author: address
            });

            // Usar Web Crypto API para SHA-256
            const encoder = new TextEncoder();
            const data = encoder.encode(contentString);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            setContentHash(hashHex);
        } catch (err) {
            console.error('Error generating hash:', err);
            setError('Error al generar hash del contenido');
        }
    };

    /**
     * Hook para validar con BezCoin
     */
    const { write: validateWithBezCoin, data: bezCoinTxData } = useContractWrite({
        address: CONTENT_VALIDATOR_CONTRACT.address,
        abi: ContentValidatorABI.abi,
        functionName: 'validateWithBezCoin',
        args: [
            contentHash,
            `bezcoin://${contentType}/${Date.now()}`, // URI temporal (actualizar desde backend)
            contentType
        ]
    });

    /**
     * Hook para validar con moneda nativa (MATIC/ETH)
     */
    const { write: validateWithNative, data: nativeTxData } = useContractWrite({
        address: CONTENT_VALIDATOR_CONTRACT.address,
        abi: ContentValidatorABI.abi,
        functionName: 'validateWithNative',
        args: [
            contentHash,
            `native://${contentType}/${Date.now()}`,
            contentType
        ],
        value: parseEther('0.01') // 0.01 MATIC/ETH (ajustar según precio)
    });

    /**
     * Esperar confirmación de transacción crypto
     */
    const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransaction({
        hash: bezCoinTxData?.hash || nativeTxData?.hash
    });

    // Auto-transición a success cuando la tx se confirma
    useEffect(() => {
        if (isTxSuccess && step === 'processing') {
            setStep('success');
            setTimeout(() => {
                handleSuccess();
            }, 2000);
        }
    }, [isTxSuccess, step]);

    /**
     * Maneja pago con criptomoneda
     */
    const handleCryptoPayment = async (method) => {
        if (!isConnected) {
            setError('Por favor conecta tu wallet primero');
            return;
        }

        if (!contentHash) {
            setError('Error: Hash del contenido no generado');
            return;
        }

        setIsProcessing(true);
        setStep('processing');

        try {
            if (method === 'bezcoin') {
                await validateWithBezCoin?.();
            } else {
                await validateWithNative?.();
            }
        } catch (err) {
            console.error('Error en pago crypto:', err);
            setError(err.message || 'Error al procesar pago crypto');
            setStep('crypto-payment');
            setIsProcessing(false);
        }
    };

    /**
     * Maneja pago con FIAT (Stripe)
     */
    const handleFiatPayment = async () => {
        setIsProcessing(true);
        setStep('processing');

        try {
            // 1. Crear sesión de pago en Stripe
            const response = await http.post('/api/payment/create-validation-session', {
                contentHash,
                contentData: content,
                contentType,
                authorAddress: address,
                amount: 999, // €9.99 en centavos
                currency: 'eur'
            });

            const { sessionId, error: apiError } = response.data;

            if (apiError) {
                throw new Error(apiError);
            }

            // 2. Redirigir a Stripe Checkout
            const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
            if (!stripeKey || stripeKey === 'undefined') {
                throw new Error('Stripe key not configured');
            }
            const stripe = await loadStripe(stripeKey);
            const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });

            if (stripeError) {
                throw new Error(stripeError.message);
            }
        } catch (err) {
            console.error('Error en pago FIAT:', err);
            setError(err.message || 'Error al procesar pago FIAT');
            setStep('fiat-payment');
            setIsProcessing(false);
        }
    };

    /**
     * Maneja validación exitosa
     */
    const handleSuccess = () => {
        onValidate({
            contentHash,
            isValidated: true,
            validationMethod: paymentMethod,
            timestamp: Date.now()
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Certificar Contenido</h2>
                                <p className="text-sm text-gray-400">Valida tu contenido en blockchain</p>
                            </div>
                        </div>
                        <button
                            onClick={onSkip}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Step 1: Selection */}
                    {step === 'selection' && (
                        <div className="space-y-6">
                            {/* Info Box */}
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
                                    <div>
                                        <p className="text-blue-300 font-semibold mb-1">
                                            ¿Por qué certificar tu contenido?
                                        </p>
                                        <ul className="text-sm text-gray-300 space-y-1">
                                            <li>✓ Prueba inmutable de autoría y timestamp</li>
                                            <li>✓ Protección contra plagio y robo de contenido</li>
                                            <li>✓ Badge exclusivo visible para todos</li>
                                            <li>✓ Mayor credibilidad y confianza</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Options */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white">Selecciona método de pago</h3>

                                {/* Crypto Payment */}
                                <button
                                    onClick={() => {
                                        setPaymentMethod('crypto');
                                        setStep('crypto-payment');
                                    }}
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-6 rounded-xl transition-all duration-300 text-left"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Wallet className="w-8 h-8" />
                                            <div>
                                                <p className="font-bold text-lg">Pagar con Crypto</p>
                                                <p className="text-sm text-blue-100">
                                                    10 BEZ o 0.01 MATIC
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold">≈ €5</p>
                                            <p className="text-xs text-blue-100">Precio actual</p>
                                        </div>
                                    </div>
                                </button>

                                {/* FIAT Payment */}
                                <button
                                    onClick={() => {
                                        setPaymentMethod('fiat');
                                        setStep('fiat-payment');
                                    }}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white p-6 rounded-xl transition-all duration-300 text-left"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <CreditCard className="w-8 h-8" />
                                            <div>
                                                <p className="font-bold text-lg">Pagar con Tarjeta</p>
                                                <p className="text-sm text-green-100">
                                                    Visa, Mastercard, etc.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold">€9.99</p>
                                            <p className="text-xs text-green-100">Precio fijo</p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Skip Button */}
                            <button
                                onClick={onSkip}
                                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-xl transition-colors"
                            >
                                Publicar sin certificar
                            </button>
                        </div>
                    )}

                    {/* Step 2: Crypto Payment */}
                    {step === 'crypto-payment' && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setStep('selection')}
                                className="text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Volver
                            </button>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white">Selecciona criptomoneda</h3>

                                {/* BezCoin Option */}
                                <button
                                    onClick={() => handleCryptoPayment('bezcoin')}
                                    disabled={isProcessing}
                                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white p-4 rounded-xl transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">Pagar con BezCoin</span>
                                        <span className="font-bold">10 BEZ</span>
                                    </div>
                                </button>

                                {/* Native Currency Option */}
                                <button
                                    onClick={() => handleCryptoPayment('native')}
                                    disabled={isProcessing}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white p-4 rounded-xl transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold">Pagar con MATIC</span>
                                        <span className="font-bold">0.01 MATIC</span>
                                    </div>
                                </button>
                            </div>

                            {/* Content Hash Display */}
                            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                                <p className="text-xs text-gray-400 mb-2">Hash del Contenido:</p>
                                <p className="text-xs text-gray-300 font-mono break-all">{contentHash}</p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: FIAT Payment */}
                    {step === 'fiat-payment' && (
                        <div className="space-y-6">
                            <button
                                onClick={() => setStep('selection')}
                                className="text-gray-400 hover:text-white flex items-center gap-2"
                            >
                                ← Volver
                            </button>

                            <div className="text-center space-y-4">
                                <CreditCard className="w-16 h-16 text-green-400 mx-auto" />
                                <h3 className="text-xl font-bold text-white">Pago con Tarjeta</h3>
                                <p className="text-gray-400">
                                    Serás redirigido a Stripe para completar el pago de forma segura
                                </p>

                                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-400">Certificación blockchain</span>
                                        <span className="text-white font-bold">€9.99</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">Procesamiento</span>
                                        <span className="text-white">Incluido</span>
                                    </div>
                                    <div className="h-px bg-gray-700"></div>
                                    <div className="flex items-center justify-between text-lg">
                                        <span className="text-white font-semibold">Total</span>
                                        <span className="text-white font-bold">€9.99</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleFiatPayment}
                                    disabled={isProcessing}
                                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 rounded-xl transition-all duration-300"
                                >
                                    {isProcessing ? 'Procesando...' : 'Continuar al Pago'}
                                </button>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Processing */}
                    {step === 'processing' && (
                        <div className="text-center space-y-6 py-8">
                            <div className="relative">
                                <div className="w-24 h-24 mx-auto">
                                    <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="absolute inset-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse' }}></div>
                                    <Lock className="w-12 h-12 text-purple-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-white">Certificando en Blockchain...</h3>
                            <p className="text-gray-400">
                                Tu contenido está siendo validado de forma inmutable.<br />
                                Por favor espera un momento.
                            </p>
                            {isTxLoading && (
                                <p className="text-sm text-blue-400">
                                    Esperando confirmación de la blockchain...
                                </p>
                            )}
                        </div>
                    )}

                    {/* Step 5: Success */}
                    {step === 'success' && (
                        <div className="text-center space-y-6 py-8">
                            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                                <Check className="w-12 h-12 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white">¡Certificación Exitosa!</h3>
                            <p className="text-gray-300">
                                Tu contenido ha sido validado en blockchain.<br />
                                Ahora tiene un certificado inmutable de autenticidad.
                            </p>
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                <p className="text-green-400 text-sm">
                                    Hash: <span className="font-mono">{contentHash.slice(0, 20)}...</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
