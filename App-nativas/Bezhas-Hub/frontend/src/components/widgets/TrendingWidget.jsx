import React, { useState, useEffect } from 'react';
import { TrendingUp, Hash } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function TrendingWidget() {
    const [trendingTopics, setTrendingTopics] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrending();

        // Refresh every 2 minutes
        const interval = setInterval(fetchTrending, 120000);

        return () => clearInterval(interval);
    }, []);

    const fetchTrending = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/social/trending/hashtags`);

            if (response.data.success) {
                setTrendingTopics(response.data.data.slice(0, 4));
            }
        } catch (error) {
            console.error('Error fetching trending:', error);
            // Use fallback data
            setTrendingTopics([
                { category: 'BeZhas', topic: '#BeZhas', posts: 156, trending: true },
                { category: 'Crypto', topic: '#BEZToken', posts: 89, trending: true },
                { category: 'Web3', topic: '#Web3Social', posts: 67, trending: true },
                { category: 'Community', topic: '#BeVIP', posts: 45, trending: true }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const formatPosts = (count) => {
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count;
    };

    return (
        <div className="rounded-lg bg-gray-800 dark:bg-gray-200 p-4 border border-gray-700 dark:border-gray-300 mb-4">
            <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <h3 className="font-semibold text-white dark:text-gray-900">Trending</h3>
            </div>
            <div className="space-y-3">
                {loading ? (
                    <div className="text-center py-4">
                        <div className="animate-pulse text-gray-500">Cargando...</div>
                    </div>
                ) : trendingTopics.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-600 text-center py-4">
                        No hay trending topics
                    </p>
                ) : (
                    trendingTopics.map((topic, idx) => (
                        <div
                            key={idx}
                            className="flex items-start justify-between hover:bg-gray-700 dark:hover:bg-gray-300 p-2 rounded cursor-pointer transition-colors"
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-1 text-sm text-gray-400 dark:text-gray-600">
                                    <Hash className="w-3 h-3" />
                                    <span>{topic.category}</span>
                                </div>
                                <p className="font-medium text-sm mt-1 text-white dark:text-gray-900">
                                    {topic.topic}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-600 mt-1">
                                    {formatPosts(topic.posts)} posts
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
