const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const newsAggregator = require('../services/news-aggregator.service');
const feedOptimizer = require('../services/feed-optimizer.service');
const UnifiedAI = require('../services/unified-ai.service');

// Almacenamiento temporal en memoria (en producción usar MongoDB/PostgreSQL)
let posts = [];
let postIdCounter = 1;

// Manual trigger route
router.post('/fetch-news', async (req, res) => {
    await updateNews();
    res.json({ success: true, message: 'News fetch triggered' });
});

// Posts de demostración de blockchain (se cargan al iniciar)
function initializeDemoPosts() {
    const demoPosts = [
        {
            id: postIdCounter++,
            content: `🔗 **¿Por qué tu próxima transacción cripto será más rápida, barata y segura?**

Imagina que Ethereum es una autopista principal. Polygon y las soluciones Layer 2 son carreteras rápidas y eficientes.

🧠 **Layer 2** procesa transacciones fuera de la cadena principal:
✅ Más velocidad: Miles de tx/segundo
✅ Menores costos: Tarifas ultra bajas
✅ Misma seguridad de Ethereum

💡 **BeZhas + Polygon**:
- Transacciones en 2-3 segundos
- Costos de $0.01-$0.10
- Eco-friendly (PoS)

#Blockchain #Layer2 #Polygon #Web3`,
            privacy: 'public',
            author: '0xBeZhasOfficial',
            timestamp: Date.now() - 3600000,
            validated: true,
            pinned: true,
            blockchainData: {
                txHash: '0x742d35cc6634c0532925a3b844bc9e7fe6064c32',
                blockNumber: 50123456,
                network: 'polygon',
                validationScore: 95
            },
            validationScore: 95,
            metadata: {
                title: 'Transacciones cripto más rápidas y baratas',
                category: 'technology',
                tags: ['blockchain', 'layer2', 'polygon', 'web3']
            },
            title: 'Transacciones cripto más rápidas y baratas',
            tags: ['blockchain', 'layer2', 'polygon', 'web3'],
            category: 'technology',
            likes: 142,
            comments: 28,
            shares: 15,
            reactions: { total: 142, types: [{ emoji: '🔥', count: 80 }, { emoji: '👍', count: 42 }] },
            createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: postIdCounter++,
            content: `🚀 **BeZhas: Crea, Conecta y Crece**

Red social Web3 que fusiona redes tradicionales con blockchain.

✅ **Crea** y sé dueño de tu contenido (NFTs)
✅ **Monetiza** con BEZ-Coins
✅ **Conecta** con comunidades globales
✅ **Participa** en economía creativa

💎 **Funcionalidades**:
📝 Posts validados por blockchain
💰 Economía de creadores
🎮 Gamificación con rangos
👥 Chat en tiempo real

#BeZhas #Web3 #SocialNetwork #Creators`,
            privacy: 'public',
            author: '0xBeZhasOfficial',
            timestamp: Date.now() - 7200000,
            validated: true,
            pinned: true,
            blockchainData: {
                txHash: '0x9a8b7c6d5e4f3g2h1i0j9k8l7m6n5o4p',
                blockNumber: 50234567,
                network: 'polygon',
                validationScore: 98
            },
            validationScore: 98,
            metadata: {
                title: 'BeZhas: Tu plataforma Web3',
                category: 'social',
                tags: ['bezhas', 'web3', 'monetization']
            },
            title: 'BeZhas: Tu plataforma Web3',
            tags: ['bezhas', 'web3', 'monetization'],
            category: 'social',
            likes: 287,
            comments: 53,
            shares: 31,
            reactions: { total: 287, types: [{ emoji: '❤️', count: 150 }, { emoji: '🚀', count: 87 }] },
            createdAt: new Date(Date.now() - 7200000).toISOString()
        },
        {
            id: postIdCounter++,
            content: `💎 **BEZ-Coin: La Nueva Era de la Economía Creativa**

Token ERC-20 en Polygon que impulsa la economía de BeZhas.

📊 **Supply**: 1,000,000,000 BEZ
- 30% Recompensas Comunidad
- 25% Staking/Farming
- 20% Desarrollo

🎯 **Casos de Uso**:
1. Recompensas por contenido
2. Gobernanza de plataforma
3. Staking y farming
4. Marketplace NFTs
5. Acceso premium

🔥 **Deflacionario**:
- 1% quemado por transacción
- Buyback activo
- Staking reduce supply

📈 **Roadmap 2025**:
Q1 ✅ Lanzamiento
Q2 🔄 DEX listing
Q3-Q4 📅 CEX + DAO

#BEZCoin #Tokenomics #Polygon #Web3`,
            privacy: 'public',
            author: '0xBeZhasOfficial',
            timestamp: Date.now() - 10800000,
            validated: true,
            pinned: true,
            blockchainData: {
                txHash: '0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p',
                blockNumber: 50345678,
                network: 'polygon',
                validationScore: 100
            },
            validationScore: 100,
            metadata: {
                title: 'BEZ-Coin: Economía Creativa en Polygon',
                category: 'finance',
                tags: ['bezcoin', 'tokenomics', 'polygon', 'web3']
            },
            title: 'BEZ-Coin: Economía Creativa en Polygon',
            tags: ['bezcoin', 'tokenomics', 'polygon', 'web3'],
            category: 'finance',
            likes: 423,
            comments: 87,
            shares: 64,
            reactions: { total: 423, types: [{ emoji: '💎', count: 200 }, { emoji: '🚀', count: 150 }] },
            createdAt: new Date(Date.now() - 10800000).toISOString()
        },
        {
            id: postIdCounter++,
            content: `🔬 **Descubierta la "Ley del Crecimiento Universal" en organismos vivos**

Científicos japoneses del Instituto ELSI han identificado una ley matemática universal que describe cómo crecen casi todos los organismos vivos—desde bacterias hasta ballenas azules.

📊 **El Descubrimiento:**
• Ley de crecimiento sigmoidal de 3 parámetros
• Aplica a >1000 especies diferentes
• Bacterias, plantas, peces, mamíferos, aves

🧬 **Implicaciones:**
✅ **Medicina**: Predecir crecimiento tumoral y desarrollo fetal
✅ **Agricultura**: Optimizar producción de cultivos
✅ **Acuicultura**: Mejorar crecimiento de peces de granja
✅ **Ganadería**: Maximizar producción de carne/leche

💡 **Aplicación Práctica:**
"Esta ley puede ayudar a predecir el crecimiento en agricultura y medicina", señala el líder del estudio.

🌱 **Impacto Global:**
Prima Agrotech ya está usando esta ley para optimizar su tecnología AgriTech, mejorando cultivos hidropónicos y monitoreando salud de plantas en tiempo real.

🔗 **Fuente:** ScienceDaily | ELSI | Prima Agrotech

Publicado hace 12 horas

#Ciencia #Biología #Agricultura #Innovación #AgriTech`,
            privacy: 'public',
            author: '0xBeZhasSci',
            timestamp: Date.now() - 43200000,
            validated: true,
            pinned: false,
            blockchainData: {
                txHash: '0x9z8y7x6w5v4u3t2s1r0q9p8o7n6m5l4k',
                blockNumber: 50456789,
                network: 'polygon',
                validationScore: 97
            },
            validationScore: 97,
            metadata: {
                title: 'Ley del Crecimiento Universal en organismos',
                category: 'science',
                tags: ['ciencia', 'biología', 'agricultura', 'investigación', 'agritech'],
                externalLinks: [
                    'https://primaagrotech.com',
                    'https://sciencedaily.com',
                    'https://elsi.jp'
                ]
            },
            title: 'Ley del Crecimiento Universal en organismos',
            tags: ['ciencia', 'biología', 'agricultura', 'investigación', 'agritech'],
            category: 'science',
            likes: 89,
            comments: 23,
            shares: 12,
            reactions: { total: 89, types: [{ emoji: '🔬', count: 45 }, { emoji: '🌱', count: 30 }] },
            createdAt: new Date(Date.now() - 43200000).toISOString()
        },
        {
            id: postIdCounter++,
            content: `🌊 **Islandia declara el colapso de la corriente atlántica como una amenaza de seguridad**

Islandia ha designado el potencial colapso de la Circulación Meridional de Retorno del Atlántico (AMOC) como una preocupación de seguridad nacional y una amenaza existencial—marcando la primera vez que un evento climático específico ha sido presentado formalmente ante el consejo de seguridad de una nación.​

❄️ **La Amenaza:**
La AMOC transporta agua cálida desde las regiones tropicales hacia el norte. Su colapso podría:
• Desencadenar una era de hielo moderna en el norte de Europa
• Traer inviernos drásticamente más fríos
• Aumentar nevadas e hielo marino
• Interrumpir transporte marítimo
• Impactar agricultura y pesca

🔴 **Declaración del Gobierno:**
"Representa un desafío directo para nuestra resiliencia y seguridad nacional", dijo Johann Pall Johannsson, Ministro de Clima de Islandia.​

🔬 **Consenso Científico Creciente:**
• Octubre 2024: 44 científicos de 15 países advirtieron que "el riesgo ha sido muy subestimado"
• Podría ocurrir en las próximas décadas
• Stefan Rahmstorf: "El punto de inflexión puede ser inminente"

🌍 **Impacto Global:**
• Desestabilizar patrones de lluvia en África, India y América del Sur
• Acelerar calentamiento en la Antártida
• Afectar agricultores de subsistencia mundialmente

📋 **Respuesta Regional:**
• 🇮🇸 Islandia: Amenaza de seguridad nacional
• 🇮🇪 Irlanda: Informó al primer ministro
• 🇳🇴 Noruega: Mejorando investigación
• 🇬🇧 Reino Unido: £81 millones para investigación

🔗 **Fuentes:** cnn.com | vice.com

Publicado hace 5 horas

#CambioClimático #AMOC #SeguridadNacional #Islandia #CrisisClimática`,
            privacy: 'public',
            author: '0xBeZhasClimate',
            timestamp: Date.now() - 18000000,
            validated: true,
            pinned: false,
            blockchainData: {
                txHash: '0x3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r',
                blockNumber: 50567890,
                network: 'polygon',
                validationScore: 99
            },
            validationScore: 99,
            metadata: {
                title: 'Islandia declara colapso AMOC como amenaza de seguridad',
                category: 'climate',
                tags: ['cambio-climático', 'AMOC', 'seguridad-nacional', 'islandia', 'oceanografía'],
                externalLinks: [
                    'https://cnn.com',
                    'https://vice.com'
                ]
            },
            title: 'Islandia declara colapso AMOC como amenaza de seguridad',
            tags: ['cambio-climático', 'AMOC', 'seguridad-nacional', 'islandia', 'oceanografía'],
            category: 'climate',
            likes: 234,
            comments: 56,
            shares: 45,
            reactions: { total: 234, types: [{ emoji: '🌊', count: 100 }, { emoji: '⚠️', count: 90 }] },
            createdAt: new Date(Date.now() - 18000000).toISOString()
        }
    ];

    posts = [...demoPosts, ...posts];
    console.log(`✅ ${demoPosts.length} posts de blockchain inicializados (pinned y validados)`);
}

