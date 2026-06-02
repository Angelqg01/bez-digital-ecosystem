import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ActiveUsersWidget() {
    const [activeUsers, setActiveUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchActiveUsers();

        // Refresh every 30 seconds
        const interval = setInterval(fetchActiveUsers, 30000);

        return () => clearInterval(interval);
    }, []);

    const fetchActiveUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }

            const response = await axios.get(`${API_URL}/api/social/users/active`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setActiveUsers(response.data.data.slice(0, 4)); // Show top 4
            }
        } catch (error) {
            console.error('Error fetching active users:', error);
            // Fallback to mock data
            setActiveUsers([
                {
                    name: 'Usuario BeZhas',
                    avatar: 'https://ui-avatars.com/api/?name=B&background=random',
                    status: 'En línea',
                    online: true
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="rounded-lg bg-gray-800 dark:bg-gray-200 p-4 border border-gray-700 dark:border-gray-300 mb-4">
            <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold text-white dark:text-gray-900">Contactos Activos</h3>
                {!loading && (
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-600">
                        {activeUsers.length} online
                    </span>
                )}
            </div>
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-4">
                        <div className="animate-pulse text-gray-500">Cargando...</div>
                    </div>
                ) : activeUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-600 text-center py-4">
                        No hay usuarios activos
                    </p>
                ) : (
                    activeUsers.map((user, idx) => (
                        <div
                            key={user.id || idx}
                            className="flex items-center gap-3 hover:bg-gray-700 dark:hover:bg-gray-300 p-2 rounded cursor-pointer transition-colors"
                        >
                            <div className="relative">
                                <img
                                    src={user.avatar}
                                    alt={user.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                    onError={(e) => {
                                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name[0])}&background=random`;
                                    }}
                                />
                                {user.online && (
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 dark:border-gray-200 rounded-full"></div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate text-white dark:text-gray-900">
                                    {user.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-600 truncate">
                                    {user.status}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
