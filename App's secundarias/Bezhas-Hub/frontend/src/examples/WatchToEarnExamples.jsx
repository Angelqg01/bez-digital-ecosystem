/**
 * @fileoverview Ejemplo de Implementación - Sistema Watch-to-Earn
 * @description Ejemplos prácticos de cómo usar el sistema en diferentes contextos
 */

// ============================================
// EJEMPLO 1: Crear DAO con verificación de saldo BEZ
// ============================================

import React, { useState } from 'react';
import { PremiumFeatureButton, useBezBalance } from '../hooks/useBezBalance';
import { toast } from 'react-hot-toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function CreateDAOExample() {
    const [daoName, setDaoName] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleCreateDAO() {
        if (!daoName) {
            toast.error('Ingresa un nombre para el DAO');
            return;
        }

        setLoading(true);
        try {
            // 1. Deducir BEZ del usuario (implementar endpoint)
            await axios.post(`${API_URL}/bezcoin/deduct`, {
                userId: 'currentUserId',
                amount: 1000,
                reason: 'CREATE_DAO'
            });

            // 2. Crear DAO
            await axios.post(`${API_URL}/daos/create`, {
                name: daoName,
                creator: 'currentUserId'
            });

            toast.success('¡DAO creado exitosamente! -1000 BEZ');
            setDaoName('');
        } catch (error) {
            console.error('Error creating DAO:', error);
            toast.error('Error al crear el DAO');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Crear DAO</h2>

            <input
                type="text"
                value={daoName}
                onChange={(e) => setDaoName(e.target.value)}
                placeholder="Nombre del DAO"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg mb-4"
            />

            <PremiumFeatureButton
                featureName="CREATE_DAO"
                onClick={handleCreateDAO}
                disabled={loading || !daoName}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-xl font-bold transition-all"
            >
                {loading ? 'Creando...' : 'Crear DAO'}
            </PremiumFeatureButton>

            <p className="text-sm text-gray-400 mt-2">
                Requiere 1000 BEZ para crear un DAO
            </p>
        </div>
    );
}

// ============================================
// EJEMPLO 2: Post Destacado
// ============================================

export function FeaturedPostExample({ postId }) {
    const { hasEnough, checkAndProceed } = useBezBalance('FEATURED_POST');

    async function makePostFeatured() {
        try {
            await axios.post(`${API_URL}/posts/${postId}/feature`, {
                userId: 'currentUserId'
            });
            toast.success('¡Post ahora es destacado! -50 BEZ');
        } catch (error) {
            toast.error('Error al destacar post');
        }
    }

    return (
        <button
            onClick={() => checkAndProceed(makePostFeatured)}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition-all flex items-center gap-2"
        >
            ⭐ Destacar Post (50 BEZ)
        </button>
    );
}

// ============================================
// EJEMPLO 3: Mensaje Premium con AdComponent integrado
// ============================================

export function PremiumMessageExample() {
    const [message, setMessage] = useState('');
    const { checkAndProceed } = useBezBalance('PREMIUM_DM');

    async function sendPremiumMessage() {
        try {
            await axios.post(`${API_URL}/messages/premium`, {
                from: 'currentUserId',
                to: 'recipientId',
                content: message,
                cost: 10
            });
            toast.success('¡Mensaje premium enviado! -10 BEZ');
            setMessage('');
        } catch (error) {
            toast.error('Error al enviar mensaje');
        }
    }

    return (
        <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Mensaje Premium</h3>

            <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe tu mensaje premium..."
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg mb-4 h-24 resize-none"
            />

            <button
                onClick={() => checkAndProceed(sendPremiumMessage)}
                disabled={!message}
                className="w-full py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
                Enviar Mensaje Premium (10 BEZ)
            </button>

            <div className="mt-4 text-sm text-gray-400">
                💡 Los mensajes premium tienen prioridad y garantizan entrega inmediata
            </div>
        </div>
    );
}

// ============================================
// EJEMPLO 4: Post con Anuncio Integrado
// ============================================

import AdComponent from '../components/AdComponent';

