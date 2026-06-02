import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, ChevronLeft, ChevronRight, Coins, Plus, X, Upload, Link as LinkIcon, Play } from 'lucide-react';
import CreateHistoryModal from './CreateHistoryModal';
import BezCoinExchange from './BezCoinExchange';

// Mock data para las historias
const mockHistories = [
    {
        id: 1,
        type: 'video',
        content: 'https://example.com/video1.mp4',
        thumbnail: 'https://picsum.photos/360/640?random=1',
        author: {
            name: 'María González',
            avatar: 'https://i.pravatar.cc/150?img=1',
            verified: true
        },
        caption: '🚀 Mi primer NFT en BeZhas! #Web3 #NFT',
        likes: 1234,
        comments: 89,
        shares: 45,
        timestamp: '2h'
    },
    {
        id: 2,
        type: 'image',
        content: 'https://picsum.photos/360/640?random=2',
        author: {
            name: 'Carlos Ruiz',
            avatar: 'https://i.pravatar.cc/150?img=2',
            verified: false
        },
        caption: '✨ Nueva colección de arte digital disponible',
        likes: 856,
        comments: 34,
        shares: 12,
        timestamp: '5h'
    },
    {
        id: 3,
        type: 'nft',
        content: 'https://picsum.photos/360/640?random=3',
        nftData: {
            name: 'Cosmic Dreams #042',
            price: '2.5 BEZ',
            collection: 'Cosmic Collection'
        },
        author: {
            name: 'Ana Martínez',
            avatar: 'https://i.pravatar.cc/150?img=3',
            verified: true
        },
        caption: '🎨 NFT exclusivo - Edición limitada',
        likes: 2341,
        comments: 156,
        shares: 89,
        timestamp: '1d'
    },
    {
        id: 4,
        type: 'article',
        content: 'https://picsum.photos/360/640?random=4',
        articleData: {
            title: 'El Futuro de Web3',
            excerpt: 'Descubre cómo la tecnología blockchain está revolucionando...'
        },
        author: {
            name: 'Tech Magazine',
            avatar: 'https://i.pravatar.cc/150?img=4',
            verified: true
        },
        caption: '📰 Artículo destacado sobre Web3',
        likes: 567,
        comments: 78,
        shares: 123,
        timestamp: '3h'
    },
    {
        id: 5,
        type: 'post',
        content: 'https://picsum.photos/360/640?random=5',
        author: {
            name: 'Pedro Silva',
            avatar: 'https://i.pravatar.cc/150?img=5',
            verified: false
        },
        caption: '🌟 Compartiendo mi experiencia en BeZhas',
        likes: 432,
        comments: 23,
        shares: 8,
        timestamp: '6h'
    }
];