// Inicializar posts al cargar el módulo
initializeDemoPosts();

/**
 * GET /api/posts
 * Obtiene todos los posts o filtra por parámetros
 */
router.get('/', (req, res) => {
    try {
        const { author, validated, privacy, limit = 50, offset = 0 } = req.query;

        // Obtener noticias del agregador
        const newsPosts = newsAggregator.getCachedNews();

        // Preparar contenido para optimización
        const contentToOptimize = {
            news: newsPosts,
            organic: posts,
            ads: [], // Aquí se pueden agregar posts promocionados
            nfts: [], // Posts de NFT marketplace
            reels: [] // Posts de video corto
        };

        // Aplicar optimización inteligente del feed
        let optimizedFeed = feedOptimizer.optimize(contentToOptimize);

        // Enriquecer con auto-tagging usando UnifiedAI (TODO: hacer asíncrono correctamente)
        // Para evitar errores, el tagging se hará bajo demanda en el endpoint /api/posts/hashtag-suggestions
        // for (let post of optimizedFeed) {
        //     if (post.content && !post.hashtags) {
        //         const tagResult = await UnifiedAI.process('TAGGING', { content: post.content });
        //         post.hashtags = tagResult.tags || [];
        //     }
        // }

        // Filtrar por autor
        if (author) {
            optimizedFeed = optimizedFeed.filter(p => {
                const postAuthor = p.author?.username || p.author || '';
                return postAuthor.toLowerCase().includes(author.toLowerCase());
            });
        }

        // Filtrar por validación blockchain
        if (validated !== undefined) {
            const isValidated = validated === 'true';
            optimizedFeed = optimizedFeed.filter(p => p.validated === isValidated);
        }

        // Filtrar por privacidad
        if (privacy) {
            optimizedFeed = optimizedFeed.filter(p => p.privacy === privacy);
        }

        // Ordenar: primero posts pinned, luego por engagement
        optimizedFeed.sort((a, b) => {
            // Primero ordenar por pinned (pinned primero)
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            // Luego por engagement score si disponible
            if (a.engagementScore && b.engagementScore) {
                return b.engagementScore - a.engagementScore;
            }
            // Fallback a timestamp descendente
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
        });

        // Paginación
        const paginatedPosts = optimizedFeed.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        res.json({
            success: true,
            posts: paginatedPosts,
            total: optimizedFeed.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            meta: {
                newsCount: newsPosts.length,
                organicCount: posts.length,
                optimizationApplied: true
            }
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Error al obtener posts' });
    }
});

/**
 * GET /api/posts/:id
 * Obtiene un post específico por ID
 */
router.get('/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const post = posts.find(p => p.id === postId);

        if (!post) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }

        res.json({ success: true, post });
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ error: 'Error al obtener el post' });
    }
});

