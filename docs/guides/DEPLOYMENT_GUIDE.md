# 🚀 Deployment Instructions - Sistema de Publicación Tokenizada

## Pre-requisitos

Antes de comenzar, asegúrate de tener:

- [x] Node.js v16 o superior instalado
- [x] MetaMask configurado
- [x] ETH en tu wallet (testnet o mainnet)
- [x] Cuenta de Infura (opcional para IPFS)
- [x] Etherscan API key (para verificación)

---

## Paso 1: Configuración Inicial

### 1.1 Instalar Dependencias

```bash
# Instalar dependencias del proyecto
npm install

# Instalar dependencias del frontend
cd frontend
npm install
cd ..

# Instalar dependencias del backend (si aplica)
cd backend
npm install
cd ..
```

### 1.2 Configurar Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Network Configuration
PRIVATE_KEY=tu_private_key_aqui
INFURA_API_KEY=tu_infura_api_key
ETHERSCAN_API_KEY=tu_etherscan_api_key

# Token Configuration
INITIAL_TOKEN_SUPPLY=1000000
TOKEN_PRICE=0.001

# Contract Addresses (se llenan después del deployment)
BEZHAS_TOKEN_ADDRESS=
TOKEN_SALE_ADDRESS=
TOKENIZED_POST_ADDRESS=
USER_PROFILE_ADDRESS=
```

⚠️ **IMPORTANTE**: Nunca subas `.env` al repositorio

---

## Paso 2: Compilar Contratos

```bash
# Compilar todos los contratos
npx hardhat compile

# Verificar que no hay errores
✅ Compiled 15 Solidity files successfully
```

Si hay errores:
1. Verifica las versiones de Solidity en `hardhat.config.js`
2. Asegúrate de tener OpenZeppelin instalado: `npm install @openzeppelin/contracts`

---

## Paso 3: Deployment en Red Local

### 3.1 Iniciar Nodo Local

Terminal 1:
```bash
npx hardhat node
```

Salida esperada:
```
Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
```

### 3.2 Desplegar Contratos

Terminal 2:
```bash
npx hardhat run scripts/deploy-tokenized-post.js --network localhost
```

Salida esperada:
```
🚀 Deploying Tokenized Post System...

📍 Deploying contracts with account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
💰 Account balance: 10000.0 ETH

1️⃣  Deploying UserProfile...
✅ UserProfile deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3

2️⃣  Deploying BezhasToken...
✅ BezhasToken deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

3️⃣  Deploying TokenSale...
✅ TokenSale deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

4️⃣  Transferring tokens to TokenSale...
✅ Transferred 100000.0 BEZ to TokenSale

5️⃣  Deploying TokenizedPost...
✅ TokenizedPost deployed to: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

6️⃣  Granting MINTER_ROLE to TokenizedPost...
✅ MINTER_ROLE granted to TokenizedPost

7️⃣  Creating test user profile...
✅ Test profile created for deployer

============================================================
📋 DEPLOYMENT SUMMARY
============================================================
UserProfile:       0x5FbDB2315678afecb367f032d93F642f64180aa3
BezhasToken:       0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
TokenSale:         0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
TokenizedPost:     0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
============================================================

🎉 Deployment complete!
```

### 3.3 Configurar MetaMask para Red Local

1. Abrir MetaMask
2. Agregar red personalizada:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`

3. Importar cuenta de prueba:
   - Private Key: (una de las que muestra `npx hardhat node`)
   - Ejemplo: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

### 3.4 Agregar Token BEZ a MetaMask

1. En MetaMask, click en "Import tokens"
2. Pegar dirección del contrato BezhasToken
3. Symbol: `BEZ`
4. Decimals: `18`
5. Click "Add Custom Token"

---

## Paso 4: Iniciar Aplicación

### 4.1 Iniciar Backend (si aplica)

Terminal 3:
```bash
cd backend
node server.js
```

Salida esperada:
```
Backend server running on http://0.0.0.0:3001
WebSocket server ready for connections
```

### 4.2 Iniciar Frontend

Terminal 4:
```bash
cd frontend
npm run dev
```

Salida esperada:
```
VITE v5.4.20  ready in 5861 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### 4.3 Abrir Aplicación

1. Abrir navegador en `http://localhost:5173`
2. Conectar MetaMask
3. Aceptar conexión con la aplicación

---

## Paso 5: Prueba del Sistema

### 5.1 Comprar Tokens BEZ

1. Click en "Comprar BEZ" o el icono de monedas
2. Ingresar `0.01` ETH
3. Verificar que muestra ~10 BEZ (depende del precio)
4. Click "Comprar Tokens"
5. Confirmar en MetaMask
6. Esperar confirmación
7. Verificar balance BEZ actualizado

### 5.2 Crear Post Simple

1. Click en "Crear Post"
2. Escribir contenido: "Mi primer post en BeZhas!"
3. Click "Continuar"
4. Dejar toggle de tokenización apagado
5. Click "Publicar"
6. Confirmar en MetaMask
7. Post aparece en feed sin badge

### 5.3 Crear Post Tokenizado

1. Click en "Crear Post"
2. Escribir contenido: "Post verificado en blockchain ✨"
3. (Opcional) Subir imagen
4. Click "Continuar"
5. Activar toggle de tokenización
6. Verificar costo: 10 BEZ
7. Click "Tokenizar y Publicar"
8. Confirmar aprobación de tokens en MetaMask
9. Confirmar creación de post en MetaMask
10. Post aparece con badge de verificación 🔐

