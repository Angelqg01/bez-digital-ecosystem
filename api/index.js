const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bezhas.com', 'https://app.bezhas.com']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limiting for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many sensitive requests, please try again later.',
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// JWT middleware for authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'bezhas-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Wallet signature verification middleware
const verifyWalletSignature = async (req, res, next) => {
  try {
    const { address, signature, message } = req.body;
    
    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'Address, signature, and message required' });
    }

    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    req.walletAddress = address;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Authentication endpoints
app.post('/api/auth/login', [
  body('address').isEthereumAddress().withMessage('Invalid Ethereum address'),
  body('signature').isLength({ min: 1 }).withMessage('Signature required'),
  body('message').isLength({ min: 1 }).withMessage('Message required')
], verifyWalletSignature, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const token = jwt.sign(
    { address: req.walletAddress },
    process.env.JWT_SECRET || 'bezhas-secret-key',
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token,
    address: req.walletAddress
  });
});

app.post('/api/auth/refresh', authenticateToken, (req, res) => {
  const token = jwt.sign(
    { address: req.user.address },
    process.env.JWT_SECRET || 'bezhas-secret-key',
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    token
  });
});

// User profile endpoints
app.get('/api/user/profile/:address', [
  body('address').optional().isEthereumAddress()
], (req, res) => {
  const { address } = req.params;
  
  // Mock user profile data
  res.json({
    address,
    username: `user_${address.substring(2, 8)}`,
    level: Math.floor(Math.random() * 10) + 1,
    experience: Math.floor(Math.random() * 10000),
    totalPoints: Math.floor(Math.random() * 50000),
    achievements: Math.floor(Math.random() * 20),
    nftsOwned: Math.floor(Math.random() * 50),
    tokensStaked: Math.floor(Math.random() * 1000),
    joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
  });
});

app.put('/api/user/profile', authenticateToken, [
  body('username').optional().isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters'),
  body('bio').optional().isLength({ max: 500 }).withMessage('Bio must be less than 500 characters'),
  body('avatar').optional().isURL().withMessage('Avatar must be a valid URL')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Mock profile update
  res.json({
    success: true,
    message: 'Profile updated successfully'
  });
});

// NFT endpoints
app.get('/api/nfts', (req, res) => {
  const { page = 1, limit = 20, category, sortBy = 'created' } = req.query;
  
  // Mock NFT data
  const nfts = Array.from({ length: limit }, (_, i) => ({
    id: (page - 1) * limit + i + 1,
    name: `BeZhas NFT #${(page - 1) * limit + i + 1}`,
    description: 'A unique BeZhas collectible',
    image: `https://api.bezhas.com/nft/image/${(page - 1) * limit + i + 1}`,
    price: (Math.random() * 5 + 0.1).toFixed(3),
    owner: `0x${Math.random().toString(16).substring(2, 42)}`,
    category: category || ['Art', 'Gaming', 'Music', 'Sports'][Math.floor(Math.random() * 4)],
    rarity: ['Common', 'Rare', 'Epic', 'Legendary'][Math.floor(Math.random() * 4)],
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
  }));

  res.json({
    nfts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: 1000,
      pages: Math.ceil(1000 / limit)
    }
  });
});

