# Sistema de Publicación y Tokenización de Posts - BeZhas

## 📋 Descripción General

Sistema completo para crear, tokenizar y validar publicaciones en la blockchain de BeZhas. Incluye funcionalidades de:

- ✍️ Creación de posts con texto, imágenes y videos
- 🔐 Tokenización de contenido en blockchain
- 💰 Compra de tokens BEZ para validación
- 🎁 Recompensas por contenido verificado
- ✅ Badge de verificación para posts tokenizados

## 🏗️ Arquitectura

### Contratos Inteligentes

#### 1. **TokenizedPost.sol**
Contrato principal para gestión de posts con tokenización.

**Características:**
- Creación de posts gratuitos
- Creación de posts tokenizados (requiere 10 BEZ)
- Tokenización retroactiva de posts existentes
- Sistema de likes y comentarios
- Recompensas automáticas (5 BEZ por post tokenizado)

**Funciones principales:**
```solidity
// Crear post gratuito
function createPost(string contentURI, string imageURI, string videoURI)

// Crear post tokenizado (cuesta 10 BEZ, recompensa 5 BEZ)
function createTokenizedPost(string contentURI, string imageURI, string videoURI)

// Tokenizar post existente
function tokenizePost(uint256 postId)

// Like/Unlike
function toggleLike(uint256 postId)

// Comentar
function createComment(uint256 postId, string contentURI)
```

**Costos y Recompensas:**
- Costo de tokenización: **10 BEZ tokens**
- Recompensa por tokenizar: **5 BEZ tokens**
- Costo neto: **5 BEZ tokens**

#### 2. **BezhasToken.sol**
Token ERC20 para el ecosistema BeZhas.

**Características:**
- Nombre: Bez-Coin (BEZ)
- Funciones estándar ERC20
- Sistema de roles (minter, burner, pauser)
- Compatible con TokenSale

#### 3. **TokenSale.sol**
Contrato para compra de tokens BEZ con ETH.

**Características:**
- Compra directa con ETH
- Precio configurable por el owner
- Límite de 10 ETH por transacción
- Protección contra ataques

### Componentes Frontend

#### 1. **CreatePostModal.jsx**
Modal principal para creación de posts.

**Funcionalidades:**
- **Step 1**: Creación del post
  - Campo de texto (1000 caracteres máx)
  - Upload de imagen (5MB máx)
  - Enlace de video (YouTube, Vimeo, Dailymotion)
  
- **Step 2**: Sugerencia de tokenización
  - Información sobre beneficios
  - Verificación de balance BEZ
  - Toggle para activar/desactivar tokenización
  - Link para comprar tokens si no hay suficiente balance
  
- **Step 3**: Procesamiento
  - Upload a IPFS
  - Transacción blockchain
  - Confirmación y feedback

**Props:**
```javascript
{
  isOpen: boolean,
  onClose: () => void,
  onPostCreated: (post) => void,
  userAddress: string,
  contracts: {
    bezToken: Contract,
    tokenSale: Contract,
    tokenizedPost: Contract
  }
}
```

#### 2. **BuyTokensModal.jsx**
Modal para compra de tokens BEZ.

**Funcionalidades:**
- Visualización de balances (ETH y BEZ)
- Precio actual del token
- Input de cantidad de ETH
- Presets rápidos (0.01, 0.05, 0.1, 0.5 ETH)
- Cálculo automático de tokens a recibir
- Ejecución de transacción
- Feedback de éxito/error

**Props:**
```javascript
{
  isOpen: boolean,
  onClose: () => void,
  userAddress: string,
  contracts: {
    bezToken: Contract,
    tokenSale: Contract
  }
}
```

#### 3. **PostCard.jsx**
Componente para mostrar posts individuales.

**Funcionalidades:**
- Avatar y datos del autor
- Badge de verificación si está tokenizado
- Contenido de texto
- Imagen (si existe)
- Video embebido (YouTube/Vimeo)
- Información de tokenización
- Acciones: like, comentar, compartir
- Sección de comentarios expandible

**Props:**
```javascript
{
  post: {
    id: number,
    author: string,
    content: string,
    image?: string,
    video?: string,
    isTokenized: boolean,
    timestamp: number,
    likes: string[],
    comments: Comment[]
  },
  currentUser: string,
  onLike: (postId) => void,
  onComment: (postId, content) => void,
  contracts: Contracts
}
```

## 🚀 Flujo de Usuario

### Crear Post Simple (Gratis)

1. Usuario hace click en "Crear Post"
2. Modal se abre en Step 1
3. Usuario escribe contenido (texto, imagen, video opcional)
4. Click en "Continuar"
5. Step 2 muestra opción de tokenización
6. Usuario deja el toggle apagado
7. Click en "Publicar"
8. Post se crea gratis en blockchain
9. Post aparece en el feed sin badge de verificación

### Crear Post Tokenizado

1. Usuario hace click en "Crear Post"
2. Modal se abre en Step 1
3. Usuario escribe contenido completo
4. Click en "Continuar"
5. Step 2 muestra opción de tokenización
6. Sistema verifica balance de BEZ
7. Si hay suficientes tokens (≥10 BEZ):
   - Usuario activa el toggle
   - Click en "Tokenizar y Publicar"
   - Sistema pide aprobación de tokens
   - Post se tokeniza y sube a blockchain
   - Usuario recibe 5 BEZ de recompensa
   - Post aparece con badge de verificación
8. Si NO hay suficientes tokens:
   - Sistema muestra advertencia
   - Botón "Comprar BEZ Tokens" disponible
   - Usuario puede ir a comprar y volver

### Comprar Tokens BEZ

