# 🚀 Sistema de Publicación y Tokenización - Guía Rápida

## ¿Qué es esto?

Un sistema completo para crear y tokenizar publicaciones en la blockchain. Los usuarios pueden:

- 📝 Crear posts con texto, imágenes y videos
- 🔐 Tokenizar posts para verificarlos en blockchain
- 💰 Comprar tokens BEZ para validación
- 🎁 Ganar recompensas por contenido verificado

## 🎯 Características Principales

### Para Usuarios

1. **Crear Posts Simples (Gratis)**
   - Texto hasta 1000 caracteres
   - Una imagen (máx 5MB)
   - Link de video (YouTube, Vimeo)
   - Publicación instantánea

2. **Tokenizar Posts (10 BEZ)**
   - Badge de verificación visible
   - Contenido inmutable en blockchain
   - Recompensa de 5 BEZ
   - Mayor visibilidad en el feed

3. **Comprar Tokens BEZ**
   - Compra directa con ETH
   - Precios dinámicos
   - Transacción instantánea
   - Sin comisiones ocultas

### Para Desarrolladores

- ✅ Contratos inteligentes auditables
- ✅ Componentes React reutilizables
- ✅ Integración con IPFS
- ✅ Sistema de eventos blockchain
- ✅ Documentación completa

## 📦 Instalación

### Requisitos Previos

- Node.js v16+
- MetaMask instalado
- Hardhat
- ETH en testnet/mainnet

### Paso 1: Clonar e Instalar

```bash
git clone <repo-url>
cd bezhas-web3
npm install
```

### Paso 2: Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar con tus valores
PRIVATE_KEY=your_private_key
INFURA_API_KEY=your_infura_key
ETHERSCAN_API_KEY=your_etherscan_key
```

### Paso 3: Compilar Contratos

```bash
npx hardhat compile
```

### Paso 4: Desplegar Contratos

```bash
# Red local
npx hardhat node
npx hardhat run scripts/deploy-tokenized-post.js --network localhost

# Testnet (Sepolia)
npx hardhat run scripts/deploy-tokenized-post.js --network sepolia
```

### Paso 5: Iniciar Frontend

```bash
cd frontend
npm install
npm run dev
```

## 🎮 Uso

### 1. Crear un Post Simple

```
1. Click en "Crear Post" o el botón "+"
2. Escribe tu contenido
3. (Opcional) Sube una imagen
4. (Opcional) Pega link de video
5. Click "Continuar"
6. Deja el toggle de tokenización apagado
7. Click "Publicar"
```

### 2. Crear un Post Tokenizado

```
1. Click en "Crear Post"
2. Escribe tu contenido
3. Click "Continuar"
4. Activa el toggle "Tokenizar publicación"
5. Verifica que tienes al menos 10 BEZ
6. Click "Tokenizar y Publicar"
7. Confirma en MetaMask (2 transacciones)
   - Aprobar tokens BEZ
   - Crear post tokenizado
