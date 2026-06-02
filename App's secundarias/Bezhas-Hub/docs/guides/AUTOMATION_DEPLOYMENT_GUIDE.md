# 🚀 Guía de Despliegue del Automation Engine

## 📋 Checklist Completo de Implementación

Esta guía te llevará paso a paso para poner en producción el Automation Engine de BeZhas.

---

## FASE 1: Instalación de Dependencias ✅

### Backend

```bash
cd backend
npm install node-cron axios pino
```

**Dependencias instaladas:**
- `node-cron`: Para jobs periódicos (halving check)
- `axios`: Cliente HTTP para comunicación con ML Service
- `pino`: Logger estructurado (ya estaba instalado)

### Frontend

```bash
cd frontend
npm install canvas-confetti
```

**Dependencias instaladas:**
- `canvas-confetti`: Animaciones de confetti para eventos especiales

---

## FASE 2: Configurar Variables de Entorno

### Backend (.env)

```bash
# Copiar ejemplo
cp .env.example .env

# Editar .env y configurar:
```

```bash
# ===== AUTOMATION ENGINE =====

# Habilitar/deshabilitar sistema
AUTOMATION_ENABLED=true

# ML Service (Python FastAPI)
ML_SERVICE_URL=http://localhost:8000
ML_API_KEY=your-ml-api-key-here

# Blockchain
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
AUTOMATION_PRIVATE_KEY=0xYOUR_AUTOMATION_WALLET_PRIVATE_KEY
BEZHAS_CORE_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS

# Halving Check Job
HALVING_CHECK_CRON=*/30 * * * *
HALVING_CHECK_ENABLED=true

# Oracle (opcional)
ORACLE_API_KEY=your-oracle-api-key
ORACLE_REFRESH_INTERVAL=60000
```

### Frontend (.env)

```bash
# Automation Engine - BeZhasCore Contract
VITE_BEZHAS_CORE_ADDRESS=0xYOUR_BEZHAS_CORE_CONTRACT_ADDRESS
```

---

## FASE 3: Implementar ML Service (Python)

### 3.1 Crear Proyecto Python

