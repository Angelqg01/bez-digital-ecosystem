const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// In-memory storage for groups and communities
let groups = [
    {
        id: 1,
        name: "BeZhas Developers",
        description: "Official group for BeZhas platform developers and contributors",
        type: "public",
        category: "technology",
        memberCount: 150,
        createdBy: "0x1234567890123456789012345678901234567890",
        createdAt: new Date().toISOString(),
        avatar: "🔧",
        isVerified: true,
        rules: [
            "Be respectful to all members",
            "Stay on topic - development related discussions only",
            "No spam or self-promotion without permission"
        ]
    },
    {
        id: 2,
        name: "NFT Creators Hub",
        description: "Community for NFT artists and creators to share, collaborate and grow",
        type: "public",
        category: "art",
        memberCount: 89,
        createdBy: "0x2345678901234567890123456789012345678901",
        createdAt: new Date().toISOString(),
        avatar: "🎨",
        isVerified: false,
        rules: [
            "Original content only",
            "Constructive feedback encouraged",
            "No copyright infringement"
        ]
    },
    {
        id: 3,
        name: "DeFi Trading Signals",
        description: "Private group for sharing trading signals and market analysis",
        type: "private",
        category: "finance",
        memberCount: 45,
        createdBy: "0x3456789012345678901234567890123456789012",
        createdAt: new Date().toISOString(),
        avatar: "📈",
        isVerified: true,
        rules: [
            "No financial advice - signals only",
            "Invite only membership",
            "Respect risk management principles"
        ]
    }
];

let groupMembers = {}; // groupId -> [walletAddress, ...]
let userGroups = {}; // walletAddress -> [groupId, ...]

// Initialize some mock memberships
groupMembers[1] = ['0x1234567890123456789012345678901234567890'];
groupMembers[2] = ['0x2345678901234567890123456789012345678901'];
groupMembers[3] = ['0x3456789012345678901234567890123456789012'];
userGroups['0x1234567890123456789012345678901234567890'] = [1];
userGroups['0x2345678901234567890123456789012345678901'] = [2];
userGroups['0x3456789012345678901234567890123456789012'] = [3];

// Get all public groups or user's groups
router.get('/', (req, res) => {
    const { walletAddress, category, search } = req.query;

    let filteredGroups = groups;

    // If walletAddress provided, return user's groups
    if (walletAddress) {
        const address = walletAddress.toLowerCase();
        const userGroupIds = userGroups[address] || [];
        filteredGroups = groups.filter(group => userGroupIds.includes(group.id));
    } else {
        // Return public groups only
        filteredGroups = groups.filter(group => group.type === 'public');
    }

    // Apply category filter
    if (category) {
        filteredGroups = filteredGroups.filter(group => group.category === category);
    }

    // Apply search filter
    if (search) {
        const searchLower = search.toLowerCase();
        filteredGroups = filteredGroups.filter(group =>
            group.name.toLowerCase().includes(searchLower) ||
            group.description.toLowerCase().includes(searchLower)
        );
    }

    res.json(filteredGroups);
});

// Get group by ID with detailed info
router.get('/:id', (req, res) => {
    const groupId = parseInt(req.params.id);
    const group = groups.find(g => g.id === groupId);

    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }

    const members = groupMembers[groupId] || [];

    res.json({
        ...group,
        members: members.length, // Return count, not addresses for privacy
        recentActivity: [
            { type: 'member_joined', timestamp: new Date().toISOString() },
            { type: 'post_created', timestamp: new Date(Date.now() - 3600000).toISOString() }
        ]
    });
});

// Create a new group
router.post('/',
    [
        body('name').isString().trim().isLength({ min: 3, max: 50 }).withMessage('Name must be 3-50 characters'),
        body('description').isString().trim().isLength({ min: 10, max: 500 }).withMessage('Description must be 10-500 characters'),
        body('type').isIn(['public', 'private']).withMessage('Type must be public or private'),
        body('category').isString().trim().withMessage('Category is required'),
        body('createdBy').isEthereumAddress().withMessage('Invalid creator address'),
        body('avatar').optional().isString().trim(),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description, type, category, createdBy, avatar = "👥" } = req.body;

        // Check if group name already exists
        const existingGroup = groups.find(g => g.name.toLowerCase() === name.toLowerCase());
        if (existingGroup) {
            return res.status(400).json({ error: 'Group name already exists' });
        }

        const newGroup = {
            id: Math.max(...groups.map(g => g.id)) + 1,
            name,
            description,
            type,
            category,
            memberCount: 1,
            createdBy: createdBy.toLowerCase(),
            createdAt: new Date().toISOString(),
            avatar,
            isVerified: false,
            rules: [
                "Be respectful to all members",
                "Stay on topic",
                "Follow community guidelines"
            ]
        };

        groups.push(newGroup);

        // Add creator as first member
        groupMembers[newGroup.id] = [createdBy.toLowerCase()];
        if (!userGroups[createdBy.toLowerCase()]) {
            userGroups[createdBy.toLowerCase()] = [];
        }
        userGroups[createdBy.toLowerCase()].push(newGroup.id);

        res.status(201).json(newGroup);
    });

// Join a group
router.post('/:id/join',
    [
        body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const groupId = parseInt(req.params.id);
        const { walletAddress } = req.body;
        const address = walletAddress.toLowerCase();

        const group = groups.find(g => g.id === groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (group.type === 'private') {
            return res.status(403).json({ error: 'Cannot join private group without invitation' });
        }

        if (!groupMembers[groupId]) {
            groupMembers[groupId] = [];
        }

        if (groupMembers[groupId].includes(address)) {
            return res.status(400).json({ error: 'Already a member of this group' });
        }

        groupMembers[groupId].push(address);
        group.memberCount++;

        if (!userGroups[address]) {
            userGroups[address] = [];
        }
        userGroups[address].push(groupId);

        res.json({ message: 'Successfully joined group', group });
    });

// Leave a group
router.post('/:id/leave',
    [
        body('walletAddress').isEthereumAddress().withMessage('Invalid wallet address'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const groupId = parseInt(req.params.id);
        const { walletAddress } = req.body;
        const address = walletAddress.toLowerCase();

        const group = groups.find(g => g.id === groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }

        if (!groupMembers[groupId] || !groupMembers[groupId].includes(address)) {
            return res.status(400).json({ error: 'Not a member of this group' });
        }

        // Cannot leave if you're the creator and there are other members
        if (group.createdBy === address && group.memberCount > 1) {
            return res.status(400).json({
                error: 'Cannot leave group as creator. Transfer ownership first.'
            });
        }

        groupMembers[groupId] = groupMembers[groupId].filter(member => member !== address);
        group.memberCount--;

        if (userGroups[address]) {
            userGroups[address] = userGroups[address].filter(id => id !== groupId);
        }

        res.json({ message: 'Successfully left group' });
    });

// Get group categories
router.get('/meta/categories', (req, res) => {
    const categories = [
        { id: 'technology', name: 'Technology', icon: '💻' },
        { id: 'art', name: 'Art & Design', icon: '🎨' },
        { id: 'finance', name: 'Finance & DeFi', icon: '💰' },
        { id: 'gaming', name: 'Gaming', icon: '🎮' },
        { id: 'education', name: 'Education', icon: '📚' },
        { id: 'lifestyle', name: 'Lifestyle', icon: '🌟' },
        { id: 'music', name: 'Music', icon: '🎵' },
        { id: 'sports', name: 'Sports', icon: '⚽' },
        { id: 'general', name: 'General', icon: '💬' }
    ];

    res.json(categories);
});

module.exports = router;