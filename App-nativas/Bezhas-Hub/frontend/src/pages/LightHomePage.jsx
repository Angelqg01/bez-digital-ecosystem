import React from 'react';
import { useNavigate } from 'react-router-dom';
import LightLayout from '../components/layout/LightLayout';
import { NFTCard, CollectionCard, SimpleCard, CardGrid } from '../components/cards/LightCards';
import { TrendingUp, Sparkles, Users, Image } from 'lucide-react';

/**
 * HOMEPAGE DEMO - Light Mode Design
 * Página de ejemplo que demuestra el uso del Design System
 */
export default function LightHomePage() {
    const navigate = useNavigate();

    // Datos de ejemplo
    const featuredNFTs = [
        {
            id: 1,
            image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
            title: 'Cosmic Dreams #342',
            creator: 'ArtistName',
            price: '2.5',
            likes: 145,
            views: 2340,
            trending: true,
            verified: true,
        },
        {
            id: 2,
            image: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=400',
            title: 'Digital Sunset',
            creator: 'CreatorX',
            price: '1.8',
            likes: 89,
            views: 1567,
            trending: false,
            verified: true,
        },
        {
            id: 3,
            image: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400',
            title: 'Abstract Vibes',
            creator: 'ModernArt',
            price: '3.2',
            likes: 234,
            views: 3456,
            trending: true,
            verified: false,
        },
        {
            id: 4,
            image: 'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=400',
            title: 'Neon City',
            creator: 'UrbanVision',
            price: '4.0',
            likes: 567,
            views: 8901,
            trending: false,
            verified: true,
        },
    ];

    const collections = [
        {
            id: 1,
            banner: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600',
            avatar: 'https://ui-avatars.com/api/?name=Cool+Cats&background=a855f7&color=fff',
            name: 'Cool Cats Collection',
            creator: 'CoolCatsDAO',
            itemCount: '10K',
            floorPrice: '2.5 BZH',
            volume: '45K BZH',
            verified: true,
        },
        {
            id: 2,
            banner: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=600',
            avatar: 'https://ui-avatars.com/api/?name=Cyber+Punks&background=ec4899&color=fff',
            name: 'Cyber Punks',
            creator: 'PunkStudio',
            itemCount: '8K',
            floorPrice: '3.8 BZH',
            volume: '78K BZH',
            verified: true,
        },
    ];

    return (
        <LightLayout>
            {/* === HERO SECTION === */}
            <section className="mb-12 lg:mb-16">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 lg:p-12 shadow-soft-lg">
                    <div className="relative z-10 max-w-2xl">
                        <h1 className="text-4xl lg:text-6xl font-display font-bold text-text-primary dark:text-white mb-4 animate-slide-up">
                            Descubre NFTs{' '}
                            <span className="text-gradient">Increíbles</span>
                        </h1>
                        <p className="text-lg text-text-secondary dark:text-gray-400 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                            Explora, colecciona y vende arte digital extraordinario en la plataforma NFT más innovadora.
                        </p>
                        <div className="flex flex-wrap gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                            <button
                                onClick={() => navigate('/marketplace')}
                                className="btn btn-primary"
                            >
                                <Sparkles className="w-5 h-5" />
                                Explorar NFTs
                            </button>
                            <button
                                onClick={() => navigate('/create')}
                                className="btn btn-outline"
                            >
                                <Image className="w-5 h-5" />
                                Crear NFT
                            </button>
                        </div>
                    </div>

                    {/* Decorative Elements */}
                    <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary-200/30 dark:bg-primary-900/30 rounded-full blur-3xl" />
                    <div className="absolute -right-40 -bottom-20 w-96 h-96 bg-accent-200/30 dark:bg-accent-900/30 rounded-full blur-3xl" />
                </div>
            </section>

            {/* === STATS SECTION === */}
            <section className="mb-12 lg:mb-16">
                <CardGrid columns={4}>
                    <div className="card p-6 text-center bg-white dark:bg-gray-800">
                        <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-3">
                            <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-3xl font-bold text-gradient mb-1">45K+</h3>
                        <p className="text-sm text-text-muted">NFTs Vendidos</p>
                    </div>

                    <div className="card p-6 text-center bg-white dark:bg-gray-800">
                        <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Users className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-3xl font-bold text-gradient mb-1">12K+</h3>
                        <p className="text-sm text-text-muted">Creadores</p>
                    </div>

                    <div className="card p-6 text-center bg-white dark:bg-gray-800">
                        <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Image className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-3xl font-bold text-gradient mb-1">120K+</h3>
                        <p className="text-sm text-text-muted">Total NFTs</p>
                    </div>

                    <div className="card p-6 text-center bg-white dark:bg-gray-800">
                        <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center mx-auto mb-3">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-3xl font-bold text-gradient mb-1">2.8M+</h3>
                        <p className="text-sm text-text-muted">Volumen Total</p>
                    </div>
                </CardGrid>
            </section>

            {/* === TRENDING NFTs === */}
            <section className="mb-12 lg:mb-16">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-display font-bold text-text-primary dark:text-white">
                            NFTs en Tendencia
                        </h2>
                        <p className="text-text-secondary dark:text-gray-400 mt-1">
                            Los NFTs más populares del momento
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/marketplace')}
                        className="btn btn-outline text-sm"
                    >
                        Ver Todos
                    </button>
                </div>

                <CardGrid columns={4}>
                    {featuredNFTs.map((nft) => (
                        <NFTCard
                            key={nft.id}
                            {...nft}
                            onClick={() => navigate('/marketplace')}
                            onLike={() => console.log('Like NFT:', nft.id)}
                            onAddToCart={() => console.log('Add to cart:', nft.id)}
                        />
                    ))}
                </CardGrid>
            </section>

            {/* === TOP COLLECTIONS === */}
            <section className="mb-12 lg:mb-16">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-display font-bold text-text-primary dark:text-white">
                            Colecciones Destacadas
                        </h2>
                        <p className="text-text-secondary dark:text-gray-400 mt-1">
                            Las mejores colecciones curadas
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/marketplace')}
                        className="btn btn-outline text-sm"
                    >
                        Ver Todas
                    </button>
                </div>

                <CardGrid columns={2}>
                    {collections.map((collection) => (
                        <CollectionCard
                            key={collection.id}
                            {...collection}
                            onClick={() => navigate('/marketplace')}
                        />
                    ))}
                </CardGrid>
            </section>

            {/* === CTA SECTION === */}
            <section className="mb-12">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-8 lg:p-12 shadow-soft-lg">
                    <div className="relative z-10 text-center max-w-2xl mx-auto text-white">
                        <Sparkles className="w-16 h-16 mx-auto mb-4 animate-bounce-soft" />
                        <h2 className="text-3xl lg:text-4xl font-display font-bold mb-4">
                            ¿Listo para crear tu NFT?
                        </h2>
                        <p className="text-lg text-white/90 mb-6">
                            Únete a miles de creadores y convierte tu arte en activos digitales únicos
                        </p>
                        <button
                            onClick={() => navigate('/create')}
                            className="btn bg-white text-primary-600 hover:bg-white/90 hover:shadow-glow"
                        >
                            Comenzar Ahora
                        </button>
                    </div>

                    {/* Decorative circles */}
                    <div className="absolute -left-20 -top-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
                </div>
            </section>
        </LightLayout>
    );
}
