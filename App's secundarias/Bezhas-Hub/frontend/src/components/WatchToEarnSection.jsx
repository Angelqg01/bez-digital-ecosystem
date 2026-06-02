/**
 * @fileoverview Watch-to-Earn Component
 * @description Componente dedicado para ganar BEZ-Coin viendo anuncios
 */

import React, { useState, useEffect } from 'react';
import { Play, Clock, TrendingUp, Gift, Zap, Info } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const WatchToEarnSection = () => {
    const [stats, setStats] = useState({
        todayEarnings: { bez: 0, eur: 0 },
        totalEarned: { bez: 0, eur: 0 },
        adsWatched: 0,
        availableAds: 0
    });
    const [bezPrice, setBezPrice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [adPlaying, setAdPlaying] = useState(false);
    const [adData, setAdData] = useState(null);
    const [countdown, setCountdown] = useState(0);

    // Mock user ID (en producción, obtener del contexto de autenticación)
    const currentUserId = '0x1234567890abcdef1234567890abcdef12345678';

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        // Countdown timer para anuncios
        if (countdown > 0 && adPlaying) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && adPlaying) {
            completeAdView();
        }
    }, [countdown, adPlaying]);

    async function loadInitialData() {
        try {
            // Obtener precio actual de BEZ/EUR
            const priceRes = await axios.get(`${API_URL}/ad-rewards/price`);
            setBezPrice(priceRes.data.data.bezEurPrice);

            // Obtener estadísticas del usuario
            const statsRes = await axios.get(`${API_URL}/ad-rewards/stats/${currentUserId}`);
            setStats({
                todayEarnings: statsRes.data.data.todayEarnings,
                totalEarned: {
                    bez: statsRes.data.data.totalBezEarned,
                    eur: statsRes.data.data.totalEurEquivalent
                },
                adsWatched: statsRes.data.data.adsWatched,
                availableAds: 50 - statsRes.data.data.adsWatched // Máximo 50 por día
            });

        } catch (error) {
            console.error('Error loading data:', error);
            // Usar datos mock en caso de error
            setBezPrice(0.05);
            setStats({
                todayEarnings: { bez: 12.5, eur: 0.625 },
                totalEarned: { bez: 125.50, eur: 6.275 },
                adsWatched: 8,
                availableAds: 42
            });
        }
    }

    async function startRewardedAd() {
        if (adPlaying) return;

        setLoading(true);

        try {
            // En producción, aquí se cargaría el anuncio real de Google AdMob
            // Por ahora, simulamos el anuncio

            // Generar ID único para el evento del anuncio
            const adEventId = `ad_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            setAdData({
                type: 'admob_rewarded',
                eventId: adEventId,
                duration: 15, // 15 segundos
                reward: {
                    bez: 2.0, // 0.10 EUR * 40% / 0.05 EUR/BEZ
                    eur: 0.04  // 0.10 EUR * 40% (user share)
                }
            });

            setAdPlaying(true);
            setCountdown(15); // 15 segundos de anuncio
            setLoading(false);

            toast.success('¡Anuncio iniciado! Mira hasta el final para recibir tu recompensa.');

        } catch (error) {
            console.error('Error starting ad:', error);
            toast.error('Error al cargar el anuncio. Intenta nuevamente.');
            setLoading(false);
        }
    }

    async function completeAdView() {
        if (!adData) return;

        try {
            // 1. Verificar la visualización completa
            const verifyRes = await axios.post(`${API_URL}/ad-rewards/verify-ad-view`, {
                adEventId: adData.eventId,
                duration: adData.duration,
                completed: true
            });

            if (!verifyRes.data.data.eligibleForReward) {
                toast.error('El anuncio no se completó correctamente.');
                resetAdState();
                return;
            }

            // 2. Reclamar la recompensa
            const claimRes = await axios.post(`${API_URL}/ad-rewards/claim`, {
                userId: currentUserId,
                adType: 'admob_rewarded',
                eventType: 'rewarded_view',
                context: 'watch-to-earn',
                adEventId: adData.eventId
            });

            if (claimRes.data.success) {
                const reward = claimRes.data.data.rewardClaimed.viewer;

                toast.success(
                    `¡Recompensa reclamada! +${reward.amountBez.toFixed(2)} BEZ (${reward.amountEur.toFixed(4)} EUR)`,
                    { duration: 5000 }
                );

                // Actualizar estadísticas
                setStats(prev => ({
                    todayEarnings: {
                        bez: prev.todayEarnings.bez + reward.amountBez,
                        eur: prev.todayEarnings.eur + reward.amountEur
                    },
                    totalEarned: {
                        bez: prev.totalEarned.bez + reward.amountBez,
                        eur: prev.totalEarned.eur + reward.amountEur
                    },
                    adsWatched: prev.adsWatched + 1,
                    availableAds: prev.availableAds - 1
                }));
            }

        } catch (error) {
            console.error('Error claiming reward:', error);
            toast.error('Error al reclamar la recompensa. Intenta nuevamente.');
        } finally {
            resetAdState();
        }
    }

    function resetAdState() {
        setAdPlaying(false);
        setAdData(null);
        setCountdown(0);
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 mb-6 text-white">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-3xl font-bold mb-2">Watch-to-Earn</h1>
                        <p className="text-purple-100">Gana BEZ-Coin viendo anuncios</p>
                    </div>
                    <Gift size={48} className="text-yellow-300" />
                </div>

                {/* Precio actual */}
                {bezPrice && (
                    <div className="bg-white/10 rounded-lg p-3 inline-block">
                        <div className="text-sm text-purple-100">Precio BEZ/EUR</div>
                        <div className="text-xl font-bold">{bezPrice.toFixed(4)} EUR</div>
                    </div>
                )}
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">Hoy</span>
                        <TrendingUp size={20} className="text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">
                        {stats.todayEarnings.bez.toFixed(2)} BEZ
                    </div>
                    <div className="text-sm text-gray-400">
                        ≈ {stats.todayEarnings.eur.toFixed(4)} EUR
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">Total Ganado</span>
                        <Zap size={20} className="text-yellow-400" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">
                        {stats.totalEarned.bez.toFixed(2)} BEZ
                    </div>
                    <div className="text-sm text-gray-400">
                        ≈ {stats.totalEarned.eur.toFixed(4)} EUR
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400">Anuncios Disponibles</span>
                        <Clock size={20} className="text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">
                        {stats.availableAds}
                    </div>
                    <div className="text-sm text-gray-400">
                        {stats.adsWatched} vistos hoy
                    </div>
                </div>
            </div>

            {/* Área del anuncio */}
            <div className="bg-gray-800 rounded-2xl p-8 mb-6">
                {!adPlaying ? (
                    <div className="text-center">
                        <div className="mb-6">
                            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mx-auto flex items-center justify-center mb-4">
                                <Play size={48} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                ¿Listo para ganar?
                            </h2>
                            <p className="text-gray-400 mb-6">
                                Mira un anuncio de 15 segundos y recibe BEZ-Coin instantáneamente
                            </p>
                        </div>

                        <button
                            onClick={startRewardedAd}
                            disabled={loading || stats.availableAds === 0}
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
                        >
                            {loading ? 'Cargando...' : stats.availableAds === 0 ? 'Sin anuncios disponibles hoy' : 'Ver Anuncio Recompensado'}
                        </button>

                        {stats.availableAds > 0 && (
                            <div className="mt-4 text-sm text-gray-400">
                                Recompensa estimada: ~2.0 BEZ (0.04 EUR)
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center">
                        {/* Simulación de anuncio */}
                        <div className="bg-gray-900 rounded-xl p-8 mb-6">
                            <div className="mb-4">
                                <div className="text-6xl mb-4">📺</div>
                                <div className="text-xl text-gray-400 mb-2">Anuncio en reproducción...</div>
                                <div className="text-sm text-gray-500">
                                    En producción, aquí se mostraría el anuncio de Google AdMob
                                </div>
                            </div>
                        </div>

                        {/* Countdown */}
                        <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl p-6 mb-4">
                            <div className="text-4xl font-bold text-white mb-2">{countdown}s</div>
                            <div className="text-gray-400">Mira hasta el final para recibir tu recompensa</div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-1000"
                                style={{ width: `${((adData.duration - countdown) / adData.duration) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Información adicional */}
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-6">
                <div className="flex items-start gap-3">
                    <Info size={24} className="text-blue-400 flex-shrink-0 mt-1" />
                    <div className="text-sm text-gray-300">
                        <strong className="text-white">¿Cómo funciona?</strong>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                            <li>Cada anuncio recompensado dura aproximadamente 15 segundos</li>
                            <li>Recibes el 40% del ingreso del anuncio en BEZ-Coin</li>
                            <li>Las recompensas se calculan en EUR y se convierten a BEZ en tiempo real</li>
                            <li>Puedes ver hasta 50 anuncios por día</li>
                            <li>Las recompensas se acreditan instantáneamente en tu wallet</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WatchToEarnSection;