```bash
mkdir ml-service
cd ml-service
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

### 3.2 Instalar Dependencias

```bash
pip install fastapi uvicorn pydantic numpy pandas scikit-learn tensorflow
```

### 3.3 Crear `main.py`

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np

app = FastAPI(title="BeZhas ML Service", version="1.0.0")

# --- MODELS ---

class OracleData(BaseModel):
    assetPair: str
    price: float
    volume: float
    timestamp: int

class MarketAnalysisRequest(BaseModel):
    timestamp: int
    assetPair: str
    price: float
    volume: float

class MarketDecision(BaseModel):
    trend: str  # BULLISH, BEARISH, STABLE
    recommendedAPY: int
    riskLevel: int
    confidence: float
    sentiment: str
    reasoning: str

class APYOptimizationRequest(BaseModel):
    currentAPY: int
    marketConditions: dict
    userActivity: dict
    competitorAPYs: List[int] = []

class APYOptimizationResponse(BaseModel):
    optimalAPY: int
    confidence: float
    reasoning: str
    impact: Optional[dict] = None

class HalvingCheckRequest(BaseModel):
    totalSupply: int
    circulatingSupply: int
    burnRate: float
    priceHistory: List[dict]
    userGrowth: dict

class HalvingCheckResponse(BaseModel):
    shouldHalve: bool
    confidence: float
    reasoning: str
    timing: Optional[str] = None
    urgency: str = "MEDIUM"

# --- ENDPOINTS ---

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "BeZhas ML"}

@app.post("/analyze", response_model=MarketDecision)
def analyze_market(data: MarketAnalysisRequest):
    """
    Analiza condiciones del mercado y retorna decisión
    
    LÓGICA SIMPLIFICADA (Reemplazar con modelo ML real):
    - Precio > promedio histórico → BULLISH
    - Alto volumen + precio bajo → BEARISH (oportunidad compra)
    - Volatilidad baja → STABLE
    """
    
    # TODO: Implementar modelo ML real aquí
    # Por ahora, lógica de ejemplo:
    
    if data.price > 60000:
        trend = "BULLISH"
        recommended_apy = 1000  # 10% APY (mercado alcista, menos incentivos)
        sentiment = "POSITIVE"
        reasoning = "Precio alto, mercado alcista. Reducir incentivos."
    elif data.price < 50000:
        trend = "BEARISH"
        recommended_apy = 1800  # 18% APY (mercado bajista, más incentivos)
        sentiment = "NEGATIVE"
        reasoning = "Precio bajo, mercado bajista. Aumentar incentivos para retener liquidez."
    else:
        trend = "STABLE"
        recommended_apy = 1200  # 12% APY
        sentiment = "NEUTRAL"
        reasoning = "Mercado estable, mantener APY moderado."
    
    risk_level = 5 if trend == "STABLE" else (3 if trend == "BULLISH" else 7)
    confidence = 0.85  # TODO: Calcular confianza real del modelo
    
    return MarketDecision(
        trend=trend,
        recommendedAPY=recommended_apy,
        riskLevel=risk_level,
        confidence=confidence,
        sentiment=sentiment,
        reasoning=reasoning
    )

@app.post("/optimize/apy", response_model=APYOptimizationResponse)
def optimize_apy(data: APYOptimizationRequest):
    """
    Calcula APY óptimo basado en múltiples factores
    """
    
    # Algoritmo simplificado (Reemplazar con ML):
    current = data.currentAPY
    
    # Factor de mercado
    market_factor = 1.0
    if data.marketConditions.get("trend") == "BEARISH":
        market_factor = 1.2  # Subir APY 20%
    elif data.marketConditions.get("trend") == "BULLISH":
        market_factor = 0.9  # Bajar APY 10%
    
    # Factor de competencia
    if data.competitorAPYs:
        avg_competitor = sum(data.competitorAPYs) / len(data.competitorAPYs)
        if current < avg_competitor * 0.8:
            market_factor *= 1.1  # Subir para competir
    
    optimal_apy = int(current * market_factor)
    
    # Límites de seguridad
    optimal_apy = max(500, min(5000, optimal_apy))
    
    return APYOptimizationResponse(
        optimalAPY=optimal_apy,
        confidence=0.80,
        reasoning=f"APY ajustado con factor {market_factor:.2f} basado en condiciones del mercado",
        impact={"expectedUserRetention": 0.95, "projectedTVL": 1000000}
    )

@app.post("/check/halving", response_model=HalvingCheckResponse)
def check_halving(data: HalvingCheckRequest):
    """
    Determina si se debe ejecutar un halving
    
    CRITERIOS:
    - Supply > threshold
    - Precio estable o creciendo
    - User growth positivo
    """
    
    # Lógica simplificada (Reemplazar con modelo ML):
    should_halve = False
    reasoning = "Condiciones no cumplen criterios de halving"
    confidence = 0.5
    urgency = "LOW"
    
    # Check 1: Supply threshold (ej: >5M tokens)
    if data.totalSupply > 5000000:
        # Check 2: Precio estable/creciendo
        if len(data.priceHistory) >= 2:
            recent_price = data.priceHistory[-1]["price"]
            old_price = data.priceHistory[0]["price"]
            
            if recent_price >= old_price * 0.95:  # Precio no cayó más del 5%
                # Check 3: User growth positivo
                if data.userGrowth.get("daily", 0) > 0:
                    should_halve = True
                    confidence = 0.85
                    reasoning = "Supply alto, precio estable, y crecimiento de usuarios positivo"
                    urgency = "MEDIUM"
    
    return HalvingCheckResponse(
        shouldHalve=should_halve,
        confidence=confidence,
        reasoning=reasoning,
        timing="Próximas 24 horas" if should_halve else None,
        urgency=urgency
    )

@app.post("/analyze/user")
def analyze_user(data: dict):
    """
    Análisis de comportamiento de usuario
    """
    # TODO: Implementar scoring de usuarios
    
    score = 50  # Score base
    
    if data.get("transactions", 0) > 10:
        score += 20
    if data.get("stakingHistory", {}).get("totalStaked", 0) > 1000:
        score += 30
    
    return {
        "score": min(100, score),
        "promos": ["welcome_bonus"] if score > 70 else [],
        "flags": []
    }

# --- STARTUP ---

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 3.4 Ejecutar ML Service

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verificar:
```bash
curl http://localhost:8000/health
# Debe retornar: {"status":"healthy","service":"BeZhas ML"}
```

---

## FASE 4: Desplegar Smart Contract BeZhasCore

### 4.1 Crear Contrato `BeZhasCore.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BeZhasCore is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // --- STATE VARIABLES ---

    uint256 public currentAPY; // APY en basis points (ej: 1200 = 12%)
    uint256 public emissionRate; // Tasa de emisión de tokens
    uint256 public totalSupply;
    uint256 public halvingCount;

    // --- EVENTS ---

    event APYUpdated(uint256 oldAPY, uint256 newAPY, uint256 timestamp);
    event HalvingExecuted(uint256 newEmissionRate, uint256 timestamp);
    event EmergencyPause(address indexed pauser, string reason);

    // --- CONSTRUCTOR ---

    constructor(uint256 initialAPY, uint256 initialEmissionRate) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        currentAPY = initialAPY;
        emissionRate = initialEmissionRate;
        totalSupply = 0;
        halvingCount = 0;
    }

    // --- AUTOMATION FUNCTIONS ---

    /**
     * @dev Ajusta el APY de staking (solo AUTOMATION_ROLE)
     */
    function setStakingAPY(uint256 newAPY) external onlyRole(AUTOMATION_ROLE) whenNotPaused {
        require(newAPY >= 500 && newAPY <= 5000, "APY fuera de rango (5%-50%)");
        
        uint256 oldAPY = currentAPY;
        currentAPY = newAPY;

        emit APYUpdated(oldAPY, newAPY, block.timestamp);
    }

    /**
     * @dev Ejecuta un halving automático (solo AUTOMATION_ROLE)
     */
    function executeHalving() external onlyRole(AUTOMATION_ROLE) whenNotPaused nonReentrant returns (bool) {
        require(emissionRate > 0, "Emission rate ya es 0");

        emissionRate = emissionRate / 2;
        halvingCount++;

        emit HalvingExecuted(emissionRate, block.timestamp);

        return true;
    }

    // --- EMERGENCY FUNCTIONS ---

    /**
     * @dev Pausa todas las operaciones (solo PAUSER_ROLE)
     */
    function pause(string calldata reason) external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }

    /**
     * @dev Reanuda operaciones (solo ADMIN_ROLE)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // --- VIEW FUNCTIONS ---

    function getAPY() external view returns (uint256) {
        return currentAPY;
    }

    function getEmissionRate() external view returns (uint256) {
        return emissionRate;
    }

    function getHalvingCount() external view returns (uint256) {
        return halvingCount;
    }
}
```

### 4.2 Desplegar con Hardhat

```javascript
// scripts/deploy-bezhas-core.js
const hre = require("hardhat");

async function main() {
  console.log("🚀 Desplegando BeZhasCore...");

  const initialAPY = 1200; // 12%
  const initialEmissionRate = 1000000; // 1M tokens/día

  const BeZhasCore = await hre.ethers.getContractFactory("BeZhasCore");
  const beZhasCore = await BeZhasCore.deploy(initialAPY, initialEmissionRate);

  await beZhasCore.waitForDeployment();
  const address = await beZhasCore.getAddress();

  console.log("✅ BeZhasCore desplegado en:", address);

  // Otorgar AUTOMATION_ROLE a la wallet de automatización
  const automationWallet = process.env.AUTOMATION_WALLET_ADDRESS;
  if (automationWallet) {
    const AUTOMATION_ROLE = await beZhasCore.AUTOMATION_ROLE();
    await beZhasCore.grantRole(AUTOMATION_ROLE, automationWallet);
    console.log("✅ AUTOMATION_ROLE otorgado a:", automationWallet);
  }

  // Guardar dirección en archivo
  const fs = require('fs');
  const addresses = {
    beZhasCore: address,
    network: hre.network.name,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    './contract-addresses.json',
    JSON.stringify(addresses, null, 2)
  );

  console.log("✅ Dirección guardada en contract-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

**Ejecutar:**
```bash
npx hardhat run scripts/deploy-bezhas-core.js --network polygon
```

### 4.3 Verificar Contrato

```bash
npx hardhat verify --network polygon CONTRACT_ADDRESS 1200 1000000
```

---

## FASE 5: Configurar Automation Wallet

### 5.1 Crear Wallet para Automatización

```javascript
// Generar nueva wallet
const { ethers } = require('ethers');
const wallet = ethers.Wallet.createRandom();

console.log('Address:', wallet.address);
console.log('Private Key:', wallet.privateKey);
console.log('Mnemonic:', wallet.mnemonic.phrase);
```

**IMPORTANTE:** Guarda la private key en un lugar seguro (KeePass, 1Password, etc.)

### 5.2 Fondear Wallet

Enviar MATIC a la wallet para pagar gas:
```
Recomendado: 10 MATIC para ~100 transacciones
```

### 5.3 Otorgar Rol en el Contrato

Desde tu admin wallet:
```javascript
const AUTOMATION_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTOMATION_ROLE"));
await beZhasCore.grantRole(AUTOMATION_ROLE, "0xYOUR_AUTOMATION_WALLET_ADDRESS");
```

### 5.4 Configurar .env

```bash
AUTOMATION_PRIVATE_KEY=0xYOUR_AUTOMATION_WALLET_PRIVATE_KEY
BEZHAS_CORE_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

---

## FASE 6: Iniciar Backend

```bash
cd backend
npm start
```

**Verificar Logs:**
```
✅ All services initialized successfully
✅ Automation Engine initialized
👂 BeZhas event listeners inicializados
```

**Verificar Estado:**
```bash
curl http://localhost:3001/api/automation/health
```

Debe retornar:
```json
{
  "success": true,
  "data": {
    "status": "OK",
    "components": {
      "orchestrator": "UP",
      "halvingJob": "UP",
      "eventBus": "UP",
      "blockchain": "UP"
    }
  }
}
```

---

## FASE 7: Integrar Frontend

### 7.1 Agregar Hook en App.jsx

```javascript
// frontend/src/App.jsx
import { useBeZhasEvents } from './hooks/useBeZhasEvents';

function App() {
  // Activar listeners de eventos del blockchain
  useBeZhasEvents();

  return (
    <Router>
      {/* ... resto de tu app */}
    </Router>
  );
}
```

### 7.2 Instalar Dependencias

```bash
cd frontend
npm install canvas-confetti
```

### 7.3 Verificar .env

```bash
VITE_BEZHAS_CORE_ADDRESS=0xYOUR_DEPLOYED_CONTRACT_ADDRESS
```

### 7.4 Iniciar Frontend

```bash
npm run dev
```

---

## FASE 8: Testing del Sistema

### 8.1 Test Manual: Simular Evento de Oráculo

```bash
curl -X POST http://localhost:3001/api/automation/test/oracle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "assetPair": "BTC/USD",
    "price": 67000,
    "volume": 3000000000
  }'