export function PostWithAdExample({ post }) {
    return (
        <div className="bg-gray-800 rounded-xl p-6 mb-4">
            {/* Contenido del post */}
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-3">
                    <img
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="w-10 h-10 rounded-full"
                    />
                    <div>
                        <div className="font-bold text-white">{post.author.name}</div>
                        <div className="text-sm text-gray-400">{post.timestamp}</div>
                    </div>
                </div>

                <p className="text-white mb-4">{post.content}</p>

                {post.image && (
                    <img
                        src={post.image}
                        alt="Post content"
                        className="w-full rounded-lg mb-4"
                    />
                )}
            </div>

            {/* Anuncio integrado - reparte recompensas entre viewer y creador */}
            <AdComponent
                context={`post:${post.id}`}
                creatorId={post.author.id}
            />

            {/* Acciones del post */}
            <div className="flex items-center gap-4 mt-4">
                <button className="text-gray-400 hover:text-white transition-all">
                    👍 Like
                </button>
                <button className="text-gray-400 hover:text-white transition-all">
                    💬 Comentar
                </button>
                <button className="text-gray-400 hover:text-white transition-all">
                    🔗 Compartir
                </button>
            </div>
        </div>
    );
}

// ============================================
// EJEMPLO 5: Dashboard de Funciones Premium
// ============================================

import { LockedFeatureCard, PREMIUM_FEATURES_COSTS } from '../hooks/useBezBalance';

export function PremiumFeaturesGallery() {
    const features = [
        {
            name: 'CREATE_DAO',
            icon: '🏛️',
            description: 'Crea tu propia Organización Autónoma Descentralizada y gobierna junto a tu comunidad'
        },
        {
            name: 'NFT_MINT',
            icon: '🎨',
            description: 'Mintea tu propio NFT exclusivo en la blockchain de BeZhas'
        },
        {
            name: 'CUSTOM_BADGE',
            icon: '🏅',
            description: 'Diseña y obtén tu badge personalizado único en la plataforma'
        },
        {
            name: 'AD_FREE_MONTH',
            icon: '🚫',
            description: 'Disfruta de un mes completo sin anuncios en toda la plataforma'
        }
    ];

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-3xl font-bold text-white mb-2">Funciones Premium</h1>
            <p className="text-gray-400 mb-8">
                Desbloquea funciones exclusivas con BEZ-Coin. ¿No tienes suficiente? ¡Ve anuncios para ganar!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {features.map(feature => (
                    <LockedFeatureCard
                        key={feature.name}
                        featureName={feature.name}
                        icon={feature.icon}
                        description={feature.description}
                    />
                ))}
            </div>
        </div>
    );
}

// ============================================
// EJEMPLO 6: Integración en HomePage con Watch-to-Earn
// ============================================

export function HomePageWithEarnPrompt() {
    const { currentBalance } = useBezBalance('FEATURED_POST');

    return (
        <div>
            {/* Banner promocional si tiene bajo balance */}
            {currentBalance < 100 && (
                <div className="bg-gradient-to-r from-purple-900 to-pink-900 rounded-xl p-6 mb-6 border-2 border-purple-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2">
                                💰 Gana BEZ-Coin viendo anuncios
                            </h3>
                            <p className="text-purple-200">
                                Necesitas {(100 - currentBalance).toFixed(2)} BEZ más para desbloquear funciones premium
                            </p>
                        </div>
                        <a
                            href="/rewards"
                            className="px-6 py-3 bg-white text-purple-900 rounded-xl font-bold hover:bg-gray-100 transition-all"
                        >
                            Ver Anuncios
                        </a>
                    </div>
                </div>
            )}

            {/* Resto del contenido de la página */}
            {/* ... */}
        </div>
    );
}

// ============================================
// EJEMPLO 7: Sistema de Verificación Manual
// ============================================

export async function manualBezCheck(userId, featureName) {
    try {
        // Obtener balance actual
        const balanceRes = await axios.get(`${API_URL}/bezcoin/balance/${userId}`);
        const currentBalance = balanceRes.data.balance;

        // Obtener costo requerido
        const requiredAmount = PREMIUM_FEATURES_COSTS[featureName];

        if (currentBalance < requiredAmount) {
            // Fondos insuficientes
            toast.error(
                `Necesitas ${requiredAmount} BEZ para esta acción. Tu balance: ${currentBalance} BEZ`,
                { duration: 5000 }
            );
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error checking balance:', error);
        toast.error('Error al verificar balance');
        return false;
    }
}

// Uso:
async function someAction() {
    const canProceed = await manualBezCheck('userId', 'CREATE_DAO');

    if (canProceed) {
        // Proceder con la acción
        await createDAO();
    } else {
        // Mostrar opciones para obtener BEZ
        showEarnOptionsModal();
    }
}
