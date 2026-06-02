# BeZhas Fiat Gateway - Sistema de Pago con Transferencia Bancaria

## 📋 Descripción General

El **Fiat Gateway** permite a los usuarios comprar tokens BEZ mediante transferencia bancaria SEPA, eliminando intermediarios como Transak o MoonPay. El sistema utiliza una arquitectura de **Hot Wallet delegada** para dispersar tokens desde una **Safe Wallet** (bóveda principal), donde **BeZhas cubre los gastos de gas** (gas fees).

### ✨ Características Principales

- ✅ **Sin comisiones de terceros** (0% a MoonPay/Transak)
- ✅ **Gas fees pagados por BeZhas** (usuario solo paga EUR)
- ✅ **Dispersión automática** desde Safe Wallet
- ✅ **Seguridad multicapa** (Private Key nunca en cliente)
- ✅ **Calculadora en tiempo real** de precio BEZ/EUR

---

## 🏗️ Arquitectura del Sistema

```
Usuario                    Backend Node.js              Blockchain
  │                             │                          │
  │  1. Hace Transferencia      │                          │
  │     SEPA al IBAN            │                          │
  │     Concepto: BEZ-ABC123    │                          │
  │                             │                          │
  │  2. Admin Confirma          │                          │
  ├─────────────────────────────>                          │
  │     POST /api/fiat/confirm  │                          │
  │                             │                          │
  │                             │  3. Hot Wallet llama     │
  │                             │     transferFrom()       │
  │                             ├─────────────────────────>│
  │                             │     (Safe -> Usuario)    │
  │                             │                          │
  │                             │  4. TX Confirmada        │
  │                             <─────────────────────────┤
  │                             │                          │
  │  5. Tokens recibidos ✅     │                          │
  <─────────────────────────────┤                          │
```

### Componentes Clave

| Componente | Dirección | Función |
|------------|-----------|---------|
| **Safe Wallet** | `0x3EfC...e8a3` | Bóveda con los tokens BEZ |
| **Hot Wallet** | `0x52Df...044E` | Wallet delegada que ejecuta `transferFrom()` |
| **BEZ Token** | `0xEcBa...1A8` | Token ERC20 en Polygon |

---

## 🚀 Instalación y Configuración

### Paso 1: Variables de Entorno

Edita `backend/.env` y agrega:

```env
# Polygon RPC
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology

# Hot Wallet (Delegated Spender)
HOT_WALLET_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Admin Secret (Protege endpoint de confirmación)
ADMIN_SECRET=your-super-secret-admin-key-change-in-production

# Token Address
BEZCOIN_ADDRESS=0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
```

⚠️ **CRÍTICO**: La `HOT_WALLET_PRIVATE_KEY` debe ser la Private Key de la wallet `0x52Df82920CBAE522880dD7657e43d1A754eD044E`.

### Paso 2: Aprobar el Hot Wallet desde la Safe

Antes de que el sistema funcione, debes **aprobar** (approve) la Hot Wallet para que pueda gastar tokens en nombre de la Safe.

#### Opción A: Desde Gnosis Safe UI

