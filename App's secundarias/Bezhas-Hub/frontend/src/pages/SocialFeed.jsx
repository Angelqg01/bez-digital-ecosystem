import React, { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';
import SocialFeedLayout from '../components/social-feed/SocialFeedLayout';
import { usePosts } from '../hooks/usePosts';
import { postsService } from '../services/posts.service';
import toast from 'react-hot-toast';

// --- Mock Data ---

const currentUser = {
    id: 'u1',
    name: 'Usuario Demo',
    username: '@usuario_demo',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    isVIP: true
};

const mockPosts = [
    {
        id: 1,
        content: '¡Bienvenidos a la nueva experiencia social de BeZhas! 🚀\n\nEstamos integrando lo mejor de Web3 con una interfaz moderna y fluida. ¿Qué opinan de las nuevas funcionalidades?',
        author: {
            name: 'BeZhas Oficial',
            username: '@bezhas_official',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=BeZhas',
            verified: true,
            isVIP: true
        },
        timestamp: 'Hace 2 horas',
        isPinned: true,
        isOfficial: true,
        blockchainValidated: true,
        hashtags: ['Web3', 'SocialFi', 'Innovation'],
        media: [
            { type: 'image', url: 'https://picsum.photos/seed/bezhas1/800/600' }
        ],
        reactions: {
            total: 1250,
            types: [{ emoji: '❤️' }, { emoji: '🔥' }, { emoji: '🚀' }]
        },
        likes: 1250,
        comments: 45,
        shares: 120
    },
    {
        id: 2,
        content: 'Acabo de mintear mi primer NFT en la plataforma. El proceso fue súper rápido y las comisiones casi nulas. 🎨✨',
        author: {
            name: 'Ana Artista',
            username: '@ana_art',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Ana',
            verified: true
        },
        timestamp: 'Hace 4 horas',
        blockchainValidated: true,
        hashtags: ['NFT', 'DigitalArt', 'Crypto'],
        media: [
            { type: 'image', url: 'https://picsum.photos/seed/art1/600/800' },
            { type: 'image', url: 'https://picsum.photos/seed/art2/600/800' }
        ],
        reactions: {
            total: 342,
            types: [{ emoji: '❤️' }, { emoji: '😮' }]
        },
        likes: 342,
        comments: 28,
        shares: 15
    },
    {
        id: 3,
        content: '¿Alguien más está emocionado por el nuevo sistema de recompensas? 💰 He estado probando los anuncios y realmente funciona.',
        author: {
            name: 'Crypto Trader',
            username: '@trader_pro',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Trader',
            verified: false
        },
        timestamp: 'Hace 6 horas',
        hashtags: ['Rewards', 'PassiveIncome'],
        media: [],
        reactions: {
            total: 89,
            types: [{ emoji: '👍' }]
        },
        likes: 89,
        comments: 12,
        shares: 5
    },
    {
        id: 4,
        content: 'Un día increíble en el evento de comunidad. ¡Gracias a todos por venir! 🌟',
        author: {
            name: 'Comunidad Local',
            username: '@local_community',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Community',
            verified: true
        },
        timestamp: 'Hace 1 día',
        media: [
            { type: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4' }
        ],
        reactions: {
            total: 567,
            types: [{ emoji: '❤️' }, { emoji: '👏' }]
        },
        likes: 567,
        comments: 67,
        shares: 89
    },
    {
        id: 5,
        content: 'Reflexionando sobre el futuro de la identidad digital descentralizada. Es fundamental que los usuarios sean dueños de sus datos.',
        author: {
            name: 'Dev Web3',
            username: '@web3_dev',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
            verified: true
        },
        timestamp: 'Hace 1 día',
        hashtags: ['DID', 'Privacy', 'Tech'],
        media: [],
        reactions: {
            total: 230,
            types: [{ emoji: '💡' }]
        },
        likes: 230,
        comments: 45,
        shares: 34
    }
];

const mockStories = [
    { id: 1, username: 'maria_g', image: 'https://picsum.photos/seed/story1/200/300', viewed: false },
    { id: 2, username: 'juan_p', image: 'https://picsum.photos/seed/story2/200/300', viewed: true },
    { id: 3, username: 'crypto_news', image: 'https://picsum.photos/seed/story3/200/300', viewed: false },
    { id: 4, username: 'art_daily', image: 'https://picsum.photos/seed/story4/200/300', viewed: false },
    { id: 5, username: 'traveler', image: 'https://picsum.photos/seed/story5/200/300', viewed: true },
];

const mockSuggestions = [
    { id: 1, name: 'DeFi Protocol', username: '@defi_proto', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DeFi', followers: '12.5K' },
    { id: 2, name: 'NFT Collector', username: '@nft_whale', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Whale', followers: '8.2K' },
    { id: 3, name: 'Web3 News', username: '@web3_news', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=News', followers: '45K' },
];

const mockBeHistories = [
    {
        id: 1,
        type: 'video',
        content: 'https://picsum.photos/seed/history1/360/640',
        thumbnail: 'https://picsum.photos/seed/history1/360/640',
        author: { name: 'Influencer Top', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Inf', verified: true },
        caption: '¡Increíble vista desde la oficina hoy! 🌆 #Lifestyle',
        likes: 1200,
        comments: 45,
        shares: 20,
        timestamp: '2h'
    },
    {
        id: 2,
        type: 'image',
        content: 'https://picsum.photos/seed/history2/360/640',
        author: { name: 'Chef Digital', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Chef', verified: false },
        caption: 'Nueva receta disponible en mi perfil 🍳',
        likes: 850,
        comments: 30,
        shares: 15,
        timestamp: '5h'
    }
];

export default function SocialFeed() {
    const { isConnected } = useAccount();
    const { connect, connectors } = useConnect();

    // Cargar posts reales desde la API con auto-refresh
    const { posts: apiPosts, loading, error, meta, refetch } = usePosts({
        limit: 50,
        offset: 0,
        autoRefresh: true,
        refreshInterval: 30000 // 30 segundos
    });

    // Log para debugging
    useEffect(() => {
        console.log('📊 API Posts state:', {
            count: apiPosts.length,
            loading,
            error,
            meta
        });
    }, [apiPosts, loading, error, meta]);

    // Usar posts de API si están disponibles, sino mock data
    const posts = apiPosts.length > 0 ? apiPosts : mockPosts;

    // 🔥 Auto-conectar wallet al cargar la página
    useEffect(() => {
        if (!isConnected && connectors.length > 0) {
            const injectedConnector = connectors.find(c => c.id === 'injected' || c.name === 'MetaMask');
            if (injectedConnector) {
                const connectPromise = connect({ connector: injectedConnector });
                if (connectPromise && typeof connectPromise.catch === 'function') {
                    connectPromise.catch(err => {
                        if (import.meta.env.DEV) console.log('Auto-connect skipped:', err);
                    });
                }
            }
        }
    }, [isConnected, connect, connectors]);

    // Handlers
    const handleCreatePost = async (content) => {
        try {
            const formData = new FormData();
            formData.append('content', content);
            // TODO: Handle media upload if supported by component

            await postsService.createPost(formData);
            toast.success('Post creado exitosamente');
            refetch(); // Recargar posts
        } catch (error) {
            console.error('Error creating post:', error);
            toast.error('Error al crear post');
        }
    };

    const handleLike = async (postId, reaction) => {
        try {
            await postsService.likePost(postId, reaction);
            // Optimistic update or refetch could be done here
            toast.success('Reacción enviada');
        } catch (error) {
            console.error('Error liking post:', error);
            toast.error('Error al reaccionar');
        }
    };

    const handleComment = async (postId, content) => {
        try {
            await postsService.commentPost(postId, content);
            toast.success('Comentario enviado');
        } catch (error) {
            console.error('Error commenting:', error);
            toast.error('Error al comentar');
        }
    };

    const handleFollow = (userId) => {
        console.log(`Seguir usuario ${userId}`);
        toast.success('Usuario seguido (Simulado)');
    };

    const handleDonate = (contentId, amount) => {
        console.log(`Donar ${amount} a contenido ${contentId}`);
        toast.success(`¡Gracias por donar ${amount} BEZ!`);
    };

    const handleValidate = async (postId) => {
        try {
            await postsService.validatePost(postId);
            toast.success('Validación en blockchain iniciada');
        } catch (error) {
            console.error('Error validating post:', error);
            toast.error('Error al validar post');
        }
    };

    // Show loading state
    if (loading && apiPosts.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Cargando posts...</p>
                </div>
            </div>
        );
    }

    // Show error state (but still try to render with fallback data)
    if (error && apiPosts.length === 0) {
        console.warn('⚠️ Using fallback data due to API error:', error);
    }

    return (
        <SocialFeedLayout
            user={currentUser}
            posts={posts}
            stories={mockStories}
            suggestions={mockSuggestions}
            beHistories={mockBeHistories}
            onCreatePost={handleCreatePost}
            onLike={handleLike}
            onComment={handleComment}
            onFollow={handleFollow}
            onDonate={handleDonate}
            onValidate={handleValidate}
        />
    );
}