1. Usuario hace click en "Comprar BEZ" (desde post modal o sidebar)
2. BuyTokensModal se abre
3. Sistema carga:
   - Balance actual de ETH
   - Balance actual de BEZ
   - Precio del token
4. Usuario ingresa cantidad de ETH (o usa presets)
5. Sistema calcula tokens a recibir
6. Click en "Comprar Tokens"
7. MetaMask pide confirmación
8. Transacción se ejecuta
9. Tokens BEZ llegan a la wallet
10. Modal muestra confirmación de éxito

## 💡 Beneficios de la Tokenización

### Para Creadores de Contenido

1. **Verificación Blockchain**: Contenido inmutable y trazable
2. **Badge de Verificación**: Distintivo visual en el post
3. **Recompensas**: 5 BEZ tokens por cada post tokenizado
4. **Mayor Visibilidad**: Posts verificados destacan en el feed
5. **Credibilidad**: Demuestra autenticidad del contenido

### Para la Plataforma

1. **Calidad de Contenido**: Incentiva contenido valioso
2. **Economía de Tokens**: Circulación saludable de BEZ
3. **Anti-Spam**: Costo de tokenización previene spam
4. **Verificación**: Contenido validado en blockchain
5. **Engagement**: Sistema de recompensas aumenta participación

## 🔧 Instalación y Configuración

### 1. Compilar y Desplegar Contratos

```bash
# Compilar contratos
npx hardhat compile

# Desplegar en red local
npx hardhat run scripts/deploy.js --network localhost

# Desplegar en testnet
npx hardhat run scripts/deploy.js --network sepolia
```

### 2. Actualizar Direcciones de Contratos

Editar `frontend/src/contract-addresses.json`:

```json
{
  "TokenizedPostAddress": "0x...",
  "BezhasTokenAddress": "0x...",
  "TokenSaleAddress": "0x..."
}
```

### 3. Configurar Frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Configurar MetaMask

1. Conectar a la red correcta (localhost/testnet)
2. Importar cuenta con ETH
3. Agregar token BEZ personalizado:
   - Address: `BezhasTokenAddress`
   - Symbol: BEZ
   - Decimals: 18

## 📝 Uso de los Componentes

### Integración en HomePage

```jsx
import CreatePostModal from '../components/CreatePostModal';
import BuyTokensModal from '../components/BuyTokensModal';
import PostCard from '../components/PostCard';

function HomePage() {
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);
  const [showBuyTokensModal, setShowBuyTokensModal] = useState(false);
  const [contracts, setContracts] = useState(null);
  
  // Initialize Web3 and contracts
  useEffect(() => {
    initializeWeb3();
  }, []);
  
  const handlePostCreated = (newPost) => {
    // Add to feed
    setPosts(prev => [newPost, ...prev]);
  };
  
  return (
    <div>
      <button onClick={() => setShowCreatePostModal(true)}>
        Crear Post
      </button>
      
      <button onClick={() => setShowBuyTokensModal(true)}>
        Comprar BEZ
      </button>
      
      {posts.map(post => (
        <PostCard
          key={post.id}
          post={post}
          currentUser={userAddress}
          onLike={handleLike}
          onComment={handleComment}
          contracts={contracts}
        />
      ))}
      
      <CreatePostModal
        isOpen={showCreatePostModal}
        onClose={() => setShowCreatePostModal(false)}
        onPostCreated={handlePostCreated}
        userAddress={userAddress}
        contracts={contracts}
      />
      
      <BuyTokensModal
        isOpen={showBuyTokensModal}
        onClose={() => setShowBuyTokensModal(false)}
        userAddress={userAddress}
        contracts={contracts}
      />
    </div>
  );
}
```

## 🎨 Estilos y Tema

El sistema usa:
- **TailwindCSS** para estilos
- **Lucide React** para iconos
- Tema oscuro con gradientes cyan/blue
- Animaciones suaves
- Backdrop blur para modales

## 🔒 Seguridad

### Contratos
- ✅ ReentrancyGuard en funciones de pago
- ✅ Access control con roles
- ✅ Validación de inputs
- ✅ Límites en transacciones (10 ETH máx)
- ✅ Pausable en caso de emergencia

### Frontend
- ✅ Validación de campos
- ✅ Límites de tamaño (imágenes 5MB)
- ✅ Sanitización de URLs
- ✅ Manejo de errores robusto
- ✅ Timeouts en transacciones

## 🐛 Troubleshooting

### Error: "Insufficient BEZ tokens"
**Solución**: Comprar más tokens BEZ usando el BuyTokensModal

### Error: "Transaction rejected"
**Solución**: Usuario canceló en MetaMask, reintentar

### Error: "Insufficient funds"
**Solución**: Agregar más ETH a la wallet

### Error: "Contract not deployed"
**Solución**: Verificar que los contratos estén desplegados y las direcciones actualizadas

### IPFS Upload falla
**Solución**: Actualmente usa mock IPFS, integrar con Pinata, Infura o nodo propio

## 🚀 Próximas Mejoras

1. **IPFS Real**: Integración con Pinata/Infura
2. **Múltiples Imágenes**: Carrusel de fotos
3. **Edición de Posts**: Permite editar posts tokenizados
4. **NFT de Posts**: Convertir posts en NFTs
5. **Marketplace**: Compraventa de posts tokenizados
6. **Analytics**: Dashboard de estadísticas
7. **Notificaciones**: Sistema de notificaciones on-chain
8. **Moderación**: Sistema de reportes y moderación
9. **Hashtags**: Búsqueda y filtrado por tags
10. **Menciones**: Sistema de @menciones

## 📞 Soporte

Para preguntas o problemas:
- GitHub Issues: [repo-url]
- Discord: [discord-invite]
- Email: support@bezhas.com

---

**Desarrollado con ❤️ para la comunidad BeZhas**
