import { useState, useRef, useEffect } from 'react';
import { Heart, DollarSign, Euro, PoundSterling, X, ShoppingCart } from 'lucide-react';
import { LOGOS } from '../config/cryptoLogos';
import { useBezCoin } from '../context/BezCoinContext';
import { useBezPay } from '../context/BezPayContext';
import { useWeb3 } from '../context/Web3Context';
import { useTheme } from '../context/ThemeContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DonateButton = ({
    recipientAddress,
    recipientName = 'este creador',
    postId = null,
    size = 'md' // sm, md, lg
}) => {
    const { donate, address: userAddress } = useWeb3();
    const { balance: bezBalance } = useBezCoin();
    const { openBuyBez } = useBezPay();
    const { theme } = useTheme();
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedCurrency, setSelectedCurrency] = useState('BEZ');
    const [amount, setAmount] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const dropdownRef = useRef(null);

    const currencies = [
        { id: 'BEZ', symbol: <img src={LOGOS.bezcoin} alt="BEZ-Coin" className="w-5 h-5 inline-block" />, name: 'BEZ-Coin' },
        { id: 'USD', symbol: <DollarSign className="w-5 h-5" />, name: 'Dólar' },
        { id: 'EUR', symbol: <Euro className="w-5 h-5" />, name: 'Euro' },
        { id: 'GBP', symbol: <PoundSterling className="w-5 h-5" />, name: 'Libra' },
    ];

    const presetAmounts = {
        BEZ: [5, 10, 25, 50],
        USD: [1, 5, 10, 20],
        EUR: [1, 5, 10, 20],
        GBP: [1, 5, 10, 20],
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsExpanded(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDonate = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Por favor ingresa una cantidad válida');
            return;
        }

        if (!recipientAddress) {
            toast.error('Dirección del destinatario no disponible');
            return;
        }

        setIsProcessing(true);

        try {
            if (selectedCurrency === 'BEZ') {
                // Check if user has enough balance
                const amountNum = parseFloat(amount);
                if (bezBalance < amountNum) {
                    toast.error('Saldo insuficiente de BEZ-Coin');
                    openBuyBez();
                    setIsProcessing(false);
                    return;
                }

                // Use Web3 donate function
                const success = await donate(
                    recipientAddress,
                    amount,
                    `Donación${postId ? ` por post #${postId}` : ''}`
                );

                if (success) {
                    toast.success(`¡Donación de ${amount} BEZ enviada a ${recipientName}! 🎉`, {
                        duration: 4000,
                        icon: '💝',
                    });
                    setAmount('');
                    setIsExpanded(false);
                }
            } else {
                // Fiat currency donation (USD, EUR, GBP)
                const response = await axios.post(`${API_URL}/payment/fiat-donate`, {
                    recipientAddress,
                    amount: parseFloat(amount),
                    currency: selectedCurrency,
                    postId,
                    senderAddress: userAddress,
                });

                if (response.data.paymentUrl) {
                    // Redirect to payment gateway (Stripe/PayPal)
                    window.location.href = response.data.paymentUrl;
                } else {
                    toast.success(`Donación de ${amount} ${selectedCurrency} procesada exitosamente! 🎉`);
                    setAmount('');
                    setIsExpanded(false);
                }
            }
        } catch (error) {
            console.error('Error al donar:', error);
            toast.error(error.message || 'Error al procesar la donación');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleBuyTokens = () => {
        openBuyBez();
    };

    const sizeClasses = {
        sm: 'p-1.5',
        md: 'p-2',
        lg: 'p-3',
    };

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6',
    };

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            {/* Collapsed Button - Just Icon */}
            {!isExpanded && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className={`${sizeClasses[size]} rounded-full transition-all duration-300 group
            ${theme === 'light'
                            ? 'bg-pink-100 hover:bg-pink-200 text-pink-600'
                            : 'bg-pink-500/20 hover:bg-pink-500/30 text-pink-400'
                        }`}
                    title="Donar"
                >
                    <Heart className={`${iconSizes[size]} group-hover:scale-110 transition-transform`} />
                </button>
            )}

            {/* Expanded Dropdown */}
            {isExpanded && (
                <div
                    className={`absolute right-0 top-0 z-50 rounded-2xl shadow-2xl border animate-fadeIn
            ${theme === 'light'
                            ? 'bg-white border-gray-200'
                            : 'bg-gray-800 border-gray-700'
                        }`}
                    style={{ minWidth: '320px' }}
                >
                    {/* Header */}
                    <div className={`flex items-center justify-between p-4 border-b
            ${theme === 'light' ? 'border-gray-200' : 'border-gray-700'}`}
                    >
                        <div className="flex items-center gap-2">
                            <Heart className={`w-5 h-5 ${theme === 'light' ? 'text-pink-600' : 'text-pink-400'}`} />
                            <span className={`font-semibold ${theme === 'light' ? 'text-black' : 'text-gray-200'}`}>
                                Donar
                            </span>
                        </div>
                        <button
                            onClick={() => setIsExpanded(false)}
                            className={`p-1 rounded-lg transition-colors
                ${theme === 'light'
                                    ? 'hover:bg-gray-100 text-gray-500'
                                    : 'hover:bg-gray-700 text-gray-400'
                                }`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        {/* Support Message */}
                        <p className={`text-sm text-center italic
              ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}
                        >
                            &quot;Con este gesto apoyas su continuo trabajo&quot;
                        </p>

                        {/* Currency Selector */}
                        <div className="flex gap-2 justify-center">
                            {currencies.map((currency) => (
                                <button
                                    key={currency.id}
                                    onClick={() => {
                                        setSelectedCurrency(currency.id);
                                        setAmount('');
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all
                    ${selectedCurrency === currency.id
                                            ? theme === 'light'
                                                ? 'bg-pink-600 text-white'
                                                : 'bg-pink-500 text-white'
                                            : theme === 'light'
                                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    title={currency.name}
                                >
                                    {currency.symbol}
                                </button>
                            ))}
                        </div>

                        {/* Preset Amounts */}
                        <div className="grid grid-cols-4 gap-2">
                            {presetAmounts[selectedCurrency].map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => setAmount(preset.toString())}
                                    className={`py-2 px-3 rounded-lg font-semibold transition-all
                    ${amount === preset.toString()
                                            ? theme === 'light'
                                                ? 'bg-pink-600 text-white'
                                                : 'bg-pink-500 text-white'
                                            : theme === 'light'
                                                ? 'bg-gray-100 text-black hover:bg-gray-200'
                                                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                        }`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        {/* Custom Amount Input */}
                        <div>
                            <label className={`block text-sm font-medium mb-1
                ${theme === 'light' ? 'text-black' : 'text-gray-300'}`}
                            >
                                Cantidad personalizada
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className={`w-full px-4 py-2 rounded-lg border transition-colors
                  ${theme === 'light'
                                        ? 'bg-white border-gray-300 text-black placeholder-gray-400 focus:border-pink-500'
                                        : 'bg-gray-700 border-gray-600 text-white placeholder-gray-500 focus:border-pink-500'
                                    } focus:ring-2 focus:ring-pink-500/20 outline-none`}
                            />
                        </div>

                        {/* Insufficient Balance Warning */}
                        {selectedCurrency === 'BEZ' && parseFloat(amount) > bezBalance && (
                            <div className={`p-3 rounded-lg flex items-start gap-2
                ${theme === 'light'
                                    ? 'bg-yellow-50 border border-yellow-200'
                                    : 'bg-yellow-900/20 border border-yellow-700'
                                }`}
                            >
                                <span className="text-yellow-600 dark:text-yellow-400 text-sm">
                                    ⚠️ Saldo insuficiente ({parseFloat(bezBalance).toFixed(2)} BEZ disponibles)
                                </span>
                            </div>
                        )}

                        {/* Balance Display (for BEZ) */}
                        {selectedCurrency === 'BEZ' && (
                            <div className={`text-center text-sm
                ${theme === 'light' ? 'text-gray-600' : 'text-gray-400'}`}
                            >
                                Tu saldo: <span className="font-semibold">{parseFloat(bezBalance).toFixed(2)} BEZ</span>
                                <button
                                    type="button"
                                    className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-semibold"
                                    onClick={() => openBuyBez()}
                                >
                                    Comprar BEZ-Coin
                                </button>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            {selectedCurrency === 'BEZ' && parseFloat(amount) > bezBalance ? (
                                <button
                                    onClick={handleBuyTokens}
                                    className={`flex-1 py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2
                    ${theme === 'light'
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                                        }`}
                                >
                                    <ShoppingCart className="w-4 h-4" />
                                    Comprar BEZ
                                </button>
                            ) : (
                                <button
                                    onClick={handleDonate}
                                    disabled={!amount || isProcessing}
                                    className={`flex-1 py-3 rounded-lg font-semibold transition-all
                    ${!amount || isProcessing
                                            ? 'opacity-50 cursor-not-allowed bg-gray-400'
                                            : theme === 'light'
                                                ? 'bg-pink-600 hover:bg-pink-700 text-white'
                                                : 'bg-pink-500 hover:bg-pink-600 text-white'
                                        }`}
                                >
                                    {isProcessing ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                            Procesando...
                                        </span>
                                    ) : (
                                        `Donar ${amount || '0'} ${selectedCurrency}`
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Fiat Currency Info */}
                        {selectedCurrency !== 'BEZ' && (
                            <p className={`text-xs text-center
                ${theme === 'light' ? 'text-gray-500' : 'text-gray-400'}`}
                            >
                                Serás redirigido a una pasarela de pago segura
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* CSS for animation */}
            <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
        </div>
    );
};

export default DonateButton;
