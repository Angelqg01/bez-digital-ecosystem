import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../lib/api';

/**
 * Hook para obtener posts optimizados del backend
 * Incluye news, organic posts, y metadata de optimización
 */
export const usePosts = (options = {}) => {
    const {
        limit = 50,
        offset = 0,
        author = null,
        validated = null,
        privacy = null,
        autoRefresh = false,
        refreshInterval = 30000 // 30 segundos
    } = options;

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [meta, setMeta] = useState({
        total: 0,
        newsCount: 0,
        organicCount: 0,
        optimizationApplied: false
    });

    const fetchPosts = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Construir query params
            const params = new URLSearchParams();
            params.append('limit', limit);
            params.append('offset', offset);
            if (author) params.append('author', author);
            if (validated !== null) params.append('validated', validated);
            if (privacy) params.append('privacy', privacy);

            const response = await fetch(`${API_BASE}/api/posts?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                setPosts(data.posts || []);
                setMeta(data.meta || {});
                console.log('📰 Posts cargados:', {
                    total: data.posts?.length,
                    meta: data.meta
                });
            } else {
                throw new Error(data.error || 'Error al cargar posts');
            }
        } catch (err) {
            console.error('❌ Error fetching posts:', err);
            setError(err.message);
            // En caso de error, usar array vacío en lugar de fallar
            setPosts([]);
        } finally {
            setLoading(false);
        }
    }, [limit, offset, author, validated, privacy]);

    // Fetch inicial
    useEffect(() => {
        fetchPosts();
    }, [fetchPosts]);

    // Auto-refresh opcional
    useEffect(() => {
        if (!autoRefresh) return;

        const intervalId = setInterval(() => {
            console.log('🔄 Auto-refreshing posts...');
            fetchPosts();
        }, refreshInterval);

        return () => clearInterval(intervalId);
    }, [autoRefresh, refreshInterval, fetchPosts]);

    const refresh = useCallback(() => {
        return fetchPosts();
    }, [fetchPosts]);

    return {
        posts,
        loading,
        error,
        meta,
        refresh
    };
};

/**
 * Hook para obtener estadísticas del News Aggregator
 */
export const useAggregatorStats = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/posts/stats/aggregator`);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                setStats(data.stats);
            } else {
                throw new Error(data.error || 'Error al cargar estadísticas');
            }
        } catch (err) {
            console.error('❌ Error fetching aggregator stats:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return { stats, loading, error, refresh: fetchStats };
};

/**
 * Hook para sugerir hashtags automáticamente
 */
export const useHashtagSuggestions = (content) => {
    const [suggestions, setSuggestions] = useState({ existing: [], suggested: [] });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!content || content.length < 10) {
            setSuggestions({ existing: [], suggested: [] });
            return;
        }

        const debounce = setTimeout(async () => {
            try {
                setLoading(true);
                const response = await fetch(`${API_BASE}/api/posts/suggest-hashtags`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setSuggestions({
                            existing: data.existing || [],
                            suggested: data.suggested || []
                        });
                    }
                }
            } catch (err) {
                console.error('Error suggesting hashtags:', err);
            } finally {
                setLoading(false);
            }
        }, 500); // Debounce de 500ms

        return () => clearTimeout(debounce);
    }, [content]);

    return { suggestions, loading };
};
