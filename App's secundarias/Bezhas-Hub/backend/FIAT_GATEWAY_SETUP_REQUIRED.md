# ⚠️ CONFIGURACIÓN REQUERIDA ANTES DE USAR

## Problema Detectado

El sistema Fiat Gateway está configurado pero **el contrato BEZ Token no está desplegado en Polygon Amoy Testnet**.

### Situación Actual:

- ✅ **Private Key configurada** en `backend/.env`
- ✅ **Hot Wallet identificada**: `0x52Df82920CBAE522880dD7657e43d1A754eD044E`
- ❌ **Contrato BEZ**: `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` NO existe en Amoy

### Opciones para Resolver:

#### Opción 1: Usar Polygon Mainnet (Producción)

Si el token BEZ ya está desplegado en **Polygon Mainnet**, cambia la configuración:

**Edita `backend/.env`:**
```env
# Cambiar de Amoy a Mainnet
POLYGON_RPC_URL=https://polygon-rpc.com
# o
POLYGON_RPC_URL=https://polygon.llamarpc.com
```

⚠️ **IMPORTANTE**: En Mainnet usarás MATIC real y tokens reales. Asegúrate de fondear la Hot Wallet con MATIC real.

---

#### Opción 2: Desplegar Token BEZ en Amoy (Testing)

Si necesitas testear en Amoy, debes desplegar el token BEZ allí primero:

```bash
# Desde la raíz del proyecto
npx hardhat run scripts/deploy-bezcoin.js --network amoy
```

Luego actualiza la dirección en `backend/.env`:
```env
BEZCOIN_ADDRESS=0xNUEVA_DIRECCION_AQUI
```

---

#### Opción 3: Usar un Token de Prueba Existente

Para testing rápido, puedes usar USDC de Amoy como "mock":

**USDC en Amoy**: `0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582`

Edita `backend/services/fiatGateway.service.js`:
```javascript
const BEZ_TOKEN_ADDRESS = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'; // USDC Amoy
```

---

## Verificación del Contrato

Ejecuta este comando para verificar en qué red está tu token:

```bash
# Verificar en Amoy
node backend/scripts/check-token.js

# O verifica manualmente en:
https://amoy.polygonscan.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
```

---

## Pasos Siguientes

1. **Decide qué red usar** (Mainnet o Testnet)
2. **Actualiza `POLYGON_RPC_URL`** en `backend/.env`
3. **Verifica/Despliega el contrato** en esa red
4. **Actualiza `BEZCOIN_ADDRESS`** si es necesario
5. **Fondea la Hot Wallet** con MATIC en esa red
6. **Ejecuta `approve()`** desde la Safe en esa red
7. **Prueba el sistema**: `node scripts/fiat-admin.js status`

---

## Configuración Recomendada para Testing

Para desarrollo/testing seguro en Amoy:

```env
# backend/.env
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
BEZCOIN_ADDRESS=0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582  # USDC como mock
HOT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
```

1. Obtén MATIC de Amoy: https://faucet.polygon.technology/
2. Envía 1 MATIC a la Hot Wallet
3. En la Safe (también en Amoy), aprueba la Hot Wallet para gastar USDC
4. Prueba el sistema con pequeñas cantidades

---

## Soporte

Si necesitas ayuda, verifica:
- [FIAT_GATEWAY_GUIDE.md](../FIAT_GATEWAY_GUIDE.md) - Guía completa
- [Polygon Scan Amoy](https://amoy.polygonscan.com/)
- [Polygon Faucet](https://faucet.polygon.technology/)
