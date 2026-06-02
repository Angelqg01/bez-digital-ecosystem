// Script simple para publicar posts usando fetch nativo de Node.js
const posts = [
    {
        content: `🔗 **¿Por qué tu próxima transacción cripto será más rápida, barata y segura? La revolución detrás de BeZhas.**

Imagina que la blockchain principal (Ethereum) es una autopista principal. Es segura, pero en horas pico, está atascada y el peaje es caro. Presento a Polygon y a las soluciones de Capa 2 como una serie de carreteras secundarias rápidas y eficientes que alivian ese tráfico.

🧠 **¿Qué son las soluciones de Capa 2 (Layer 2)?**

Las soluciones de Layer 2 son protocolos construidos sobre blockchains de Capa 1 (como Ethereum) para mejorar la escalabilidad y reducir costos.

✅ Más velocidad: Miles de transacciones por segundo
✅ Menores costos: Tarifas de gas significativamente más bajas
✅ Misma seguridad: Hereda la seguridad de Ethereum

#Blockchain #Layer2 #Polygon #ProofOfStake #Web3`,
        privacy: 'public',
        author: '0xBeZhasOfficial',
        validated: true,
        blockchainData: {
            txHash: '0x' + Math.random().toString(16).substr(2, 64),
            blockNumber: 50000000 + Math.floor(Math.random() * 1000000),
            network: 'polygon',
            validationScore: 95
        },
        metadata: {
            title: '¿Por qué tu próxima transacción cripto será más rápida, barata y segura?',
            category: 'technology',
            tags: ['blockchain', 'layer2', 'polygon', 'proof-of-stake', 'web3']
        }
    },
    {
        content: `🚀 **¿Listo para crear, conectar y crecer? BeZhas es tu plataforma**

BeZhas es una red social Web3 que fusiona lo mejor de las redes tradicionales con el poder de la blockchain.

💎 **Funcionalidades clave**

📝 Posts y Contenido - Validación blockchain
💰 Economía de Creadores - Gana BEZ-Coins
🎮 Gamificación - Rangos y misiones
👥 Comunidad - Chat en tiempo real

#BeZhas #SocialNetwork #Web3 #Monetization #Creators`,
        privacy: 'public',
        author: '0xBeZhasOfficial',
        validated: true,
        blockchainData: {
            txHash: '0x' + Math.random().toString(16).substr(2, 64),
            blockNumber: 50000000 + Math.floor(Math.random() * 1000000),
            network: 'polygon',
            validationScore: 98
        },
        metadata: {
            title: '¿Listo para crear, conectar y crecer? BeZhas es tu plataforma',
            category: 'social',
            tags: ['bezhas', 'social-network', 'web3', 'monetization', 'creators']
        }
    },
    {
        content: `💎 **BEZ-Coin y Bezhas: Forjando la Nueva Era de la Economía Creativa en Polygon**

BEZ-Coin es el token nativo de BeZhas, un token ERC-20 en Polygon que impulsa toda la economía de la plataforma.

💰 **Tokenomics de BEZ-Coin**

📊 Suministro Total: 1,000,000,000 BEZ

🎯 **Casos de Uso**

1. Recompensas por Contenido
2. Gobernanza
3. Staking y Farming
4. Marketplace
5. Acceso Premium

🌐 **¿Por qué Polygon?**

✅ Transacciones instantáneas (2-3 segundos)
✅ Costos mínimos ($0.01 - $0.10 por tx)
✅ Seguridad de Ethereum
✅ Sostenibilidad ambiental (PoS)

#BEZCoin #Tokenomics #Polygon #CreatorEconomy #Web3 #Cryptocurrency`,
        privacy: 'public',
        author: '0xBeZhasOfficial',
        validated: true,
        blockchainData: {
            txHash: '0x' + Math.random().toString(16).substr(2, 64),
            blockNumber: 50000000 + Math.floor(Math.random() * 1000000),
            network: 'polygon',
            validationScore: 100
        },
        metadata: {
            title: 'BEZ-Coin y Bezhas: Forjando la Nueva Era de la Economía Creativa en Polygon',
            category: 'finance',
            tags: ['bezcoin', 'tokenomics', 'polygon', 'creator-economy', 'web3', 'cryptocurrency']
        }
    }
];

async function publishPosts() {
    console.log('🚀 Publicando posts de blockchain...\n');

    for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        console.log(`📝 Post ${i + 1}/3: ${post.metadata.title.substring(0, 60)}...`);

        try {
            const response = await fetch('http://localhost:3001/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(post)
            });

            const data = await response.json();

            if (data.success) {
                console.log(`   ✅ Publicado (ID: ${data.post.id}, Score: ${post.blockchainData.validationScore}/100)\n`);
            } else {
                console.log(`   ❌ Error: ${data.error}\n`);
            }
        } catch (error) {
            console.log(`   ❌ Error de red: ${error.message}\n`);
        }
    }

    console.log('✨ Proceso completado!');
}

publishPosts();
