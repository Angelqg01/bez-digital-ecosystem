import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share, Send } from 'lucide-react';
import axios from 'axios';
import DonateButton from './DonateButton';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function SimpleFeed() {
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Mock user for demo
    const currentUser = '0x1234567890abcdef1234567890abcdef12345678';

    useEffect(() => {
        fetchPosts();
    }, []);

    async function fetchPosts() {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/feed`);
            setPosts(response.data || []);
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            setLoading(false);
        }
    }

    async function createPost() {
        if (!newPost.trim()) return;

        setSubmitting(true);
        try {
            const response = await axios.post(`${API_URL}/feed`, {
                author: currentUser,
                content: newPost
            });

            setPosts(prev => [response.data, ...prev]);
            setNewPost('');
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Error al crear el post');
        } finally {
            setSubmitting(false);
        }
    }

    async function likePost(postId) {
        try {
            await axios.post(`${API_URL}/feed/${postId}/like`, {
                author: currentUser
            });

            // Update post in state
            setPosts(prev => prev.map(post =>
                post._id === postId
                    ? {
                        ...post,
                        likes: post.likes.includes(currentUser)
                            ? post.likes
                            : [...post.likes, currentUser]
                    }
                    : post
            ));
        } catch (error) {
            console.error('Error liking post:', error);
        }
    }

    async function addComment(postId, comment) {
        if (!comment.trim()) return;

        try {
            await axios.post(`${API_URL}/feed/${postId}/comment`, {
                author: currentUser,
                content: comment
            });

            // Update post in state
            setPosts(prev => prev.map(post =>
                post._id === postId
                    ? {
                        ...post,
                        comments: [...post.comments, { author: currentUser, content: comment }]
                    }
                    : post
            ));
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatAddress = (address) => {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
            {/* Create Post */}
            <div className="bg-dark-surface dark:bg-light-surface p-6 rounded-2xl">
                <h2 className="text-lg font-semibold mb-4">¿Qué está pasando?</h2>
                <textarea
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    placeholder="Comparte algo con la comunidad..."
                    className="w-full p-3 border rounded-lg resize-none bg-dark-bg dark:bg-light-bg"
                    rows={3}
                />
                <div className="flex justify-end mt-3">
                    <button
                        onClick={createPost}
                        disabled={!newPost.trim() || submitting}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        <Send size={16} />
                        {submitting ? 'Publicando...' : 'Publicar'}
                    </button>
                </div>
            </div>

            {/* Posts Feed */}
            {loading ? (
                <div className="text-center py-8">
                    <p className="text-dark-text-muted dark:text-light-text-muted">Cargando posts...</p>
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-dark-text-muted dark:text-light-text-muted">
                        No hay posts aún. ¡Sé el primero en publicar!
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <PostCard
                            key={post._id}
                            post={post}
                            currentUser={currentUser}
                            onLike={likePost}
                            onComment={addComment}
                            formatDate={formatDate}
                            formatAddress={formatAddress}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PostCard({ post, currentUser, onLike, onComment, formatDate, formatAddress }) {
    const [showComments, setShowComments] = useState(false);
    const [commentText, setCommentText] = useState('');

    const hasLiked = post.likes?.includes(currentUser);
    const isOwner = post.author === currentUser;

    const handleAddComment = () => {
        if (commentText.trim()) {
            onComment(post._id, commentText);
            setCommentText('');
        }
    };

    return (
        <div className="bg-dark-surface dark:bg-light-surface p-6 rounded-2xl">
            {/* Post Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    {formatAddress(post.author).slice(0, 2)}
                </div>
                <div>
                    <p className="font-semibold">
                        {formatAddress(post.author)}
                        {isOwner && <span className="text-blue-600 text-xs ml-2">(Tú)</span>}
                    </p>
                    <p className="text-sm text-dark-text-muted dark:text-light-text-muted">
                        {formatDate(post.createdAt)}
                    </p>
                </div>
            </div>

            {/* Post Content */}
            <div className="mb-4">
                <p className="text-dark-text dark:text-light-text">{post.content}</p>
            </div>

            {/* Post Actions */}
            <div className="flex items-center gap-4 pb-4 border-b border-dark-border dark:border-light-border">
                <button
                    onClick={() => onLike(post._id)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-lg transition ${hasLiked
                        ? 'bg-red-100 text-red-600'
                        : 'hover:bg-gray-100 text-gray-600'
                        }`}
                >
                    <Heart size={16} fill={hasLiked ? 'currentColor' : 'none'} />
                    <span>{post.likes?.length || 0}</span>
                </button>

                <button
                    onClick={() => setShowComments(!showComments)}
                    className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                    <MessageCircle size={16} />
                    <span>{post.comments?.length || 0}</span>
                </button>

                <button className="flex items-center gap-2 px-3 py-1 rounded-lg hover:bg-gray-100 text-gray-600">
                    <Share size={16} />
                    <span>Compartir</span>
                </button>

                {/* BEZ-Coin Donate Button */}
                <div className="ml-auto">
                    <DonateButton
                        recipientAddress={post.author}
                        recipientName={formatAddress(post.author)}
                        postId={post._id}
                        size="md"
                    />
                </div>
            </div>

            {/* Comments Section */}
            {showComments && (
                <div className="mt-4 space-y-3">
                    {/* Add Comment */}
                    <div className="flex gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {formatAddress(currentUser).slice(0, 2)}
                        </div>
                        <div className="flex-1">
                            <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Escribe un comentario..."
                                className="w-full p-2 border rounded-lg text-sm bg-dark-bg dark:bg-light-bg"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddComment();
                                    }
                                }}
                            />
                        </div>
                        <button
                            onClick={handleAddComment}
                            disabled={!commentText.trim()}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm"
                        >
                            <Send size={14} />
                        </button>
                    </div>

                    {/* Comments List */}
                    {post.comments?.map((comment, index) => (
                        <div key={index} className="flex gap-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                {formatAddress(comment.author).slice(0, 2)}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium">{formatAddress(comment.author)}</p>
                                <p className="text-sm text-dark-text-muted dark:text-light-text-muted">{comment.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}