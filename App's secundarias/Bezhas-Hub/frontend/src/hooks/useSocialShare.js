import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';

/**
 * Hook personalizado para manejar compartir con tracking y rewards
 */
export function useSocialShare({ postId, userId, onRewardEarned }) {
    const [shareCount, setShareCount] = useState(0);
    const [isSharing, setIsSharing] = useState(false);
    const [shareHistory, setShareHistory] = useState([]);

    /**
     * Registrar acción de compartir en el backend
     */
    const trackShare = useCallback(async (shareData) => {
        try {
            const response = await axios.post('/api/social/share', {
                postId,
                userId,
                platform: shareData.platform,
                url: shareData.url,
                timestamp: shareData.timestamp || new Date().toISOString(),
                comment: shareData.comment || '',
            });

            // Actualizar contador local
            setShareCount(prev => prev + 1);

            // Agregar al historial
            setShareHistory(prev => [shareData, ...prev]);

            // Mostrar reward si lo hay
            if (response.data.reward) {
                toast.success(
                    `¡+${response.data.reward.tokens} BEZ por compartir!`,
                    { icon: '🎁', duration: 4000 }
                );

                if (onRewardEarned) {
                    onRewardEarned(response.data.reward);
                }
            }

            return response.data;
        } catch (error) {
            console.error('Error tracking share:', error);
            // No mostramos error al usuario para no interrumpir la experiencia
            return null;
        }
    }, [postId, userId, onRewardEarned]);

    /**
     * Obtener historial de compartidos
     */
    const loadShareHistory = useCallback(async () => {
        try {
            const response = await axios.get(`/api/social/share/${postId}`);
            setShareCount(response.data.total || 0);
            setShareHistory(response.data.shares || []);
        } catch (error) {
            console.error('Error loading share history:', error);
        }
    }, [postId]);

    /**
     * Compartir con tracking automático
     */
    const handleShare = useCallback(async (shareData) => {
        setIsSharing(true);
        try {
            await trackShare(shareData);
            return true;
        } catch (error) {
            return false;
        } finally {
            setIsSharing(false);
        }
    }, [trackShare]);

    /**
     * Obtener estadísticas de compartidos
     */
    const getShareStats = useCallback(() => {
        const platforms = shareHistory.reduce((acc, share) => {
            acc[share.platform] = (acc[share.platform] || 0) + 1;
            return acc;
        }, {});

        return {
            total: shareCount,
            platforms,
            mostUsed: Object.entries(platforms).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none',
            recent: shareHistory.slice(0, 5),
        };
    }, [shareCount, shareHistory]);

    return {
        shareCount,
        shareHistory,
        isSharing,
        trackShare,
        handleShare,
        loadShareHistory,
        getShareStats,
    };
}

/**
 * Función helper para generar URLs de compartir
 */
export const generateShareUrl = (platform, { url, title, description, hashtags }) => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const encodedDescription = encodeURIComponent(description);
    const encodedHashtags = hashtags ? encodeURIComponent(hashtags.join(',')) : '';

    const urls = {
        twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}&hashtags=${encodedHashtags}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
        telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
        reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
        pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
        email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
    };

    return urls[platform] || urls.twitter;
};

/**
 * Función para detectar si el navegador soporta Web Share API
 */
export const canUseNativeShare = () => {
    return typeof navigator !== 'undefined' && !!navigator.share;
};

/**
 * Función para compartir usando Web Share API nativa
 */
export const nativeShare = async ({ url, title, text }) => {
    if (!canUseNativeShare()) {
        throw new Error('Native share not supported');
    }

    try {
        await navigator.share({
            url,
            title,
            text,
        });
        return true;
    } catch (error) {
        if (error.name === 'AbortError') {
            // Usuario canceló, no es un error
            return false;
        }
        throw error;
    }
};
