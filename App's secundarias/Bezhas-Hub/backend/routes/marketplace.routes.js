const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// In-memory storage for marketplace listings
let listings = [];
let listingIdCounter = 1;

// In-memory storage for products pending review
let pendingProducts = [];
let productIdCounter = 1;

// ============================================
// PRODUCT REVIEW ENDPOINTS (Admin)
// ============================================

// Submit product for admin review
router.post('/products/submit-review', (req, res) => {
    const productData = req.body;

    const product = {
        id: productIdCounter++,
        ...productData,
        status: 'pending_review',
        submittedAt: new Date().toISOString(),
    };

    pendingProducts.push(product);

    console.log(`✅ Nuevo producto enviado para revisión (ID: ${product.id})`);

    res.status(201).json({
        success: true,
        message: 'Producto enviado para revisión del administrador',
        productId: product.id,
        product
    });
});

// Get all pending products (Admin only)
router.get('/products/pending', (req, res) => {
    const pending = pendingProducts.filter(p => p.status === 'pending_review');
    res.json(pending);
});

// Approve product (Admin only)
router.post('/products/:id/approve', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = pendingProducts.find(p => p.id === productId);

    if (!product) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }

    product.status = 'approved';
    product.approvedAt = new Date().toISOString();

    res.json({
        success: true,
        message: 'Producto aprobado exitosamente',
        product
    });
});

// Reject product (Admin only)
router.post('/products/:id/reject',
    [
        body('reason').notEmpty().withMessage('Se requiere una razón para el rechazo'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const productId = parseInt(req.params.id);
        const { reason } = req.body;
        const product = pendingProducts.find(p => p.id === productId);

        if (!product) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }

        product.status = 'rejected';
        product.rejectedAt = new Date().toISOString();
        product.rejectionReason = reason;

        res.json({
            success: true,
            message: 'Producto rechazado',
            product
        });
    });

// ============================================
// NFT MARKETPLACE ENDPOINTS (Original)
// ============================================

// Get all active listings
router.get('/listings', (req, res) => {
    const activeListings = listings.filter(listing => listing.isActive);
    res.json(activeListings);
});

// Create a new listing
router.post('/listings',
    [
        body('nftContract').isEthereumAddress().withMessage('Invalid NFT contract address'),
        body('tokenId').isNumeric().withMessage('Token ID must be numeric'),
        body('seller').isEthereumAddress().withMessage('Invalid seller address'),
        body('price').isNumeric().withMessage('Price must be numeric'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { nftContract, tokenId, seller, price } = req.body;

        const listing = {
            listingId: listingIdCounter++,
            nftContract,
            tokenId: parseInt(tokenId),
            seller,
            price: parseFloat(price),
            isActive: true,
            createdAt: new Date().toISOString(),
        };

        listings.push(listing);
        res.status(201).json(listing);
    });

// Buy a listing
router.post('/listings/:id/buy',
    [
        body('buyer').isEthereumAddress().withMessage('Invalid buyer address'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const listingId = parseInt(req.params.id);
        const { buyer } = req.body;

        const listing = listings.find(l => l.listingId === listingId);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (!listing.isActive) {
            return res.status(400).json({ error: 'Listing is not active' });
        }

        // Mark as sold
        listing.isActive = false;
        listing.buyer = buyer;
        listing.soldAt = new Date().toISOString();

        res.json({ message: 'Listing purchased successfully', listing });
    });

// Cancel a listing
router.delete('/listings/:id',
    [
        body('seller').isEthereumAddress().withMessage('Invalid seller address'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const listingId = parseInt(req.params.id);
        const { seller } = req.body;

        const listing = listings.find(l => l.listingId === listingId);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (listing.seller.toLowerCase() !== seller.toLowerCase()) {
            return res.status(403).json({ error: 'Only the seller can cancel this listing' });
        }

        listing.isActive = false;
        listing.cancelledAt = new Date().toISOString();

        res.json({ message: 'Listing cancelled successfully' });
    });

// ============================================
// BEZ-COIN PAYMENT ENDPOINTS (Marketplace)
// ============================================

// In-memory storage for payments
let payments = [];
let paymentIdCounter = 1;

// Create BEZ-Coin payment for marketplace purchase
router.post('/listings/:id/pay-with-bez',
    [
        body('buyer').isEthereumAddress().withMessage('Invalid buyer address'),
        body('bezAmount').isNumeric().withMessage('BEZ amount must be numeric'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const listingId = parseInt(req.params.id);
        const { buyer, bezAmount } = req.body;

        const listing = listings.find(l => l.listingId === listingId);
        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (!listing.isActive) {
            return res.status(400).json({ error: 'Listing is not active' });
        }

        const payment = {
            paymentId: paymentIdCounter++,
            listingId,
            buyer,
            seller: listing.seller,
            bezAmount: parseFloat(bezAmount),
            status: 'pending',
            paymentType: 'BEZ_COIN',
            createdAt: new Date().toISOString(),
            // Contract de BEZ-Coin oficial
            bezContract: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
            instructions: {
                message: 'Envía la cantidad de BEZ indicada al contrato del marketplace',
                network: 'Polygon',
                chainId: 137
            }
        };

        payments.push(payment);

        res.status(201).json({
            success: true,
            message: 'Pago con BEZ-Coin iniciado',
            payment
        });
    });

// Confirm BEZ-Coin payment after on-chain verification
router.post('/payments/:paymentId/confirm',
    [
        body('txHash').notEmpty().withMessage('Transaction hash is required'),
        body('blockNumber').isNumeric().withMessage('Block number must be numeric'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const paymentId = parseInt(req.params.paymentId);
        const { txHash, blockNumber } = req.body;

        const payment = payments.find(p => p.paymentId === paymentId);
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        // Update payment status
        payment.status = 'confirmed';
        payment.txHash = txHash;
        payment.blockNumber = parseInt(blockNumber);
        payment.confirmedAt = new Date().toISOString();

        // Mark listing as sold
        const listing = listings.find(l => l.listingId === payment.listingId);
        if (listing) {
            listing.isActive = false;
            listing.buyer = payment.buyer;
            listing.soldAt = new Date().toISOString();
            listing.paymentMethod = 'BEZ_COIN';
            listing.txHash = txHash;
        }

        res.json({
            success: true,
            message: 'Pago confirmado exitosamente',
            payment,
            listing
        });
    });

// Get payment history for a user
router.get('/payments/:address', (req, res) => {
    const address = req.params.address.toLowerCase();
    const userPayments = payments.filter(
        p => p.buyer.toLowerCase() === address || p.seller.toLowerCase() === address
    );
    res.json({
        success: true,
        payments: userPayments,
        count: userPayments.length
    });
});

// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', (req, res) => {
    res.json({
        success: true,
        service: 'Marketplace API',
        endpoints: {
            products: [
                'POST /products/submit-review',
                'GET /products/pending',
                'POST /products/:id/approve',
                'POST /products/:id/reject'
            ],
            listings: [
                'GET /listings',
                'POST /listings',
                'POST /listings/:id/buy',
                'DELETE /listings/:id',
                'POST /listings/:id/pay-with-bez'
            ],
            payments: [
                'POST /payments/:paymentId/confirm',
                'GET /payments/:address'
            ]
        },
        bezContract: '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;