8. ¡Listo! Tu post tiene badge de verificación
```

### 3. Comprar Tokens BEZ

```
1. Click en "Comprar BEZ" en el modal o sidebar
2. Ingresa cantidad de ETH (o usa presets)
3. Revisa cuántos BEZ recibirás
4. Click "Comprar Tokens"
5. Confirma en MetaMask
6. Espera confirmación
7. Tokens BEZ aparecen en tu wallet
```

## 💡 Consejos

### Para Creadores de Contenido

- 💎 **Tokeniza contenido valioso**: Guarda los BEZ para posts importantes
- 📸 **Usa imágenes de calidad**: Las imágenes atraen más engagement
- 🎥 **Videos embebidos**: Mejor que links externos
- ⏰ **Timing**: Publica cuando tu audiencia está activa
- 🔄 **Consistencia**: Publica regularmente para ganar recompensas

### Para Economizar Tokens

- 🆓 **Posts normales primero**: Usa posts gratis para contenido casual
- 💰 **Tokeniza lo mejor**: Reserva tokenización para contenido premium
- 🎁 **Aprovecha recompensas**: Cada post tokenizado da 5 BEZ de vuelta
- 📊 **Calcula costos**: 10 BEZ - 5 BEZ reward = 5 BEZ costo real

### Para Seguridad

- 🔒 **Nunca compartas tu seed phrase**
- ✅ **Verifica direcciones de contratos**
- 💾 **Backup de tu wallet**
- 🧪 **Prueba primero en testnet**
- 📱 **Usa hardware wallet para grandes cantidades**

## 🔧 Troubleshooting

### Problema: "MetaMask no detectado"
**Solución**: Instala MetaMask y recarga la página

### Problema: "Insufficient BEZ tokens"
**Solución**: 
1. Click en "Comprar BEZ Tokens"
2. Compra al menos 10 BEZ
3. Intenta tokenizar de nuevo

### Problema: "Transaction failed"
**Solución**:
1. Verifica que tienes suficiente ETH para gas
2. Aumenta el gas limit en MetaMask
3. Verifica que estás en la red correcta

### Problema: "Contract not found"
**Solución**:
1. Verifica que los contratos están desplegados
2. Chequea contract-addresses.json
3. Asegúrate de estar en la red correcta

### Problema: "Image upload failed"
**Solución**:
1. Verifica tamaño < 5MB
2. Usa formato JPG, PNG o GIF
3. Prueba comprimir la imagen

## 📊 Economía del Token

### Precio de Referencia
- **1 BEZ = 0.001 ETH** (configurable)

### Costos del Sistema
| Acción | Costo | Recompensa | Neto |
|--------|-------|------------|------|
| Post Simple | Gratis | 0 BEZ | 0 BEZ |
| Post Tokenizado | 10 BEZ | 5 BEZ | -5 BEZ |
| Comprar BEZ | ETH | BEZ | Variable |
| Like | Gratis | 0 BEZ | 0 BEZ |
| Comentar | Gratis | 0 BEZ | 0 BEZ |

### Ejemplos de Uso

**Escenario 1: Usuario Casual**
```
- Compra: 100 BEZ (0.1 ETH)
- Crea 10 posts tokenizados
- Costo: 100 BEZ
- Recompensa: 50 BEZ
- Balance final: 50 BEZ
- Contenido: 10 posts verificados
```

**Escenario 2: Creador Activo**
```
- Compra: 1000 BEZ (1 ETH)
- Crea 100 posts tokenizados
- Costo: 1000 BEZ
- Recompensa: 500 BEZ
- Balance final: 500 BEZ
- Contenido: 100 posts verificados
- ROI: 50% en tokens + credibilidad
```

## 🎨 Personalización

### Cambiar Colores

Edita `tailwind.config.js`:
```javascript
theme: {
  extend: {
    colors: {
      'primary': '#06b6d4', // cyan-500
      'secondary': '#2563eb', // blue-600
    }
  }
}
```

### Cambiar Costos

Edita `TokenizedPost.sol`:
```solidity
uint256 public constant POST_VALIDATION_COST = 10 * 10**18; // Cambia a tu valor
uint256 public constant TOKENIZED_POST_REWARD = 5 * 10**18; // Cambia a tu valor
```

### Cambiar Precio del Token

Después del deployment:
```javascript
const tokenSale = await ethers.getContractAt("TokenSale", tokenSaleAddress);
const newPrice = ethers.parseEther("0.002"); // 0.002 ETH por BEZ
await tokenSale.updatePrice(newPrice);
```

## 📚 Recursos Adicionales

- 📖 [Documentación Completa](./docs/POST_TOKENIZATION_SYSTEM.md)
- 🎥 [Video Tutorial](https://youtube.com/bezhas-tutorial)
- 💬 [Discord Community](https://discord.gg/bezhas)
- 🐛 [Reportar Bug](https://github.com/bezhas/issues)
- 🌟 [Ejemplos de Código](./examples)

## 🤝 Contribuir

¿Quieres mejorar el sistema?

1. Fork el repositorio
2. Crea una branch (`git checkout -b feature/mejora`)
3. Commit cambios (`git commit -m 'Add mejora'`)
4. Push a la branch (`git push origin feature/mejora`)
5. Abre un Pull Request

## 📄 Licencia

MIT License - Ver [LICENSE](../LICENSE) para detalles

## 🙏 Agradecimientos

- OpenZeppelin por los contratos seguros
- Ethers.js por la biblioteca Web3
- Tailwind CSS por los estilos
- Lucide por los iconos

---

**¿Necesitas ayuda?** Únete a nuestro [Discord](https://discord.gg/bezhas) o abre un [Issue](https://github.com/bezhas/issues)

**Made with ❤️ by BeZhas Team**
