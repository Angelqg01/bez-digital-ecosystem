# Script para publicar los 3 posts de blockchain

$API_URL = "http://localhost:3001/api/posts"

$posts = @(
    @{
        content        = @"
🔗 **¿Por qué tu próxima transacción cripto será más rápida, barata y segura? La revolución detrás de BeZhas.**

Imagina que la blockchain principal (Ethereum) es una autopista principal. Es segura, pero en horas pico, está atascada y el peaje es caro. Presento a Polygon y a las soluciones de Capa 2 como una serie de carreteras secundarias rápidas y eficientes que alivian ese tráfico.

**🧠 ¿Qué son las soluciones de Capa 2 (Layer 2)?**

Las soluciones de Layer 2 son protocolos construidos sobre blockchains de Capa 1 (como Ethereum) para mejorar la escalabilidad y reducir costos. Procesan transacciones fuera de la cadena principal (off-chain) y luego registran el resultado final en la cadena principal (on-chain). Esto logra:

✅ **Más velocidad**: Miles de transacciones por segundo
✅ **Menores costos**: Tarifas de gas significativamente más bajas
✅ **Misma seguridad**: Hereda la seguridad de Ethereum

**🌐 Polygon (Matic): El líder de Layer 2**

Polygon es una solución de escalado para Ethereum que utiliza Proof-of-Stake (PoS). Es como tener una ciudad satélite conectada a la metrópolis principal:

- **Sidechains**: Cadenas laterales que funcionan en paralelo a Ethereum
- **Plasma Chains**: Procesamiento masivo de transacciones fuera de Ethereum
- **ZK-Rollups**: Compresión de miles de transacciones en una sola

**💡 ¿Por qué BeZhas eligió Polygon?**

1. **Transacciones ultrarrápidas**: 2-3 segundos vs 15-30 segundos en Ethereum
2. **Costos mínimos**: $0.01 - $0.10 por transacción vs $5 - $50 en Ethereum
3. **Eco-friendly**: Proof-of-Stake consume 99.9% menos energía que Proof-of-Work
4. **Compatibilidad total con Ethereum**: Mismas herramientas y wallets

#Blockchain #Layer2 #Polygon #ProofOfStake #Web3
"@
        privacy        = "public"
        author         = "0xBeZhasOfficial"
        validated      = $true
        blockchainData = @{
            txHash          = "0x" + (1..64 | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) }) -join ''
            blockNumber     = Get-Random -Minimum 50000000 -Maximum 60000000
            network         = "polygon"
            validationScore = 95
        }
        metadata       = @{
            title    = "¿Por qué tu próxima transacción cripto será más rápida, barata y segura?"
            category = "technology"
            tags     = @("blockchain", "layer2", "polygon", "proof-of-stake", "web3")
            summary  = "Explica cómo Polygon y las soluciones Layer 2 hacen que BeZhas sea rápido, barato y seguro"
        }
    },
    @{
        content        = @"
🚀 **¿Listo para crear, conectar y crecer? BeZhas es tu plataforma**

**🌟 ¿Qué es BeZhas?**

BeZhas es una red social Web3 que fusiona lo mejor de las redes tradicionales con el poder de la blockchain. Aquí puedes:

✅ **Crear contenido y ser dueño de él**: Tus posts, fotos y videos te pertenecen gracias a NFTs
✅ **Monetizar tu creatividad**: Gana BEZ-Coins por tu contenido de calidad
✅ **Conectar con comunidades globales**: Chats, grupos, foros y eventos
✅ **Participar en la economía creativa**: Staking, marketplace, donaciones P2P

**💎 Funcionalidades clave**

📝 **Posts y Contenido**
- Publica texto, imágenes, videos y audio
- Validación blockchain de autenticidad
- Sistema de reacciones y comentarios
- Privacidad configurable (público, amigos, privado)

💰 **Economía de Creadores**
- Gana BEZ-Coins por contenido de calidad
- Sistema de donaciones entre usuarios
- Marketplace de NFTs
- Staking y farming de tokens

🎮 **Gamificación**
- Sistema de rangos y insignias
- Misiones diarias y semanales
- Logros y recompensas
- Leaderboards globales

👥 **Comunidad**
- Chat en tiempo real (usuarios, grupos, empresas, IA)
- Foros temáticos
- Grupos y comunidades
- Eventos virtuales y presenciales

#BeZhas #SocialNetwork #Web3 #Monetization #Creators
"@
        privacy        = "public"
        author         = "0xBeZhasOfficial"
        validated      = $true
        blockchainData = @{
            txHash          = "0x" + (1..64 | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) }) -join ''
            blockNumber     = Get-Random -Minimum 50000000 -Maximum 60000000
            network         = "polygon"
            validationScore = 98
        }
        metadata       = @{
            title    = "¿Listo para crear, conectar y crecer? BeZhas es tu plataforma"
            category = "social"
            tags     = @("bezhas", "social-network", "web3", "monetization", "creators")
            summary  = "Descripción completa de BeZhas como red social Web3"
        }
    },
    @{
        content        = @"
💎 **BEZ-Coin y Bezhas: Forjando la Nueva Era de la Economía Creativa en Polygon**

**🪙 ¿Qué es BEZ-Coin?**

BEZ-Coin es el token nativo de BeZhas, un token ERC-20 en Polygon que impulsa toda la economía de la plataforma. Piensa en él como la moneda oficial de un país digital donde la creatividad es la industria principal.

**💰 Tokenomics de BEZ-Coin**

📊 **Suministro Total**: 1,000,000,000 BEZ
📈 **Distribución Inicial**:
- 30% - Recompensas de Comunidad (300M BEZ)
- 25% - Staking y Farming (250M BEZ)
- 20% - Desarrollo del Ecosistema (200M BEZ)
- 15% - Equipo y Asesores (150M BEZ) - Vesting de 4 años
- 10% - Marketing y Partnerships (100M BEZ)

**🎯 Casos de Uso**

1. **Recompensas por Contenido**
   - Gana BEZ por crear posts de calidad
   - Sistema de votación comunitaria
   - Algoritmo de validación blockchain

2. **Gobernanza**
   - Vota en propuestas de la plataforma
   - Poder de voto proporcional a tokens en staking
   - Participa en decisiones importantes

3. **Staking y Farming**
   - Bloquea BEZ y gana recompensas
   - APY variable según demanda
   - Farming de liquidez en pools

4. **Marketplace**
   - Compra y vende NFTs con BEZ
   - Servicios premium de la plataforma
   - Donaciones entre creadores

5. **Acceso Premium**
   - Funcionalidades VIP
   - Contenido exclusivo
   - Herramientas avanzadas de creación

**🔥 Mecanismos Deflacionarios**

- **Quema de tokens**: 1% de cada transacción se quema
- **Buyback**: 5% de las ganancias de la plataforma se usa para recomprar BEZ
- **Staking**: Reduce el suministro circulante

**🌐 ¿Por qué Polygon?**

Polygon nos permite ofrecer:
✅ Transacciones instantáneas (2-3 segundos)
✅ Costos mínimos ($0.01 - $0.10 por tx)
✅ Seguridad de Ethereum
✅ Sostenibilidad ambiental (PoS)

**📈 Roadmap de BEZ-Coin**

**Q1 2025** ✅
- Lanzamiento de token en Polygon
- Staking pool inicial
- Programa de recompensas

**Q2 2025** 🔄
- Listado en exchanges descentralizados
- Farming de liquidez
- Sistema de gobernanza

**Q3 2025** 📅
- Expansión a más redes (Arbitrum, Optimism)
- Listado en exchanges centralizados
- Programa de embajadores

**Q4 2025** 📅
- Cross-chain bridge
- DAO completo
- Expansión global

#BEZCoin #Tokenomics #Polygon #CreatorEconomy #Web3 #Cryptocurrency
"@
        privacy        = "public"
        author         = "0xBeZhasOfficial"
        validated      = $true
        blockchainData = @{
            txHash          = "0x" + (1..64 | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) }) -join ''
            blockNumber     = Get-Random -Minimum 50000000 -Maximum 60000000
            network         = "polygon"
            validationScore = 100
        }
        metadata       = @{
            title    = "BEZ-Coin y Bezhas: Forjando la Nueva Era de la Economía Creativa en Polygon"
            category = "finance"
            tags     = @("bezcoin", "tokenomics", "polygon", "creator-economy", "web3", "cryptocurrency")
            summary  = "Todo sobre BEZ-Coin: tokenomics, casos de uso y roadmap"
        }
    }
)

Write-Host "🚀 Publicando posts de blockchain en BeZhas..." -ForegroundColor Cyan
Write-Host ""

$postNumber = 1
foreach ($post in $posts) {
    $jsonBody = $post | ConvertTo-Json -Depth 10
    
    Write-Host "📝 Post $postNumber/3: $($post.metadata.title.Substring(0, 60))..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Uri $API_URL -Method Post -Body $jsonBody -ContentType "application/json"
        Write-Host "   ✅ Publicado exitosamente (ID: $($response.post.id), Score: $($post.blockchainData.validationScore)/100)" -ForegroundColor Green
    }
    catch {
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host ""
    $postNumber++
}

Write-Host "✨ Proceso completado!" -ForegroundColor Green