/**
 * POST /api/posts
 * Crea un nuevo post
 */
router.post('/', (req, res) => {
    try {
        const { content, privacy, location, media, author, validated, blockchainData, metadata } = req.body;

        if (!content && (!media || media.length === 0)) {
            return res.status(400).json({ error: 'El post debe tener contenido o archivos multimedia' });
        }

        if (!author) {
            return res.status(400).json({ error: 'Se requiere la dirección del autor' });
        }

        const newPost = {
            id: postIdCounter++,
            content: content || '',
            privacy: privacy || 'public',
            location: location || null,
            media: media || [],
            author,
            timestamp: Date.now(),
            validated: validated || false,
            blockchainData: blockchainData || null,
            validationScore: blockchainData?.validationScore || 0,
            metadata: metadata || {},
            title: metadata?.title || '',
            tags: metadata?.tags || [],
            category: metadata?.category || 'general',
            likes: 0,
            comments: 0,
            shares: 0,
            reactions: {
                total: 0,
                types: []
            },
            createdAt: new Date().toISOString()
        };

        posts.push(newPost);

        res.status(201).json({
            success: true,
            post: newPost,
            message: 'Post creado exitosamente'
        });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Error al crear el post' });
    }
});

/**
 * PUT /api/posts/:id
 * Actualiza un post existente
 */