app.get('/api/nfts/:id', (req, res) => {
  const { id } = req.params;
  
  // Mock NFT details
  res.json({
    id: parseInt(id),
    name: `BeZhas NFT #${id}`,
    description: 'A unique BeZhas collectible with special properties',
    image: `https://api.bezhas.com/nft/image/${id}`,
    animation_url: `https://api.bezhas.com/nft/animation/${id}`,
    price: (Math.random() * 5 + 0.1).toFixed(3),
    owner: `0x${Math.random().toString(16).substring(2, 42)}`,
    creator: `0x${Math.random().toString(16).substring(2, 42)}`,
    category: ['Art', 'Gaming', 'Music', 'Sports'][Math.floor(Math.random() * 4)],
    rarity: ['Common', 'Rare', 'Epic', 'Legendary'][Math.floor(Math.random() * 4)],
    attributes: [
      { trait_type: 'Background', value: 'Blue' },
      { trait_type: 'Eyes', value: 'Laser' },
      { trait_type: 'Mouth', value: 'Smile' }
    ],
    history: [
      {
        event: 'Minted',
        from: null,
        to: `0x${Math.random().toString(16).substring(2, 42)}`,
        price: null,
        timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
  });
});

// Market data endpoints
app.get('/api/market/stats', (req, res) => {
  res.json({
    totalVolume: '12,456.78',
    floorPrice: '0.25',
    totalSupply: 10000,
    owners: 3456,
    listed: 234,
    volume24h: '156.7',
    change24h: '+12.5%'
  });
});

app.get('/api/market/collections', (req, res) => {
  const collections = [
    {
      name: 'BeZhas Genesis',
      floorPrice: '2.45',
      volume24h: '156.7',
      change24h: '+12.5%',
      totalSupply: 1000,
      owners: 789
    },
    {
      name: 'BeZhas Rare',
      floorPrice: '1.89',
      volume24h: '98.4',
      change24h: '+8.2%',
      totalSupply: 5000,
      owners: 3456
    }
  ];

  res.json({ collections });
});

// Analytics endpoints
app.get('/api/analytics/platform', authenticateToken, (req, res) => {
  const { timeRange = '7d' } = req.query;
  
  res.json({
    users: {
      total: 12547,
      active24h: 2341,
      active7d: 8923,
      new24h: 156
    },
    transactions: {
      total: 45678,
      volume: '1,234.56',
      fees: '23.45'
    },
    nfts: {
      total: 10000,
      minted24h: 45,
      traded24h: 123
    }
  });
});

app.get('/api/analytics/user/:address', (req, res) => {
  const { address } = req.params;
  
  res.json({
    address,
    portfolioValue: (Math.random() * 10000 + 1000).toFixed(2),
    totalTransactions: Math.floor(Math.random() * 100) + 10,
    nftsOwned: Math.floor(Math.random() * 50) + 5,
    stakingRewards: (Math.random() * 100).toFixed(2),
    level: Math.floor(Math.random() * 10) + 1,
    achievements: Math.floor(Math.random() * 20) + 5
  });
});

// Gamification endpoints
app.get('/api/gamification/profile/:address', (req, res) => {
  const { address } = req.params;
  
  res.json({
    address,
    level: Math.floor(Math.random() * 10) + 1,
    experience: Math.floor(Math.random() * 10000),
    totalPoints: Math.floor(Math.random() * 50000),
    streakDays: Math.floor(Math.random() * 30),
    achievements: Math.floor(Math.random() * 20),
    rank: Math.floor(Math.random() * 1000) + 1
  });
});

app.get('/api/gamification/leaderboard/:type', (req, res) => {
  const { type } = req.params;
  const { limit = 10 } = req.query;
  
  const leaderboard = Array.from({ length: limit }, (_, i) => ({
    rank: i + 1,
    address: `0x${Math.random().toString(16).substring(2, 42)}`,
    score: Math.floor(Math.random() * 10000) + 1000 - (i * 100),
    username: `user_${Math.random().toString(16).substring(2, 8)}`
  }));

  res.json({
    type,
    leaderboard
  });
});

// Notification endpoints
app.post('/api/notifications/send', strictLimiter, authenticateToken, [
  body('to').isEthereumAddress().withMessage('Invalid recipient address'),
  body('type').isIn(['transaction', 'nft_sold', 'staking_reward', 'message', 'security_alert']).withMessage('Invalid notification type'),
  body('title').isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
  body('message').isLength({ min: 1, max: 500 }).withMessage('Message must be 1-500 characters')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Mock notification sending
  res.json({
    success: true,
    notificationId: Math.random().toString(36).substring(7),
    message: 'Notification sent successfully'
  });
});

// File upload endpoint for IPFS
app.post('/api/upload/ipfs', authenticateToken, (req, res) => {
  // Mock IPFS upload
  const mockHash = `Qm${Math.random().toString(36).substring(2, 47)}`;
  
  res.json({
    success: true,
    ipfsHash: mockHash,
    url: `https://ipfs.io/ipfs/${mockHash}`
  });
});

// Email service endpoints
app.post('/api/email/send', strictLimiter, [
  body('to').isEmail().withMessage('Invalid email address'),
  body('subject').isLength({ min: 1, max: 200 }).withMessage('Subject must be 1-200 characters'),
  body('template').isIn(['welcome', 'verification', 'password_reset', 'transaction_alert']).withMessage('Invalid template'),
  body('data').isObject().withMessage('Template data must be an object')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  // Mock email sending
  res.json({
    success: true,
    messageId: Math.random().toString(36).substring(7),
    message: 'Email sent successfully'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested resource was not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`BeZhas API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
