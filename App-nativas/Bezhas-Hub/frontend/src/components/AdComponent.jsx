// frontend/src/components/AdComponent.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const AdComponent = ({ context, creatorId = null }) => {
    const [ad, setAd] = useState(null);
    const [eventId, setEventId] = useState(null);
    const [adViewed, setAdViewed] = useState(false);
    const [claiming, setClaiming] = useState(false);

    // Mock user ID (en producción, obtener del contexto de autenticación)
    const currentUserId = '0x1234567890abcdef1234567890abcdef12345678';

    useEffect(() => {
        loadAd();
    }, [context]);

    async function loadAd() {
        try {
            // En producción, aquí se solicitaría un anuncio real de Google AdSense
            // Por ahora, usamos anuncios simulados
            const res = await axios.post(`${API_URL}/ads/request-ad`, { context });

            if (res.data.ad) {
                setAd(res.data.ad);
                setEventId(res.data.eventId || `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

                // Registrar impresión
                await axios.post(`${API_URL}/ads/verify-event`, {
                    eventId: res.data.eventId,
                    type: 'impression',
                    userId: currentUserId
                });
            }
        } catch (error) {
            console.error('Error loading ad:', error);
            // Fallback a anuncio demo
            setAd({
                image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="728" height="90"%3E%3Crect fill="%234F46E5" width="728" height="90"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="18" fill="white" text-anchor="middle" dy=".3em"%3EBeZhas Partner Ad%3C/text%3E%3C/svg%3E',
                link: 'https://bezhas.com',
                text: 'Anuncio de demostración - Click para ganar BEZ',
                type: 'adsense'
            });
            setEventId(`ad_demo_${Date.now()}`);
        }
    }

    async function handleAdClick() {
        if (claiming || adViewed) return;

        try {
            // 1. Registrar el clic
            await axios.post(`${API_URL}/ads/verify-event`, {
                eventId,
                type: 'click',
                userId: currentUserId
            });

            // 2. Reclamar recompensa por el clic (FIAT-FIRST)
            setClaiming(true);

            const contextStr = context || 'watch-to-earn';
            const isPostContext = contextStr.startsWith('post:');

            const claimRes = await axios.post(`${API_URL}/ad-rewards/claim`, {
                userId: currentUserId,
                adType: ad.type || 'adsense',
                eventType: 'click',
                context: contextStr,
                creatorId: isPostContext && creatorId ? creatorId : null,
                adEventId: eventId
            });

            if (claimRes.data.success) {
                const reward = claimRes.data.data.rewardClaimed;

                // Notificar al usuario
                let message = `¡Recompensa! +${reward.viewer.amountBez.toFixed(2)} BEZ`;

                if (reward.creator) {
                    message += ` (Creador: +${reward.creator.amountBez.toFixed(2)} BEZ)`;
                }

                toast.success(message, { duration: 5000 });
                setAdViewed(true);
            }

        } catch (error) {
            console.error('Error claiming ad reward:', error);
            toast.error('Error al procesar la recompensa. El clic fue registrado.');
        } finally {
            setClaiming(false);
        }

        // Abrir enlace del anuncio
        if (ad.link) {
            window.open(ad.link, '_blank', 'noopener,noreferrer');
        }
    }

    if (!ad) return null;

    return (
        <div className="ad-box my-4 relative">
            <div className="text-xs text-gray-500 mb-1">Publicidad</div>
            <div
                onClick={handleAdClick}
                className={`cursor-pointer border-2 border-gray-700 rounded-lg overflow-hidden hover:border-purple-500 transition-all ${claiming ? 'opacity-50' : ''}`}
            >
                <img
                    src={ad.image}
                    alt="Anuncio"
                    className="w-full h-auto"
                    loading="lazy"
                />
                {ad.text && (
                    <div className="p-2 bg-gray-800 text-sm text-white">
                        {ad.text}
                    </div>
                )}
            </div>

            {claiming && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                    <div className="text-white font-bold">Procesando recompensa...</div>
                </div>
            )}

            {adViewed && (
                <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                    ✓ Recompensa reclamada
                </div>
            )}
        </div>
    );
};

export default AdComponent;

