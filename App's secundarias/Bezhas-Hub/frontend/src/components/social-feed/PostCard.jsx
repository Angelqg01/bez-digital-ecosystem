import React, { useState } from 'react';
import {
    Heart,
    MessageCircle,
    Share2,
    MoreHorizontal,
    CheckCircle,
    Shield,
    Coins,
    Smile
} from 'lucide-react';
import DonationButton from './DonationButton';
import BlockchainValidationBadge from './BlockchainValidationBadge';
import MediaGalleryModal from './MediaGalleryModal';
import ShareModal from '../modals/ShareModal';
import CommentsSection from './CommentsSection';

// Función utilitaria para formatear timestamps
const formatTimestamp = (timestamp) => {
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 60) return `Hace ${minutes}m`;
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days}d`;

        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    } catch (e) {
        return timestamp;
    }
};

/**
 * PostCard Component - Versión Compacta con Galería Modal
 * Posts 80% más pequeños, imágenes apiladas en preview
 * Click en imagen/video abre galería en pantalla completa
 * Soporte completo para posts de noticias
 * 
 * @param {Object} post - Datos del post
 * @param {Function} onLike - Callback para dar like
 * @param {Function} onComment - Callback para comentar
 * @param {Function} onDonate - Callback para donaciones
 * @param {Function} onValidate - Callback para validación blockchain
 */
const PostCard = ({ post, onLike, onComment, onDonate, onValidate }) => {
    const [showReactions, setShowReactions] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [selectedReaction, setSelectedReaction] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [showGallery, setShowGallery] = useState(false);
    const [galleryStartIndex, setGalleryStartIndex] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [earnedAmount, setEarnedAmount] = useState(0);

    // Normalizar datos del post (compatibilidad con diferentes estructuras)
    const likes = post.stats?.likes || post.likes || 0;
    const comments = post.stats?.comments || post.comments || 0;
    const shares = post.stats?.shares || post.shares || 0;
    const views = post.stats?.views || post.views || 0;

    // Constante para el límite de caracteres
    const CHAR_LIMIT = 350;
    const shouldTruncate = post.content && post.content.length > CHAR_LIMIT;

    // Función para manejar la ganancia por anuncios
    const handleAdRevenue = (amountInDollars) => {
        // 1. Calcular tokens basados en precio actual (Mock: 1 Token = $0.50)
        const tokenPrice = 0.50;
        const tokensEarned = (parseFloat(amountInDollars) / tokenPrice).toFixed(4);

        // 2. Mostrar notificación visual
        setEarnedAmount(amountInDollars);
        setTimeout(() => setEarnedAmount(0), 3000);

        // 3. Aquí llamarías a tu backend/smart contract
        console.log(`💰 Revenue: $${amountInDollars} | Tokens: ${tokensEarned} BZH enviados a ${post.author.username}`);
    };

    const toggleComments = () => {
        setShowComments(!showComments);
        if (onComment) onComment(post.id);
    };

    // Lógica de compartir
    const handleShare = async (e) => {
        e.stopPropagation(); // Evitar abrir el post si se hace clic en compartir

        // Construir la URL del post
        const postUrl = `${window.location.origin}/social/post/${post.id}`;
        const shareData = {
            title: `Mira este post de ${post.author?.name || 'BeZhas'}`,
            text: post.content,
            url: postUrl,
        };

        // Intentar usar la API nativa del dispositivo (Móvil: WhatsApp, Signal, etc.)
        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Error al compartir nativamente:', err);
                    setIsShareModalOpen(true); // Fallback al modal si falla algo que no sea cancelar
                }
            }
        } else {
            // Si no hay API nativa (Escritorio), abrir modal
            setIsShareModalOpen(true);
        }
    };

    // Reacciones disponibles (emojis)
    const reactions = [
        { emoji: '❤️', name: 'Love' },
        { emoji: '😂', name: 'Haha' },
        { emoji: '😮', name: 'Wow' },
        { emoji: '😢', name: 'Sad' },
        { emoji: '😡', name: 'Angry' },
        { emoji: '👍', name: 'Like' }
    ];

    // Emojis adicionales para el picker completo
    const quickReactions = ['❤️', '😂', '😮', '😢', '👏', '🔥', '🎉', '💯'];

    const emojiCategories = {
        'Caras': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔'],
        'Emociones': ['😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬'],
        'Gestos': ['👋', '🤚', '🖐️', '✋', '👌', '🤌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '👏', '🙌', '👐', '🤲', '🙏'],
        'Símbolos': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '⭐', '🌟', '✨', '⚡', '💥', '🔥'],
        'Objetos': ['🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '💯', '🔔', '🎵', '🎶', '💰', '💎', '👑', '🌈', '☀️', '🌙', '⭐']
    };

    const handleReaction = (reaction) => {
        setSelectedReaction(reaction);
        setShowReactions(false);
        setShowEmojiPicker(false);
        onLike && onLike(post.id, reaction);
    };

    const handleMediaClick = (index) => {
        setGalleryStartIndex(index);
        setShowGallery(true);
    };

    return (
        <>
            {/* Notificación Flotante de Ganancia */}
            {earnedAmount > 0 && (
                <div className="fixed bottom-20 right-4 z-50 animate-bounce">
                    <div className="bg-yellow-400 text-black font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border-2 border-yellow-200">
                        <Coins size={20} />
                        <span>+${earnedAmount} USD (en Token)</span>
                    </div>
                </div>
            )}

            {/* Post Card - Diseño compacto 80% más pequeño */}
            <div
                id={`post-${post.id}`}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden border ${post.isPinned || post.isOfficial
                    ? 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/20'
                    : 'border-gray-100 dark:border-gray-700'
                    }`}>
                {/* Badge de Post Oficial - NUEVO */}
                {(post.isPinned || post.isOfficial) && (
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-2">
                        <Shield size={14} className="text-white" />
                        <span>📌 POST OFICIAL - INFORMACIÓN IMPORTANTE</span>
                        {post.blockchainValidated && (
                            <span className="ml-auto flex items-center gap-1">
                                <CheckCircle size={12} />
                                Validado Blockchain
                            </span>
                        )}
                    </div>
                )}

                {/* Badge de News Post */}
                {post.isNews && (
                    <div className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-3 py-1.5 text-xs font-semibold flex items-center gap-2">
                        <span>📰 NEWS</span>
                        {post.newsSource && (
                            <span className="ml-2 opacity-90">| {post.newsSource}</span>
                        )}
                        <CheckCircle size={12} className="ml-auto" />
                    </div>
                )}

                {/* Header del Post - Compacto */}
                <div className="p-3">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                            {/* Avatar más pequeño */}
                            <div className="relative">
                                <img
                                    src={post.author.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.author.username}`}
                                    alt={post.author.username}
                                    className="w-8 h-8 rounded-full object-cover ring-1 ring-purple-500/20"
                                />
                                {post.author.verified && (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center border border-white dark:border-gray-800">
                                        <CheckCircle size={8} className="text-white" />
                                    </div>
                                )}
                            </div>

                            {/* Nombre y Timestamp compactos */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                        {post.author.username}
                                    </h3>
                                    {post.author.isVIP && (
                                        <span className="px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold rounded">
                                            VIP
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatTimestamp(post.timestamp)}
                                </p>
                            </div>
                        </div>

                        {/* Menú de Opciones compacto */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                                aria-label="More options"
                            >
                                <MoreHorizontal size={16} className="text-gray-500" />
                            </button>

                            {/* Dropdown Menu */}
                            {showMenu && (
                                <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 z-10 text-xs">
                                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-t-lg">
                                        Guardar post
                                    </button>
                                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700">
                                        Ocultar post
                                    </button>
                                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700">
                                        Reportar
                                    </button>
                                    <button className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-lg border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-purple-600 dark:text-purple-400">
                                        <Shield size={14} />
                                        Validar en Blockchain
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contenido del Post - Con funcionalidad expandir/contraer */}
                    <div className="mb-2">
                        <p className="text-gray-800 dark:text-gray-200 text-sm leading-snug whitespace-pre-wrap">
                            {shouldTruncate && !isExpanded
                                ? post.content.substring(0, CHAR_LIMIT) + '...'
                                : post.content
                            }
                        </p>

                        {/* Botón "Leer más" */}
                        {shouldTruncate && !isExpanded && (
                            <button
                                onClick={() => setIsExpanded(true)}
                                className="mt-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold text-sm flex items-center gap-1 transition-colors"
                            >
                                Leer más
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        )}

                        {/* Botón "Contraer post" */}
                        {shouldTruncate && isExpanded && (
                            <button
                                onClick={() => {
                                    setIsExpanded(false);
                                    // Scroll suave hacia el post
                                    document.getElementById(`post-${post.id}`)?.scrollIntoView({
                                        behavior: 'smooth',
                                        block: 'start'
                                    });
                                }}
                                className="mt-3 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold text-sm flex items-center gap-1 transition-colors"
                            >
                                Contraer post
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                        )}

                        {/* Hashtags compactos */}
                        {post.hashtags && post.hashtags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {post.hashtags.map((tag, idx) => (
                                    <span
                                        key={idx}
                                        className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 cursor-pointer font-medium"
                                    >
                                        {tag.startsWith('#') ? tag : `#${tag}`}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* External Link para News */}
                        {post.externalLink && post.isNews && (
                            <a
                                href={post.externalLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-3 inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 hover:from-cyan-500/20 hover:to-blue-500/20 border border-cyan-500/30 rounded-lg text-xs text-cyan-600 dark:text-cyan-400 font-semibold transition-all group"
                            >
                                <span>🔗 Leer noticia completa</span>
                                <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}
                    </div>

                    {/* Media Gallery - Imágenes apiladas compactas con click para expandir */}
                    {post.media && post.media.length > 0 && (
                        <div className="relative px-3 pb-2">
                            {/* Vista previa de la primera imagen/video */}
                            <div
                                className="relative w-full cursor-pointer group"
                                onClick={() => handleMediaClick(0)}
                            >
                                {post.media[0].type === 'video' ? (
                                    <div className="relative w-full bg-gray-900 rounded-xl overflow-hidden">
                                        <video
                                            src={post.media[0].url}
                                            className="w-full h-auto max-h-[500px] object-contain"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                        {/* Overlay de play */}
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                            <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                                                <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-gray-800 border-b-[8px] border-b-transparent ml-1"></div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <img
                                        src={post.media[0].url}
                                        alt="Post media"
                                        className="w-full h-auto max-h-[500px] object-cover rounded-xl group-hover:brightness-95 transition-all"
                                    />
                                )}

                                {/* Indicador de múltiples medios */}
                                {post.media.length > 1 && (
                                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        <span>📷</span>
                                        <span>{post.media.length}</span>
                                    </div>
                                )}

                                {/* Overlay hover */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <span className="text-white text-xs bg-black/50 px-3 py-1 rounded-full">
                                        Ver {post.media.length > 1 ? 'galería' : 'imagen'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Estadísticas y botones - Todo compacto */}
                    <div className="px-3 py-2">
                        {/* Reacciones Preview compactas */}
                        {post.reactions && post.reactions.total > 0 && (
                            <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                                <div className="flex -space-x-1">
                                    {post.reactions.types?.slice(0, 3).map((reaction, index) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center justify-center w-4 h-4 bg-white dark:bg-gray-800 rounded-full border border-white dark:border-gray-800 text-[10px]"
                                        >
                                            {reaction.emoji}
                                        </span>
                                    ))}
                                </div>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {post.reactions.total}
                                </span>
                            </div>
                        )}

                        {/* Botones de Interacción compactos */}
                        <div className="flex items-center justify-between gap-2 mb-2 relative">
                            {/* Like Button con Reacciones */}
                            <div className="relative flex-1">
                                <button
                                    onClick={() => {
                                        if (selectedReaction) {
                                            // Si ya hay reacción, cambiarla abriendo el popup
                                            setShowReactions(!showReactions);
                                        } else {
                                            // Si no hay reacción, dar like directo
                                            handleReaction(reactions[0]);
                                        }
                                    }}
                                    onMouseEnter={() => !showEmojiPicker && setShowReactions(true)}
                                    className={`
                                    flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
                                    transition-all duration-200 w-full text-xs
                                    ${selectedReaction
                                            ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                                        }
                                `}
                                >
                                    {selectedReaction ? (
                                        <span className="text-sm">{selectedReaction.emoji}</span>
                                    ) : (
                                        <Heart size={16} />
                                    )}
                                    <span className="font-medium hidden sm:inline">
                                        {selectedReaction ? selectedReaction.name : 'Me gusta'}
                                    </span>
                                    {likes > 0 && <span>{likes}</span>}
                                </button>

                                {/* Reactions Popup - Mantiene abierto con hover */}
                                {showReactions && (
                                    <div
                                        className="absolute bottom-full left-0 mb-1 flex bg-white dark:bg-gray-800 rounded-full shadow-xl border border-gray-200 dark:border-gray-700 px-3 py-2 gap-2 z-20"
                                        onMouseEnter={() => setShowReactions(true)}
                                        onMouseLeave={() => setShowReactions(false)}
                                    >
                                        {reactions.map((reaction, index) => (
                                            <button
                                                key={index}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleReaction(reaction);
                                                }}
                                                className="hover:scale-125 transition-transform duration-200 text-xl hover:-translate-y-1"
                                                title={reaction.name}
                                            >
                                                {reaction.emoji}
                                            </button>
                                        ))}
                                        {/* Botón para más emojis */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowEmojiPicker(!showEmojiPicker);
                                                setShowReactions(false);
                                            }}
                                            className="hover:scale-125 transition-transform duration-200 text-xl hover:-translate-y-1 text-gray-500"
                                            title="Más reacciones"
                                        >
                                            <Smile size={20} />
                                        </button>
                                    </div>
                                )}

                                {/* Emoji Picker Completo */}
                                {showEmojiPicker && (
                                    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 z-30 w-80 max-h-96 overflow-y-auto">
                                        {/* Botón cerrar */}
                                        <div className="flex items-center justify-between mb-3 sticky top-0 bg-white dark:bg-gray-800 pb-2">
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Reaccionar</h3>
                                            <button
                                                onClick={() => setShowEmojiPicker(false)}
                                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                            >
                                                ✕
                                            </button>
                                        </div>

                                        {/* Reacciones Rápidas */}
                                        <div className="mb-4">
                                            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">Rápidas</h4>
                                            <div className="flex gap-2 flex-wrap">
                                                {quickReactions.map((emoji, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleReaction({ emoji, name: 'Reacción' })}
                                                        className="text-2xl hover:scale-125 transition-transform duration-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg w-10 h-10 flex items-center justify-center"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Categorías de Emojis */}
                                        {Object.entries(emojiCategories).map(([category, emojis]) => (
                                            <div key={category} className="mb-4">
                                                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase">{category}</h4>
                                                <div className="grid grid-cols-8 gap-1">
                                                    {emojis.map((emoji, idx) => (
                                                        <button
                                                            key={`${category}-${idx}`}
                                                            onClick={() => handleReaction({ emoji, name: category })}
                                                            className="text-xl hover:scale-125 transition-transform duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-1"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Comment Button compacto */}
                            <button
                                onClick={toggleComments}
                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md transition-all duration-200 flex-1 text-xs ${showComments
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                                    }`}
                            >
                                <MessageCircle size={16} />
                                <span className="font-medium hidden sm:inline">Comentar</span>
                                {comments > 0 && <span>{comments}</span>}
                            </button>

                            {/* Share Button compacto */}
                            <button
                                onClick={handleShare}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-200 flex-1 text-gray-600 dark:text-gray-400 text-xs"
                            >
                                <Share2 size={16} />
                                <span className="font-medium hidden sm:inline">Compartir</span>
                                {shares > 0 && <span>{shares}</span>}
                            </button>
                        </div>

                        {/* Acciones adicionales compactas */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <DonationButton
                                author={post.author}
                                contentId={post.id}
                                contentType="post"
                                onDonationComplete={onDonate}
                                variant="compact"
                            />

                            <BlockchainValidationBadge
                                post={post}
                                onValidate={onValidate}
                                variant={post.blockchainValidated ? 'badge' : 'button'}
                            />
                        </div>
                    </div>

                    {/* Sección de Comentarios Expandible */}
                    {showComments && (
                        <CommentsSection
                            postId={post.id}
                            authorName="Usuario" // Debería venir del contexto de autenticación
                            onRevenueGenerated={handleAdRevenue}
                        />
                    )}
                </div>
            </div>

            {/* Modal de Galería - Se abre al hacer click en imagen/video */}
            {showGallery && (
                <MediaGalleryModal
                    media={post.media}
                    initialIndex={galleryStartIndex}
                    onClose={() => setShowGallery(false)}
                />
            )}

            {/* Modal de Compartir */}
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                url={`${window.location.origin}/social/post/${post.id}`}
                title={`Post de ${post.author?.name || 'Usuario'}`}
            />
        </>
    );
};

export default PostCard;
