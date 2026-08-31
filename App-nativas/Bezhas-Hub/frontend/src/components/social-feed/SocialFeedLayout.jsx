import React, { useState, useEffect, useMemo } from 'react';
import PostCard from './PostCard';
import FeedTabs from './FeedTabs';
import CreatePostArea from './CreatePostArea';
import AdCard from './AdCard';

// Nuevos componentes
import StoriesRail from './StoriesRail';
import ReelInFeedCard from './ReelInFeedCard';
import { NFTCard } from '../shop/NFTCard';
import { mixFeedContent } from '../../utils/feedMixer';

/**
 * SocialFeedLayout Component
 * Layout de feed unificado con BeHistory arriba y contenido mezclado (Reels, Ads, NFTs)
 */
const SocialFeedLayout = ({
    user,
    posts = [],
    stories = [],
    suggestions = [],
    beHistories = [],
    reels = [], // Nuevos props
    ads = [],
    nfts = [],
    onCreatePost,
    onLike,
    onComment,
    onFollow,
    onDonate,
    onValidate
}) => {
    console.log('SocialFeedLayout rendering', { postsCount: posts.length });
    const [activeTab, setActiveTab] = useState('recents');

    // Mock data para Reels y NFTs si no vienen en props (para demostración)
    const demoReels = reels.length > 0 ? reels : [
        { id: 'r1', userName: 'CryptoArtist', userAvatar: 'https://i.pravatar.cc/150?u=r1', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-in-the-water-1164-large.mp4', likes: 120, comments: 45, description: 'Creating digital art 🎨 #nft #art' },
        { id: 'r2', userName: 'Web3Dev', userAvatar: 'https://i.pravatar.cc/150?u=r2', videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4', likes: 89, comments: 12, description: 'Coding the future 🚀 #web3 #coding' }
    ];

    const demoAds = ads.length > 0 ? ads : [
        { id: 'a1', title: 'BeZhas Premium', description: 'Unlock exclusive features now!', image: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="300"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0%25" y1="0%25" x2="100%25" y2="100%25"%3E%3Cstop offset="0%25" style="stop-color:%234F46E5;stop-opacity:1" /%3E%3Cstop offset="100%25" style="stop-color:%238B5CF6;stop-opacity:1" /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill="url(%23g)" width="600" height="300"/%3E%3Ctext x="50%25" y="50%25" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em"%3EBeZhas Premium%3C/text%3E%3C/svg%3E' },
        { id: 'a2', title: 'Crypto Wallet', description: 'Secure your assets.', image: 'https://via.placeholder.com/600x300' }
    ];

    const demoNFTs = nfts.length > 0 ? nfts : [
        { id: 'n1', tokenId: '101', name: 'Cosmic Cube', price: '0.5', image: 'https://picsum.photos/300/300?random=nft1' },
        { id: 'n2', tokenId: '102', name: 'Digital Punk', price: '1.2', image: 'https://picsum.photos/300/300?random=nft2' }
    ];

    /**
     * Genera contenido mezclado usando el algoritmo feedMixer
     */
    const mixedContent = useMemo(() => {
        return mixFeedContent(posts, demoReels, demoAds, demoNFTs);
    }, [posts, demoReels, demoAds, demoNFTs]);

    /**
     * Renderiza un componente según su tipo
     */
    const renderComponent = (item) => {
        const { type, data } = item;

        switch (type) {
            case 'post':
                return (
                    <PostCard
                        post={data}
                        onLike={onLike}
                        onComment={onComment}
                        onDonate={onDonate}
                        onValidate={onValidate}
                    />
                );
            case 'reel':
                return <ReelInFeedCard reel={data} />;
            case 'ad':
                return (
                    <div className="relative mb-6">
                        <div className="absolute -top-2 left-4 bg-yellow-400 text-xs font-bold px-2 py-0.5 rounded text-black z-10">
                            SPONSORED
                        </div>
                        <AdCard ad={data} />
                    </div>
                );
            case 'nft':
                return (
                    <div className="relative mb-6">
                        <div className="absolute -top-2 right-4 bg-purple-600 text-xs font-bold px-2 py-0.5 rounded text-white z-10 shadow-lg shadow-purple-500/50">
                            NEW MINT
                        </div>
                        <NFTCard listing={data} metadata={data} />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Main Container - Feed unificado sin sidebar */}
            <div className="container mx-auto px-4 py-4 max-w-2xl">
                <div className="space-y-3">
                    {/* Stories Rail (BeHistory) - Fijo arriba */}
                    <StoriesRail
                        stories={beHistories.length > 0 ? beHistories : stories}
                        currentUser={user}
                        onCreateStory={onCreatePost}
                    />

                    {/* Create Post Area */}
                    <CreatePostArea user={user} onCreatePost={onCreatePost} />

                    {/* Feed Tabs */}
                    <FeedTabs
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />

                    {/* Feed Mezclado */}
                    {mixedContent.map((item, index) => (
                        <div key={`${item.type}-${item.data.id || index}`}>
                            {renderComponent(item)}
                        </div>
                    ))}

                    {/* Empty State */}
                    {posts.length === 0 && (
                        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                No hay publicaciones para mostrar
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SocialFeedLayout;
