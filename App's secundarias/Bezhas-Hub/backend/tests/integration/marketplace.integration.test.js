/**
 * Marketplace Integration Tests
 * Tests for NFT marketplace functionality
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test_jwt_secret_key_for_testing_only';

describe('Marketplace API Integration', () => {
    let app;
    let server;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Mock data store
        const listings = new Map();
        let listingIdCounter = 1;

        // Auth middleware
        const authMiddleware = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'No token provided' });
            }
            try {
                const token = authHeader.replace('Bearer ', '');
                req.user = jwt.verify(token, JWT_SECRET);
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        };

        // Optional auth middleware
        const optionalAuth = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (authHeader) {
                try {
                    const token = authHeader.replace('Bearer ', '');
                    req.user = jwt.verify(token, JWT_SECRET);
                } catch (e) {
                    // Ignore invalid token for public routes
                }
            }
            next();
        };

        // Get marketplace listings
        app.get('/api/marketplace/listings', optionalAuth, (req, res) => {
            const { category, minPrice, maxPrice, sort } = req.query;

            let items = Array.from(listings.values());

            // Filter by category
            if (category) {
                items = items.filter(i => i.category === category);
            }

            // Filter by price
            if (minPrice) {
                items = items.filter(i => i.price >= parseFloat(minPrice));
            }
            if (maxPrice) {
                items = items.filter(i => i.price <= parseFloat(maxPrice));
            }

            // Sort
            if (sort === 'price_asc') {
                items.sort((a, b) => a.price - b.price);
            } else if (sort === 'price_desc') {
                items.sort((a, b) => b.price - a.price);
            } else {
                items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }

            res.json({
                success: true,
                listings: items,
                total: items.length,
                page: 1,
                pageSize: 20
            });
        });

        // Create listing
        app.post('/api/marketplace/listings', authMiddleware, (req, res) => {
            const { name, description, price, category, tokenId, contractAddress } = req.body;

            if (!name || !price) {
                return res.status(400).json({ error: 'name and price are required' });
            }

            if (price <= 0) {
                return res.status(400).json({ error: 'price must be positive' });
            }

            const listing = {
                id: `listing_${listingIdCounter++}`,
                name,
                description,
                price: parseFloat(price),
                category: category || 'general',
                tokenId,
                contractAddress,
                sellerId: req.user.userId,
                sellerAddress: req.user.walletAddress,
                status: 'active',
                createdAt: new Date().toISOString()
            };

            listings.set(listing.id, listing);

            res.status(201).json({
                success: true,
                listing
            });
        });

        // Get single listing
        app.get('/api/marketplace/listings/:id', optionalAuth, (req, res) => {
            const listing = listings.get(req.params.id);

            if (!listing) {
                return res.status(404).json({ error: 'Listing not found' });
            }

            res.json({
                success: true,
                listing
            });
        });

        // Update listing
        app.put('/api/marketplace/listings/:id', authMiddleware, (req, res) => {
            const listing = listings.get(req.params.id);

            if (!listing) {
                return res.status(404).json({ error: 'Listing not found' });
            }

            if (listing.sellerId !== req.user.userId) {
                return res.status(403).json({ error: 'Not authorized to update this listing' });
            }

            const { name, description, price, category } = req.body;

            if (name) listing.name = name;
            if (description) listing.description = description;
            if (price && price > 0) listing.price = parseFloat(price);
            if (category) listing.category = category;

            listing.updatedAt = new Date().toISOString();

            listings.set(listing.id, listing);

            res.json({
                success: true,
                listing
            });
        });

        // Delete listing
        app.delete('/api/marketplace/listings/:id', authMiddleware, (req, res) => {
            const listing = listings.get(req.params.id);

            if (!listing) {
                return res.status(404).json({ error: 'Listing not found' });
            }

            if (listing.sellerId !== req.user.userId && req.user.role !== 'admin') {
                return res.status(403).json({ error: 'Not authorized to delete this listing' });
            }

            listings.delete(req.params.id);

            res.json({
                success: true,
                message: 'Listing deleted successfully'
            });
        });

        // Purchase/Buy listing
        app.post('/api/marketplace/listings/:id/buy', authMiddleware, (req, res) => {
            const listing = listings.get(req.params.id);

            if (!listing) {
                return res.status(404).json({ error: 'Listing not found' });
            }

            if (listing.status !== 'active') {
                return res.status(400).json({ error: 'Listing is not available for purchase' });
            }

            if (listing.sellerId === req.user.userId) {
                return res.status(400).json({ error: 'Cannot buy your own listing' });
            }

            // Mark as sold
            listing.status = 'sold';
            listing.buyerId = req.user.userId;
            listing.soldAt = new Date().toISOString();
            listings.set(listing.id, listing);

            res.json({
                success: true,
                message: 'Purchase successful',
                transactionId: `tx_${Date.now()}`,
                listing
            });
        });

        // Get user's listings
        app.get('/api/marketplace/my-listings', authMiddleware, (req, res) => {
            const userListings = Array.from(listings.values())
                .filter(l => l.sellerId === req.user.userId);

            res.json({
                success: true,
                listings: userListings,
                total: userListings.length
            });
        });

        // Get user's purchases
        app.get('/api/marketplace/my-purchases', authMiddleware, (req, res) => {
            const purchases = Array.from(listings.values())
                .filter(l => l.buyerId === req.user.userId);

            res.json({
                success: true,
                purchases,
                total: purchases.length
            });
        });

        server = app.listen(0);
    });

    afterAll(() => {
        if (server) {
            server.close();
        }
    });

    const createToken = (payload = {}) => {
        return jwt.sign(
            {
                userId: 'user123',
                role: 'user',
                walletAddress: '0x1234567890123456789012345678901234567890',
                ...payload
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
    };

    describe('GET /api/marketplace/listings', () => {
        it('should return empty listings initially', async () => {
            const res = await request(app)
                .get('/api/marketplace/listings')
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('listings');
            expect(Array.isArray(res.body.listings)).toBe(true);
        });

        it('should be accessible without authentication', async () => {
            await request(app)
                .get('/api/marketplace/listings')
                .expect(200);
        });
    });

    describe('POST /api/marketplace/listings', () => {
        it('should create a listing', async () => {
            const token = createToken();

            const res = await request(app)
                .post('/api/marketplace/listings')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: 'Test NFT',
                    description: 'A test NFT listing',
                    price: 100,
                    category: 'art'
                })
                .expect(201);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('listing');
            expect(res.body.listing.name).toBe('Test NFT');
            expect(res.body.listing.price).toBe(100);
        });

        it('should require authentication', async () => {
            await request(app)
                .post('/api/marketplace/listings')
                .send({ name: 'Test', price: 100 })
                .expect(401);
        });

        it('should validate required fields', async () => {
            const token = createToken();

            await request(app)
                .post('/api/marketplace/listings')
                .set('Authorization', `Bearer ${token}`)
                .send({})
                .expect(400);
        });

        it('should validate positive price', async () => {
            const token = createToken();

            await request(app)
                .post('/api/marketplace/listings')
                .set('Authorization', `Bearer ${token}`)
                .send({ name: 'Test', price: -10 })
                .expect(400);
        });
    });

    describe('GET /api/marketplace/listings/:id', () => {
        it('should return 404 for non-existent listing', async () => {
            await request(app)
                .get('/api/marketplace/listings/non_existent')
                .expect(404);
        });
    });

    describe('PUT /api/marketplace/listings/:id', () => {
        it('should require authentication', async () => {
            await request(app)
                .put('/api/marketplace/listings/listing_1')
                .send({ price: 200 })
                .expect(401);
        });
    });

    describe('DELETE /api/marketplace/listings/:id', () => {
        it('should require authentication', async () => {
            await request(app)
                .delete('/api/marketplace/listings/listing_1')
                .expect(401);
        });
    });

    describe('GET /api/marketplace/my-listings', () => {
        it('should return user listings', async () => {
            const token = createToken();

            const res = await request(app)
                .get('/api/marketplace/my-listings')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('listings');
        });
    });

    describe('GET /api/marketplace/my-purchases', () => {
        it('should return user purchases', async () => {
            const token = createToken();

            const res = await request(app)
                .get('/api/marketplace/my-purchases')
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('purchases');
        });
    });
});
