# 🎨 NFT Marketplace - Guía de Funcionalidades

## ✅ Implementaciones Activadas

### 📍 URL Principal
**http://localhost:5174/marketplace** (o el puerto que muestre Vite)

---

## 🎯 Características Implementadas

### 1️⃣ **Marketplace (Comprar NFTs)**
- ✅ Grid de NFTs disponibles con imágenes reales de Unsplash
- ✅ 8 NFTs de ejemplo con precios variados (85-200 BEZ)
- ✅ Información detallada: nombre, descripción, precio, vendedor
- ✅ Sistema de atributos (Rareza, Clase, Poder, etc.)
- ✅ Botón "Comprar" con validación de balance BEZ
- ✅ Modal de fondos insuficientes si no tienes BEZ
- ✅ Integración con BezCoin para pagos

### 2️⃣ **Mis NFTs (Gestionar Colección)**
- ✅ Visualización de todos los NFTs que posees
- ✅ Botón "Listar en Marketplace" para vender tus NFTs
- ✅ Modal para establecer precio de venta
- ✅ Aprobación automática del contrato Marketplace
- ✅ Estado vacío amigable cuando no tienes NFTs

### 3️⃣ **Crear NFT (Mintear)**
- ✅ Formulario completo para crear NFTs:
  - Nombre del NFT
  - Descripción
  - URL de imagen con vista previa
  - Atributos en formato JSON (opcional)
- ✅ Validación de campos requeridos
- ✅ Vista previa de imagen en tiempo real
- ✅ Minteo directo a tu wallet

---

## 🎨 NFTs de Ejemplo Disponibles

| # | Nombre | Precio BEZ | Rareza |
|---|--------|------------|--------|
| 1 | Bezhas Genesis #1 | 150 | Legendario |
| 2 | Cosmic Warrior | 85 | Épico |
| 3 | Digital Dreams | 120 | Legendario |
| 4 | Neon Samurai | 200 | Mítico |
| 5 | Cyber Punk Girl | 95 | Épico |
| 6 | Mystic Portal | 175 | Legendario |
| 7 | Quantum Reality | 110 | Épico |
| 8 | Ethereum Explorer | 140 | Legendario |

**Todos los NFTs incluyen:**
- 🖼️ Imágenes de alta calidad (Unsplash)
- 📝 Descripciones detalladas
- 🏷️ Sistema de atributos (Rareza, Tipo, Poder, etc.)
- 💰 Precios en BEZ Coin

---

## 🔧 Modo de Operación

### 🟡 Modo Demostración (Actual)
Cuando los contratos no están desplegados:
- ✅ Muestra los 8 NFTs de ejemplo
- ⚠️ Banner amarillo indicando "Modo Demostración"
- 🔘 Botón para intentar cargar contratos reales
- ℹ️ Los botones "Comprar" muestran mensaje informativo

### 🟢 Modo Producción (Contratos Desplegados)
Cuando despliegues los contratos:
- ✅ Carga NFTs reales de la blockchain
- ✅ Compras reales con transacciones en blockchain
- ✅ Minteo funcional de nuevos NFTs
- ✅ Listado y venta de NFTs propios

---

## 🛠️ Componentes Técnicos Creados

### Hooks Personalizados
1. **`useNFTContract.js`**
   - `mintNFT()` - Crear nuevos NFTs
   - `getOwnedNFTs()` - Obtener NFTs del usuario
   - `approveNFT()` - Aprobar transferencias
   - `isApproved()` - Verificar aprobaciones

2. **`useMarketplaceContract.js`**
   - `listNFT()` - Listar NFT en marketplace
   - `buyNFT()` - Comprar NFT listado
   - `cancelListing()` - Cancelar listado
   - `getActiveListings()` - Obtener NFTs en venta

### Componentes UI
1. **`CreateNFT.jsx`** - Formulario de minteo
2. **`MyNFTs.jsx`** - Galería de NFTs propios
3. **`MarketplacePage.jsx`** - Página principal con tabs

