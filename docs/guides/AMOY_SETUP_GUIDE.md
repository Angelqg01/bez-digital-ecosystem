# 🟣 Guía de Configuración: Polygon Amoy Testnet

## 📋 Información de la Red

- **Nombre:** Polygon Amoy Testnet
- **Chain ID:** 80002
- **RPC URL:** https://rpc-amoy.polygon.technology
- **Explorer:** https://amoy.polygonscan.com
- **Moneda:** MATIC (testnet)
- **Faucet:** https://faucet.polygon.technology/

---

## 🔧 Paso 1: Configurar Variables de Entorno

Edita tu archivo `.env` en la raíz del proyecto:

```bash
# Polygon Amoy RPC
AMOY_RPC_URL=https://rpc-amoy.polygon.technology/

# Tu private key (¡NUNCA compartir en producción!)
PRIVATE_KEY=tu_private_key_aqui_sin_0x

# Opcional: API Key de PolygonScan para verificación
POLYGONSCAN_API_KEY=tu_api_key_aqui
```

---

## 💰 Paso 2: Obtener MATIC de Testnet

### Opción A: Faucet Oficial de Polygon
1. Ve a https://faucet.polygon.technology/
2. Selecciona "Polygon Amoy"
3. Ingresa tu dirección de wallet
4. Haz clic en "Submit" (recibirás 0.2 MATIC)

### Opción B: Alchemy Faucet
1. Ve a https://www.alchemy.com/faucets/polygon-amoy
2. Inicia sesión con cuenta de Alchemy
3. Solicita tokens

---

## 🔗 Paso 3: Agregar Amoy a MetaMask

### Método Manual:
1. Abre MetaMask
2. Click en el selector de red (arriba)
3. Click en "Add Network" → "Add a network manually"
4. Ingresa los siguientes datos:

```
Network Name: Polygon Amoy Testnet
New RPC URL: https://rpc-amoy.polygon.technology
Chain ID: 80002
Currency Symbol: MATIC
Block Explorer URL: https://amoy.polygonscan.com
```

### Método Automático (desde la app):
1. Conecta tu wallet en BeZhas
2. La app detectará que no tienes Amoy
3. Click en "Switch to Amoy" cuando se solicite
4. MetaMask te pedirá agregar la red automáticamente

---

## 🚀 Paso 4: Desplegar Contratos en Amoy

### Desplegar BezhasToken:
```bash
npx hardhat run scripts/deploy.js --network amoy
```

### Desplegar Marketplace:
```bash
npx hardhat run scripts/deploy_marketplace.js --network amoy
```

### Desplegar DAO:
```bash
npx hardhat run scripts/deploy-dao.js --network amoy
```

### Ver Contratos Desplegados:
Las direcciones se guardarán en `backend/config.json`:
```json
{
  "amoy": {
    "bezhasToken": "0x...",
    "marketplace": "0x...",
    "dao": "0x..."
  }
}
```

---

## 🔍 Paso 5: Verificar Contratos en PolygonScan

```bash
npx hardhat verify --network amoy DEPLOYED_CONTRACT_ADDRESS "Constructor Args"
```

Ejemplo:
```bash
npx hardhat verify --network amoy 0x123... "BeZhas Token" "BZH" 1000000
```

---

## 🌐 Paso 6: Conectar Frontend a Amoy

El frontend ya está configurado para Amoy en:
- `frontend/src/lib/wagmi.js` ✅
- `frontend/src/context/Web3Context.jsx` ✅

Para usar Amoy en la app:
1. Abre http://localhost:5173
2. Click en "Connect Wallet"
3. Selecciona MetaMask
4. Cambia a red "Polygon Amoy Testnet"
5. ¡Listo! Ahora puedes interactuar con los contratos

---

## 📊 Monitoreo de Transacciones

### Ver tus transacciones:
```
https://amoy.polygonscan.com/address/TU_WALLET_ADDRESS
```

### Ver contrato desplegado:
```
https://amoy.polygonscan.com/address/CONTRACT_ADDRESS
```

---

## 🧪 Probar Funcionalidades

### 1. Mint BezhasToken:
```javascript
// En la consola del navegador (F12)
const { signer, bezhasToken } = useWeb3();
await bezhasToken.mint(address, ethers.parseEther("100"));
```

### 2. Crear NFT en Marketplace:
1. Ve a la página "Marketplace"
2. Click en tab "Sell"
3. Completa el formulario
4. Confirma transacción en MetaMask

### 3. Votar en DAO:
1. Ve a la página "DAO"
2. Selecciona una propuesta
3. Click en "Vote"
4. Confirma transacción

---

## ⚙️ Configuración Avanzada

### Custom RPC (si el oficial es lento):
```bash
# Opciones alternativas de RPC
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/YOUR_API_KEY
AMOY_RPC_URL=https://rpc.ankr.com/polygon_amoy
AMOY_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
```

### Gas Optimization:
```javascript
// En hardhat.config.js
networks: {
  amoy: {
    url: AMOY_RPC_URL,
    accounts: [PRIVATE_KEY],
    gasPrice: 35000000000, // 35 Gwei
    gas: 2100000,
  }
}
```

---

## 🛠️ Troubleshooting

### Error: "insufficient funds for gas"
- Obtén más MATIC del faucet
- Verifica que estés en la red correcta

### Error: "nonce too high"
- Reset MetaMask: Settings → Advanced → Clear activity tab data

### Error: "network not found"
- Verifica que AMOY_RPC_URL esté en .env
- Restart Hardhat node

### Transacción pendiente por mucho tiempo:
- El gas price podría ser muy bajo
- Cancela y reenvía con gas más alto en MetaMask

---

## 📚 Recursos Adicionales

- **Documentación Polygon:** https://wiki.polygon.technology/
- **Amoy Testnet Info:** https://polygon.technology/blog/introducing-the-amoy-testnet-for-polygon-pos
- **Discord Polygon:** https://discord.gg/polygon
- **Faucet POL (Polygon):** https://faucet.polygon.technology/

---

## ✅ Checklist de Configuración

- [ ] Variables de entorno configuradas (.env)
- [ ] MATIC obtenido del faucet
- [ ] Amoy agregado a MetaMask
- [ ] Contratos desplegados
- [ ] Frontend conectado
- [ ] Primera transacción exitosa

---

**¡Estás listo para desarrollar en Polygon Amoy!** 🚀
