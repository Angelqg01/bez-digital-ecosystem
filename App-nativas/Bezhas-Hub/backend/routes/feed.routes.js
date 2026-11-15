/**
 * Feed Routes - PostgreSQL (tabla `posts`, migraciones 005 y 025).
 *
 * Seguridad (corregida al migrar desde Mongo):
 *  - Crear, dar «me gusta» y comentar exigen sesión y el AUTOR sale de la identidad autenticada: antes el autor venía en el cuerpo y
 *    cualquiera podía publicar, comentar o dar like en nombre de otra dirección.
 *  - Los posts ocultos por moderación sólo los ve un administrador REAL: antes bastaba una cabecera `Authorization: Bearer x`.
 */

const express = require('express');
const router = express.Router();
const Post = require('../models/pg/Post');
const { verifyAdminToken } = require('../middleware/admin.middleware');
const isAdminRequest = require('../middleware/isAdminRequest');
const { protect } = require('../middleware/auth.middleware');

/** Identidad pública del autor: su wallet o, si no tiene, su nombre de usuario. */
const autorDe = (req) => req.user.walletAddress || req.user.wallet_address || req.user.username || null;

// Flag to use mock data during development (set to false for production)
const USE_MOCK_FALLBACK = process.env.USE_MOCK_FEED === 'true';

// Seed data for initial posts (only used if DB is empty)
const seedPosts = [
    {
        author: '0xBeZhasOfficial',
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
        likes: [],
        comments: [],
        hidden: false,
        pinned: true,
        validated: true,
        blockchainData: {
            txHash: '0x742d35cc6634c0532925a3b844bc9e7fe6064c32',
            blockNumber: 50123456,
            network: 'polygon',
            validationScore: 95
        },
        metadata: {
            category: 'education',
            tags: ['blockchain', 'layer2', 'polygon', 'web3']
        }
    },
    {
        author: '0xBeZhasOfficial',
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
        likes: [],
        comments: [],
        hidden: false,
        pinned: true,
        validated: true,
        blockchainData: {
            txHash: '0x9a8b7c6d5e4f3g2h1i0j9k8l7m6n5o4p',
            blockNumber: 50234567,
            network: 'polygon',
            validationScore: 98
        },
        metadata: {
            category: 'announcement',
            tags: ['bezhas', 'web3', 'social', 'creators']
        }
    },
    {
        author: '0xBeZhasOfficial',
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

#BEZCoin #Tokenomics #Polygon #Web3`,
        likes: [],
        comments: [],
        hidden: false,
        pinned: true,
        validated: true,
        blockchainData: {
            txHash: '0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p',
            blockNumber: 50345678,
            network: 'polygon',
            validationScore: 100
        },
        metadata: {
            category: 'tokenomics',
            tags: ['bezcoin', 'tokenomics', 'polygon', 'defi']
        }
    }
];

// Siembra inicial (sólo si la tabla está vacía; atómica entre instancias)
async function initializeSeedData() {
    try {
        const creados = await Post.seedIfEmpty(seedPosts);
        if (creados) console.log(`✅ Feed: ${creados} seed posts created.`);
    } catch (error) {
        console.error('❌ Feed: Error initializing seed data:', error.message);
        // No se propaga: las rutas siguen funcionando con datos vacíos
    }
}

// Call initialization (non-blocking)
if (process.env.NODE_ENV !== 'test') initializeSeedData();

/**
 * GET /api/feed
 * Get all posts (exclude hidden ones for regular users)
 */
router.get('/', async (req, res) => {
    try {
        // Administrador REAL (token válido y 2FA): ve también los ocultos.
        const posts = await Post.feed({ includeHidden: isAdminRequest(req), limit: 100 });
        res.json(posts);
    } catch (error) {
        console.error('Feed GET error:', error);

        if (USE_MOCK_FALLBACK) {
            console.warn('⚠️ Using mock fallback for feed');
            res.json(seedPosts);
        } else {
            res.status(500).json({ error: 'Failed to fetch feed' });
        }
    }
});

/**
 * POST /api/feed
 * Create a new post
 */
router.post('/', protect, async (req, res) => {
    try {
        const { content, image, metadata } = req.body;
        const author = autorDe(req);

        if (!author) return res.status(409).json({ error: 'Your account has no wallet or username to publish with' });
        if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Missing required field: content' });
        if (content.length > 10000) return res.status(413).json({ error: 'Post too long (max 10000 characters)' });

        const post = await Post.create({ author, content, image, metadata });

        console.log(`📝 New post created by ${author}`);
        res.status(201).json(post);
    } catch (error) {
        console.error('Feed POST error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

/**
 * POST /api/feed/:id/like
 * Like a post
 */
router.post('/:id/like', protect, async (req, res) => {
    try {
        const post = await Post.like(req.params.id, autorDe(req));
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post);
    } catch (error) {
        console.error('Feed LIKE error:', error);
        res.status(500).json({ error: 'Failed to like post' });
    }
});

/**
 * POST /api/feed/:id/unlike
 * Unlike a post
 */
router.post('/:id/unlike', protect, async (req, res) => {
    try {
        const post = await Post.unlike(req.params.id, autorDe(req));
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post);
    } catch (error) {
        console.error('Feed UNLIKE error:', error);
        res.status(500).json({ error: 'Failed to unlike post' });
    }
});

/**
 * POST /api/feed/:id/comment
 * Add a comment to a post
 */
router.post('/:id/comment', protect, async (req, res) => {
    try {
        const { content } = req.body;
        if (typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: 'Content is required' });
        if (content.length > 2000) return res.status(413).json({ error: 'Comment too long (max 2000 characters)' });

        const post = await Post.addComment(req.params.id, autorDe(req), content);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        res.json(post);
    } catch (error) {
        console.error('Feed COMMENT error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

/**
 * PATCH /api/feed/:id
 * Admin: Update post (hide/show, pin/unpin)
 */
router.patch('/:id', verifyAdminToken, async (req, res) => {
    try {
        const { hidden, pinned, validated } = req.body;
        const post = await Post.moderate(req.params.id, { hidden, pinned, validated });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json({ success: true, post });
    } catch (error) {
        console.error('Feed PATCH error:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

/**
 * DELETE /api/feed/:id
 * Admin: Delete post
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
    try {
        if (!(await Post.remove(req.params.id))) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Feed DELETE error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

/**
 * GET /api/feed/user/:address
 * Get posts by a specific user
 */
router.get('/user/:address', async (req, res) => {
    try {
        res.json(await Post.byAuthor(req.params.address, { limit: 50 }));
    } catch (error) {
        console.error('Feed USER error:', error);
        res.status(500).json({ error: 'Failed to fetch user posts' });
    }
});

/**
 * GET /api/feed/stats
 * Get feed statistics
 */
router.get('/stats', async (req, res) => {
    try {
        res.json({ ...(await Post.stats()), timestamp: new Date() });
    } catch (error) {
        console.error('Feed STATS error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

module.exports = router;
