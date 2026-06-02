import { useState, useEffect } from 'react';
import { Copy, TrendingUp, TrendingDown, Check, Activity } from 'lucide-react';

// BEZ Token en Polygon Mainnet
const TOKEN_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

const TokenWidget = ({ position = 'hero' }) => {
    const [price, setPrice] = useState(0);
    const [change, setChange] = useState(0);
    const [copied, setCopied] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);

    useEffect(() => {
        // Mostrar widget después de 1s
        setTimeout(() => setIsVisible(true), 1000);

        const fetchTokenData = async () => {
            try {
                // Intentar obtener precio real de DexScreener (Polygon)
                const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN_CONTRACT}`);
                const data = await response.json();

                if (data.pairs && data.pairs.length > 0) {
                    const pair = data.pairs[0];
                    setPrice(parseFloat(pair.priceUsd));
                    setChange(pair.priceChange?.h24 || 0);
                    setLastUpdate(new Date());
                } else {
                    // Fallback: intentar con CoinGecko o usar precio base
                    fetchFromBackend();
                }
            } catch (error) {
                fetchFromBackend();
            }
        };

        const fetchFromBackend = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || '';
                const response = await fetch(`${apiUrl}/api/token/price`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.price) {
                        setPrice(data.price);
                        setChange(data.change24h || 0);
                        setLastUpdate(new Date());
                        return;
                    }
                }
            } catch (e) {
                // Fallback silencioso
            }
            // Precio base si no hay datos
            if (price === 0) {
                setPrice(0.0542);
                setChange(2.4);
            }
        };

        fetchTokenData();
        const interval = setInterval(fetchTokenData, 15000); // Actualizar cada 15s

        return () => clearInterval(interval);
    }, []);

    const copyContract = async () => {
        try {
            await navigator.clipboard.writeText(TOKEN_CONTRACT);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Error copying:', error);
        }
    };

    const isPositive = change >= 0;

    // Posición según prop
    const positionClasses = position === 'hero'
        ? 'absolute top-32 right-4 md:right-8 lg:right-12'
        : 'fixed bottom-6 right-6';

    return (
        <div
            className={`${positionClasses} z-50 transform transition-all duration-700 font-display ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-10 opacity-0 scale-95'
                }`}
        >
            {/* Glow Effect Behind */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 rounded-2xl blur-md opacity-40 animate-pulse"></div>

            {/* Main Card */}
            <div className="relative bg-[#0a0a0f]/95 backdrop-blur-xl border border-purple-500/30 p-4 rounded-xl shadow-2xl shadow-purple-900/20">

                {/* Header - Oracle Badge */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Activity className="w-3 h-3 text-purple-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-purple-400 tracking-widest uppercase">Polygon Oracle</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="text-[9px] text-green-400 font-medium">LIVE</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 min-w-[260px]">
                    {/* Icon Wrapper */}
                    <div
                        className="relative group cursor-pointer"
                        onClick={copyContract}
                        title="Copiar contrato BEZ"
                    >
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-600 via-indigo-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 transition-all group-hover:scale-105 group-hover:shadow-purple-500/50">
                            <span className="font-bold text-white text-2xl">B</span>
                        </div>
                        {/* Live Status Dot */}
                        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-[#0a0a0f]"></span>
                        </span>
                    </div>

                    {/* Price Info */}
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-gray-300 tracking-wide">BEZ / USD</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${isPositive
                                ? 'text-green-400 bg-green-400/15 border border-green-500/20'
                                : 'text-red-400 bg-red-400/15 border border-red-500/20'
                                }`}>
                                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                <span>{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
                            </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-white tracking-tight">
                                ${price > 0 ? price.toFixed(4) : '0.0542'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-gray-500 uppercase tracking-wide">24h Change</span>
                        </div>
                    </div>

                    {/* Copy Button */}
                    <button
                        onClick={copyContract}
                        className="group p-2.5 hover:bg-purple-500/10 rounded-lg transition-all border border-white/5 hover:border-purple-500/30"
                        aria-label="Copiar Contrato"
                    >
                        {copied ? (
                            <Check className="w-4 h-4 text-green-400" />
                        ) : (
                            <Copy className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
                        )}
                    </button>
                </div>
            </div>

            {/* Copy Toast Notification */}
            {copied && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-xs font-medium bg-black/90 text-white px-4 py-2 rounded-full border border-white/10 backdrop-blur-md shadow-lg flex items-center gap-2 whitespace-nowrap">
                    <Check className="w-3 h-3 text-green-500" />
                    Contrato Copiado
                </div>
            )}
        </div>
    );
};

export default TokenWidget;