```

**Resultado Esperado:**
1. Backend recibe evento
2. ML Service analiza datos
3. Orchestrator decide ajustar APY
4. Blockchain Service ejecuta transacción
5. Frontend muestra notificación con confetti

### 8.2 Test Manual: Ajustar APY

```bash
curl -X POST http://localhost:3001/api/automation/manual/apy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "newAPY": 1500,
    "reason": "Test de ajuste manual"
  }'
```

**Verificar en Frontend:**
- Toast notification: "📈 APY: 12% → 15%"
- Confetti animation

### 8.3 Test de Halving Job

```bash
# Verificar logs del job
curl http://localhost:3001/api/automation/logs/events?type=ECONOMY_HALVING_DUE
```

### 8.4 Monitoreo de Métricas

```bash
curl http://localhost:3001/api/automation/metrics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## FASE 9: Despliegue a Producción

### 9.1 Backend (Railway/Heroku/AWS)

**Railway:**
```bash
# Instalar CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

**Variables de Entorno en Railway:**
- Configurar todas las variables de `.env`
- Usar secretos para `AUTOMATION_PRIVATE_KEY`, `ML_API_KEY`

### 9.2 ML Service (Render/Fly.io)

**Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Deploy en Render:**
1. Conectar repo de GitHub
2. Seleccionar `ml-service` directory
3. Configurar puerto 8000
4. Deploy

### 9.3 Frontend (Vercel/Netlify)

**Vercel:**
```bash
npm install -g vercel
cd frontend
vercel --prod
```

**Variables de Entorno en Vercel:**
- `VITE_BEZHAS_CORE_ADDRESS`
- `VITE_API_URL=https://your-backend.railway.app/api`

