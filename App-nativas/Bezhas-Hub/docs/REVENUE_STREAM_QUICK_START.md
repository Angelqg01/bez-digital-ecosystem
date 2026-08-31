# 🚀 Revenue Stream Native - Quick Start

## ¿Qué es esto?

BeZhas ahora **genera ingresos automáticamente** de cada transacción. En lugar de quemar tokens, cobramos un **0.5% de fee** que va directo a la tesorería para financiar el desarrollo.

### Beneficios Clave

✅ **Revenue Sostenible**: $60K/año con $1M de volumen mensual  
✅ **AI Security**: Prevención automática de fraude  
✅ **Gas Eficiente**: Arquitectura basada en firmas criptográficas  
✅ **UX Simple**: Aprobación en 1 click (sin whitelists)  
✅ **100% Transparente**: Todas las fees visibles on-chain  

---

## 🎯 Implementación Completa

### Archivos Creados

| Archivo | Ubicación | Propósito |
|---------|-----------|-----------|
| **BezLiquidityRamp.sol** | `backend/contracts/` | Smart contract con revenue system |
| **aiRiskEngine.controller.js** | `backend/controllers/` | AI Risk Engine + firma criptográfica |
| **aiRiskEngine.routes.js** | `backend/routes/` | API endpoints del AI |
| **aiRiskEngine.js** | `frontend/src/services/` | Service layer (telemetría + firma) |
| **SwapWithAI.jsx** | `frontend/src/components/payments/` | UI component para swaps |
| **deployLiquidityRamp.js** | `backend/scripts/` | Script de deployment |
| **.env.revenue-stream** | `backend/` | Template de configuración |

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| **server.js** | ✅ Rutas del AI registradas (`/api/ai`) |

---

## ⚡ Setup Rápido (5 pasos)

### 1. Configurar Variables de Entorno

```bash
# Backend
cd backend
cp .env.revenue-stream .env
```

Editar `backend/.env`:

```env
# Generar wallet privada: node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"
AI_SIGNER_PRIVATE_KEY=0xTuPrivateKeyAqui

# Después del deployment
BEZ_LIQUIDITY_RAMP_ADDRESS=0xContractAddressAqui

# Polygon RPC
POLYGON_RPC_URL=https://polygon-rpc.com
```

Frontend `.env`:

```env
VITE_BEZ_LIQUIDITY_RAMP_ADDRESS=0xContractAddressAqui
VITE_CHAIN_ID=137
```

### 2. Instalar Dependencias

```bash
# Backend
cd backend
npm install ethers@^6.0.0 @openzeppelin/contracts

# Frontend (ya debería estar)
cd frontend
npm install ethers@^6.0.0
```

### 3. Desplegar Smart Contract

```bash
cd backend

# Editar scripts/deployLiquidityRamp.js:
# - BEZ_TOKEN = "0xTuBezTokenAddress"
# - TREASURY_ADDRESS = "0xTuTreasuryWallet"

# Deploy
npx hardhat run scripts/deployLiquidityRamp.js --network polygon

# Copiar contract address → .env
```

### 4. Otorgar SIGNER_ROLE

```bash
# En Hardhat console o script
const contract = await ethers.getContractAt("BezLiquidityRamp", "0xContractAddress");
const SIGNER_ROLE = await contract.SIGNER_ROLE();
await contract.grantRole(SIGNER_ROLE, "0xBackendWalletAddress");
```

