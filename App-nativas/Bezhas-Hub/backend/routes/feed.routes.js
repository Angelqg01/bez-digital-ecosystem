/**
 * Feed Routes - MongoDB Persistent Storage
 * Migrated from in-memory to MongoDB for production use
 */

const express = require('express');
const router = express.Router();
const Post = require('../models/post.model');
const { verifyAdminToken } = require('../middleware/admin.middleware');

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

// Initialize seed data if database is empty
async function initializeSeedData() {
    try {
        const count = await Post.countDocuments();
        if (count === 0) {
            console.log('📝 Feed: No posts found. Seeding initial data...');
            await Post.insertMany(seedPosts);
            console.log(`✅ Feed: ${seedPosts.length} seed posts created.`);
        } else {
            console.log(`✅ Feed: ${count} posts found in database.`);
        }
    } catch (error) {
        console.error('❌ Feed: Error initializing seed data:', error.message);
        // Don't throw - allow routes to function with empty data
    }
}

// Call initialization (non-blocking)
initializeSeedData();

/**
 * GET /api/feed
 * Get all posts (exclude hidden ones for regular users)
 */
router.get('/', async (req, res) => {
    try {
        // Check if request is from admin
        const isAdmin = req.headers.authorization && req.headers.authorization.includes('Bearer');

        // Build query
        const query = isAdmin ? {} : { hidden: { $ne: true } };

        // Fetch posts sorted by pinned (desc) then createdAt (desc)
        const posts = await Post.find(query)
            .sort({ pinned: -1, createdAt: -1 })
            .limit(100)
            .lean();

        res.json(posts);
    } catch (error) {
        console.error('Feed GET error:', error);

        // Fallback to empty array on error
        if (USE_MOCK_FALLBACK) {
            console.warn('⚠️ Using mock fallback for feed');
            res.json(seedPosts);
        } else {
            res.status(500).json({ error: 'Failed to fetch feed', message: error.message });
        }
    }
});

/**
 * POST /api/feed
 * Create a new post
 */
router.post('/', async (req, res) => {
    try {
        const { author, content, image, metadata } = req.body;

        if (!author || !content) {
            return res.status(400).json({ error: 'Missing required fields: author, content' });
        }

        const post = new Post({
            author,
            content,
            image: image || '',
            metadata: metadata || {},
            likes: [],
            comments: [],
            hidden: false,
            pinned: false,
            validated: false,
        });

        await post.save();

        console.log(`📝 New post created by ${author}`);
        res.status(201).json(post);
    } catch (error) {
        console.error('Feed POST error:', error);
        res.status(500).json({ error: 'Failed to create post', message: error.message });
    }
});

/**
 * POST /api/feed/:id/like
 * Like a post
 */
router.post('/:id/like', async (req, res) => {
    try {
        const { author } = req.body;
        const postId = req.params.id;

        if (!author) {
            return res.status(400).json({ error: 'Author is required' });
        }

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Add like if not already liked
        if (!post.likes.includes(author)) {
            post.likes.push(author);
            await post.save();
        }

        res.json(post);
    } catch (error) {
        console.error('Feed LIKE error:', error);
        res.status(500).json({ error: 'Failed to like post', message: error.message });
    }
});

/**
 * POST /api/feed/:id/unlike
 * Unlike a post
 */
router.post('/:id/unlike', async (req, res) => {
    try {
        const { author } = req.body;
        const postId = req.params.id;

        if (!author) {
            return res.status(400).json({ error: 'Author is required' });
        }

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Remove like
        post.likes = post.likes.filter(addr => addr !== author);
        await post.save();

        res.json(post);
    } catch (error) {
        console.error('Feed UNLIKE error:', error);
        res.status(500).json({ error: 'Failed to unlike post', message: error.message });
    }
});

/**
 * POST /api/feed/:id/comment
 * Add a comment to a post
 */
router.post('/:id/comment', async (req, res) => {
    try {
        const { author, content } = req.body;
        const postId = req.params.id;

        if (!author || !content) {
            return res.status(400).json({ error: 'Author and content are required' });
        }

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        post.comments.push({ author, content, createdAt: new Date() });
        await post.save();

        res.json(post);
    } catch (error) {
        console.error('Feed COMMENT error:', error);
        res.status(500).json({ error: 'Failed to add comment', message: error.message });
    }
});

/**
 * PATCH /api/feed/:id
 * Admin: Update post (hide/show, pin/unpin)
 */
router.patch('/:id', verifyAdminToken, async (req, res) => {
    try {
        const { hidden, pinned, validated } = req.body;
        const postId = req.params.id;

        const updateData = { modifiedAt: new Date() };
        if (hidden !== undefined) updateData.hidden = hidden;
        if (pinned !== undefined) updateData.pinned = pinned;
        if (validated !== undefined) updateData.validated = validated;

        const post = await Post.findByIdAndUpdate(postId, updateData, { new: true });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json({ success: true, post });
    } catch (error) {
        console.error('Feed PATCH error:', error);
        res.status(500).json({ error: 'Failed to update post', message: error.message });
    }
});

/**
 * DELETE /api/feed/:id
 * Admin: Delete post
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
    try {
        const postId = req.params.id;
        const result = await Post.findByIdAndDelete(postId);

        if (!result) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
        console.error('Feed DELETE error:', error);
        res.status(500).json({ error: 'Failed to delete post', message: error.message });
    }
});

/**
 * GET /api/feed/user/:address
 * Get posts by a specific user
 */
router.get('/user/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const posts = await Post.find({ author: address, hidden: { $ne: true } })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        res.json(posts);
    } catch (error) {
        console.error('Feed USER error:', error);
        res.status(500).json({ error: 'Failed to fetch user posts', message: error.message });
    }
});

/**
 * GET /api/feed/stats
 * Get feed statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const totalPosts = await Post.countDocuments();
        const validatedPosts = await Post.countDocuments({ validated: true });
        const pinnedPosts = await Post.countDocuments({ pinned: true });

        res.json({
            totalPosts,
            validatedPosts,
            pinnedPosts,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Feed STATS error:', error);
        res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
    }
});

module.exports = router;