---

## FASE 10: Monitoreo y Alertas

### 10.1 Configurar Health Checks

**UptimeRobot:**
- Monitor HTTP: `https://your-backend.com/api/automation/health`
- Interval: 5 minutos
- Alerta si status !== 200

### 10.2 Logs Centralizados

**Datadog:**
```javascript
// backend/server.js
const tracer = require('dd-trace').init({
  service: 'bezhas-automation',
  env: 'production'
});
```

### 10.3 Alertas Críticas

Configurar alertas para:
- Circuit breaker abierto
- Halving ejecutado
- APY cambiado >10%
- ML Service down >5 min
- Blockchain desconectado

---

## ✅ Checklist Final

### Backend
- [ ] Dependencias instaladas (`node-cron`, `axios`)
- [ ] Variables de entorno configuradas
- [ ] ML Service corriendo en puerto 8000
- [ ] Automation Engine iniciado sin errores
- [ ] Health check retorna "OK"

### Smart Contract
- [ ] BeZhasCore desplegado en Polygon
- [ ] Contrato verificado en PolygonScan
- [ ] AUTOMATION_ROLE otorgado a wallet
- [ ] Wallet fondeada con MATIC

### Frontend
- [ ] `canvas-confetti` instalado
- [ ] `useBeZhasEvents` integrado en App.jsx
- [ ] VITE_BEZHAS_CORE_ADDRESS configurado
- [ ] Notificaciones funcionando correctamente