### 5. Iniciar Servicios

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Abrir http://localhost:5173
```

---

## 🧪 Test del Sistema

### Test Manual

1. Abrir frontend
2. Conectar MetaMask (Polygon)
3. Usar componente `<SwapWithAI />`
4. Ingresar 100 USDC
5. Ver fee breakdown: **0.5 USDC fee (0.5%)**
6. Click "Continue" → AI evalúa riesgo
7. Si aprueba → Click "Execute Swap"
8. Confirmar en MetaMask
9. ✅ Verificar:
   - BEZ recibido en wallet
   - 0.5 USDC en treasury wallet
   - Evento `PlatformFeeCollected` en Polygonscan

### Test Automatizado

```bash
cd backend
npm test test/BezLiquidityRamp.test.js
```

**Tests incluidos**:
- ✅ Fee collection (0.5%)
- ✅ Signature validation
- ✅ Anti-replay protection
- ✅ Role-based access
- ✅ Statistics tracking
- ✅ Edge cases

---

## 📊 Flujo del Sistema

```
┌──────────┐    1. Enter 1000 USDC
│  USER    │────────────────────────┐
└──────────┘                        │
                                    ▼
                            ┌───────────────┐
                            │   FRONTEND    │
                            │  SwapWithAI   │
                            └───────────────┘
                                    │
                    2. POST /api/ai/sign-swap
                    {telemetry, amount}
                                    │
                                    ▼
                            ┌───────────────┐
                            │   BACKEND     │
                            │  AI Engine    │
                            └───────────────┘
                                    │
                  3. Calculate Risk Score (7 factors)
                     KYC, VPN, Balance, etc.
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            Score >= 60                      Score < 60
            (APPROVED)                       (REJECTED)
                    │                               │
        4. Generate EIP-191            4. Return risk flags
           signature                      & improvement tips
                    │                               │
                    ▼                               ▼
        ┌───────────────────┐          ┌──────────────────┐
        │ Return signature  │          │ Show rejection   │
        │ + deadline        │          │ to user          │
        └───────────────────┘          └──────────────────┘
                    │
        5. User confirms in MetaMask
                    │
                    ▼
        ┌──────────────────────────┐
        │  SMART CONTRACT          │
        │  BezLiquidityRamp.sol    │
        └──────────────────────────┘
                    │
        ┌───────────┴────────────┐
        │                        │
    6. Validate             7. Collect Fee
       signature               5 USDC (0.5%)
       ✓ Correct signer        → Treasury
       ✓ Not expired               │
       ✓ Not used before           │
                                   │
                                   ▼
                        8. Swap 995 USDC → BEZ
                           via Uniswap/QuickSwap
                                   │
                                   ▼
                        9. Transfer BEZ to user
                           Emit events
                           Update stats
                                   │
                                   ▼
                            ┌──────────┐
                            │ SUCCESS! │
                            └──────────┘
```

---

## 🔥 Uso del Componente

### Integración Simple

```jsx
import SwapWithAI from './components/payments/SwapWithAI';

function MyPage() {
  return (
    <SwapWithAI
      serviceId="LIQUIDITY_RAMP"
      onSuccess={(data) => {
        console.log('Swap completed!');
        console.log('Tx Hash:', data.txHash);
        console.log('Amount:', data.amountUSDC);
        console.log('Fee:', data.feeAmount);
        console.log('Net:', data.netAmount);
        
        // Trigger webhook, update UI, etc.
      }}
      onError={(error) => {
        console.error('Swap failed:', error.message);
        // Show error toast
      }}
    />
  );
}
```

### Customización

```jsx
// Para otros servicios (no solo swaps)
<SwapWithAI 
  serviceId="NFT_PURCHASE"    // Different service
  onSuccess={handleNFTPurchase}
/>

<SwapWithAI 
  serviceId="PREMIUM_PLAN"    // Subscription
  onSuccess={activatePremium}
/>
```

---

## 💰 Revenue Tracking

### Consultar Estadísticas On-Chain

```javascript
// Frontend o Hardhat console
const contract = new ethers.Contract(
  "0xContractAddress",
  ["function getStats() view returns (uint256, uint256, uint256)"],
  provider
);

const [volume, fees, txCount] = await contract.getStats();