1. Ve a [Gnosis Safe](https://app.safe.global/)
2. Conecta la Safe Wallet `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3`
3. Ve a "Apps" → "Transaction Builder"
4. Contrato: `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` (BEZ Token)
5. Función: `approve(address spender, uint256 amount)`
6. Parámetros:
   - `spender`: `0x52Df82920CBAE522880dD7657e43d1A754eD044E`
   - `amount`: `115792089237316195423570985008687907853269984665640564039457584007913129639935` (Max uint256)
7. Ejecuta la transacción

#### Opción B: Desde Hardhat/Script

```javascript
const { ethers } = require('hardhat');

async function main() {
    const bezToken = await ethers.getContractAt(
        'IERC20',
        '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8'
    );
    
    const hotWallet = '0x52Df82920CBAE522880dD7657e43d1A754eD044E';
    const maxUint = ethers.MaxUint256;
    
    const tx = await bezToken.approve(hotWallet, maxUint);
    await tx.wait();
    
    console.log('✅ Approved!');
}

main();
```

### Paso 3: Fondear la Hot Wallet con MATIC

La Hot Wallet necesita MATIC para pagar gas fees:

```bash
# Envía 1 MATIC a la Hot Wallet
# Desde tu wallet principal o exchange
To: 0x52Df82920CBAE522880dD7657e43d1A754eD044E
Amount: 1 MATIC
```

Con 1 MATIC puedes procesar ~1000 transferencias (gas fee ~$0.001 por TX).

### Paso 4: Verificar Estado del Sistema

```bash
cd backend
node scripts/fiat-admin.js status
```

Deberías ver:

```
✅ System ready to process payments!
```

---

## 🖥️ Uso del Sistema

### Para Usuarios (Frontend)

1. El usuario importa el componente en cualquier página:

```jsx
import BuyBezOptions from '../components/payments/BuyBezOptions';

function WalletPage() {
    return (
        <div>
            <BuyBezOptions />
        </div>
    );
}
```

2. El usuario selecciona "Bank Transfer"
3. Ve los datos bancarios y la calculadora
4. Hace la transferencia con el código de referencia `BEZ-ABC123`
5. Espera 1-24h para recibir los tokens

### Para Administradores (Backend)

#### Opción 1: API Endpoint (Recomendado)

```bash
curl -X POST http://localhost:3001/api/fiat/confirm-payment \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-admin-secret" \
  -d '{
    "userWallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "amountEur": 100,
    "referenceId": "BEZ-ABC123"
  }'
```

#### Opción 2: Script CLI

```bash
node backend/scripts/fiat-admin.js confirm 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb 100
```

---

## 📡 Endpoints de la API

### 1. GET `/api/fiat/bank-details`
Obtiene los datos bancarios para el frontend.

**Response:**
```json
{
  "success": true,
  "data": {
    "bankName": "BeZhas Platform",
    "iban": "ES77 1465 0100 91 1766376210",
    "bic": "INGDESMMXXX",
    "beneficiary": "bez.digital"
  }
}
```

### 2. POST `/api/fiat/calculate`
Calcula cuántos BEZ por X EUR.

**Request:**
```json
{
  "amountEur": 100
}
```

**Response:**
```json
{
  "success": true,
  "input": { "amountEur": 100, "currency": "EUR" },
  "output": { "amountBez": 66666.67, "token": "BEZ" },
  "rate": 0.0015
}
```

### 3. POST `/api/fiat/confirm-payment` (Admin Only)
Confirma un pago y dispersa tokens.

**Headers:**
```
x-admin-secret: your-admin-secret
```

**Request:**
```json
{
  "userWallet": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "amountEur": 100,
  "referenceId": "BEZ-ABC123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment confirmed and tokens dispersed successfully",
  "data": {
    "txHash": "0xabc123...",
    "blockNumber": 12345678,
    "tokensSent": 66666.67,
    "rate": 0.0015,
    "explorerUrl": "https://amoy.polygonscan.com/tx/0xabc123..."
  }
}
```

### 4. GET `/api/fiat/status` (Admin Only)
Verifica estado de las wallets.

**Response:**
```json
{
  "success": true,
  "data": {
    "safeAddress": "0x3EfC...",
    "hotWalletAddress": "0x52Df...",
    "bezBalance": "1000000",
    "allowance": "999999",
    "hotWalletMaticBalance": "0.95",
    "isConfigured": true,
    "needsApproval": false
  }
}
```

---

## 🔐 Seguridad

### Protecciones Implementadas

1. **Private Key Isolation**: La PK de la Safe Wallet NUNCA está en el servidor
2. **Admin Secret**: Endpoint de confirmación protegido por header secreto
3. **Validación de Balances**: Verifica fondos antes de ejecutar TX
4. **Validación de Allowance**: Confirma que Hot Wallet tiene permiso
5. **Rate Limiting**: Protección contra spam (implementado en `server.js`)

### Recomendaciones Adicionales

- 🔒 Usa HTTPS en producción
- 🔒 Cambia `ADMIN_SECRET` por un valor fuerte (32+ caracteres)
- 🔒 Guarda la Private Key en un Secret Manager (AWS Secrets, Google Cloud KMS)
- 🔒 Implementa 2FA para el Admin Panel
- 🔒 Monitorea transacciones sospechosas con Discord Webhooks

---

## 🧪 Testing

### 1. Verificar Estado

```bash
node backend/scripts/fiat-admin.js status
```

### 2. Simular Pago (Testnet)

```bash
# En Amoy Testnet
node backend/scripts/fiat-admin.js confirm 0xTuWalletDeTest 10
```

### 3. Verificar TX en Explorer

```bash
https://amoy.polygonscan.com/tx/<txHash>
```

---

## 🐛 Troubleshooting

### Error: "Hot Wallet needs approve()"

**Causa**: La Safe no ha dado permiso a la Hot Wallet.  
**Solución**: Ejecuta `approve()` desde la Safe (ver Paso 2).

### Error: "Hot Wallet needs MATIC for gas fees"

**Causa**: La Hot Wallet no tiene MATIC.  
**Solución**: Envía 1 MATIC a `0x52Df82920CBAE522880dD7657e43d1A754eD044E`.

### Error: "Safe Wallet insufficient funds"

**Causa**: La Safe no tiene suficientes tokens BEZ.  
**Solución**: Envía tokens BEZ a la Safe desde otra wallet.

### Error: "Transaction reverted"

**Causas posibles**:
1. El usuario ya recibió los tokens
2. Allowance insuficiente
3. Balance insuficiente

**Solución**: Verifica el estado con `node scripts/fiat-admin.js status`.

---

## 🔄 Próximos Pasos

### Mejoras Futuras

1. **Integración con OpenBanking**: Detectar transferencias automáticamente
2. **Panel Admin UI**: Dashboard para gestionar órdenes visualmente
3. **Modelo de Base de Datos**: Guardar órdenes pendientes/completadas
4. **Notificaciones**: Email/SMS cuando los tokens sean enviados
5. **Oracle de Precios**: Conectar con QuickSwap Pool para precio real
6. **Staking Interno**: Implementar contrato de Staking (separado de liquidez)

---

## 📞 Soporte

Si tienes problemas con la implementación, verifica:

1. ✅ `.env` tiene todas las variables configuradas
2. ✅ `approve()` fue ejecutado desde la Safe
3. ✅ Hot Wallet tiene MATIC para gas
4. ✅ Safe Wallet tiene tokens BEZ disponibles

Para más ayuda, revisa:
- [COMPLETE_SYSTEM_GUIDE.md](../COMPLETE_SYSTEM_GUIDE.md)
- [Logs del Backend](../backend/logs/)

---

## 📝 Licencia

Este módulo es parte del proyecto BeZhas y está sujeto a la licencia del proyecto principal.
