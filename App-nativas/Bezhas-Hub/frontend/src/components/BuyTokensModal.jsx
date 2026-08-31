import React, { useState, useEffect } from 'react';
import { X, CreditCard, Wallet, ArrowRight, Info, TrendingDown, CheckCircle, AlertCircle } from 'lucide-react';
import { useBezCoin } from '../context/BezCoinContext';
import { useWeb3 } from '../context/Web3Context';
import { isAddress } from 'ethers';

const BuyTokensModal = ({ isOpen, onClose }) => {
    const [amount, setAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('fiat'); // 'fiat' | 'crypto'
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [recipientAddress, setRecipientAddress] = useState('');

    const { buyWithFIAT, buyWithETH, tokenPrice } = useBezCoin();
    const { address } = useWeb3();

    // Constantes de precio y descuento
    const MARKET_PRICE = parseFloat(tokenPrice) || 0.10; // Precio base en USD
    const FIAT_DISCOUNT = 0.01; // 1% de descuento
    const FIAT_PRICE = MARKET_PRICE * (1 - FIAT_DISCOUNT);

    // Auto-fill address when modal opens or account changes
    useEffect(() => {
        if (isOpen && address) {
            setRecipientAddress(address);
        }
    }, [isOpen, address]);

    const calculateTokens = (usdAmount) => {
        const price = paymentMethod === 'fiat' ? FIAT_PRICE : MARKET_PRICE;
        if (!usdAmount || isNaN(usdAmount)) return 0;
        return (parseFloat(usdAmount) / price).toFixed(2);
    };

    const handleBuy = async () => {
        // Validaciones
        if (!amount || parseFloat(amount) <= 0) return;

        if (paymentMethod === 'fiat') {
            if (!recipientAddress || !isAddress(recipientAddress)) {
                // El input mostrará el error visualmente, pero detenemos aquí también
                return;
            }
        }

        setLoading(true);
        try {
            if (paymentMethod === 'fiat') {
                // Lógica de compra con descuento y dirección específica
                await buyWithFIAT(amount, FIAT_PRICE, recipientAddress);
            } else {
                // Para crypto, asumimos que el usuario quiere comprar la cantidad equivalente en tokens
                // Ojo: buyWithETH espera cantidad de ETH.
                // Aquí simplificamos asumiendo que el usuario ingresa ETH si selecciona Crypto
                // O convertimos USD a ETH si tuviéramos oráculo.
                // Para evitar errores, si es crypto, asumimos que el input es ETH.
                await buyWithETH(amount);
            }
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
                setAmount('');
            }, 3000);
        } catch (error) {
            console.error("Error buying tokens:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const isValidAddress = recipientAddress && isAddress(recipientAddress);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 shrink-0">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600">
                            <Wallet size={18} />
                        </div>
                        Comprar BEZ
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">

                    {/* Selector de Método */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setPaymentMethod('fiat')}
                            className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'fiat'
                                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            {/* Badge de Descuento */}
                            <div className="absolute -top-2.5 -right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 animate-bounce-slow">
                                <TrendingDown size={10} />
                                -1% OFF
                            </div>

                            <CreditCard size={24} />
                            <span className="font-semibold text-sm">Tarjeta (Stripe)</span>
                        </button>

                        <button
                            onClick={() => setPaymentMethod('crypto')}
                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'crypto'
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                                }`}
                        >
                            <div className="flex items-center gap-1">
                                <span className="text-xl">Ξ</span>
                            </div>
                            <span className="font-semibold text-sm">Cripto (ETH)</span>
                        </button>
                    </div>

                    {/* Info Box para Fiat */}
                    {paymentMethod === 'fiat' && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 text-sm text-green-800 dark:text-green-200 flex gap-2 items-start">
                            <Info className="shrink-0 mt-0.5" size={16} />
                            <p className="text-xs leading-relaxed">
                                <strong>Mejor Precio:</strong> Al pagar con tarjeta, te enviamos los BEZ directamente a tu wallet un <strong>1% más barato</strong>. Nosotros cubrimos el gas de la transferencia.
                            </p>
                        </div>
                    )}

                    {/* Input Amount */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {paymentMethod === 'fiat' ? 'Monto a invertir (USD)' : 'Cantidad de ETH'}
                        </label>
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                                {paymentMethod === 'fiat' ? '$' : 'Ξ'}
                            </span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={paymentMethod === 'fiat' ? "100.00" : "0.1"}
                                className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all font-mono text-lg"
                            />
                        </div>
                    </div>

                    {/* Wallet de Destino (Solo Fiat) */}
                    {paymentMethod === 'fiat' && (
                        <div className="space-y-2 animate-fade-in">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex justify-between items-center">
                                <span>Wallet de Destino</span>
                                <span className="text-[10px] text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                    Red Ethereum
                                </span>
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={recipientAddress}
                                    onChange={(e) => setRecipientAddress(e.target.value)}
                                    placeholder="0x..."
                                    className={`w-full pl-4 pr-10 py-3 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs font-mono focus:ring-2 outline-none transition-all ${recipientAddress && !isValidAddress
                                            ? 'border-red-500 focus:ring-red-200'
                                            : 'border-gray-300 dark:border-gray-600 focus:ring-primary-500'
                                        }`}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    {isValidAddress ? (
                                        <CheckCircle size={18} className="text-green-500" />
                                    ) : recipientAddress ? (
                                        <AlertCircle size={18} className="text-red-500" />
                                    ) : (
                                        <Wallet size={18} className="text-gray-400" />
                                    )}
                                </div>
                            </div>
                            {recipientAddress && !isValidAddress && (
                                <p className="text-xs text-red-500 mt-1">Dirección de Ethereum no válida</p>
                            )}
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                Los tokens se enviarán automáticamente a esta dirección una vez confirmado el pago.
                            </p>
                        </div>
                    )}

                    {/* Conversion Preview */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 flex justify-between items-center border border-gray-100 dark:border-gray-700">
                        <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Recibirás aprox.</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white font-mono tracking-tight">
                                {paymentMethod === 'fiat' ? calculateTokens(amount) : '---'} <span className="text-sm font-sans font-normal text-gray-500">BEZ</span>
                            </p>
                        </div>
                        {paymentMethod === 'fiat' && (
                            <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Precio Oferta</p>
                                <p className="text-sm font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                                    ${FIAT_PRICE.toFixed(4)}
                                </p>
                                <p className="text-[10px] text-gray-400 line-through mt-0.5">${MARKET_PRICE.toFixed(4)}</p>
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleBuy}
                        disabled={!amount || parseFloat(amount) <= 0 || loading || (paymentMethod === 'fiat' && !isValidAddress)}
                        className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all ${loading || (paymentMethod === 'fiat' && !isValidAddress)
                                ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                : 'bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 transform hover:-translate-y-0.5 shadow-primary-500/20'
                            }`}
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Procesando...</span>
                            </div>
                        ) : (
                            <>
                                {paymentMethod === 'fiat' ? 'Pagar con Tarjeta' : 'Swap ETH por BEZ'}
                                <ArrowRight size={20} />
                            </>
                        )}
                    </button>

                    {success && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300 animate-fade-in">
                            <CheckCircle size={18} />
                            <span className="text-sm font-medium">¡Compra iniciada! Revisa tu wallet en unos momentos.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BuyTokensModal;
