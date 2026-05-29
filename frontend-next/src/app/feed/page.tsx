"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Heart, MessageCircle, Share2, Bookmark, MoreHorizontal,
    Image as ImageIcon, Send, TrendingUp, Users, Globe,
    Loader2, Plus, Sparkles, RefreshCw, Filter
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Post {
    id: string;
    author: {
        address: string;
        username: string;
        avatar: string;
    };
    content: string;
    images?: string[];
    likes: number;
    comments: number;
    shares: number;
    liked: boolean;
    bookmarked: boolean;
    createdAt: string;
    tags?: string[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────
const MOCK_POSTS: Post[] = [
    {
        id: '1', 
        author: { address: '0x52Df82920CBAE522880dD7657e43d1A754eD044E', username: 'BeZhas Core', avatar: '' },
        content: '🚀 Nuevo release de @bezhas/sdk v3.2 con soporte multi-chain! Integra pagos BEZ, Quality Escrow y NFT minting en menos de 10 líneas de código. #BezPay #Web3 #SDK',
        likes: 142, comments: 23, shares: 47, liked: false, bookmarked: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        tags: ['BezPay', 'Web3', 'SDK'],
    },
    {
        id: '2',
        author: { address: '0x260A9fBcE1c6817c04e51c170b5BFd8d594c0d8A', username: 'CryptoTrader_ES', avatar: '' },
        content: '📈 BEZ-Coin ha subido un 18% esta semana. El pool BEZ/USDT en farming está dando un APY del 124% 🔥 ¿Quién más está farmeando? #BEZCoin #DeFi #Farming',
        likes: 89, comments: 15, shares: 31, liked: true, bookmarked: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        tags: ['BEZCoin', 'DeFi', 'Farming'],
    },
    {
        id: '3',
        author: { address: '0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE', username: 'ArtistaNFT', avatar: '' },
        content: '🎨 Acabo de tokenizar mi colección de arte digital como RWA en BeZhas Marketplace. Cada pieza está respaldada por un certificado de autenticidad on-chain. El futuro del arte es Web3. #RWA #NFT #DigitalArt',
        likes: 234, comments: 56, shares: 78, liked: false, bookmarked: true,
        createdAt: new Date(Date.now() - 14400000).toISOString(),
        tags: ['RWA', 'NFT', 'DigitalArt'],
    },
    {
        id: '4',
        author: { address: '0x3088573c025F197A886b97440761990c9A9e83C9', username: 'DevBuilder', avatar: '' },
        content: '💡 Tutorial: Cómo integrar Quality Escrow de BeZhas en tu e-commerce en 15 minutos. Thread 🧵👇\n\n1/ Instala @bezhas/sdk\n2/ Configura tu API Key en Developer Console\n3/ Llama a sdk.escrow.create() con el monto y las condiciones\n4/ El comprador deposita y el vendedor recibe al confirmar calidad\n\nSimple, seguro y descentralizado.',
        likes: 312, comments: 89, shares: 122, liked: false, bookmarked: false,
        createdAt: new Date(Date.now() - 28800000).toISOString(),
        tags: ['Tutorial', 'Escrow', 'eCommerce'],
    },
];

const TRENDING_TAGS = ['#BEZCoin', '#DeFi', '#Marketplace', '#RWA', '#OpenClaw', '#SDK', '#Farming', '#QualityEscrow'];

// ─── PostCard ────────────────────────────────────────────────────────────────
function PostCard({ post, onLike }: { post: Post; onLike: (id: string) => void }) {
    const timeAgo = (date: string) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg hover:shadow-xl transition-shadow">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <Link href={`/profile/${post.author.address}`} className="flex items-center gap-3 group">
                    <img
                        src={post.author.avatar || `https://ui-avatars.com/api/?name=${post.author.username}&background=6366f1&color=fff&size=48`}
                        alt={post.author.username}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary-300 transition-all"
                    />
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-primary-600 transition-colors">{post.author.username}</p>
                        <p className="text-xs text-gray-400">{timeAgo(post.createdAt)}</p>
                    </div>
                </Link>
                <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400"><MoreHorizontal size={18} /></button>
            </div>

            {/* Content */}
            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed mb-4">
                {post.content}
            </p>

            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                    {post.tags.map(tag => (
                        <span key={tag} className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-2.5 py-1 rounded-lg">
                            #{tag}
                        </span>
                    ))}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                <button onClick={() => onLike(post.id)} className={`flex items-center gap-2 text-sm font-medium transition-all px-3 py-1.5 rounded-lg ${post.liked ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
                    <Heart size={18} fill={post.liked ? 'currentColor' : 'none'} />
                    <span>{post.likes}</span>
                </button>
                <button className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-primary-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20">
                    <MessageCircle size={18} />
                    <span>{post.comments}</span>
                </button>
                <button className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-green-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20">
                    <Share2 size={18} />
                    <span>{post.shares}</span>
                </button>
                <button className={`p-1.5 rounded-lg transition-colors ${post.bookmarked ? 'text-yellow-500' : 'text-gray-400 hover:text-yellow-500'}`}>
                    <Bookmark size={18} fill={post.bookmarked ? 'currentColor' : 'none'} />
                </button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function FeedPage() {
    const { address, isConnected } = useAccount();
    const { open } = useWeb3Modal();

    const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
    const [loading, setLoading] = useState(false);
    const [newPostContent, setNewPostContent] = useState('');
    const [filter, setFilter] = useState<'all' | 'following' | 'trending'>('all');

    const handleLike = (id: string) => {
        setPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p));
    };

    const handlePost = () => {
        if (!newPostContent.trim()) return;
        if (!isConnected) { open(); return; }

        const newPost: Post = {
            id: Date.now().toString(),
            author: {
                address: address || '0x0',
                username: `User_${address?.slice(2, 8)}`,
                avatar: '',
            },
            content: newPostContent,
            likes: 0, comments: 0, shares: 0,
            liked: false, bookmarked: false,
            createdAt: new Date().toISOString(),
            tags: newPostContent.match(/#\w+/g)?.map(t => t.slice(1)) || [],
        };

        setPosts(prev => [newPost, ...prev]);
        setNewPostContent('');
        toast.success('Post publicado');
    };

    return (
        <div className="container mx-auto px-6 py-8 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* ─── Main Feed ──────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Compose Box */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                        <div className="flex items-start gap-4">
                            <img
                                src={address ? `https://ui-avatars.com/api/?name=${address.slice(2,8)}&background=6366f1&color=fff&size=48` : `https://ui-avatars.com/api/?name=U&background=ccc&size=48`}
                                alt="Tu avatar"
                                className="w-10 h-10 rounded-full"
                            />
                            <div className="flex-1">
                                <textarea
                                    value={newPostContent}
                                    onChange={e => setNewPostContent(e.target.value)}
                                    placeholder="¿Qué está pasando en el ecosistema?"
                                    rows={3}
                                    className="w-full bg-gray-50 dark:bg-gray-800 border-0 rounded-xl py-3 px-4 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-none placeholder:text-gray-400"
                                />
                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex items-center gap-2">
                                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400"><ImageIcon size={18} /></button>
                                        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400"><Sparkles size={18} /></button>
                                    </div>
                                    <button
                                        onClick={handlePost}
                                        disabled={!newPostContent.trim()}
                                        className="bg-gradient-primary text-white font-bold py-2 px-6 rounded-xl shadow-button hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-2"
                                    >
                                        <Send size={16} /> Publicar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex items-center gap-2">
                        {(['all', 'following', 'trending'] as const).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === f
                                    ? 'bg-primary-600 text-white shadow-button'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border border-light-border dark:border-gray-700'
                                    }`}
                            >
                                {f === 'all' ? 'Todos' : f === 'following' ? 'Siguiendo' : 'Tendencias'}
                            </button>
                        ))}
                    </div>

                    {/* Posts */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin text-primary-500" size={32} />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {posts.map(post => (
                                <PostCard key={post.id} post={post} onLike={handleLike} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Sidebar ────────────────────────────────────── */}
                <div className="space-y-6">
                    {/* Trending Tags */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <TrendingUp size={20} className="text-primary-500" /> Tendencias
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {TRENDING_TAGS.map(tag => (
                                <button key={tag} className="px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors">
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Suggested Users */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-light-border dark:border-gray-800 p-6 shadow-soft-lg">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <Users size={20} className="text-primary-500" /> Cuentas Sugeridas
                        </h3>
                        <div className="space-y-4">
                            {[
                                { name: 'BeZhas Official', address: '0x52Df...044E', followers: '12.4K' },
                                { name: 'DeFi_Master', address: '0x8a3F...9b2C', followers: '8.2K' },
                                { name: 'NFT_Collector', address: '0x4C55...d26', followers: '5.6K' },
                            ].map((u, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <img src={`https://ui-avatars.com/api/?name=${u.name}&background=6366f1&color=fff&size=40`} alt={u.name} className="w-10 h-10 rounded-full" />
                                        <div>
                                            <p className="font-semibold text-gray-900 dark:text-white text-sm">{u.name}</p>
                                            <p className="text-xs text-gray-400">{u.followers} seguidores</p>
                                        </div>
                                    </div>
                                    <button className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors">
                                        Seguir
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Platform Stats */}
                    <div className="bg-gradient-to-br from-primary-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
                        <h3 className="font-bold mb-4 flex items-center gap-2"><Globe size={18} /> Ecosistema</h3>
                        <div className="space-y-3">
                            {[
                                { label: 'Usuarios activos', value: '14,238' },
                                { label: 'Posts hoy', value: '1,847' },
                                { label: 'Transacciones BEZ', value: '2.84M' },
                            ].map((s, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-white/70 text-sm">{s.label}</span>
                                    <span className="font-bold">{s.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
