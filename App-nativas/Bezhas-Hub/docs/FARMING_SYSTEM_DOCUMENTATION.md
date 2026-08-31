# 🌾 BeZhas Farming System - Implementación Completa

## 📋 Resumen
Sistema de Yield Farming implementado end-to-end para BeZhas, permitiendo a los usuarios hacer staking de tokens y recibir recompensas con multiplicadores por bloqueo temporal.

## 🏗️ Arquitectura

### 1. Smart Contract (Solidity)
- **Archivo**: `contracts/LiquidityFarming.sol`
- **Funcionalidades**:
  - Múltiples pools de farming con diferentes tokens
  - Sistema de recompensas por bloques
  - Multiplicadores por períodos de bloqueo (7, 30, 90, 180, 365 días)
  - Retiro de emergencia
  - Administración de pools (agregar, pausar, modificar recompensas)

### 2. SDK (JavaScript)
- **Archivo**: `sdk/farming.js`
- **Clase**: `FarmingSDK`
- **Métodos Principales**:
  ```javascript
  // Operaciones de usuario
  deposit(pid, amount, lockPeriod)        // Hacer staking
  withdraw(pid, amount)                    // Retirar stake
  claimRewards(pid)                        // Reclamar recompensas
  
  // Consultas
  getPendingRewards(pid, userAddress)      // Recompensas pendientes
  getUserInfo(pid, userAddress)            // Info del stake del usuario
  getPoolInfo(pid)                         // Información del pool
  
  // Utilidades
  calculateAPY(pid, rewardPerBlock, blocksPerYear)
  getLockMultiplier(lockPeriod)
  
  // Eventos
  onEvent(eventName, callback)             // Escuchar eventos
  offEvent(eventName, callback)            // Dejar de escuchar
  ```

### 3. Backend Service
- **Archivo**: `backend/services/farming.service.js`
- **Funciones**:
  - `initialize()` - Inicializa el SDK con provider
  - `getAllPools()` - Retorna todos los pools activos con APY calculado
  - `getUserFarmingData(userAddress)` - Datos de staking del usuario
  - `getFarmingStats()` - Estadísticas globales (TVL, pools activos)
  - `canStake(poolId, amount, userAddress)` - Validación de stake
  - `getLockMultipliers()` - Multiplicadores disponibles con % de boost

### 4. API Routes
- **Archivo**: `backend/routes/farming.routes.js`
- **Endpoints**:
  ```
  GET  /api/farming/pools              - Listar todos los pools (público)
  GET  /api/farming/stats              - Estadísticas globales (público)
  GET  /api/farming/multipliers        - Multiplicadores de bloqueo (público)
  GET  /api/farming/user/:address      - Datos de farming del usuario (protegido)
  POST /api/farming/validate-stake     - Validar parámetros de stake (protegido)
  GET  /api/farming/pool/:poolId       - Info de pool específico (público)
  ```

### 5. Frontend Components
- **Página Principal**: `frontend/src/pages/DeFiHub.jsx`
- **Custom Hooks**: `frontend/src/hooks/useFarming.js`
- **Características**:
  - Grid de pools con APY y TVL
  - Modal de staking con selector de lock period
  - Dashboard de stakes activos del usuario
  - Estadísticas globales (TVL, Active Pools, User Rewards)
  - Tabs: "Pools" y "Mis Stakes"
  - Botones de Claim y Withdraw

## 🔄 Flujo de Uso

### Para Usuarios (Staking)
1. Usuario conecta su wallet (wagmi)
2. Visualiza pools disponibles en `/defi`
3. Selecciona un pool y hace clic en "Stake"
4. Ingresa cantidad y selecciona período de bloqueo
5. Backend valida los parámetros
6. Usuario aprueba transacción en su wallet
7. SDK ejecuta `deposit()` en el contrato
8. Frontend actualiza dashboard con nuevo stake

### Para Administradores (Gestión)
1. Admin accede al contrato
2. Puede agregar nuevos pools
3. Modificar tasas de recompensa
4. Pausar/reactivar pools
5. Ver estadísticas y métricas

## 📊 Estructura de Datos

### Pool Structure
```javascript
{
  id: 0,
  name: "BEZ-USDC LP",
  token: "0x...",
  totalStaked: "1000000000000000000", // Wei
  rewardPerBlock: "100000000000000000",
  minStake: "1000000000000000000",
  apy: "120.5",
  active: true
}
```

### User Farming Data
```javascript
{
  pools: [
    {
      poolId: 0,
      staked: "5000000000000000000",
      pendingRewards: "250000000000000000",
      lockEnd: 1735689600,
      multiplier: "1.5",
      canWithdraw: false
    }
  ],
  totalStaked: "5000000000000000000",
  totalRewards: "250000000000000000"
}
```

