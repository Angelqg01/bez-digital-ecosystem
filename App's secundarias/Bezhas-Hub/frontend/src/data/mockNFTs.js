// Mock NFT data for demonstration when contracts are not deployed
export const mockNFTs = [
    {
        tokenId: '1',
        name: 'Bezhas Genesis #1',
        description: 'El primer NFT de la colección Genesis de Bezhas',
        imageUrl: 'https://images.unsplash.com/photo-1634973357973-f2ed2657db3c?w=400&h=400&fit=crop',
        price: '150',
        seller: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
        attributes: [
            { trait_type: 'Rareza', value: 'Legendario' },
            { trait_type: 'Generación', value: 'Genesis' },
            { trait_type: 'Poder', value: '95' }
        ]
    },
    {
        tokenId: '2',
        name: 'Cosmic Warrior',
        description: 'Un guerrero cósmico de las profundidades del universo',
        imageUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=400&fit=crop',
        price: '85',
        seller: '0x8B8e3864e7c82c3e67b99A6a1e3E2f98D7e8E9fA',
        attributes: [
            { trait_type: 'Rareza', value: 'Épico' },
            { trait_type: 'Clase', value: 'Guerrero' },
            { trait_type: 'Nivel', value: '50' }
        ]
    },
    {
        tokenId: '3',
        name: 'Digital Dreams',
        description: 'Representación abstracta de los sueños digitales',
        imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop',
        price: '120',
        seller: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        attributes: [
            { trait_type: 'Rareza', value: 'Legendario' },
            { trait_type: 'Estilo', value: 'Abstracto' },
            { trait_type: 'Energía', value: '88' }
        ]
    },
    {
        tokenId: '4',
        name: 'Neon Samurai',
        description: 'Samurai del futuro con armadura de neón',
        imageUrl: 'https://images.unsplash.com/photo-1635322966219-b75ed372eb01?w=400&h=400&fit=crop',
        price: '200',
        seller: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        attributes: [
            { trait_type: 'Rareza', value: 'Mítico' },
            { trait_type: 'Clase', value: 'Samurai' },
            { trait_type: 'Poder', value: '99' }
        ]
    },
    {
        tokenId: '5',
        name: 'Cyber Punk Girl',
        description: 'Personaje femenino en un mundo cyberpunk',
        imageUrl: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400&h=400&fit=crop',
        price: '95',
        seller: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
        attributes: [
            { trait_type: 'Rareza', value: 'Épico' },
            { trait_type: 'Estilo', value: 'Cyberpunk' },
            { trait_type: 'Carisma', value: '92' }
        ]
    },
    {
        tokenId: '6',
        name: 'Mystic Portal',
        description: 'Portal místico hacia dimensiones desconocidas',
        imageUrl: 'https://images.unsplash.com/photo-1618172193622-ae2d025f4032?w=400&h=400&fit=crop',
        price: '175',
        seller: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
        attributes: [
            { trait_type: 'Rareza', value: 'Legendario' },
            { trait_type: 'Tipo', value: 'Portal' },
            { trait_type: 'Magia', value: '97' }
        ]
    },
    {
        tokenId: '7',
        name: 'Quantum Reality',
        description: 'Representación visual de la mecánica cuántica',
        imageUrl: 'https://images.unsplash.com/photo-1617791160588-241658c0f566?w=400&h=400&fit=crop',
        price: '110',
        seller: '0x976EA74026E726554dB657fA54763abd0C3a0aa9',
        attributes: [
            { trait_type: 'Rareza', value: 'Épico' },
            { trait_type: 'Concepto', value: 'Cuántico' },
            { trait_type: 'Complejidad', value: '85' }
        ]
    },
    {
        tokenId: '8',
        name: 'Ethereum Explorer',
        description: 'Explorador del universo blockchain',
        imageUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=400&fit=crop',
        price: '140',
        seller: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
        attributes: [
            { trait_type: 'Rareza', value: 'Legendario' },
            { trait_type: 'Blockchain', value: 'Ethereum' },
            { trait_type: 'Exploración', value: '90' }
        ]
    }
];

export const getMockNFTById = (tokenId) => {
    return mockNFTs.find(nft => nft.tokenId === tokenId);
};

export const getMockNFTsByOwner = (ownerAddress) => {
    // In a mock scenario, return a subset of NFTs
    return mockNFTs.slice(0, 3).map(nft => ({
        ...nft,
        owner: ownerAddress
    }));
};

export const getRandomMockNFTs = (count = 4) => {
    const shuffled = [...mockNFTs].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};