console.log({
  totalVolume: ethers.formatUnits(volume, 6) + " USDC",
  totalFees: ethers.formatUnits(fees, 6) + " USDC",
  transactions: txCount.toString(),
  avgTxSize: volume / txCount,
  monthlyRevenue: fees + " USDC"  // If collected this month
});
```

### Monitoreo en Tiempo Real

```javascript
// Backend: Listen to events
contract.on("PlatformFeeCollected", (user, amount, service) => {
  const feeUSDC = ethers.formatUnits(amount, 6);
  
  console.log(`💰 Fee collected: $${feeUSDC} from ${user}`);
  
  // Send alert to Discord
  sendDiscordWebhook({
    content: `**Revenue!** $${feeUSDC} collected from ${service}`,
    color: 0x00ff00
  });
});
```

### Dashboard UI

```jsx
function RevenueDashboard() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    async function fetchStats() {
      const contract = new ethers.Contract(...);
      const [volume, fees, txCount] = await contract.getStats();
      
      setStats({
        volume: ethers.formatUnits(volume, 6),
        fees: ethers.formatUnits(fees, 6),
        transactions: txCount.toString(),
        avgFee: fees / txCount,
        projectedYearly: fees * 12  // If monthly
      });
    }
    fetchStats();
  }, []);
  
  return (
    <div className="dashboard">
      <h2>Revenue Statistics</h2>
      <div className="stats-grid">
        <StatCard title="Total Volume" value={stats?.volume + " USDC"} />
        <StatCard title="Fees Collected" value={stats?.fees + " USDC"} />
        <StatCard title="Transactions" value={stats?.transactions} />
        <StatCard title="Yearly Projection" value={stats?.projectedYearly + " USDC"} />
      </div>
    </div>
  );
}
```

---

## 🔒 Seguridad

### Checklist Pre-Production

- [ ] **Smart contract audit** (CertiK/OpenZeppelin)
- [ ] **Private key en vault** (AWS KMS/1Password)
- [ ] **Rate limiting** (10 req/min por IP)
- [ ] **Monitoring alerts** (Discord/Slack)
- [ ] **Backup de keys** (en lugar seguro)
- [ ] **Contract verified** (Polygonscan)
- [ ] **Emergency pause** (procedimiento documentado)

### Protecciones Implementadas

✅ **Anti-Replay**: Cada firma solo se puede usar 1 vez  
✅ **Signature Expiration**: 5 minutos de validez  
✅ **Role-Based Access**: Solo SIGNER_ROLE puede firmar  
✅ **Fee Cap**: Máximo 5% (no se puede subir más)  
✅ **ReentrancyGuard**: Previene ataques de reentrada  
✅ **SafeERC20**: Transferencias seguras de tokens  

---

## 📈 Métricas de Éxito

### KPIs Objetivo (Q1 2024)

| Métrica | Objetivo |
|---------|----------|
| **Monthly Revenue** | $5,000/mes |
| **Transaction Volume** | $1M/mes |
| **Unique Users** | 500 |
| **Total Swaps** | 1,000 |
| **AI Approval Rate** | 85-90% |
| **Fraud Rate** | <1% |

### Proyección de Ingresos

| Volumen Mensual | Fee (0.5%) | Anual |
|----------------|-----------|-------|
| $100K | $500 | $6K |
| $500K | $2,500 | $30K |
| **$1M** | **$5,000** | **$60K** |
| $5M | $25,000 | $300K |
| $10M | $50,000 | $600K |

---

## 🆘 Troubleshooting

### Error: "Invalid signer"

**Causa**: Backend wallet no tiene SIGNER_ROLE  
**Fix**: `contract.grantRole(SIGNER_ROLE, backendAddress)`

### Error: "Signature already used"

**Causa**: Intentando reutilizar firma (anti-replay)  
**Fix**: Generar nueva firma con nuevo deadline

### Error: "Signature expired"

**Causa**: Firma tiene más de 5 minutos  
**Fix**: Solicitar nueva firma al backend

### Error: "Backend unavailable"

**Causa**: Backend offline o timeout  
**Fix**: Verificar que backend esté corriendo en puerto correcto

---

## 📞 Soporte

**Documentación Completa**: Ver `REVENUE_STREAM_NATIVE.md`  
**Test Suite**: `backend/test/BezLiquidityRamp.test.js`  
**Smart Contract**: `backend/contracts/BezLiquidityRamp.sol`  
**API Docs**: Ver JSDoc en `aiRiskEngine.controller.js`

---

## ✨ Resultado Final

Con este sistema, **BeZhas genera revenue automático** que financia el desarrollo continuo. Es:

- ✅ **Sostenible**: Ingresos recurrentes, no dependencia de inversión externa
- ✅ **Escalable**: Revenue crece linealmente con adopción
- ✅ **Seguro**: AI previene fraude, protege la plataforma
- ✅ **Transparente**: Todas las fees visibles on-chain
- ✅ **User-Friendly**: UX simple, aprobación en 1 click

**¡La plataforma ahora gana dinero por sus servicios para poder seguir desarrollando!** 🚀

---

*Implementado por GitHub Copilot - Enero 2024*
