import React, { useState } from 'react';
import { Play, Heart, MessageCircle, Share2, ChevronLeft, ChevronRight, Coins } from 'lucide-react';
import DonationButton from './DonationButton';
import ShareModal from '../modals/ShareModal';
import CommentsSection from './CommentsSection';

/**
 * BeHistoryCard - Componente para mostrar contenido vertical (estilo TikTok/Reels)
 * Se integra en el feed principal de forma intercalada
 */
const BeHistoryCard = ({ histories = [], onDonate }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [earnedAmount, setEarnedAmount] = useState(0);

    console.log('📜 BeHistoryCard recibió:', {
        historiesCount: histories?.length,
        histories: histories
    });

    if (!histories || histories.length === 0) {
        console.warn('⚠️ BeHistoryCard: No hay historias para mostrar');
        return null;
    }

    const currentHistory = histories[currentIndex];

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev === 0 ? histories.length - 1 : prev - 1));
        setIsPlaying(false);
        setShowComments(false);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev === histories.length - 1 ? 0 : prev + 1));
        setIsPlaying(false);
        setShowComments(false);
    };

    const handlePlay = () => {
        setIsPlaying(true);
        // Aquí se puede agregar lógica para abrir en modal fullscreen
        window.location.href = '/social'; // Redirige a la página BeHistory completa
    };

    // Lógica de compartir
    const handleShare = async (e) => {
        e.stopPropagation();

        const historyUrl = `${window.location.origin}/social/history/${currentHistory.id}`;
        const shareData = {
            title: `Mira esta historia de ${currentHistory.author?.name || 'BeZhas'}`,
            text: currentHistory.caption || 'Mira esta historia en BeZhas',
            url: historyUrl,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('Error al compartir nativamente:', err);
                    setIsShareModalOpen(true);
                }
            }
        } else {
            setIsShareModalOpen(true);
        }
    };

    // Función para manejar la ganancia por anuncios
    const handleAdRevenue = (amountInDollars) => {
        const tokenPrice = 0.50;
        const tokensEarned = (parseFloat(amountInDollars) / tokenPrice).toFixed(4);

        setEarnedAmount(amountInDollars);
        setTimeout(() => setEarnedAmount(0), 3000);

        console.log(`💰 Revenue: $${amountInDollars} | Tokens: ${tokensEarned} BZH enviados a ${currentHistory.author?.username}`);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700 relative">
            {/* Notificación Flotante de Ganancia */}
            {earnedAmount > 0 && (
                <div className="absolute top-4 right-4 z-50 animate-bounce">
                    <div className="bg-yellow-400 text-black font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border-2 border-yellow-200">
                        <Coins size={20} />
                        <span>+${earnedAmount} USD</span>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        📱 BeHistory - Contenido Vertical
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{currentIndex + 1}</span>
                        <span>/</span>
                        <span>{histories.length}</span>
                    </div>
                </div>
            </div>

            {/* Contenedor de video/imagen 9:16 (responsive) */}
            <div className="relative bg-black">
                {/* Aspect ratio 9:16 */}
                <div className="relative" style={{ paddingBottom: '177.78%', maxHeight: '600px' }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                        {currentHistory.type === 'video' ? (
                            <div className="relative w-full h-full">
                                <img
                                    src={currentHistory.thumbnail || currentHistory.content}
                                    alt={currentHistory.caption}
                                    className="w-full h-full object-cover"
                                />
                                {/* Play button overlay */}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <button
                                        onClick={handlePlay}
                                        className="w-20 h-20 bg-white/90 hover:bg-white rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-2xl"
                                    >
                                        <Play size={36} className="text-gray-900 ml-1" fill="currentColor" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <img
                                src={currentHistory.content}
                                alt={currentHistory.caption}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={handlePlay}
                            />
                        )}
                    </div>
                </div>

                {/* Navegación izquierda/derecha */}
                {histories.length > 1 && (
                    <>
                        <button
                            onClick={handlePrev}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <button
                            onClick={handleNext}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-all backdrop-blur-sm"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </>
                )}

                {/* Información del autor (overlay bottom) */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <img
                            src={currentHistory.author?.avatar}
                            alt={currentHistory.author?.name}
                            className="w-10 h-10 rounded-full border-2 border-white"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <p className="font-semibold text-white">{currentHistory.author?.name}</p>
                                {currentHistory.author?.verified && (
                                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                        <span className="text-white text-xs">✓</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-gray-300">{currentHistory.timestamp}</p>
                        </div>
                    </div>
                    <p className="text-sm text-white line-clamp-2">{currentHistory.caption}</p>
                </div>
            </div>

            {/* Footer con estadísticas */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center justify-around mb-3">
                    <button className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                        <Heart size={20} />
                        <span className="text-sm font-medium">{currentHistory.likes}</span>
                    </button>
                    <button
                        onClick={() => setShowComments(!showComments)}
                        className={`flex items-center gap-2 transition-colors ${showComments
                            ? 'text-blue-500 dark:text-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
                            }`}
                    >
                        <MessageCircle size={20} />
                        <span className="text-sm font-medium">{currentHistory.comments}</span>
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors"
                    >
                        <Share2 size={20} />
                        <span className="text-sm font-medium">{currentHistory.shares}</span>
                    </button>
                </div>

                {/* Botón de donación */}
                <div className="mb-3">
                    <DonationButton
                        author={currentHistory.author}
                        contentId={currentHistory.id}
                        contentType="behistory"
                        onDonationComplete={onDonate}
                        variant="default"
                    />
                </div>

                {/* Botón para ver más */}
                <button
                    onClick={handlePlay}
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
                >
                    Ver en Pantalla Completa
                </button>
            </div>

            {/* Indicadores de puntos (para navegación) */}
            {histories.length > 1 && (
                <div className="flex justify-center gap-1.5 py-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                    {histories.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`h-1.5 rounded-full transition-all ${index === currentIndex
                                ? 'w-8 bg-purple-600'
                                : 'w-1.5 bg-gray-300 dark:bg-gray-600'
                                }`}
                        />
                    ))}
                </div>
            )}

            {/* Sección de Comentarios Expandible */}
            {showComments && (
                <CommentsSection
                    postId={currentHistory.id}
                    authorName="Usuario"
                    onRevenueGenerated={handleAdRevenue}
                />
            )}

            {/* Modal de Compartir */}
            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                url={`${window.location.origin}/social/history/${currentHistory.id}`}
                title={`Historia de ${currentHistory.author?.name || 'Usuario'}`}
            />
        </div>
    );
};

export default BeHistoryCard;
