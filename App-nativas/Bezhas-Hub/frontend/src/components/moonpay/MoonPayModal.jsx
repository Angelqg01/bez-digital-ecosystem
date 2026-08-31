import React, { useState, useEffect } from 'react';
import { X, CreditCard, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { buildBuyUrl, buildSellUrl, getSupportedCryptocurrencies, getSupportedFiatCurrencies } from '../../services/moonpay.service';
import { useWeb3 } from '../../context/Web3Context';
import toast from 'react-hot-toast';

/**
 * MoonPay Modal Component
 * Provides cryptocurrency buy/sell functionality through MoonPay widget
 */
const MoonPayModal = ({ isOpen, onClose, mode = 'buy', initialCurrency = 'eth' }) => {
    const { address } = useWeb3();
    const [selectedCrypto, setSelectedCrypto] = useState(initialCurrency);
    const [selectedFiat, setSelectedFiat] = useState('usd');
    const [amount, setAmount] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const cryptos = getSupportedCryptocurrencies();
    const fiats = getSupportedFiatCurrencies();

    useEffect(() => {
        if (isOpen) {
            setSelectedCrypto(initialCurrency);
            setAmount('');
        }
    }, [isOpen, initialCurrency]);

    const handleOpenMoonPay = () => {
        if (!address) {
            toast.error('Por favor conecta tu wallet primero');
            return;
        }

        if (amount && parseFloat(amount) <= 0) {
            toast.error('Por favor ingresa una cantidad válida');
            return;
        }

        setIsLoading(true);

        try {
            const params = {
                currencyCode: selectedCrypto,
                walletAddress: address,
                baseCurrencyCode: selectedFiat,
                baseCurrencyAmount: amount || '',
                email: email || '',
                colorCode: '#7C3AED', // BeZhas purple
                redirectURL: window.location.origin + '/profile',
                externalTransactionId: `bezhas_${Date.now()}`,
            };

            let moonpayUrl;
            if (mode === 'buy') {
                moonpayUrl = buildBuyUrl(params);
            } else {
                moonpayUrl = buildSellUrl({
                    ...params,
                    refundWalletAddress: address,
                });
            }

            // Open in popup window
            const width = 450;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                moonpayUrl,
                'MoonPay',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
            );

            if (!popup) {
                toast.error('Por favor permite ventanas emergentes para continuar');
                setIsLoading(false);
                return;
            }

            // Monitor popup
            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    setIsLoading(false);
                    onClose();
                    toast.success(
                        mode === 'buy'
                            ? '¡Transacción completada! Tu crypto llegará pronto'
                            : '¡Venta completada! Tu dinero llegará pronto'
                    );
                }
            }, 500);

            // Close modal but keep monitoring popup
            setTimeout(() => {
                if (!popup.closed) {
                    onClose();
                }
            }, 1000);

        } catch (error) {
            console.error('Error opening MoonPay:', error);
            toast.error('Error al abrir MoonPay. Por favor intenta de nuevo.');
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-2xl shadow-2xl border border-purple-500/30 w-full max-w-md mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-3">
                        {mode === 'buy' ? (
                            <TrendingUp className="text-white" size={32} />
                        ) : (
                            <TrendingDown className="text-white" size={32} />
                        )}
                        <div>
                            <h2 className="text-2xl font-bold text-white">
                                {mode === 'buy' ? 'Comprar Crypto' : 'Vender Crypto'}
                            </h2>
                            <p className="text-white/80 text-sm">Powered by MoonPay</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Wallet Address */}
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet size={18} className="text-purple-400" />
                            <span className="text-gray-400 text-sm">Wallet conectada</span>
                        </div>
                        <p className="text-white font-mono text-sm truncate">
                            {address || 'No conectada'}
                        </p>
                    </div>

                    {/* Cryptocurrency Selection */}
                    <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">
                            {mode === 'buy' ? 'Crypto a comprar' : 'Crypto a vender'}
                        </label>
                        <select
                            value={selectedCrypto}
                            onChange={(e) => setSelectedCrypto(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {cryptos.map((crypto) => (
                                <option key={crypto.code} value={crypto.code}>
                                    {crypto.symbol} - {crypto.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Fiat Currency Selection */}
                    <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">
                            Moneda fiat
                        </label>
                        <select
                            value={selectedFiat}
                            onChange={(e) => setSelectedFiat(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {fiats.map((fiat) => (
                                <option key={fiat.code} value={fiat.code}>
                                    {fiat.symbol} {fiat.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Amount Input */}
                    <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">
                            Cantidad (opcional)
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="100"
                            min="0"
                            step="0.01"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                            Deja vacío para elegir en MoonPay
                        </p>
                    </div>

                    {/* Email Input */}
                    <div>
                        <label className="block text-gray-400 text-sm font-medium mb-2">
                            Email (opcional)
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <p className="text-gray-500 text-xs mt-1">
                            Para recibir notificaciones
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                            <CreditCard size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-blue-200">
                                <p className="font-medium mb-1">Métodos de pago aceptados:</p>
                                <p className="text-blue-300/80">
                                    Tarjetas de crédito/débito, transferencias bancarias, PayPal, Apple Pay, Google Pay
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleOpenMoonPay}
                        disabled={isLoading || !address}
                        className={`w-full py-4 rounded-lg font-semibold text-white transition-all ${isLoading || !address
                            ? 'bg-gray-700 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-purple-500/50'
                            }`}
                    >
                        {isLoading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Abriendo MoonPay...
                            </span>
                        ) : !address ? (
                            'Conecta tu Wallet primero'
                        ) : (
                            `${mode === 'buy' ? 'Comprar' : 'Vender'} con MoonPay`
                        )}
                    </button>

                    {/* Disclaimer */}
                    <p className="text-gray-500 text-xs text-center">
                        Serás redirigido a MoonPay para completar la transacción de forma segura.
                        BeZhas no almacena tu información de pago.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MoonPayModal;