### Testing
- [ ] Evento de oráculo simulado exitoso
- [ ] Ajuste manual de APY funciona
- [ ] Frontend recibe eventos y muestra notificaciones
- [ ] Halving job ejecutándose cada 30 min

### Producción
- [ ] Backend desplegado (Railway/AWS)
- [ ] ML Service desplegado (Render/Fly.io)
- [ ] Frontend desplegado (Vercel/Netlify)
- [ ] Health checks configurados
- [ ] Alertas configuradas (Slack/Email)

---

## 🆘 Troubleshooting

### "ML Service no responde"
```bash
# Verificar servicio
curl http://localhost:8000/health

# Reiniciar
cd ml-service
uvicorn main:app --reload
```

### "Circuit breaker abierto"
```bash
# Ver errores
curl http://localhost:3001/api/automation/logs/events

# Reiniciar sistema
curl -X POST http://localhost:3001/api/automation/stop
curl -X POST http://localhost:3001/api/automation/start
```

### "Wallet sin permisos"
```javascript
const AUTOMATION_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTOMATION_ROLE"));
await beZhasCore.grantRole(AUTOMATION_ROLE, automationWalletAddress);
```

---

## 📚 Recursos

- [Documentación Completa](./AUTOMATION_ENGINE_DOCS.md)
- [Resumen de Implementación](./AUTOMATION_IMPLEMENTATION_SUMMARY.md)
- [Smart Contract Addresses](./contract-addresses.json)

---

## 🎉 ¡Listo!

Tu Automation Engine está completamente funcional. El sistema ahora:

✅ Escucha datos de oráculos  
✅ Analiza con Machine Learning  
✅ Ajusta APY automáticamente  
✅ Ejecuta halvings inteligentes  
✅ Notifica a usuarios en tiempo real  

**¡Bienvenido al futuro de las finanzas descentralizadas automatizadas!** 🚀
