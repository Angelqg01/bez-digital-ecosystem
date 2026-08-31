import React from 'react';
import { ExternalLink, Star, TrendingUp } from 'lucide-react';

/**
 * AdCard Component
 * Tarjeta de anuncio publicitario para intercalar en el feed
 * 
 * @param {Object} props
 * @param {Object} [props.ad] - Objeto de anuncio específico (opcional)
 * @param {number} [props.adIndex] - Índice del anuncio para mostrar diferentes variantes (fallback)
 */
const AdCard = ({ ad: propAd, adIndex = 0 }) => {
    console.log('📺 AdCard renderizando', propAd ? 'con anuncio específico' : `con índice: ${adIndex}`);

    // Anuncios de ejemplo (fallback)
    const fallbackAds = [
        {
            id: 1,
            title: '🚀 Impulsa tu Contenido',
            description: 'Valida tus posts en blockchain y obtén mayor visibilidad. Solo 10 BEZ tokens.',
            image: 'https://picsum.photos/400/200?random=ad1',
            cta: 'Validar Ahora',
            link: '#',
            sponsored: 'BeZhas Premium',
            gradient: 'from-purple-500 to-pink-500'
        },
        {
            id: 2,
            title: '💎 Hazte VIP',
            description: 'Accede a funciones exclusivas, multiplicadores y recompensas premium.',
            image: 'https://picsum.photos/400/200?random=ad2',
            cta: 'Ver Planes',
            link: '/be-vip',
            sponsored: 'BeZhas VIP',
            gradient: 'from-yellow-500 to-orange-500'
        },
        {
            id: 3,
            title: '🎨 Crea y Vende NFTs',
            description: 'Convierte tu contenido en NFTs únicos y vende en nuestro marketplace.',
            image: 'https://picsum.photos/400/200?random=ad3',
            cta: 'Crear NFT',
            link: '/marketplace',
            sponsored: 'BeZhas Marketplace',
            gradient: 'from-blue-500 to-cyan-500'
        }
    ];

    // Usar el anuncio pasado por props o seleccionar uno del fallback
    const ad = propAd || fallbackAds[adIndex % fallbackAds.length];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Sponsored Label */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <Star size={14} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Patrocinado por {ad.sponsored}
                    </span>
                </div>
                <TrendingUp size={14} className="text-green-500" />
            </div>

            {/* Ad Content */}
            <div className="relative">
                {/* Background Image with Gradient Overlay */}
                <div className="relative h-48 overflow-hidden">
                    <img
                        src={ad.image}
                        alt={ad.title}
                        className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${ad.gradient} opacity-40`} />
                </div>

                {/* Text Content */}
                <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {ad.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        {ad.description}
                    </p>

                    {/* CTA Button */}
                    <a
                        href={ad.link}
                        className={`
                            inline-flex items-center justify-center gap-2 
                            w-full px-4 py-2.5 rounded-lg 
                            bg-gradient-to-r ${ad.gradient}
                            text-white font-semibold text-sm
                            hover:shadow-lg hover:scale-105
                            transition-all duration-200
                        `}
                    >
                        {ad.cta}
                        <ExternalLink size={16} />
                    </a>
                </div>
            </div>

            {/* Footer Info */}
            <div className="px-4 pb-3 text-xs text-gray-400 dark:text-gray-500">
                <p>
                    Anuncio • <a href="#" className="hover:underline">¿Por qué veo esto?</a>
                </p>
            </div>
        </div>
    );
};

export default AdCard;
