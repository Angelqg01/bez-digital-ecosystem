const { validationResult } = require('express-validator');

// In-memory storage for profiles (simulating a database)
const profiles = new Map();
const activities = new Map(); // Store activities per user

// Helper to get or create profile
const getOrCreateProfile = (address) => {
    const lowerAddress = address.toLowerCase();
    if (!profiles.has(lowerAddress)) {
        profiles.set(lowerAddress, {
            address: lowerAddress,
            username: `User_${lowerAddress.slice(2, 8)}`,
            bio: 'Este usuario aún no ha añadido una biografía.',
            avatar: `https://ui-avatars.com/api/?name=${lowerAddress.slice(2, 8)}&background=random&size=128`,
            banner: 'https://i.imgur.com/s1Y3aE7.jpeg',
            email: '',
            role: 'user',
            postsCount: 0,
            followersCount: 0,
            followingCount: 0,
            createdAt: new Date().toISOString(),
            socialLinks: {
                twitter: '',
                instagram: '',
                website: ''
            }
        });
    }
    return profiles.get(lowerAddress);
};

exports.getProfile = (req, res) => {
    try {
        const { address } = req.params;
        const profile = getOrCreateProfile(address);
        res.json(profile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
};

exports.updateProfile = (req, res) => {
    try {
        const { address } = req.params;
        const updates = req.body;
        const lowerAddress = address.toLowerCase();

        let profile = getOrCreateProfile(lowerAddress);

        // Update fields
        profile = {
            ...profile,
            ...updates,
            address: lowerAddress, // Prevent address change
            updatedAt: new Date().toISOString()
        };

        profiles.set(lowerAddress, profile);
        res.json(profile);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error al actualizar el perfil' });
    }
};

exports.getActivities = (req, res) => {
    try {
        const { address } = req.params;
        const lowerAddress = address.toLowerCase();

        // Mock activities if none exist
        if (!activities.has(lowerAddress)) {
            activities.set(lowerAddress, [
                {
                    id: 1,
                    type: 'nft_buy',
                    title: 'NFT Comprado',
                    description: 'Compró "Cosmic Cube #42"',
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    icon: 'shopping-cart'
                },
                {
                    id: 2,
                    type: 'nft_list',
                    title: 'NFT Listado',
                    description: 'Listó "Neon Genesis #01" por 500 BEZ',
                    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    icon: 'tag'
                },
                {
                    id: 3,
                    type: 'stake',
                    title: 'Staking Iniciado',
                    description: 'Depositó 1000 BEZ en el Pool de Liquidez',
                    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    icon: 'layers'
                }
            ]);
        }

        res.json(activities.get(lowerAddress));
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Error al obtener actividad' });
    }
};

exports.getUserNFTs = (req, res) => {
    // This endpoint can be used if we want to serve NFTs from backend instead of blockchain directly
    // For now, we'll return a mock list to demonstrate connectivity
    try {
        const mockNFTs = [
            { id: 1, name: 'BeZhas Genesis #1', image: 'https://i.imgur.com/8nLfcVP.png', tokenId: '1', isListed: false },
            { id: 2, name: 'BeZhas Gold #42', image: 'https://i.imgur.com/4x3M6yD.png', tokenId: '42', isListed: true, price: 100 }
        ];
        res.json(mockNFTs);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching NFTs' });
    }
};
