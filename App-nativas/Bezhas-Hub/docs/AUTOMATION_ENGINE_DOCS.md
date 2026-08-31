# 🤖 BeZhas Automation Engine - Documentación Completa

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura](#arquitectura)
3. [Componentes](#componentes)
4. [Flujo de Datos](#flujo-de-datos)
5. [Instalación](#instalación)
6. [Configuración](#configuración)
7. [API Reference](#api-reference)
8. [Ejemplos de Uso](#ejemplos-de-uso)
9. [Monitoreo](#monitoreo)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Visión General

El **Automation Engine** es el sistema nervioso central de BeZhas que automatiza completamente la economía de la plataforma utilizando **Machine Learning**, **Oráculos**, y **Smart Contracts**.

### 🌟 Características Principales

- **Ajuste Dinámico de APY**: El ML analiza condiciones del mercado y ajusta automáticamente las recompensas de staking
- **Halving Automático**: Ejecuta halvings basados en predicciones del ML y métricas del sistema
- **Event-Driven Architecture**: Comunicación desacoplada vía Pub/Sub pattern
- **Circuit Breaker**: Protección contra fallos en cascada
- **Health Monitoring**: Monitoreo continuo del estado del sistema

### 🏗️ Stack Tecnológico

- **Backend**: Node.js + Express
- **Event Bus**: EventEmitter con patrón Singleton
- **ML Service**: Python (FastAPI) - Comunicación vía HTTP/gRPC
- **Blockchain**: ethers.js v6 + Smart Contracts (Solidity)
- **Cron Jobs**: node-cron para tareas periódicas
- **Logging**: Pino logger con niveles estructurados

---

## 🏛️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                        AUTOMATION ENGINE                         │
└─────────────────────────────────────────────────────────────────┘

       ┌──────────────┐
       │   ORACLES    │ ← Datos de mercado (precios, volumen)
       └──────┬───────┘
              │
              ▼
       ┌──────────────┐
       │  EVENT BUS   │ ← Sistema Pub/Sub central
       └──────┬───────┘
              │
              ▼
    ┌─────────────────────┐
    │   ORCHESTRATOR      │ ← Director de la orquesta
    └─────────┬───────────┘
              │
         ┌────┴────┐
         ▼         ▼
    ┌────────┐  ┌──────────┐
    │   ML   │  │ CRON JOB │
    │SERVICE │  │ (Halving)│
    └────┬───┘  └─────┬────┘
         │            │
         ▼            ▼
    ┌─────────────────────┐
    │ BLOCKCHAIN SERVICE  │ ← Ejecuta transacciones
    └─────────┬───────────┘
              │
              ▼
       ┌──────────────┐
       │ SMART        │
       │ CONTRACTS    │
       └──────────────┘
              │
              ▼
       ┌──────────────┐
       │   FRONTEND   │ ← Notificaciones a usuarios
       └──────────────┘
```

---

## 🧩 Componentes

### 1. **EventBus** (`automation/events/EventBus.js`)

Sistema Pub/Sub que permite comunicación desacoplada entre módulos.

**Características:**
- Singleton pattern
- Circuit Breaker (threshold: 10 fallos)
- Retry logic (3 intentos, exponential backoff)
- Métricas en tiempo real

**Eventos Predefinidos:**
```javascript
// Oracle
ORACLE_DATA_RECEIVED
ORACLE_ERROR

// Machine Learning
ML_ANALYSIS_COMPLETE
ML_PREDICTION_READY
ML_MODEL_UPDATED

// Blockchain
BLOCKCHAIN_APY_UPDATED
BLOCKCHAIN_HALVING_EXECUTED
BLOCKCHAIN_TX_CONFIRMED

// Economy
ECONOMY_CONFIG_CHANGED
ECONOMY_HALVING_DUE
ECONOMY_RISK_ALERT

// User Experience
USER_ACTIVITY_DETECTED
USER_ELIGIBLE_AIRDROP
USER_PROMO_TRIGGERED

// System
SYSTEM_EMERGENCY_PAUSE
SYSTEM_HEALTH_CHECK
AUTOMATION_HANDLER_FAILED
```

**Ejemplo de Uso:**
```javascript
const eventBus = require('./automation/events/EventBus');

// Publicar evento
eventBus.publish(eventBus.EVENTS.ORACLE_DATA_RECEIVED, {
  oracleData: {
    assetPair: 'BTC/USD',
    price: 65000,
    volume: 2000000000
  }
});

// Suscribirse a evento
eventBus.subscribe(
  eventBus.EVENTS.ML_PREDICTION_READY,
  async (event) => {
    console.log('Predicción recibida:', event.payload.decision);
  },
  { priority: 'high' }
);
```

---

### 2. **ML Service** (`automation/services/ml.service.js`)

Servicio que se comunica con el modelo de Machine Learning (Python) para obtener decisiones inteligentes.

**Métodos Principales:**

#### `analyzeMarketConditions(oracleData)`
Analiza datos del oráculo y retorna una decisión completa.

**Input:**
```javascript
{
  assetPair: 'BTC/USD',
  price: 65000,
  volume: 2000000000,
  timestamp: 1234567890
}
```

**Output:**
```javascript
{
  trendForecast: 'BULLISH', // BULLISH | BEARISH | STABLE
  suggestedAPY: 1500,       // 15% APY
  riskLevel: 3,             // 1-10
  confidence: 0.85,         // 85% confianza
  action: 'INCREASE_INCENTIVES', // INCREASE | DECREASE | MAINTAIN
  sentiment: 'POSITIVE',
  reasoning: 'Mercado alcista con alto volumen',
  recommendedAds: ['promo_staking_bonus']
}
```

#### `calculateOptimalAPY(marketData)`
Calcula el APY óptimo para maximizar retención y crecimiento.

#### `checkHalvingConditions(systemMetrics)`
Determina si se deben ejecutar halvings automáticos.

**Fallback Strategy:**
Si el servicio de ML falla, el sistema usa valores por defecto seguros:
```javascript
{
  defaultAPY: 1200,      // 12%
  defaultRiskLevel: 5,
  defaultTrend: 'STABLE'
}
```

---

### 3. **Blockchain Service** (`automation/services/blockchain.service.js`)

Interfaz con smart contracts para ejecutar decisiones on-chain.

**Métodos Principales:**

#### `initialize()`
Conecta con el blockchain y verifica el rol AUTOMATION_ROLE.

#### `setStakingAPY(newAPY, reason)`
Ajusta el APY de staking en el contrato.

**Ejemplo:**
```javascript
const result = await blockchainService.setStakingAPY(1500, 'Mercado alcista detectado');

// Output:
{
  success: true,
  txHash: '0xabc123...',
  blockNumber: 12345678,
  oldAPY: 1200,
  newAPY: 1500
}
```

#### `executeHalving(reason)`
Ejecuta un halving en el contrato.

**Protecciones:**
- Circuit Breaker (5 fallos → pausa 1 minuto)
- Retry con exponential backoff (3 intentos)
- Gas limit configurado (150k para APY, 300k para halving)

---

### 4. **Automation Orchestrator** (`automation/controllers/AutomationOrchestrator.js`)

El director de orquesta que coordina todos los componentes.

**Flujo de Trabajo:**

```
1. Evento: ORACLE_DATA_RECEIVED
   ↓
2. Orchestrator → ML Service (análisis)
   ↓
3. ML retorna decisión
   ↓
4. Orchestrator evalúa si ejecutar
   ↓
5. Si procede → Blockchain Service (transacción)
   ↓
6. Confirmación → Actualizar UX
```

**Configuración:**
```javascript
{
  minConfidenceForAPYChange: 0.75,      // 75% confianza mínima
  minAPYChangePercent: 2,                // 2% cambio mínimo
  maxAPYChangePerHour: 5,                // Máximo 5 cambios/hora
  halvingCooldown: 86400000              // 24h entre halvings
}
```

---

### 5. **Halving Check Job** (`automation/jobs/halvingCheck.job.js`)

Cron job que verifica periódicamente si se deben ejecutar halvings.

**Schedule por Defecto:** `*/30 * * * *` (cada 30 minutos)

**Verificaciones:**
1. Obtiene métricas del sistema (totalSupply, userGrowth, priceHistory)
2. Envía al ML para análisis
3. Si ML recomienda halving con >80% confianza → Publica evento `ECONOMY_HALVING_DUE`
4. Orchestrator maneja la ejecución

**Health Check:** Cada 5 minutos verifica el estado de:
- EventBus
- Circuit Breakers
- Métricas de jobs

---

## 🔄 Flujo de Datos Completo

### Ejemplo: Ajuste Automático de APY

```
1. ORÁCULO recibe precio BTC: $65,000
   ↓
2. Publica ORACLE_DATA_RECEIVED al EventBus
   ↓
3. ORCHESTRATOR recibe evento
   ↓
4. Llama ML.analyzeMarketConditions()
   ↓
5. ML (Python) analiza:
   - Tendencia: BULLISH
   - Volatilidad: Media
   - Sentimiento: Positivo
   ↓
6. ML retorna: suggestedAPY = 1000 (10%)
   ↓
7. ORCHESTRATOR evalúa:
   - ¿Confianza > 75%? ✅ (85%)
   - ¿Cambio significativo? ✅ (actual 12% → 10%)
   - ¿Límite de cambios/hora? ✅ (2 de 5)
   ↓
8. ORCHESTRATOR → blockchainService.setStakingAPY(1000)
   ↓
9. BLOCKCHAIN SERVICE ejecuta transacción
   ↓
10. Smart Contract emite evento APYUpdated
    ↓
11. ORCHESTRATOR actualiza UX:
    - Post en feed social
    - Notificación push a usuarios
    ↓
12. MÉTRICAS actualizadas
```

---

## 📦 Instalación

### 1. Instalar Dependencias

```bash
cd backend
npm install node-cron axios pino
```

### 2. Configurar Variables de Entorno

Copiar `.env.example` a `.env` y configurar:

```bash
# Automation Engine
AUTOMATION_ENABLED=true

# ML Service
ML_SERVICE_URL=http://localhost:8000
ML_API_KEY=your-ml-api-key

# Blockchain
RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY
AUTOMATION_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
BEZHAS_CORE_ADDRESS=0xYOUR_CONTRACT_ADDRESS

# Halving Job
HALVING_CHECK_CRON=*/30 * * * *
HALVING_CHECK_ENABLED=true
```

### 3. Configurar Smart Contract

El contrato debe tener el rol `AUTOMATION_ROLE`:

```solidity
// En tu contrato BeZhasCore.sol
bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");

function setStakingAPY(uint256 newAPY) external onlyRole(AUTOMATION_ROLE) {
    uint256 oldAPY = currentAPY;
    currentAPY = newAPY;
    emit APYUpdated(oldAPY, newAPY, block.timestamp);
}

function executeHalving() external onlyRole(AUTOMATION_ROLE) returns (bool) {
    emissionRate = emissionRate / 2;
    emit HalvingExecuted(emissionRate, block.timestamp);
    return true;
}
```

### 4. Otorgar Rol a la Wallet de Automatización

```javascript
// En tu script de deployment o admin panel
const AUTOMATION_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTOMATION_ROLE"));
await beZhasCore.grantRole(AUTOMATION_ROLE, "0xYOUR_AUTOMATION_WALLET");
```

---

## ⚙️ Configuración

### Ajustar Umbrales del Orchestrator

Editar `automation/controllers/AutomationOrchestrator.js`:

```javascript
this.config = {
  minConfidenceForAPYChange: 0.80,   // Aumentar a 80% si quieres más conservador
  minAPYChangePercent: 5,             // Cambio mínimo de 5%
  maxAPYChangePerHour: 3,             // Reducir a 3 cambios/hora
  halvingCooldown: 172800000          // 48 horas entre halvings
};
```

### Cambiar Schedule del Halving Job

```bash
# En .env
HALVING_CHECK_CRON=*/15 * * * *  # Cada 15 minutos (más frecuente)
# o
HALVING_CHECK_CRON=0 */2 * * *   # Cada 2 horas (menos frecuente)
```

---

## 🔌 API Reference

### Endpoints del Automation Engine

#### **GET** `/api/automation/status`
Obtener estado general del sistema.

**Requiere:** Admin token

**Response:**
```json
{
  "success": true,
  "data": {
    "orchestrator": {
      "isRunning": true,
      "metrics": {
        "totalDecisions": 156,
        "successfulAdjustments": 142,
        "failedAdjustments": 2,
        "halvingsExecuted": 3
      }
    },
    "halvingJob": {
      "isRunning": true,
      "metrics": {
        "totalChecks": 48,
        "halvingTriggered": 1
      }
    },
    "eventBus": {
      "totalEvents": 1024,
      "circuitBreaker": {
        "isOpen": false
      }
    },
    "blockchain": {
      "isInitialized": true,
      "currentAPY": 1200
    }
  }
}
```

#### **POST** `/api/automation/start`
Iniciar el sistema de automatización.

**Requiere:** Admin token

**Response:**
```json
{
  "success": true,
  "message": "Sistema de automatización iniciado"
}
```

#### **POST** `/api/automation/stop`
Detener el sistema.

#### **POST** `/api/automation/manual/apy`
Ajustar APY manualmente (bypass ML).

**Body:**
```json
{
  "newAPY": 1500,
  "reason": "Promoción especial de verano"
}
```

#### **POST** `/api/automation/test/oracle`
Simular datos del oráculo (testing).

**Body:**
```json
{
  "assetPair": "BTC/USD",
  "price": 67000,
  "volume": 3000000000
}
```

**Response:**
```json
{
  "success": true,
  "message": "Evento de oráculo simulado",
  "note": "El sistema procesará estos datos automáticamente"
}
```

#### **GET** `/api/automation/health`
Health check público (no requiere auth).

**Response:**
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

## 💡 Ejemplos de Uso

### Ejemplo 1: Integrar con un Oráculo Externo

```javascript
// En tu servicio de oráculo (oracle.service.js)
const axios = require('axios');
const eventBus = require('./automation/events/EventBus');

async function fetchMarketData() {
  const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
    params: {
      ids: 'bitcoin',
      vs_currencies: 'usd',
      include_24hr_vol: true
    }
  });

  const { bitcoin } = response.data;

  // Publicar al EventBus
  eventBus.publish(eventBus.EVENTS.ORACLE_DATA_RECEIVED, {
    oracleData: {
      id: `coingecko_${Date.now()}`,
      source: 'CoinGecko',
      assetPair: 'BTC/USD',
      price: bitcoin.usd,
      volume: bitcoin.usd_24h_vol,
      timestamp: Date.now()
    }
  });
}

// Ejecutar cada 5 minutos
setInterval(fetchMarketData, 300000);
```

### Ejemplo 2: Escuchar Eventos en el Frontend

```javascript
// frontend/src/hooks/useBeZhasEvents.js
import { useEffect } from 'react';
import { useWeb3 } from './useWeb3';
import { toast } from 'react-hot-toast';
import confetti from 'canvas-confetti';

export function useBeZhasEvents() {
  const { contract } = useWeb3();

  useEffect(() => {
    if (!contract) return;

    // Listener: APY Updated
    const handleAPYUpdated = (oldAPY, newAPY, timestamp) => {
      const oldPercent = Number(oldAPY) / 100;
      const newPercent = Number(newAPY) / 100;

      const emoji = newPercent > oldPercent ? '📈' : '📉';
      toast.success(
        `${emoji} APY actualizado: ${oldPercent}% → ${newPercent}%`,
        { duration: 5000 }
      );
    };

    // Listener: Halving Executed
    const handleHalving = (newEmissionRate, timestamp) => {
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 }
      });

      toast('🔪 ¡HALVING EJECUTADO!', {
        icon: '🚨',
        duration: 10000,
        style: {
          background: '#ff4757',
          color: '#fff',
          fontSize: '18px'
        }
      });
    };

    contract.on('APYUpdated', handleAPYUpdated);
    contract.on('HalvingExecuted', handleHalving);

    return () => {
      contract.off('APYUpdated', handleAPYUpdated);
      contract.off('HalvingExecuted', handleHalving);
    };
  }, [contract]);
}
```

### Ejemplo 3: Dashboard de Monitoreo

```javascript
// frontend/src/pages/admin/AutomationDashboard.jsx
import { useQuery } from 'react-query';
import axios from 'axios';

export function AutomationDashboard() {
  const { data: status } = useQuery('automation-status', async () => {
    const res = await axios.get('/api/automation/status');
    return res.data.data;
  }, { refetchInterval: 10000 }); // Refresh cada 10s

  return (
    <div>
      <h1>🤖 Automation Engine Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        {/* Orchestrator */}
        <div className="card">
          <h3>Orchestrator</h3>
          <p>Status: {status?.orchestrator.isRunning ? '🟢 Running' : '🔴 Stopped'}</p>
          <p>Total Decisions: {status?.orchestrator.metrics.totalDecisions}</p>
          <p>Success Rate: {(
            status?.orchestrator.metrics.successfulAdjustments /
            status?.orchestrator.metrics.totalDecisions * 100
          ).toFixed(1)}%</p>
        </div>

        {/* Halving Job */}
        <div className="card">
          <h3>Halving Job</h3>
          <p>Status: {status?.halvingJob.isRunning ? '🟢 Running' : '🔴 Stopped'}</p>
          <p>Total Checks: {status?.halvingJob.metrics.totalChecks}</p>
          <p>Halvings Triggered: {status?.halvingJob.metrics.halvingTriggered}</p>
        </div>

        {/* Blockchain */}
        <div className="card">
          <h3>Blockchain</h3>
          <p>Current APY: {status?.blockchain.currentAPY / 100}%</p>
          <p>Status: {status?.blockchain.isInitialized ? '🟢 Connected' : '🔴 Disconnected'}</p>
        </div>
      </div>

      {/* Event Bus Metrics */}
      <div className="card mt-4">
        <h3>Event Bus</h3>
        <p>Total Events: {status?.eventBus.metrics.totalEvents}</p>
        <p>Circuit Breaker: {status?.eventBus.metrics.circuitBreaker?.isOpen ? '🔴 OPEN' : '🟢 CLOSED'}</p>
      </div>
    </div>
  );
}
```

---

## 📊 Monitoreo

### Métricas Clave

1. **Orchestrator**
   - `totalDecisions`: Total de decisiones tomadas
   - `successfulAdjustments`: Ajustes exitosos
   - `failedAdjustments`: Ajustes fallidos
   - `halvingsExecuted`: Halvings ejecutados

2. **Event Bus**
   - `totalEvents`: Total de eventos procesados
   - `eventsByType`: Desglose por tipo de evento
   - `circuitBreaker.isOpen`: Estado del circuit breaker
   - `errors`: Lista de errores recientes

3. **Blockchain Service**
   - `isInitialized`: Estado de conexión
   - `currentAPY`: APY actual del contrato

### Logs Estructurados (Pino)

Todos los logs se generan en formato JSON con niveles:

```json
{
  "level": "info",
  "time": 1234567890,
  "msg": "🧠 Decisión del ML recibida",
  "trend": "BULLISH",
  "suggestedAPY": 1500,
  "confidence": 0.85,
  "action": "INCREASE_INCENTIVES"
}
```

**Niveles:**
- `trace`: Debugging detallado
- `info`: Operaciones normales
- `warn`: Advertencias (ej: circuit breaker, fallback)
- `error`: Errores que requieren atención
- `fatal`: Errores críticos que detienen el sistema

### Alertas Recomendadas

Configurar alertas para:

1. **Circuit Breaker Abierto** → Investigar fallos repetidos
2. **Halving Ejecutado** → Comunicar a usuarios
3. **APY Cambiado >5%** → Revisar decisión del ML
4. **ML Service Down** → Verificar servicio Python
5. **Blockchain Desconectado** → Revisar RPC

---

## 🐛 Troubleshooting

### Problema: "Circuit breaker abierto"

**Causa:** Demasiados fallos consecutivos (>10).

**Solución:**
1. Verificar logs de errores: `GET /api/automation/logs/events?type=AUTOMATION_HANDLER_FAILED`
2. Verificar conexión con ML Service: `curl http://localhost:8000/health`
3. Verificar conexión blockchain: Revisar `RPC_URL` en `.env`
4. Reiniciar el sistema: `POST /api/automation/stop` → `POST /api/automation/start`

### Problema: "ML Service no disponible"

**Causa:** Servicio Python no está corriendo.

**Solución:**
```bash
# Verificar si el servicio está corriendo
curl http://localhost:8000/health

# Si no responde, iniciar el servicio Python
cd ml-service
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### Problema: "Wallet no tiene AUTOMATION_ROLE"

**Causa:** La wallet configurada en `AUTOMATION_PRIVATE_KEY` no tiene permisos.

**Solución:**
```javascript
// Desde admin wallet, ejecutar:
const AUTOMATION_ROLE = ethers.keccak256(ethers.toUtf8Bytes("AUTOMATION_ROLE"));
await beZhasCore.grantRole(AUTOMATION_ROLE, "0xYOUR_AUTOMATION_WALLET_ADDRESS");
```

### Problema: "APY no se ajusta automáticamente"

**Diagnóstico:**
1. Verificar que el orchestrator esté corriendo: `GET /api/automation/status`
2. Verificar eventos publicados: `GET /api/automation/logs/events`
3. Simular un evento de oráculo: `POST /api/automation/test/oracle`
4. Revisar logs del ML Service

**Checks:**
- ¿EventBus recibiendo eventos ORACLE_DATA_RECEIVED?
- ¿ML Service retornando decisiones con confianza >75%?
- ¿Se alcanzó el límite de cambios/hora (5)?

### Problema: "Halving nunca se ejecuta"

**Causa:** Condiciones no se cumplen o cooldown activo.

**Solución:**
1. Verificar métricas del sistema: ¿totalSupply > minSupplyForCheck?
2. Revisar última ejecución: `GET /api/automation/status` → `orchestrator.config.lastHalving`
3. Reducir umbral de confianza en `ml.service.js` si es necesario
4. Ejecutar manualmente (testing): `POST /api/automation/manual/halving`

---

## 🚀 Próximos Pasos

1. **Implementar el ML Service en Python**
   - Framework: FastAPI
   - Modelos: TensorFlow/PyTorch para predicciones
   - Endpoints: `/analyze`, `/predict/trend`, `/optimize/apy`, `/check/halving`

2. **Desplegar Smart Contract BeZhasCore**
   - Agregar roles: `AUTOMATION_ROLE`, `ADMIN_ROLE`, `PAUSER_ROLE`
   - Implementar funciones: `setStakingAPY()`, `executeHalving()`
   - Deploy en Polygon Mainnet

3. **Frontend Integration**
   - Hook `useBeZhasEvents()` para escuchar eventos del contrato
   - Dashboard de admin para monitoreo
   - Notificaciones push en cambios de APY/Halving

4. **Monitoring & Alerting**
   - Integrar Datadog/New Relic
   - Configurar alerts para circuit breaker, ML failures
   - Dashboard de métricas en Grafana

---

## 📚 Referencias

- [EventBus Pattern](https://refactoring.guru/design-patterns/observer)
- [Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [ethers.js Documentation](https://docs.ethers.org/v6/)
- [node-cron Syntax](https://www.npmjs.com/package/node-cron)
- [Pino Logger](https://getpino.io/)

---

## 📝 Changelog

### v1.0.0 (Noviembre 2024)
- ✅ EventBus con Circuit Breaker
- ✅ ML Service con fallback strategy
- ✅ Blockchain Service con retry logic
- ✅ AutomationOrchestrator completo
- ✅ Halving Check Job con cron
- ✅ API Routes para monitoreo y control
- ✅ Integración con server.js
- ✅ Documentación completa

---

## 👥 Contribuciones

Para contribuir al Automation Engine:

1. Fork el repositorio
2. Crear branch: `git checkout -b feature/nueva-feature`
3. Commit: `git commit -m "Add: nueva feature"`
4. Push: `git push origin feature/nueva-feature`
5. Abrir Pull Request

---

## 📄 Licencia

MIT License - BeZhas Team 2024
