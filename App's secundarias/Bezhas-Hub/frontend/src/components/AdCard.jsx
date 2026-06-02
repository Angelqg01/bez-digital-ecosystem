import React, { useState, useEffect } from 'react';
import { ExternalLink, Target } from 'lucide-react';

const SAMPLE_ADS = [
    {
        id: 'ad1',
        title: 'BeZhas Premium',
        description: 'Desbloquea funciones exclusivas y acceso prioritario',
        image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Cdefs%3E%3ClinearGradient id="g1" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%234F46E5;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%238B5CF6;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23g1)" width="400" height="200"/%3E%3Ctext x="50%25" y="45%25" font-family="Arial" font-size="28" fill="white" text-anchor="middle" font-weight="bold"%3EBeZhas Premium%3C/text%3E%3Ctext x="50%25" y="65%25" font-family="Arial" font-size="14" fill="white" text-anchor="middle"%3EAcceso Ilimitado%3C/text%3E%3C/svg%3E',
        ctaText: 'Suscribirse',
        url: '/be-vip'
    },
    {
        id: 'ad2',
        title: 'Tokeniza tus Activos',
        description: 'Convierte propiedades y productos en tokens comerciables',
        image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Cdefs%3E%3ClinearGradient id="g2" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%2310B981;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%2306B6D4;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23g2)" width="400" height="200"/%3E%3Ctext x="50%25" y="45%25" font-family="Arial" font-size="24" fill="white" text-anchor="middle" font-weight="bold"%3ETokenización RWA%3C/text%3E%3Ctext x="50%25" y="65%25" font-family="Arial" font-size="14" fill="white" text-anchor="middle"%3EDesde $100 USD%3C/text%3E%3C/svg%3E',
        ctaText: 'Comenzar',
        url: '/marketplace'
    },
    {
        id: 'ad3',
        title: 'Gana con Logística',
        description: 'Participa en la red de envíos descentralizada',
        image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="200"%3E%3Cdefs%3E%3ClinearGradient id="g3" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%23F59E0B;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%23EF4444;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23g3)" width="400" height="200"/%3E%3Ctext x="50%25" y="45%25" font-family="Arial" font-size="24" fill="white" text-anchor="middle" font-weight="bold"%3ELogística Smart%3C/text%3E%3Ctext x="50%25" y="65%25" font-family="Arial" font-size="14" fill="white" text-anchor="middle"%3ERecompensas Diarias%3C/text%3E%3C/svg%3E',
        ctaText: 'Explorar',
        url: '/logistics'
    }
];

const AdCard = () => {
    const [currentAd, setCurrentAd] = useState(SAMPLE_ADS[0]);
    const [adIndex, setAdIndex] = useState(0);

    useEffect(() => {
        // Rotate ads every 10 seconds
        const interval = setInterval(() => {
            setAdIndex((prev) => {
                const nextIndex = (prev + 1) % SAMPLE_ADS.length;
                setCurrentAd(SAMPLE_ADS[nextIndex]);
                return nextIndex;
            });
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const handleClick = () => {
        window.location.href = currentAd.url;
    };

    return (
        <div className="bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 shadow-lg group cursor-pointer hover:border-purple-500/30 transition-all duration-300">
            <div className="relative">
                <img
                    src={currentAd.image}
                    alt={currentAd.title}
                    className="w-full h-48 object-cover"
                />
                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 text-xs text-white flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Patrocinado
                </div>
            </div>

            <div className="p-4">
                <h4 className="font-bold text-lg text-white mb-2 group-hover:text-purple-400 transition-colors">
                    {currentAd.title}
                </h4>
                <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                    {currentAd.description}
                </p>

                <button
                    onClick={handleClick}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                >
                    {currentAd.ctaText}
                    <ExternalLink className="w-4 h-4" />
                </button>

                {/* Ad rotation indicator */}
                <div className="flex gap-1 justify-center mt-3">
                    {SAMPLE_ADS.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1 rounded-full transition-all duration-300 ${idx === adIndex
                                    ? 'w-6 bg-purple-500'
                                    : 'w-1 bg-gray-600'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdCard;