### Datos
- **`mockNFTs.js`** - 8 NFTs de ejemplo con datos completos

---

## 🚀 Cómo Usar

### Para Comprar NFTs:
1. Ve a http://localhost:5174/marketplace
2. Navega por los NFTs disponibles
3. Haz clic en "Comprar" en el NFT que te guste
4. Si no tienes suficientes BEZ, aparecerá modal para comprar
5. Confirma la transacción (en modo demo muestra aviso)

### Para Crear un NFT:
1. Ve a la pestaña "Crear NFT"
2. Completa el formulario:
   - Nombre: "Mi NFT Increíble"
   - Descripción: "Este es mi primer NFT..."
   - URL de imagen: https://ejemplo.com/imagen.jpg
3. (Opcional) Agrega atributos en JSON
4. Haz clic en "Crear NFT"

### Para Listar tu NFT:
1. Ve a la pestaña "Mis NFTs"
2. Encuentra el NFT que quieres vender
3. Haz clic en "Listar en Marketplace"
4. Establece el precio en BEZ
5. Confirma la transacción

---

## 📦 Variables de Entorno Necesarias

Para activar contratos reales, agrega a `.env`:

```env
VITE_BEZHAS_NFT_ADDRESS=0x... # Dirección del contrato BezhasNFT
VITE_MARKETPLACE_ADDRESS=0x... # Dirección del contrato Marketplace
```

---

## 🎯 Próximos Pasos para Producción

1. **Desplegar Contratos:**
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

2. **Actualizar Variables de Entorno:**
   - Copia las direcciones de los contratos desplegados
   - Actualiza VITE_BEZHAS_NFT_ADDRESS
   - Actualiza VITE_MARKETPLACE_ADDRESS

3. **Subir Imágenes a IPFS:**
   - Usa Pinata, NFT.Storage o similar
   - Reemplaza URLs de Unsplash con URIs de IPFS

4. **Probar Funcionalidad Real:**
   - Conecta wallet en testnet (Sepolia)
   - Crea un NFT real
   - Lista en marketplace
   - Compra con otra cuenta

---

## 🎨 Diseño Visual

- **Colores:** Gradientes purple-pink y blue-purple
- **Layout:** Grid responsivo (1-4 columnas según pantalla)
- **Tarjetas:** Sombras suaves con hover effect
- **Icons:** React Icons (FaStore, FaImage, FaWallet, etc.)
- **Estados:** Loading spinners, estados vacíos amigables
- **Modals:** Overlays con blur para listar NFTs

---

## ⚠️ Notas Importantes

1. **Mock Data:** Los NFTs de ejemplo usan imágenes de Unsplash que pueden cambiar
2. **Contratos:** Asegúrate de desplegar contratos antes de producción
3. **IPFS:** En producción, usa IPFS para almacenar metadatos e imágenes
4. **Gas Fees:** Las transacciones reales requieren ETH para gas
5. **Aprobaciones:** El usuario debe aprobar el Marketplace para transferir NFTs

---

## 🐛 Solución de Problemas

**❌ "Contratos No Desplegados"**
- Despliega los contratos primero
- Verifica las variables de entorno

**❌ "Error al crear NFT"**
- Asegúrate de tener MINTER_ROLE en el contrato
- Verifica que la URL de imagen sea válida

**❌ "Error al listar NFT"**
- Confirma la aprobación del Marketplace
- Verifica que seas el dueño del NFT

**❌ "Fondos Insuficientes"**
- Compra BEZ Coin desde el modal
- Verifica tu balance antes de comprar

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa la consola del navegador (F12)
2. Verifica que el backend esté corriendo (puerto 3001)
3. Confirma que el frontend esté corriendo (puerto 5173/5174)
4. Revisa los logs del terminal

---

**¡Disfruta comprando, vendiendo y creando NFTs en Bezhas! 🎉**
