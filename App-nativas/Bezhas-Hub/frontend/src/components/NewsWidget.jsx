import React, { useState, useEffect } from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';

const NEWS_SOURCES = [
    { id: 1, source: 'Bloomberg', type: 'RWA', title: 'Tokenización de Activos Reales: El mercado de $16 Billones', time: '2h ago', trend: 'up', url: 'https://www.bloomberg.com' },
    { id: 2, source: 'Reuters', type: 'Logistics', title: 'Blockchain reduce costos de envío global en un 30%', time: '4h ago', trend: 'neutral', url: 'https://www.reuters.com' },
    { id: 3, source: 'Coinbase', type: 'Crypto', title: 'Nuevas regulaciones favorecen plataformas DeFi transparentes', time: '5h ago', trend: 'up', url: 'https://www.coinbase.com' },
    { id: 4, source: 'Yahoo Finance', type: 'AI', title: 'La IA predice interrupciones en la cadena de suministro antes que sucedan', time: '7h ago', trend: 'up', url: 'https://finance.yahoo.com' },
    { id: 5, source: 'Google News', type: 'Tech', title: 'Cómo la Web3 está transformando la identidad digital', time: '1d ago', trend: 'up', url: 'https://news.google.com' },
    { id: 6, source: 'The Block', type: 'DeFi', title: 'Total Value Locked en DeFi alcanza nuevo máximo histórico', time: '3h ago', trend: 'up', url: 'https://www.theblock.co' },
    { id: 7, source: 'CoinDesk', type: 'NFT', title: 'Volumen de trading de NFTs aumenta 45% en el último trimestre', time: '6h ago', trend: 'up', url: 'https://www.coindesk.com' },
];

const NewsWidget = () => {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulación de carga de API externa
        setTimeout(() => {
            setNews(NEWS_SOURCES);
            setLoading(false);
        }, 500);
    }, []);

    if (loading) {
        return (
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-lg animate-pulse">
                <div className="h-6 bg-gray-700 rounded mb-4"></div>
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10 shadow-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    Market Intelligence
                </h3>
                <span className="text-xs text-gray-400">Powered by BeZhas Oracle</span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar">
                {news.map((item) => (
                    <a
                        key={item.id}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block cursor-pointer hover:bg-white/5 p-3 rounded-lg transition-all duration-300 border border-transparent hover:border-white/10"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">{item.source} • {item.type}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{item.time}</span>
                                <ExternalLink className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                        <h4 className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors leading-snug">
                            {item.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-2">
                            {item.trend === 'up' && (
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    Tendencia Alcista
                                </span>
                            )}
                            {item.trend === 'neutral' && (
                                <span className="text-xs text-yellow-400 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                                    </svg>
                                    Neutral
                                </span>
                            )}
                        </div>
                    </a>
                ))}
            </div>

            <button className="w-full mt-4 py-2 text-sm text-center text-blue-400 hover:text-blue-300 transition-colors border-t border-white/10 pt-4">
                Ver más noticias →
            </button>
        </div>
    );
};

export default NewsWidget;