router.put('/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const postIndex = posts.findIndex(p => p.id === postId);

        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }

        const { content, privacy, location } = req.body;

        // Actualizar campos permitidos
        if (content !== undefined) posts[postIndex].content = content;
        if (privacy !== undefined) posts[postIndex].privacy = privacy;
        if (location !== undefined) posts[postIndex].location = location;

        posts[postIndex].updatedAt = new Date().toISOString();

        res.json({
            success: true,
            post: posts[postIndex],
            message: 'Post actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ error: 'Error al actualizar el post' });
    }
});

/**
 * DELETE /api/posts/:id
 * Elimina un post
 */
router.delete('/:id', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const postIndex = posts.findIndex(p => p.id === postId);

        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }

        const deletedPost = posts.splice(postIndex, 1)[0];

        res.json({
            success: true,
            post: deletedPost,
            message: 'Post eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ error: 'Error al eliminar el post' });
    }
});

/**
 * POST /api/posts/:id/like
 * Da like a un post
 */
router.post('/:id/like', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const { reaction } = req.body; // emoji de reacción
        const postIndex = posts.findIndex(p => p.id === postId);

        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }

        posts[postIndex].likes += 1;
        posts[postIndex].reactions.total += 1;

        // Agregar o actualizar reacción
        if (reaction) {
            const reactionIndex = posts[postIndex].reactions.types.findIndex(r => r.emoji === reaction);
            if (reactionIndex !== -1) {
                posts[postIndex].reactions.types[reactionIndex].count += 1;
            } else {
                posts[postIndex].reactions.types.push({ emoji: reaction, count: 1 });
            }
        }

        res.json({
            success: true,
            post: posts[postIndex],
            message: 'Like agregado'
        });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ error: 'Error al dar like' });
    }
});

