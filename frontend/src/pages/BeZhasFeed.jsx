import React, { useEffect, useState } from 'react';
import http from '../services/http';
import { ethers } from 'ethers';
import { apiGet, apiPost } from '../lib/api';
import { toast } from 'react-hot-toast';
import { useBezCoin } from '../context/BezCoinContext';
import { FaCoins, FaHeart } from 'react-icons/fa';
// BuyBezCoinModal -> useBezPay().openBuyBez()
import InsufficientFundsModal from '../components/modals/InsufficientFundsModal';
import DonateButton from '../components/DonateButton';

const erc20Abi = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)"
];

async function getBZHAddress() {
    const res = await http.get('/contract-addresses.json');
    const data = res.data;
    return data.BZHToken;
}

const mockPosts = [
    {
        id: 1,
        author: {
            name: 'Alice',
            avatar: '/avatars/alice.jpg',
            username: '@alice',
            wallet: '0x000000000000000000000000000000000000dEaD'
        },
        content: '¡Bienvenido a BeZhas! Este es el primer post del feed social.',
        image: '/images/post1.jpg',
        likes: 12,
        comments: [
            { author: 'Bob', content: '¡Genial!' }
        ],
        createdAt: '2025-10-09T10:00:00Z'
    },
    {
        id: 2,
        author: {
            name: 'Bob',
            avatar: '/avatars/bob.jpg',
            username: '@bob',
            wallet: '0x000000000000000000000000000000000000b0b0'
        },
        content: '¿Listos para el futuro de Web3?',
        image: '',
        likes: 8,
        comments: [],
        createdAt: '2025-10-09T11:00:00Z'
    }
];

