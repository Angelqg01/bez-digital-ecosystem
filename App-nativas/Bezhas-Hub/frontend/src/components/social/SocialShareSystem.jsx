import React, { useState } from 'react';
import {
    Share2,
    Facebook,
    Twitter,
    Linkedin,
    Mail,
    Copy,
    Check,
    MessageCircle,
    Send,
    X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
    FaWhatsapp,
    FaTelegram,
    FaReddit,
    FaPinterest,
    FaDiscord
} from 'react-icons/fa';

/**
 * Sistema Completo de Compartir en Redes Sociales
 * Soporta: Facebook, Twitter, LinkedIn, WhatsApp, Telegram, Email, Reddit, Pinterest, Discord
 */
export default function SocialShareSystem({
    url,
    title,
    description,
    hashtags = [],
    postId,
    onShare,
    className = ''
}) {
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shareComment, setShareComment] = useState('');

    // URL por defecto es la actual
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    const shareTitle = title || 'BeZhas - Web3 Social Platform';
    const shareDescription = description || 'Check out this amazing content on BeZhas!';
    const shareHashtags = hashtags.length > 0 ? hashtags.join(',') : 'BeZhas,Web3,Blockchain';

    const socialPlatforms = [
        {
            name: 'Twitter',
            icon: Twitter,
            color: 'bg-[#1DA1F2] hover:bg-[#1a8cd8]',
            action: () => shareOnTwitter()
        },
        {
            name: 'Facebook',
            icon: Facebook,
            color: 'bg-[#1877F2] hover:bg-[#166fe5]',
            action: () => shareOnFacebook()
        },
        {
            name: 'LinkedIn',
            icon: Linkedin,
            color: 'bg-[#0A66C2] hover:bg-[#095ba8]',
            action: () => shareOnLinkedIn()
        },
        {
            name: 'WhatsApp',
            icon: FaWhatsapp,
            color: 'bg-[#25D366] hover:bg-[#20bd5a]',
            action: () => shareOnWhatsApp()
        },
        {
            name: 'Telegram',
            icon: FaTelegram,
            color: 'bg-[#0088cc] hover:bg-[#0077b5]',
            action: () => shareOnTelegram()
        },
        {
            name: 'Reddit',
            icon: FaReddit,
            color: 'bg-[#FF4500] hover:bg-[#e03d00]',
            action: () => shareOnReddit()
        },
        {
            name: 'Email',
            icon: Mail,
            color: 'bg-gray-600 hover:bg-gray-700',
            action: () => shareViaEmail()
        },
        {
            name: 'Discord',
            icon: FaDiscord,
            color: 'bg-[#5865F2] hover:bg-[#4752c4]',
            action: () => shareOnDiscord()
        }
    ];

    const shareOnTwitter = () => {
        const text = `${shareTitle}\n${shareDescription}`;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}&hashtags=${encodeURIComponent(shareHashtags)}`;
        openShareWindow(twitterUrl, 'Twitter');
        trackShare('twitter');
    };

    const shareOnFacebook = () => {
        const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareTitle)}`;
        openShareWindow(facebookUrl, 'Facebook');
        trackShare('facebook');
    };

    const shareOnLinkedIn = () => {
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        openShareWindow(linkedinUrl, 'LinkedIn');
        trackShare('linkedin');
    };

    const shareOnWhatsApp = () => {
        const text = `*${shareTitle}*\n${shareDescription}\n${shareUrl}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        openShareWindow(whatsappUrl, 'WhatsApp');
        trackShare('whatsapp');
    };

    const shareOnTelegram = () => {
        const text = `${shareTitle}\n${shareDescription}`;
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;
        openShareWindow(telegramUrl, 'Telegram');
        trackShare('telegram');
    };

    const shareOnReddit = () => {
        const redditUrl = `https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`;
        openShareWindow(redditUrl, 'Reddit');
        trackShare('reddit');
    };

    const shareViaEmail = () => {
        const subject = shareTitle;
        const body = `${shareDescription}\n\nCheck it out: ${shareUrl}`;
        const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = emailUrl;
        trackShare('email');
    };

    const shareOnDiscord = () => {
        // Discord no tiene URL directa para compartir, copiamos al portapapeles
        copyToClipboard();
        toast.success('Link copiado! Pégalo en Discord');
        trackShare('discord');
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            toast.success('¡Link copiado al portapapeles!');
            setTimeout(() => setCopied(false), 2000);
            trackShare('copy');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            toast.error('Error al copiar el link');
        }
    };

    const openShareWindow = (url, platform) => {
        window.open(url, `share-${platform}`, 'width=600,height=400');
    };

    const trackShare = (platform) => {
        console.log(`Shared on ${platform}:`, { url: shareUrl, title: shareTitle });

        // Llamar callback si existe
        if (onShare) {
            onShare({
                platform,
                postId,
                url: shareUrl,
                timestamp: new Date().toISOString()
            });
        }

        // Cerrar modal después de compartir
        setTimeout(() => setShowModal(false), 500);
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: shareDescription,
                    url: shareUrl,
                });
                toast.success('¡Compartido exitosamente!');
                trackShare('native');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error('Error sharing:', error);
                }
            }
        } else {
            setShowModal(true);
        }
    };

    return (
        <>
            {/* Botón de Compartir */}
            <button
                onClick={handleNativeShare}
                className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all group ${className}`}
                title="Compartir"
            >
                <Share2 size={18} className="group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Compartir</span>
            </button>

            {/* Modal de Compartir */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Share2 size={24} />
                                Compartir Contenido
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Contenido */}
                        <div className="p-6 space-y-6">
                            {/* Preview del contenido */}
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                                <h4 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                                    {shareTitle}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                    {shareDescription}
                                </p>
                            </div>

                            {/* Comentario opcional */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Agregar un comentario (opcional)
                                </label>
                                <textarea
                                    value={shareComment}
                                    onChange={(e) => setShareComment(e.target.value)}
                                    placeholder="Escribe algo sobre este contenido..."
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white resize-none"
                                />
                            </div>

                            {/* Botones de Redes Sociales */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                                    Compartir en:
                                </h4>
                                <div className="grid grid-cols-4 gap-3">
                                    {socialPlatforms.map((platform) => {
                                        const Icon = platform.icon;
                                        return (
                                            <button
                                                key={platform.name}
                                                onClick={platform.action}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-xl ${platform.color} text-white transition-all hover:scale-105 hover:shadow-lg`}
                                                title={`Compartir en ${platform.name}`}
                                            >
                                                <Icon size={24} />
                                                <span className="text-xs font-medium">{platform.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Copiar Link */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    O copia el link:
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={shareUrl}
                                        readOnly
                                        className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-mono"
                                    />
                                    <button
                                        onClick={copyToClipboard}
                                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${copied
                                                ? 'bg-green-500 text-white'
                                                : 'bg-purple-500 hover:bg-purple-600 text-white'
                                            }`}
                                    >
                                        {copied ? (
                                            <>
                                                <Check size={18} />
                                            </>
                                        ) : (
                                            <>
                                                <Copy size={18} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * Componente compacto para compartir en línea
 */
export function CompactShareButtons({ url, title, onShare, showLabel = true }) {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    const shareTitle = title || 'BeZhas';

    const quickShare = [
        {
            name: 'Twitter',
            icon: Twitter,
            color: 'text-[#1DA1F2] hover:bg-blue-50 dark:hover:bg-blue-900/20',
            action: () => {
                window.open(
                    `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`,
                    'twitter',
                    'width=600,height=400'
                );
                onShare?.({ platform: 'twitter' });
            }
        },
        {
            name: 'Facebook',
            icon: Facebook,
            color: 'text-[#1877F2] hover:bg-blue-50 dark:hover:bg-blue-900/20',
            action: () => {
                window.open(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
                    'facebook',
                    'width=600,height=400'
                );
                onShare?.({ platform: 'facebook' });
            }
        },
        {
            name: 'WhatsApp',
            icon: FaWhatsapp,
            color: 'text-[#25D366] hover:bg-green-50 dark:hover:bg-green-900/20',
            action: () => {
                window.open(
                    `https://wa.me/?text=${encodeURIComponent(shareTitle + ' ' + shareUrl)}`,
                    'whatsapp',
                    'width=600,height=400'
                );
                onShare?.({ platform: 'whatsapp' });
            }
        }
    ];

    return (
        <div className="flex items-center gap-2">
            {showLabel && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Compartir:
                </span>
            )}
            {quickShare.map((platform) => {
                const Icon = platform.icon;
                return (
                    <button
                        key={platform.name}
                        onClick={platform.action}
                        className={`p-2 rounded-lg transition-all ${platform.color}`}
                        title={`Compartir en ${platform.name}`}
                    >
                        <Icon size={16} />
                    </button>
                );
            })}
        </div>
    );
}
