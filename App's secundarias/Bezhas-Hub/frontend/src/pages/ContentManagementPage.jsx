import React, { useEffect, useState } from 'react';
import http from '../services/http';
import { Trash2, Flag, CheckCircle, XCircle } from 'lucide-react';

export default function ContentManagementPage() {
    const [posts, setPosts] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('posts');

    useEffect(() => {
        fetchContent();
    }, []);

    async function fetchContent() {
        setLoading(true);
        try {
            // Fetch posts from feed
            const postsRes = await http.get('/api/feed');
            setPosts(postsRes.data || []);

            // Fetch groups
            const groupsRes = await http.get('/api/groups');
            setGroups(groupsRes.data || []);
        } catch (err) {
            console.error('Error fetching content:', err);
        } finally {
            setLoading(false);
        }
    }

    async function deletePost(postId) {
        if (!window.confirm('¿Seguro que deseas eliminar este post?')) return;
        try {
            await http.delete(`/api/feed/${postId}`);
            setPosts(prev => prev.filter(p => p._id !== postId));
        } catch (err) {
            alert('Error al eliminar post');
        }
    }

    async function togglePostStatus(postId, hidden) {
        try {
            await http.patch(`/api/feed/${postId}`, { hidden: !hidden });
            setPosts(prev => prev.map(p => p._id === postId ? { ...p, hidden: !hidden } : p));
        } catch (err) {
            alert('Error al cambiar estado del post');
        }
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Moderación de Contenido</h1>

            {/* Tabs */}
            <div className="flex mb-6 border-b">
                <button
                    className={`px-4 py-2 ${activeTab === 'posts' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('posts')}
                >
                    Posts ({posts.length})
                </button>
                <button
                    className={`px-4 py-2 ml-4 ${activeTab === 'groups' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                    onClick={() => setActiveTab('groups')}
                >
                    Grupos ({groups.length})
                </button>
            </div>

            {loading ? (
                <p>Cargando contenido...</p>
            ) : (
                <div className="bg-dark-surface dark:bg-light-surface p-6 rounded-2xl">
                    {activeTab === 'posts' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold">Posts del Feed</h3>
                            {posts.length === 0 ? (
                                <p className="text-gray-500">No hay posts para moderar</p>
                            ) : (
                                <div className="space-y-4">
                                    {posts.map(post => (
                                        <div key={post._id} className={`border rounded-lg p-4 ${post.hidden ? 'bg-red-50 border-red-200' : ''}`}>
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="font-semibold">Autor: {post.author}</p>
                                                    <p className="mt-2">{post.content}</p>
                                                    <p className="text-sm text-gray-500 mt-2">
                                                        Likes: {post.likes?.length || 0} | Comentarios: {post.comments?.length || 0}
                                                    </p>
                                                    {post.hidden && <span className="text-red-600 text-sm font-bold">OCULTO</span>}
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <button
                                                        onClick={() => togglePostStatus(post._id, post.hidden)}
                                                        className={`p-2 rounded ${post.hidden ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}
                                                        title={post.hidden ? 'Mostrar post' : 'Ocultar post'}
                                                    >
                                                        {post.hidden ? <CheckCircle size={16} /> : <Flag size={16} />}
                                                    </button>
                                                    <button
                                                        onClick={() => deletePost(post._id)}
                                                        className="p-2 bg-red-100 text-red-600 rounded"
                                                        title="Eliminar post"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'groups' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold">Grupos</h3>
                            {groups.length === 0 ? (
                                <p className="text-gray-500">No hay grupos para moderar</p>
                            ) : (
                                <div className="space-y-4">
                                    {groups.map(group => (
                                        <div key={group.id} className="border rounded-lg p-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex-1">
                                                    <p className="font-semibold">{group.name}</p>
                                                    <p className="text-sm text-gray-600">{group.description}</p>
                                                    <p className="text-sm text-gray-500 mt-2">
                                                        Miembros: {group.memberCount} | Categoría: {group.category} | Tipo: {group.type}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                    <button
                                                        className="p-2 bg-yellow-100 text-yellow-600 rounded"
                                                        title="Moderar grupo"
                                                    >
                                                        <Flag size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