export default function BeZhasFeed() {
    const [posts, setPosts] = useState(mockPosts);
    const [usingMock, setUsingMock] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newPost, setNewPost] = useState('');
    const [comment, setComment] = useState({});
    const [account, setAccount] = useState(null);

    // BezCoin Integration
    const {
        balance,
        donate,
        showBuyModal,
        setShowBuyModal,
        insufficientFundsModal,
        setInsufficientFundsModal
    } = useBezCoin();

    const load = async (showToast = false) => {
        try {
            setLoading(true);
            setError(null);
            // Detect wallet address if available
            if (window.ethereum) {
                try {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const signer = await provider.getSigner().catch(() => null);
                    const addr = signer ? await signer.getAddress() : null;
                    if (addr) setAccount(addr);
                } catch (_) { }
            }
            const res = await apiGet('/api/feed');
            if (!res.ok) throw new Error('Backend no disponible');
            // Some backends return an array, others wrap in {posts}
            const data = await res.json();
            const arr = Array.isArray(data) ? data : (Array.isArray(data?.posts) ? data.posts : []);
            // Normalize to our UI shape
            const normalized = arr.map((p, idx) => ({
                id: p._id || p.id || idx + 1,
                author: typeof p.author === 'string' ? {
                    name: p.author,
                    username: p.author?.slice(0, 6) + '...' + p.author?.slice(-4),
                    avatar: '/avatars/default.svg',
                    wallet: p.author,
                } : (p.author || { name: 'Anon', username: '@anon', avatar: '/avatars/default.svg' }),
                content: p.content || '',
                image: p.image || '',
                likes: Array.isArray(p.likes) ? p.likes.length : (p.likes || 0),
                comments: p.comments || [],
                createdAt: p.createdAt || new Date().toISOString(),
            }));
            setPosts(normalized.length ? normalized : mockPosts);
            setUsingMock(!normalized.length);
            if (showToast) toast.success('Feed actualizado');
        } catch (e) {
            setError('No se pudo conectar al backend. Mostrando datos de ejemplo.');
            setPosts(mockPosts);
            setUsingMock(true);
            if (showToast) toast.error('No se pudo actualizar el feed');
        } finally {
            setLoading(false);
        }
    };

    // Try to fetch from backend; fallback to mock
    useEffect(() => {
        load();
    }, []);

    // Legacy tip function (keep for backward compatibility if needed in other places)
    const tip = async (to, amount = '1') => {
        try {
            if (!window.ethereum) return alert('Conecta una wallet para dar propinas');
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const bzhAddr = await getBZHAddress();
            if (!bzhAddr) return alert('No se encontró la dirección del token BZH');
            const token = new ethers.Contract(bzhAddr, erc20Abi, signer);
            const decimals = await token.decimals();
            const value = ethers.parseUnits(amount, decimals);
            const tx = await token.transfer(to, value);
            await tx.wait();
            alert('Propina enviada ✅');
        } catch (e) {
            console.error(e);
            alert('No se pudo enviar la propina');
        }
    };

    // Crear post (usa backend si disponible, si no, actualiza mock local)
    const createPost = async () => {
        if (!newPost.trim()) return;
        const authorName = account || 'Invitado';
        const payload = { author: authorName, content: newPost };
        try {
            if (!usingMock) {
                const res = await http.post('/api/feed', payload);
                if (res.status !== 200 && res.status !== 201) throw new Error('Error al publicar');
                const created = res.data;
                const p = created.post || created; // soporta {post} o objeto directo
                setPosts(prev => [{
                    id: p._id || p.id || prev.length + 1,
                    author: typeof p.author === 'string' ? {
                        name: p.author,
                        username: p.author?.slice(0, 6) + '...' + p.author?.slice(-4),
                        avatar: '/avatars/default.svg',
                        wallet: p.author,
                    } : (p.author || { name: 'Anon', username: '@anon', avatar: '/avatars/default.svg' }),
                    content: p.content || '',
                    image: p.image || '',
                    likes: Array.isArray(p.likes) ? p.likes.length : (p.likes || 0),
                    comments: p.comments || [],
                    createdAt: p.createdAt || new Date().toISOString(),
                }, ...prev]);
            } else {
                // backend no disponible: agregar localmente
                setPosts(prev => [{
                    id: prev.length + 1,
                    author: { name: authorName, username: '@guest', avatar: '/avatars/default.svg', wallet: account },
                    content: newPost,
                    image: '',
                    likes: 0,
                    comments: [],
                    createdAt: new Date().toISOString(),
                }, ...prev]);
            }
            // Emit global event for quest progress
            try { window.dispatchEvent(new CustomEvent('bezhas:feed-post', { detail: { walletAddress: account } })); } catch (_) { }
            setNewPost('');
            toast.success('Publicado');
        } catch (e) {
            console.error(e);
            toast.error('No se pudo publicar');
        }
    };

    // Like a post
    const likePost = async (post) => {
        try {
            if (!usingMock) {
                await apiPost(`/api/feed/${post.id}/like`, { author: account || 'guest' });
                // refrescar lista
                const res = await http.get('/api/feed');
                const data = res.data;
                const arr = Array.isArray(data) ? data : data.posts;
                setPosts(arr.map((p, idx) => ({
                    id: p._id || p.id || idx + 1,
                    author: typeof p.author === 'string' ? {
                        name: p.author,
                        username: p.author?.slice(0, 6) + '...' + p.author?.slice(-4),
                        avatar: '/avatars/default.svg',
                        wallet: p.author,
                    } : (p.author || { name: 'Anon', username: '@anon', avatar: '/avatars/default.svg' }),
                    content: p.content || '',
                    image: p.image || '',
                    likes: Array.isArray(p.likes) ? p.likes.length : (p.likes || 0),
                    comments: p.comments || [],
                    createdAt: p.createdAt || new Date().toISOString(),
                })));
            } else {
                // local update
                setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: (p.likes || 0) + 1 } : p));
            }
            // Emit global event for quest progress
            try { window.dispatchEvent(new CustomEvent('bezhas:feed-like', { detail: { walletAddress: account } })); } catch (_) { }
            toast.success('Te ha gustado el post');
        } catch (e) {
            console.error(e);
            toast.error('No se pudo registrar tu me gusta');
        }
    };

    // Comment a post
    const commentPost = async (post) => {
        const value = comment[post.id];
        if (!value || !value.trim()) return;
        try {
            if (!usingMock) {
                await apiPost(`/api/feed/${post.id}/comment`, { author: account || 'guest', content: value });
                const res = await http.get('/api/feed');
                const data = res.data;
                const arr = Array.isArray(data) ? data : data.posts;
                setPosts(arr.map((p, idx) => ({
                    id: p._id || p.id || idx + 1,
                    author: typeof p.author === 'string' ? {
                        name: p.author,
                        username: p.author?.slice(0, 6) + '...' + p.author?.slice(-4),
                        avatar: '/avatars/default.svg',
                        wallet: p.author,
                    } : (p.author || { name: 'Anon', username: '@anon', avatar: '/avatars/default.svg' }),
                    content: p.content || '',
                    image: p.image || '',
                    likes: Array.isArray(p.likes) ? p.likes.length : (p.likes || 0),
                    comments: p.comments || [],
                    createdAt: p.createdAt || new Date().toISOString(),
                })));
            } else {
                setPosts(prev => prev.map(p => p.id === post.id ? {
                    ...p,
                    comments: [...(p.comments || []), { author: account || 'guest', content: value }]
                } : p));
            }
            // Emit global event for quest progress
            try { window.dispatchEvent(new CustomEvent('bezhas:feed-comment', { detail: { walletAddress: account } })); } catch (_) { }
            setComment(prev => ({ ...prev, [post.id]: '' }));
            toast.success('Comentario publicado');
        } catch (e) {
            console.error(e);
            toast.error('No se pudo comentar');
        }
    };
    return (
        <div className="max-w-2xl mx-auto py-8">
            {/* Header with Balance */}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">BeZhas Feed</h2>

                {/* Balance Display */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg shadow-lg">
                        <FaCoins className="text-yellow-300" size={18} />
                        <span className="font-bold">{parseFloat(balance).toFixed(2)} BEZ</span>
                    </div>
                    <button
                        onClick={() => openBuyBez()}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
                    >
                        Comprar BEZ
                    </button>
                </div>
            </div>

            {loading && <div className="text-gray-500 mb-4">Cargando...</div>}
            {error && <div className="text-red-500 mb-4">{error}</div>}
            {usingMock && !loading && (
                <div className="text-yellow-700 bg-yellow-100 border border-yellow-300 rounded p-3 mb-4">
                    Estás viendo datos de ejemplo. Inicia el backend en el puerto 3001 para ver datos reales.
                </div>
            )}
            {/* Crear nuevo post */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <textarea
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    placeholder="¿Qué estás pensando?"
                    className="w-full border rounded p-2"
                    rows={3}
                />
                <div className="flex justify-between items-center mt-2">
                    <button onClick={() => load(true)} className="bg-gray-200 text-gray-800 px-3 py-1 rounded">Refrescar</button>
                    <button onClick={createPost} className="bg-blue-600 text-white px-3 py-1 rounded">Publicar</button>
                </div>
            </div>

            {posts.map(post => (
                <div key={post.id} className="bg-white rounded-lg shadow p-6 mb-6">
                    <div className="flex items-center mb-4">
                        <img src={post.author.avatar} alt="" className="w-10 h-10 rounded-full mr-3" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/avatars/default.jpg'; }} />
                        <div>
                            <div className="font-bold">{post.author.name}</div>
                            <div className="text-gray-500 text-sm">{post.author.username}</div>
                        </div>
                    </div>
                    <div className="mb-4">{post.content}</div>
                    {post.image && <img src={post.image} alt="" className="rounded-lg mb-4" />}
                    <div className="flex items-center text-gray-600">
                        <button onClick={() => likePost(post)} className="mr-4 hover:text-blue-600">👍 {post.likes}</button>
                        <span className="mr-4">💬 {post.comments.length}</span>
                        <div className="ml-auto">
                            <DonateButton
                                recipientAddress={post.author.wallet}
                                recipientName={post.author.name}
                                postId={post.id}
                                size="md"
                            />
                        </div>
                    </div>
                    {/* Comentarios */}
                    <div className="mt-3">
                        {(post.comments || []).map((c, idx) => (
                            <div key={idx} className="text-sm text-gray-800 mb-1">
                                <span className="font-semibold">{c.author}:</span> {c.content}
                            </div>
                        ))}
                        <div className="flex mt-2">
                            <input
                                className="flex-1 border rounded p-2 text-sm"
                                placeholder="Escribe un comentario"
                                value={comment[post.id] || ''}
                                onChange={(e) => setComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                            />
                            <button onClick={() => commentPost(post)} className="ml-2 bg-gray-800 text-white px-3 py-1 rounded text-sm">Comentar</button>
                        </div>
                    </div>
                </div>
            ))}

            {/* BezCoin Modals */}
            <BuyBezCoinModal
                isOpen={showBuyModal}
                onClose={() => {}}
            />

            <InsufficientFundsModal
                isOpen={insufficientFundsModal.show}
                onClose={() => setInsufficientFundsModal({ show: false, requiredAmount: 0, actionName: '', onPurchaseComplete: null })}
                requiredAmount={insufficientFundsModal.requiredAmount}
                currentBalance={balance}
                actionName={insufficientFundsModal.actionName}
                onPurchaseComplete={insufficientFundsModal.onPurchaseComplete}
            />
        </div>
    );
}