const HistoryItem = ({ history, isActive }) => {
    const [liked, setLiked] = useState(false);
    const [saved, setSaved] = useState(false);
    const [showDonation, setShowDonation] = useState(false);
    const [showExchange, setShowExchange] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current) {
            if (isActive) {
                videoRef.current.play();
            } else {
                videoRef.current.pause();
            }
        }
    }, [isActive]);

    const handleDonate = () => {
        setShowExchange(true);
    };

    return (
        <div className="behistory-item">
            {/* Contenedor de video 9:16 */}
            <div className="video-container-9-16">
                {history.type === 'video' ? (
                    <video
                        ref={videoRef}
                        src={history.content}
                        className="behistory-video"
                        loop
                        muted
                        playsInline
                        poster={history.thumbnail}
                    />
                ) : (
                    <img
                        src={history.content}
                        alt={history.caption}
                        className="behistory-image"
                    />
                )}

                {/* Gradiente overlay */}
                <div className="behistory-gradient"></div>
            </div>

            {/* Botón de Donación (Solo logo redondeado) */}
            <div className="behistory-donation-container">
                <button
                    onClick={handleDonate}
                    className="behistory-donation-btn-round"
                    aria-label="Donar BEZ Coins"
                    title="Donar BEZ Coins"
                >
                    <Coins size={20} className="donation-icon" />
                </button>
            </div>

            {/* Notificación de donación */}
            {showDonation && (
                <div className="behistory-donation-notification">
                    <div className="donation-notification-content">
                        <Coins size={32} className="text-yellow-400" />
                        <div>
                            <p className="font-bold text-lg">¡Gracias por donar!</p>
                            <p className="text-sm text-gray-300">Apoyas a {history.author.name}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Reacciones Laterales (Borde Izquierdo) */}
            <div className="behistory-reactions-container">
                <div className="behistory-reactions">
                    {/* Like */}
                    <button
                        onClick={() => setLiked(!liked)}
                        className="reaction-btn"
                        aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}
                    >
                        <Heart
                            size={32}
                            className={`${liked ? 'reaction-liked' : 'reaction-icon'}`}
                        />
                        <span className="reaction-count">
                            {liked ? history.likes + 1 : history.likes}
                        </span>
                    </button>

                    {/* Comment */}
                    <button className="reaction-btn" aria-label="Comentar">
                        <MessageCircle size={32} className="reaction-icon" />
                        <span className="reaction-count">{history.comments}</span>
                    </button>

                    {/* Share */}
                    <button className="reaction-btn" aria-label="Compartir">
                        <Share2 size={32} className="reaction-icon" />
                        <span className="reaction-count">{history.shares}</span>
                    </button>

                    {/* Save */}
                    <button
                        onClick={() => setSaved(!saved)}
                        className="reaction-btn"
                        aria-label={saved ? 'Quitar guardado' : 'Guardar'}
                    >
                        <Bookmark
                            size={32}
                            className={`${saved ? 'reaction-saved' : 'reaction-icon'}`}
                        />
                    </button>

                    {/* More */}
                    <button className="reaction-btn" aria-label="Más opciones">
                        <MoreHorizontal size={32} className="reaction-icon" />
                    </button>
                </div>
            </div>

            {/* Información inferior */}
            <div className="behistory-info">
                {/* Badge de tipo de contenido */}
                <div className="behistory-badge-container">
                    <span className="behistory-badge">
                        {history.type === 'nft' ? '🎨 NFT' :
                            history.type === 'video' ? '🎥 Video' :
                                history.type === 'article' ? '📰 Artículo' :
                                    history.type === 'image' ? '🖼️ Imagen' : '📝 Post'}
                    </span>
                </div>

                {/* Author info */}
                <div className="behistory-author">
                    <img
                        src={history.author.avatar}
                        alt={history.author.name}
                        className="behistory-avatar"
                    />
                    <div className="behistory-author-info">
                        <div className="behistory-author-name">
                            <span className="author-name">
                                {history.author.name}
                            </span>
                            {history.author.verified && (
                                <span className="verified-badge">✓</span>
                            )}
                            <span className="timestamp">{history.timestamp}</span>
                        </div>
                        <button className="follow-btn">
                            Seguir
                        </button>
                    </div>
                </div>

                {/* Caption */}
                <p className="behistory-caption">
                    {history.caption}
                </p>

                {/* NFT/Article specific info */}
                {history.type === 'nft' && history.nftData && (
                    <div className="behistory-nft-info">
                        <p className="nft-name">{history.nftData.name}</p>
                        <p className="nft-price">{history.nftData.price}</p>
                        <p className="nft-collection">{history.nftData.collection}</p>
                    </div>
                )}

                {history.type === 'article' && history.articleData && (
                    <div className="behistory-article-info">
                        <p className="article-title">{history.articleData.title}</p>
                        <p className="article-excerpt line-clamp-2">{history.articleData.excerpt}</p>
                        <button className="article-read-more">
                            Leer más →
                        </button>
                    </div>
                )}
            </div>

            {/* Modal de Exchange */}
            {showExchange && (
                <BezCoinExchange onClose={() => setShowExchange(false)} />
            )}
        </div>
    );
};

const BeHistory = () => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const scrollContainerRef = useRef(null);

    const scrollToHistory = (index) => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const historyWidth = container.clientWidth;
            container.scrollTo({
                left: historyWidth * index,
                behavior: 'smooth'
            });
            setCurrentIndex(index);
        }
    };

    const handleScroll = () => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const historyWidth = container.clientWidth;
            const newIndex = Math.round(container.scrollLeft / historyWidth);
            setCurrentIndex(newIndex);
        }
    };

    const goToPrevious = () => {
        if (currentIndex > 0) {
            scrollToHistory(currentIndex - 1);
        }
    };

    const goToNext = () => {
        if (currentIndex < mockHistories.length - 1) {
            scrollToHistory(currentIndex + 1);
        }
    };

    return (
        <div className="behistory-container">
            {/* Scroll Container Horizontal */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="behistory-scroll"
            >
                {mockHistories.map((history, index) => (
                    <HistoryItem
                        key={history.id}
                        history={history}
                        isActive={currentIndex === index}
                    />
                ))}
            </div>

            {/* Navegación con flechas */}
            {currentIndex > 0 && (
                <button
                    onClick={goToPrevious}
                    className="behistory-nav-btn behistory-nav-prev"
                    aria-label="Historia anterior"
                >
                    <ChevronLeft size={32} />
                </button>
            )}

            {currentIndex < mockHistories.length - 1 && (
                <button
                    onClick={goToNext}
                    className="behistory-nav-btn behistory-nav-next"
                    aria-label="Siguiente historia"
                >
                    <ChevronRight size={32} />
                </button>
            )}

            {/* Indicadores de progreso */}
            <div className="behistory-indicators">
                {mockHistories.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => scrollToHistory(index)}
                        className={`behistory-indicator ${index === currentIndex ? 'indicator-active' : ''
                            }`}
                        aria-label={`Ir a historia ${index + 1}`}
                    />
                ))}
            </div>

            {/* Floating Action Button (FAB) - Crear History */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="behistory-fab"
                aria-label="Crear nueva historia"
            >
                <Plus size={28} />
            </button>

            {/* Modal de Creación */}
            {showCreateModal && (
                <CreateHistoryModal onClose={() => setShowCreateModal(false)} />
            )}
        </div>
    );
};

export default BeHistory;
