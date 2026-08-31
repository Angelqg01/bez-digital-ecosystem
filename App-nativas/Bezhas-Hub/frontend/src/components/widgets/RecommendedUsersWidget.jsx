import React, { useState, useEffect } from 'react';
import { UserPlus, Check } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function RecommendedUsersWidget() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState({});

    useEffect(() => {
        fetchRecommended();
    }, []);

    const fetchRecommended = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            const response = await axios.get(`${API_URL}/api/social/users/recommended`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setUsers(response.data.data.slice(0, 3)); // Show top 3
            }
        } catch (error) {
            console.error('Error fetching recommended users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async (userId) => {
        try {
            setFollowLoading(prev => ({ ...prev, [userId]: true }));

            const token = localStorage.getItem('token');
            const response = await axios.post(
                `${API_URL}/api/social/users/${userId}/follow`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                const isFollowing = response.data.data.isFollowing;

                setUsers(prev => prev.map(user =>
                    user.id === userId ? { ...user, isFollowing } : user
                ));

                toast.success(isFollowing ? 'Usuario seguido' : 'Dejaste de seguir');
            }
        } catch (error) {
            console.error('Error following user:', error);
            toast.error('Error al seguir usuario');
        } finally {
            setFollowLoading(prev => ({ ...prev, [userId]: false }));
        }
    };

    if (loading) {
        return (
            <div className="rounded-lg bg-gray-800 dark:bg-gray-200 p-4 border border-gray-700 dark:border-gray-300 mb-4">
                <div className="flex items-center gap-2 mb-3">
                    <UserPlus className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-white dark:text-gray-900">Usuarios Sugeridos</h3>
                </div>
                <div className="text-center py-4">
                    <div className="animate-pulse text-gray-500">Cargando...</div>
                </div>
            </div>
        );
    }

    if (users.length === 0) {
        return null; // Don't show widget if no recommendations
    }

    return (
        <div className="rounded-lg bg-gray-800 dark:bg-gray-200 p-4 border border-gray-700 dark:border-gray-300 mb-4">
            <div className="flex items-center gap-2 mb-3">
                <UserPlus className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-white dark:text-gray-900">Usuarios Sugeridos</h3>
            </div>
            <div className="space-y-4">
                {users.map((user) => (
                    <div key={user.id} className="flex items-start gap-3">
                        <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name[0])}&background=random`;
                            }}
                        />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate text-white dark:text-gray-900">
                                {user.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-600 truncate">
                                @{user.username}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {user.followers} seguidores
                            </p>
                        </div>
                        <button
                            onClick={() => handleFollow(user.id)}
                            disabled={followLoading[user.id]}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${user.isFollowing
                                    ? 'bg-gray-700 dark:bg-gray-300 text-white dark:text-gray-900 hover:bg-gray-600 dark:hover:bg-gray-400'
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                } disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1`}
                        >
                            {followLoading[user.id] ? (
                                <span className="animate-pulse">...</span>
                            ) : user.isFollowing ? (
                                <>
                                    <Check className="w-3 h-3" />
                                    Siguiendo
                                </>
                            ) : (
                                <>
                                    <UserPlus className="w-3 h-3" />
                                    Seguir
                                </>
                            )}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