### Lock Multipliers
```javascript
[
  { seconds: 0, label: "Sin bloqueo", boost: "1.0x (0%)", multiplier: 1.0 },
  { seconds: 604800, label: "7 días", boost: "1.2x (+20%)", multiplier: 1.2 },
  { seconds: 2592000, label: "30 días", boost: "1.5x (+50%)", multiplier: 1.5 },
  { seconds: 7776000, label: "90 días", boost: "2.0x (+100%)", multiplier: 2.0 },
  { seconds: 15552000, label: "180 días", boost: "2.5x (+150%)", multiplier: 2.5 },
  { seconds: 31536000, label: "365 días", boost: "3.0x (+200%)", multiplier: 3.0 }
]
```

## 🔐 Seguridad

### Backend
- ✅ Autenticación JWT en endpoints protegidos
- ✅ Validación de parámetros de entrada
- ✅ Rate limiting (implícito en Express)
- ✅ Sanitización de direcciones Ethereum

### Smart Contract
- ✅ ReentrancyGuard en funciones críticas
- ✅ Pausable por admin
- ✅ Validación de períodos de bloqueo
- ✅ Emergency withdrawal

### Frontend
- ✅ Validación de inputs del usuario
- ✅ Manejo de errores con toast notifications
- ✅ Conexión segura con wagmi/viem
- ✅ Verificación de red (Polygon)

## 🚀 Deployment

### 1. Desplegar Smart Contract
```bash
cd /d/Documentos\ D/Documentos\ Yoe/BeZhas/BeZhas\ Web/bezhas-web3
npx hardhat run scripts/deploy-liquidity-farming.js --network polygon
```

### 2. Configurar Backend
```env
# backend/.env
FARMING_CONTRACT_ADDRESS=0x... # Dirección del contrato desplegado
POLYGON_RPC_URL=https://polygon-rpc.com
```

### 3. Registrar Rutas
```javascript
// backend/server.js (línea 686)
app.use('/api/farming', require('./routes/farming.routes'));
```

### 4. Iniciar Servicios
```bash
# Backend
pnpm run start:backend

# Frontend
cd frontend
pnpm run dev
```

## 📝 Variables de Entorno Requeridas

### Backend
```env
FARMING_CONTRACT_ADDRESS=0x...
POLYGON_RPC_URL=https://polygon-rpc.com
JWT_SECRET=your-jwt-secret
MONGODB_URI=mongodb://localhost:27017/bezhas
```

### Frontend
```env
VITE_API_URL=http://localhost:3001
VITE_FARMING_CONTRACT=0x...
VITE_CHAIN_ID=137 # Polygon Mainnet
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
pnpm test services/farming.service.test.js
pnpm test routes/farming.routes.test.js
```

### Frontend Tests
```bash
cd frontend
pnpm test DeFiHub.test.jsx
```

### Contract Tests
```bash
npx hardhat test test/LiquidityFarming.test.js
```

## 📈 Próximas Mejoras

### Fase 2 (Próximas)
- [ ] WebSocket para actualizaciones en tiempo real
- [ ] Gráficos históricos de APY
- [ ] Calculadora de ROI
- [ ] Auto-compound de recompensas
- [ ] Notificaciones de unlock

### Fase 3 (Futuras)
- [ ] Pools con múltiples tokens de recompensa
- [ ] Migración de stakes entre pools
- [ ] Gobernanza para aprobar nuevos pools
- [ ] Integración con agregadores de yield (Yearn, Beefy)

## 🐛 Debugging

### Backend no encuentra el contrato
```bash
# Verificar que FARMING_CONTRACT_ADDRESS está configurado
echo $FARMING_CONTRACT_ADDRESS

# Verificar que el contrato está desplegado
npx hardhat verify --network polygon 0x...
```

### Frontend no carga pools
```javascript
// Abrir consola del navegador
// Verificar respuesta de API
fetch('http://localhost:3001/api/farming/pools')
  .then(r => r.json())
  .then(console.log)
```

### Transacción falla en wallet
- Verificar que el usuario tiene suficientes tokens
- Verificar gas limit (mínimo 200,000)
- Verificar allowance del contrato
- Verificar que el pool está activo

## 👥 Roles y Permisos

### Usuario
- Ver pools
- Hacer stake
- Retirar stake (después del lock)
- Reclamar recompensas
- Ver sus estadísticas

### Admin
- Crear pools
- Modificar recompensas
- Pausar/reactivar pools
- Ver estadísticas globales
- Gestionar emergencias

## 📞 Soporte

Para problemas o preguntas:
- Backend: Revisar logs en `backend/logs/`
- Frontend: Abrir DevTools → Console
- Contrato: Verificar eventos en PolygonScan
- API: Probar endpoints con Postman/curl

---

**Implementado por**: BeZhas Development Team  
**Fecha**: Enero 2025  
**Versión**: 1.0.0  
**Estado**: ✅ Producción Lista (Backend + Frontend completos)
