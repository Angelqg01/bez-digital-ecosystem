import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import {
    ArrowLeftRight, Coins, DollarSign, CreditCard, Wallet,
    TrendingUp, TrendingDown, Info, X, Check, Loader2,
    Bitcoin, Banknote, Euro, Send, Download
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * BezCoinExchange - Sistema completo de compra/venta de BEZ Coins
 * Soporta pagos en: BTC, ETH, USDT, USD, EUR, GBP
 */
const BezCoinExchange = ({ onClose }) => {
    const { address, isConnected } = useAccount();
    const [activeTab, setActiveTab] = useState('buy'); // 'buy' | 'sell' | 'send' | 'donate'

    // Estados principales
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('ETH'); // ETH, BTC, USDT, USD, EUR, GBP
    const [recipientAddress, setRecipientAddress] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Precios y tasas
    const [bezPrice, setBezPrice] = useState(0.50); // Precio base en USD
    const [exchangeRates, setExchangeRates] = useState({
        ETH: 0.00015, // BEZ por ETH
        BTC: 0.000012, // BEZ por BTC
        USDT: 0.50, // BEZ por USDT
        USD: 0.50,
        EUR: 0.46,
        GBP: 0.40
    });

    // Balance del usuario
    const [bezBalance, setBezBalance] = useState(0);
    const [paymentBalance, setPaymentBalance] = useState(0);

    // Cargar balance del usuario
    useEffect(() => {
        if (isConnected && address) {
            loadUserBalance();
        }
    }, [isConnected, address, paymentMethod]);

    const loadUserBalance = async () => {
        try {
            // Cargar balance de BEZ
            const bezRes = await axios.get(`${API_URL}/api/bezcoin/balance/${address}`);
            setBezBalance(bezRes.data.balance || 0);

            // Cargar balance del método de pago seleccionado
            // Aquí se implementaría la lógica para obtener balance de ETH, BTC, etc.
            // Por ahora simulamos
            setPaymentBalance(Math.random() * 10);
        } catch (error) {
            console.error('Error cargando balance:', error);
        }
    };

    // Calcular conversión
    const calculateConversion = () => {
        if (!amount || isNaN(amount)) return 0;

        if (activeTab === 'buy') {
            // Comprando BEZ con otra moneda
            return (parseFloat(amount) / exchangeRates[paymentMethod]).toFixed(4);
        } else if (activeTab === 'sell') {
            // Vendiendo BEZ por otra moneda
            return (parseFloat(amount) * exchangeRates[paymentMethod]).toFixed(4);
        }
        return 0;
    };

    // Métodos de pago disponibles
    const paymentMethods = [
        { id: 'ETH', name: 'Ethereum', icon: Wallet, type: 'crypto', color: 'text-blue-400' },
        { id: 'BTC', name: 'Bitcoin', icon: Bitcoin, type: 'crypto', color: 'text-orange-400' },
        { id: 'USDT', name: 'Tether', icon: DollarSign, type: 'crypto', color: 'text-green-400' },
        { id: 'USD', name: 'US Dollar', icon: DollarSign, type: 'fiat', color: 'text-green-500' },
        { id: 'EUR', name: 'Euro', icon: Euro, type: 'fiat', color: 'text-blue-500' },
        { id: 'GBP', name: 'British Pound', icon: Banknote, type: 'fiat', color: 'text-purple-500' }
    ];

    // Procesar compra
    const handleBuy = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        const bezAmount = calculateConversion();
        if (parseFloat(bezAmount) <= 0) {
            toast.error('Cantidad inválida');
            return;
        }

        setIsProcessing(true);
        try {
            const method = paymentMethods.find(m => m.id === paymentMethod);

            if (method.type === 'crypto') {
                // Pago con criptomonedas
                const res = await axios.post(`${API_URL}/api/bezcoin/buy-crypto`, {
                    userAddress: address,
                    amount: bezAmount,
                    paymentCurrency: paymentMethod,
                    paymentAmount: amount
                });

                toast.success(`¡Compraste ${bezAmount} BEZ con ${amount} ${paymentMethod}!`);
            } else {
                // Pago con fiat (requiere procesador de pagos)
                const res = await axios.post(`${API_URL}/api/bezcoin/buy-fiat`, {
                    userAddress: address,
                    amount: bezAmount,
                    paymentCurrency: paymentMethod,
                    paymentAmount: amount
                });

                // Aquí se redirigiría a Stripe/PayPal
                toast.success('Redirigiendo al procesador de pagos...');
                window.open(res.data.paymentUrl, '_blank');
            }

            await loadUserBalance();
            setAmount('');
        } catch (error) {
            console.error('Error en compra:', error);
            toast.error(error.response?.data?.message || 'Error al comprar BEZ');
        } finally {
            setIsProcessing(false);
        }
    };

    // Procesar venta
    const handleSell = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        if (parseFloat(amount) > bezBalance) {
            toast.error('Balance insuficiente de BEZ');
            return;
        }

        setIsProcessing(true);
        try {
            const receiveAmount = calculateConversion();
            const res = await axios.post(`${API_URL}/api/bezcoin/sell`, {
                userAddress: address,
                bezAmount: amount,
                receiveCurrency: paymentMethod,
                receiveAmount
            });

            toast.success(`¡Vendiste ${amount} BEZ por ${receiveAmount} ${paymentMethod}!`);
            await loadUserBalance();
            setAmount('');
        } catch (error) {
            console.error('Error en venta:', error);
            toast.error(error.response?.data?.message || 'Error al vender BEZ');
        } finally {
            setIsProcessing(false);
        }
    };

    // Enviar BEZ
    const handleSend = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        if (!recipientAddress || recipientAddress.length < 10) {
            toast.error('Ingresa una dirección válida');
            return;
        }

        if (parseFloat(amount) > bezBalance) {
            toast.error('Balance insuficiente');
            return;
        }

        setIsProcessing(true);
        try {
            const res = await axios.post(`${API_URL}/api/bezcoin/transfer`, {
                from: address,
                to: recipientAddress,
                amount
            });

            toast.success(`¡Enviaste ${amount} BEZ exitosamente!`);
            await loadUserBalance();
            setAmount('');
            setRecipientAddress('');
        } catch (error) {
            console.error('Error al enviar:', error);
            toast.error(error.response?.data?.message || 'Error al enviar BEZ');
        } finally {
            setIsProcessing(false);
        }
    };

    // Donar BEZ
    const handleDonate = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Ingresa una cantidad válida');
            return;
        }

        if (!recipientAddress || recipientAddress.length < 10) {
            toast.error('Ingresa una dirección válida del destinatario');
            return;
        }

        if (parseFloat(amount) > bezBalance) {
            toast.error('Balance insuficiente');
            return;
        }

        setIsProcessing(true);
        try {
            const res = await axios.post(`${API_URL}/api/bezcoin/donate`, {
                from: address,
                to: recipientAddress,
                amount
            });

            toast.success(`¡Donaste ${amount} BEZ! 🎉`);
            await loadUserBalance();
            setAmount('');
            setRecipientAddress('');
        } catch (error) {
            console.error('Error al donar:', error);
            toast.error(error.response?.data?.message || 'Error al donar BEZ');
        } finally {
            setIsProcessing(false);
        }
    };

    const conversion = calculateConversion();

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center justify-between border-b border-gray-700">
                    <div className="flex items-center gap-3">
                        <Coins size={32} className="text-yellow-400" />
                        <div>
                            <h2 className="text-2xl font-bold text-white">BEZ Exchange</h2>
                            <p className="text-sm text-gray-200">Compra, vende y transfiere BEZ Coins</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={24} className="text-white" />
                    </button>
                </div>

                {/* Balance */}
                <div className="p-6 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-400">Tu Balance BEZ</p>
                            <p className="text-3xl font-bold text-yellow-400">{bezBalance.toFixed(2)} BEZ</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-400">Precio BEZ</p>
                            <p className="text-xl font-bold text-green-400">${bezPrice} USD</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-4 bg-gray-900/50 border-b border-gray-700 overflow-x-auto">
                    {[
                        { id: 'buy', label: 'Comprar', icon: Download },
                        { id: 'sell', label: 'Vender', icon: TrendingUp },
                        { id: 'send', label: 'Enviar', icon: Send },
                        { id: 'donate', label: 'Donar', icon: Coins }
                    ].map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                    }`}
                            >
                                <Icon size={18} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Métodos de pago */}
                    {(activeTab === 'buy' || activeTab === 'sell') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                                {activeTab === 'buy' ? 'Pagar con' : 'Recibir en'}
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {paymentMethods.map(method => {
                                    const Icon = method.icon;
                                    return (
                                        <button
                                            key={method.id}
                                            onClick={() => setPaymentMethod(method.id)}
                                            className={`p-4 rounded-xl border-2 transition-all ${paymentMethod === method.id
                                                    ? 'border-blue-500 bg-blue-500/10'
                                                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                                                }`}
                                        >
                                            <Icon size={24} className={`${method.color} mx-auto mb-2`} />
                                            <p className="text-sm font-semibold text-white">{method.id}</p>
                                            <p className="text-xs text-gray-400">{method.name}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Input de cantidad */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {activeTab === 'buy' ? `Cantidad de ${paymentMethod}` : 'Cantidad de BEZ'}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-gray-800 text-white text-2xl font-bold p-4 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {activeTab === 'buy' && (
                                <button
                                    onClick={() => setAmount(paymentBalance.toString())}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg"
                                >
                                    MAX
                                </button>
                            )}
                        </div>
                        {amount && (
                            <p className="mt-2 text-sm text-gray-400">
                                Balance disponible: {activeTab === 'buy' ? paymentBalance.toFixed(4) : bezBalance.toFixed(2)}{' '}
                                {activeTab === 'buy' ? paymentMethod : 'BEZ'}
                            </p>
                        )}
                    </div>

                    {/* Conversión */}
                    {(activeTab === 'buy' || activeTab === 'sell') && amount && (
                        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-400">
                                        {activeTab === 'buy' ? 'Recibirás' : 'Obtendrás'}
                                    </p>
                                    <p className="text-2xl font-bold text-white">
                                        {conversion} {activeTab === 'buy' ? 'BEZ' : paymentMethod}
                                    </p>
                                </div>
                                <ArrowLeftRight size={32} className="text-blue-400" />
                            </div>
                        </div>
                    )}

                    {/* Input de dirección (para enviar/donar) */}
                    {(activeTab === 'send' || activeTab === 'donate') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Dirección del destinatario
                            </label>
                            <input
                                type="text"
                                value={recipientAddress}
                                onChange={(e) => setRecipientAddress(e.target.value)}
                                placeholder="0x..."
                                className="w-full bg-gray-800 text-white p-4 rounded-xl border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Botón de acción */}
                    <button
                        onClick={() => {
                            if (activeTab === 'buy') handleBuy();
                            else if (activeTab === 'sell') handleSell();
                            else if (activeTab === 'send') handleSend();
                            else if (activeTab === 'donate') handleDonate();
                        }}
                        disabled={isProcessing || !amount || (activeTab !== 'buy' && activeTab !== 'sell' && !recipientAddress)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-lg p-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={24} className="animate-spin" />
                                Procesando...
                            </>
                        ) : (
                            <>
                                {activeTab === 'buy' && 'Comprar BEZ'}
                                {activeTab === 'sell' && 'Vender BEZ'}
                                {activeTab === 'send' && 'Enviar BEZ'}
                                {activeTab === 'donate' && 'Donar BEZ'}
                            </>
                        )}
                    </button>

                    {/* Info */}
                    <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-800/50 p-4 rounded-xl">
                        <Info size={16} className="mt-0.5 flex-shrink-0" />
                        <p>
                            {activeTab === 'buy' && 'Las transacciones con criptomonedas son instantáneas. Los pagos con fiat pueden tardar 1-3 días hábiles.'}
                            {activeTab === 'sell' && 'Las ventas de BEZ se procesan instantáneamente. Los retiros pueden tardar según el método elegido.'}
                            {activeTab === 'send' && 'Los envíos de BEZ son instantáneos y sin comisiones dentro de la red BeZhas.'}
                            {activeTab === 'donate' && 'Las donaciones son permanentes e irreversibles. Apoya a los creadores de contenido con BEZ.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BezCoinExchange;