---

## Paso 6: Deployment en Testnet (Sepolia)

### 6.1 Obtener ETH de Testnet

Visitar faucets:
- https://sepoliafaucet.com
- https://faucet.sepolia.dev

### 6.2 Actualizar hardhat.config.js

```javascript
module.exports = {
  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 11155111
    }
  }
};
```

### 6.3 Desplegar en Sepolia

```bash
npx hardhat run scripts/deploy-tokenized-post.js --network sepolia
```

⏳ Este proceso tomará más tiempo (1-2 minutos por contrato)

### 6.4 Verificar Contratos en Etherscan

```bash
# Verificar BezhasToken
npx hardhat verify --network sepolia BEZHAS_TOKEN_ADDRESS "1000000000000000000000000"

# Verificar TokenSale
npx hardhat verify --network sepolia TOKEN_SALE_ADDRESS BEZHAS_TOKEN_ADDRESS WALLET_ADDRESS "1000000000000000"

# Verificar TokenizedPost
npx hardhat verify --network sepolia TOKENIZED_POST_ADDRESS USER_PROFILE_ADDRESS BEZHAS_TOKEN_ADDRESS
```

### 6.5 Configurar MetaMask para Sepolia

1. Cambiar red a "Sepolia test network"
2. Agregar token BEZ con la nueva dirección

---

## Paso 7: Deployment en Mainnet

⚠️ **PRECAUCIÓN**: Solo hacer después de:
- ✅ Auditoría de seguridad completa
- ✅ Pruebas exhaustivas en testnet
- ✅ Review de código por múltiples desarrolladores
- ✅ Plan de contingencia preparado

### 7.1 Preparación

1. Asegurar fondos suficientes para gas (0.5-1 ETH recomendado)
2. Backup de private keys
3. Verificar precios y parámetros finales

### 7.2 Actualizar hardhat.config.js

```javascript
module.exports = {
  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1,
      gasPrice: 'auto' // o especificar manualmente
    }
  }
};
```

### 7.3 Desplegar en Mainnet

```bash
# ⚠️ CUIDADO: ESTO USA ETH REAL
npx hardhat run scripts/deploy-tokenized-post.js --network mainnet
```

### 7.4 Post-Deployment

1. Verificar todos los contratos en Etherscan
2. Transferir ownership a multisig
3. Pausar contratos hasta launch oficial
4. Publicar addresses en documentación oficial
5. Anunciar en redes sociales

---

## Troubleshooting

### Error: "insufficient funds for gas"
**Solución**: Agregar más ETH a la wallet

### Error: "nonce has already been used"
**Solución**: Resetear MetaMask o esperar a que se confirme la transacción anterior

### Error: "contract deployment failed"
**Solución**: Verificar que el gas limit es suficiente

### Error: "Transaction reverted"
**Solución**: Revisar los logs y verificar que los parámetros son correctos

### Frontend no conecta con contratos
**Solución**: 
1. Verificar que contract-addresses.json está actualizado
2. Verificar que MetaMask está en la red correcta
3. Hacer hard refresh (Ctrl+Shift+R)

---

## Checklist Final

Antes de considerar el deployment completo:

### Contratos
- [ ] Todos los contratos compilados sin errores
- [ ] Tests pasando (si existen)
- [ ] Auditoría de seguridad realizada (mainnet)
- [ ] Roles asignados correctamente
- [ ] Ownership transferido a multisig (mainnet)

### Frontend
- [ ] contract-addresses.json actualizado
- [ ] .env configurado correctamente
- [ ] Build de producción funciona
- [ ] MetaMask se conecta correctamente
- [ ] Todos los modales funcionan

### Backend
- [ ] API endpoints funcionando
- [ ] Base de datos configurada
- [ ] Sincronización con blockchain activa
- [ ] Rate limiting implementado

### Documentación
- [ ] README actualizado
- [ ] Guías de usuario publicadas
- [ ] API docs disponibles
- [ ] Contract addresses documentados

### Seguridad
- [ ] Private keys aseguradas
- [ ] Acceso a servidores restringido
- [ ] Monitoring activo
- [ ] Plan de respuesta a incidentes

---

## Monitoreo Post-Deployment

### Métricas a Vigilar

1. **Transacciones**
   - Posts creados
   - Posts tokenizados
   - Tokens comprados

2. **Economía**
   - Precio del token
   - Volumen de trading
   - Liquidez

3. **Usuarios**
   - Usuarios activos
   - Nuevos registros
   - Retención

4. **Técnico**
   - Gas usado
   - Errores de transacción
   - Tiempo de confirmación

### Herramientas

- **Etherscan**: Monitoreo de contratos
- **Dune Analytics**: Dashboards personalizados
- **The Graph**: Indexación de eventos
- **Tenderly**: Debugging y monitoreo

---

## Soporte

Si encuentras problemas durante el deployment:

1. Revisar logs de errores
2. Consultar documentación
3. Buscar en issues de GitHub
4. Preguntar en Discord: https://discord.gg/bezhas
5. Email: dev@bezhas.com

---

## Actualizaciones

Para actualizar los contratos después del deployment:

### Opción 1: Proxy Pattern (Recomendado)
Implementar con OpenZeppelin Upgrades

### Opción 2: Migration
Desplegar nuevos contratos y migrar datos

### Opción 3: Governance
Permitir cambios vía votación de comunidad

---

**Última actualización**: 17 de Octubre, 2025
**Versión**: 1.0.0

**¡Buena suerte con tu deployment! 🚀**
