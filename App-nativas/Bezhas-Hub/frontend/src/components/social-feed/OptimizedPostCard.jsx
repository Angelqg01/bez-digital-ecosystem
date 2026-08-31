import React, { useState, memo, lazy, Suspense } from 'react';
import { Heart, MessageCircle, Share2, ExternalLink } from 'lucide-react';

// Lazy load componentes pesados
const DonationButton = lazy(() => import('./DonationButton'));
const BlockchainValidationBadge = lazy(() => import('./BlockchainValidationBadge'));
const MediaGalleryModal = lazy(() => import('./MediaGalleryModal'));
const ShareModal = lazy(() => import('../modals/ShareModal'));
const CommentsSection = lazy(() => import('./CommentsSection'));

/**
 * PostCard Optimizado con Performance
 * - React.memo para prevenir re-renders innecesarios
 * - Lazy loading de componentes pesados
 * - Suspense boundaries para mejor UX
 * - Intersection Observer ready (para virtual scrolling)
 */
const OptimizedPostCard = memo(({ post, onLike, onComment, onDonate, onValidate }) => {
    const [showComments, setShowComments] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const CHAR_LIMIT = 350;
    const shouldTruncate = post.content && post.content.length > CHAR_LIMIT;

    const handleLike = () => {
        setIsLiked(!isLiked);
        onLike?.(post.id);
    };

    const handleComment = () => {
        setShowComments(!showComments);
    };

    const handleShare = () => {
        setShowShareModal(true);
    };

    const displayContent = shouldTruncate && !isExpanded
        ? post.content.substring(0, CHAR_LIMIT) + '...'
        : post.content;

    // Renderizado condicional de badges
    const renderBadges = () => (
        <div className="flex items-center gap-2 mb-3">
            {post.isNews && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-sm">
                    📰 {post.newsSource || 'News'}
                </span>
            )}
            {post.sentiment && post.sentiment !== 'neutral' && (
                <span className={`px-2 py-1 rounded-full text-xs ${post.sentiment === 'bullish' ? 'bg-green-100 text-green-700' :
                        post.sentiment === 'bearish' ? 'bg-red-100 text-red-700' :
                            post.sentiment === 'positive' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                    }`}>
                    {post.sentiment === 'bullish' ? '📈' : post.sentiment === 'bearish' ? '📉' : '✨'} {post.sentiment}
                </span>
            )}
            {post.autoTagged && (
                <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700">
                    🤖 Auto-tagged
                </span>
            )}
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow p-4 mb-4">
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <img
                    src={post.author?.avatar || '/default-avatar.png'}
                    alt={post.author?.name}
                    className="w-10 h-10 rounded-full object-cover"
                    loading="lazy"
                />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm truncate">{post.author?.name}</h4>
                        {post.author?.verified && (
                            <span className="text-blue-500" title="Verified">✓</span>
                        )}
                        {post.author?.isVIP && (
                            <span className="text-yellow-500" title="VIP">⭐</span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">
                        @{post.author?.username} · {new Date(post.timestamp).toLocaleDateString()}
                    </p>
                </div>
            </div>

            {/* Badges */}
            {renderBadges()}

            {/* Content */}
            <div className="mb-3">
                <p className="text-sm whitespace-pre-wrap break-words">{displayContent}</p>
                {shouldTruncate && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-blue-500 text-xs mt-1 hover:underline"
                    >
                        {isExpanded ? 'Ver menos' : 'Ver más'}
                    </button>
                )}
            </div>

            {/* Hashtags */}
            {post.hashtags && post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {post.hashtags.map((tag, idx) => (
                        <span key={idx} className="text-blue-500 text-xs hover:underline cursor-pointer">
                            {tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Media Preview */}
            {post.media && post.media.length > 0 && (
                <div className="mb-3 rounded-lg overflow-hidden">
                    <img
                        src={post.media[0].url}
                        alt="Post media"
                        className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        loading="lazy"
                    />
                </div>
            )}

            {/* External Link Button (for news) */}
            {post.isNews && post.externalLink && (
                <a
                    href={post.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 mb-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                >
                    🔗 Leer noticia completa
                    <ExternalLink size={14} />
                </a>
            )}

            {/* Stats */}
            <div className="flex items-center justify-between text-xs text-gray-500 mb-3 pb-3 border-b border-gray-100 dark:border-gray-700">
                <span>{post.stats?.likes || 0} likes</span>
                <span>{post.stats?.comments || 0} comentarios</span>
                <span>{post.stats?.shares || 0} compartidos</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleLike}
                    className={`flex items-center gap-2 text-sm ${isLiked ? 'text-red-500' : 'text-gray-600'
                        } hover:text-red-500 transition-colors`}
                >
                    <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} />
                    <span>Me gusta</span>
                </button>

                <button
                    onClick={handleComment}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-500 transition-colors"
                >
                    <MessageCircle size={18} />
                    <span>Comentar</span>
                </button>

                <button
                    onClick={handleShare}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-500 transition-colors"
                >
                    <Share2 size={18} />
                    <span>Compartir</span>
                </button>
            </div>

            {/* Comments Section (Lazy Loaded) */}
            {showComments && (
                <Suspense fallback={<div className="mt-4 text-center text-sm text-gray-500">Cargando comentarios...</div>}>
                    <CommentsSection postId={post.id} />
                </Suspense>
            )}

            {/* Share Modal (Lazy Loaded) */}
            {showShareModal && (
                <Suspense fallback={null}>
                    <ShareModal
                        isOpen={showShareModal}
                        onClose={() => setShowShareModal(false)}
                        post={post}
                    />
                </Suspense>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function para memo
    // Solo re-render si cambian datos relevantes
    return (
        prevProps.post.id === nextProps.post.id &&
        prevProps.post.stats?.likes === nextProps.post.stats?.likes &&
        prevProps.post.stats?.comments === nextProps.post.stats?.comments &&
        prevProps.post.content === nextProps.post.content
    );
});

OptimizedPostCard.displayName = 'OptimizedPostCard';

export default OptimizedPostCard;