/**
 * POST /api/posts/:id/validate
 * Actualiza el estado de validación blockchain de un post
 */
router.post('/:id/validate', (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const { blockchainData } = req.body;
        const postIndex = posts.findIndex(p => p.id === postId);

        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post no encontrado' });
        }

        posts[postIndex].validated = true;
        posts[postIndex].blockchainData = blockchainData;
        posts[postIndex].validatedAt = new Date().toISOString();

        res.json({
            success: true,
            post: posts[postIndex],
            message: 'Post validado en blockchain'
        });
    } catch (error) {
        console.error('Error validating post:', error);
        res.status(500).json({ error: 'Error al validar el post' });
    }
});

/**
 * POST /api/posts/bulk
 * Crear múltiples posts a la vez (para Admin)
 */
router.post('/bulk', (req, res) => {
    try {
        const { posts: newPosts } = req.body;

        if (!Array.isArray(newPosts) || newPosts.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de posts' });
        }

        const createdPosts = [];

        for (const postData of newPosts) {
            const newPost = {
                id: postIdCounter++,
                ...postData,
                timestamp: postData.timestamp || Date.now(),
                likes: 0,
                comments: 0,
                shares: 0,
                reactions: {
                    total: 0,
                    types: []
                },
                createdAt: new Date().toISOString()
            };

            posts.push(newPost);
            createdPosts.push(newPost);
        }

        res.status(201).json({
            success: true,
            posts: createdPosts,
            count: createdPosts.length,
            message: `${createdPosts.length} posts creados exitosamente`
        });
    } catch (error) {
        console.error('Error creating bulk posts:', error);
        res.status(500).json({ error: 'Error al crear posts en lote' });
    }
});

/**
 * POST /api/posts/sample-blockchain
 * Crear los 3 posts de ejemplo sobre blockchain (para Admin)
 */
router.post('/sample-blockchain', (req, res) => {
    try {
        const { posts: samplePosts } = require('../create-sample-posts');

        const createdPosts = [];

        for (const postData of samplePosts) {
            const newPost = {
                id: postIdCounter++,
                title: postData.title,
                content: postData.content,
                author: postData.author,
                authorId: postData.authorId,
                category: postData.category,
                tags: postData.tags,
                isValidated: postData.isValidated,
                validated: postData.isValidated,
                validationScore: postData.validationScore,
                timestamp: postData.timestamp,
                blockchainData: {
                    validated: true,
                    score: postData.validationScore,
                    validatedAt: new Date().toISOString()
                },
                privacy: 'public',
                media: [],
                likes: 0,
                comments: 0,
                shares: 0,
                reactions: {
                    total: 0,
                    types: []
                },
                createdAt: new Date().toISOString()
            };

            posts.push(newPost);
            createdPosts.push(newPost);
        }

        res.status(201).json({
            success: true,
            posts: createdPosts,
            count: createdPosts.length,
            message: `✅ ${createdPosts.length} posts de blockchain creados y validados`
        });
    } catch (error) {
        console.error('Error creating sample blockchain posts:', error);
        res.status(500).json({ error: 'Error al crear posts de ejemplo' });
    }
});

/**
 * POST /api/posts/suggest-hashtags
 * Sugiere hashtags automáticos para un contenido
 */
router.post('/suggest-hashtags', async (req, res) => {
    try {
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                error: 'Se requiere contenido para sugerir hashtags'
            });
        }

        const tagResult = await UnifiedAI.process('TAGGING', { content });
        const suggestions = {
            hashtags: tagResult.tags || [],
            confidence: tagResult.confidence || 0.8
        };

        res.json({
            success: true,
            ...suggestions
        });
    } catch (error) {
        console.error('Error suggesting hashtags:', error);
        res.status(500).json({ error: 'Error al sugerir hashtags' });
    }
});

/**
 * GET /api/posts/stats/aggregator
 * Obtiene estadísticas del agregador de noticias
 */
router.get('/stats/aggregator', (req, res) => {
    try {
        const stats = newsAggregator.getStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error fetching aggregator stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;
