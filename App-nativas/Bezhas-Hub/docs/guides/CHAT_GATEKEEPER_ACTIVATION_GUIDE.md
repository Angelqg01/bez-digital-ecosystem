# 🚀 CHAT & GATEKEEPER SYSTEM - GUÍA DE ACTIVACIÓN

## 📋 Tabla de Contenidos

1. [Descripción del Sistema](#descripción-del-sistema)
2. [Arquitectura](#arquitectura)
3. [Requisitos Previos](#requisitos-previos)
4. [Instalación](#instalación)
5. [Configuración](#configuración)
6. [Integración con Backend Existente](#integración-con-backend-existente)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## 📖 Descripción del Sistema

El **Chat & Gatekeeper System** es un módulo empresarial de chat en tiempo real con monetización basada en créditos BEZ-Coin. Permite a los usuarios comunicarse mientras gestiona automáticamente el consumo de créditos por palabras enviadas.

### ✨ Características Principales

- **Real-Time Chat**: Socket.IO con WebSocket/Polling fallback
- **Escalabilidad Horizontal**: Redis Adapter para múltiples instancias
- **Monetización**: 1 Crédito = 1000 palabras
- **Gatekeeper**: Bloqueo automático si crédito insuficiente
- **Security**: JWT, Rate Limiting, XSS Prevention, Message Sanitization
- **AI Integration**: Detección de menciones `@AgenteIA`
- **Admin Tools**: Broadcast, Stats, User Management

### 📊 Modelo de Créditos

```
1 Credit = 1 BEZ-Coin = 1000 palabras
```

**Ejemplo:**
- Usuario tiene 5 créditos = 5000 palabras disponibles
- Envía mensajes acumulados de 1200 palabras
- Sistema cobra 2 créditos automáticamente
- Quedan 3 créditos = 3000 palabras

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
│  (React/Vue/Angular con Socket.IO Client)                   │
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket/Polling
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  CHAT SERVER (chat-server.js)               │
│  • Socket.IO Server                                         │
│  • Redis Adapter (Pub/Sub)                                  │
│  • Express REST API                                         │
└────────────┬───────────────────────┬────────────────────────┘
             │                       │
             ↓                       ↓
┌────────────────────┐   ┌────────────────────────────────────┐
│  GATEKEEPER        │   │  SOCKET HANDLERS                   │
│  (chatGatekeeper)  │←──│  (socketHandlers.js)               │
│                    │   │  • joinRoom, sendMessage, etc.     │
│  • Word counting   │   │  • Rate limiting                   │
│  • Credit check    │   │  • Authentication                  │
│  • Charge credits  │   │  • Message sanitization            │
└────────┬───────────┘   └────────────────────────────────────┘
         │
         ↓
┌─────────────────────────────────────────────────────────────┐
│              CREDIT SERVICE (credit.service.js)             │
│  • getCreditBalance()                                       │
│  • chargeCredits()                                          │
│  • Cache (Redis)                                            │
│  • API Integration                                          │
│  • Blockchain Fallback                                      │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
             ↓                        ↓
┌────────────────────┐   ┌────────────────────────────────────┐
│  REDIS             │   │  CREDIT API / BLOCKCHAIN            │
│  • Pub/Sub         │   │  • BEZ-Coin Contract                │
│  • Session Cache   │   │  • Transaction History              │
│  • Rate Limits     │   │  • Balance Updates                  │
└────────────────────┘   └────────────────────────────────────┘
```

---

## ✅ Requisitos Previos

### Software Necesario

- **Node.js**: >= 18.0.0
- **Redis**: >= 6.0.0
- **NPM/Yarn**: Gestor de paquetes

### Servicios Externos

- **Blockchain Provider**: Polygon RPC o similar
- **BEZ-Coin Contract**: Dirección del contrato desplegado
- **Credit API** (opcional): Microservicio de créditos

---

## 📦 Instalación

### 1. Instalar Dependencias

```powershell
cd backend

# Instalar Socket.IO y Redis Adapter
npm install socket.io @socket.io/redis-adapter

# Verificar que ioredis ya esté instalado (debería estar)
npm list ioredis
```

### 2. Verificar Estructura de Carpetas

```
backend/
├── chat/
│   ├── chat-server.js      ✅ (Nuevo)
│   ├── chatGatekeeper.js   ✅ (Nuevo)
│   └── socketHandlers.js   ✅ (Nuevo)
├── services/
│   └── credit.service.js   ✅ (Nuevo)
├── server.js               (Existente)
└── package.json            (Actualizar)
```

---

## ⚙️ Configuración

### 1. Variables de Entorno

Crear o actualizar `backend/.env`:

```bash
# ============================================================================
# CHAT SERVER CONFIGURATION
# ============================================================================

# Server
CHAT_SERVER_PORT=3002
NODE_ENV=development
LOG_LEVEL=info

# CORS Origins (separados por coma)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,https://bezhas.com

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
ENABLE_REDIS_ADAPTER=true

# Socket.IO Configuration
MAX_CONNECTIONS=10000
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000

# ============================================================================
# CREDIT SERVICE CONFIGURATION
# ============================================================================

# Blockchain
BLOCKCHAIN_PROVIDER_URL=https://polygon-rpc.com
BEZ_COIN_CONTRACT_ADDRESS=0x...  # ⚠️ IMPORTANTE: Configurar dirección del contrato

# Credit API (opcional)
CREDIT_API_URL=http://localhost:3003/api/credits
CREDIT_API_TIMEOUT=5000

# Credit Cache
CREDIT_CACHE_TTL=60

# ============================================================================
# SECURITY
# ============================================================================

# Admin Token (para endpoints de administración)
ADMIN_TOKEN=your_secure_admin_token_here_change_in_production

# JWT Secret (si usas JWT)
JWT_SECRET=your_jwt_secret_here

# ============================================================================
# GATEKEEPER CONFIGURATION
# ============================================================================

# Ya configurado en el código:
# WORDS_PER_CREDIT=1000
# GRACE_WORDS=50
# SESSION_TIMEOUT=86400000 (24 horas)
```

### 2. Iniciar Redis

```powershell
# Windows - WSL o Docker
docker run --name redis-bezhas -p 6379:6379 -d redis:latest

# O si tienes Redis instalado localmente
redis-server
```

### 3. Verificar Redis

```powershell
# Conectar a Redis CLI
docker exec -it redis-bezhas redis-cli

# Dentro de Redis CLI
PING
# Debe responder: PONG
```

---

## 🔗 Integración con Backend Existente

Tienes dos opciones:

### Opción A: Chat Server Standalone (Recomendado)

Ejecutar el chat en un proceso separado (puerto 3002):

```powershell
# Terminal 1 - Backend principal
cd backend
npm start

# Terminal 2 - Chat server
cd backend/chat
node chat-server.js
```

**Ventajas:**
- ✅ Separación de responsabilidades
- ✅ Escalado independiente
- ✅ Fácil debugging

### Opción B: Integrar en server.js Existente

Modificar `backend/server.js` para incluir Socket.IO:

```javascript
// backend/server.js (agregar al final, antes de server.listen)

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { setupSocketHandlers } = require('./chat/socketHandlers');
const Redis = require('ioredis');

// Crear Socket.IO server
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    maxHttpBufferSize: 1e6,
    pingTimeout: 60000,
    pingInterval: 25000,
});

// Redis adapter
const pubClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
});
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

// Setup handlers
setupSocketHandlers(io);

console.log('✅ Socket.IO Chat integrated');
```

---

## 🧪 Testing

### 1. Test Chat Server

```powershell
# Iniciar servidor
cd backend/chat
node chat-server.js
```

Deberías ver:

```
╔══════════════════════════════════════════════════════════════╗
║           🚀 BEZHAS CHAT SERVER - RUNNING                    ║
║  Port:              3002                                     ║
║  Redis Adapter:     Enabled ✅                               ║
║  Words per Credit:  1000                                     ║
╚══════════════════════════════════════════════════════════════╝
```

### 2. Test Health Endpoint

```powershell
curl http://localhost:3002/health
```

Respuesta esperada:

```json
{
  "status": "ok",
  "service": "bezhas-chat-server",
  "timestamp": 1704067200000,
  "uptime": 12.345,
  "memory": { ... }
}
```

### 3. Test Credit Stats

```powershell
curl http://localhost:3002/api/credits/stats/user123
```

### 4. Test Socket.IO Connection

Crear `test-socket-client.js`:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3002', {
    auth: {
        token: 'test_jwt_token' // Cambia según tu implementación
    }
});

socket.on('connect', () => {
    console.log('✅ Connected to chat server');
    console.log('Socket ID:', socket.id);
    
    // Unirse a sala
    socket.emit('joinRoom', {
        roomId: 'test-room',
        roomType: 'group',
        userId: 'user123',
        username: 'Test User'
    });
});

socket.on('roomJoined', (data) => {
    console.log('✅ Joined room:', data);
    
    // Enviar mensaje
    socket.emit('sendMessage', {
        roomId: 'test-room',
        userId: 'user123',
        message: 'Hello from test client!',
        username: 'Test User'
    });
});

socket.on('newMessage', (data) => {
    console.log('📩 New message:', data);
});

socket.on('creditError', (data) => {
    console.log('⚠️ Credit error:', data);
});

socket.on('creditWarning', (data) => {
    console.log('⚠️ Credit warning:', data);
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected');
});

// Ejecutar: node test-socket-client.js
```

### 5. Test Gatekeeper

```javascript
// Test del contador de palabras
const { checkAndChargeCredit, countWords } = require('./chatGatekeeper');

async function testGatekeeper() {
    // Test 1: Contar palabras
    const words1 = countWords('Hola mundo, esto es una prueba');
    console.log('Words:', words1); // Debe ser 6
    
    // Test 2: Filtrar URLs
    const words2 = countWords('Visita https://bezhas.com para más info');
    console.log('Words (con URL):', words2); // No debe contar la URL
    
    // Test 3: Verificar y cobrar crédito
    const result = await checkAndChargeCredit('user123', 'Este es un mensaje de prueba');
    console.log('Result:', result);
}

testGatekeeper();
```

---

## 🚀 Deployment

### Producción con PM2 (Recomendado)

```powershell
# Instalar PM2 globalmente
npm install -g pm2

# Crear ecosystem.config.js
```

**ecosystem.config.js:**

```javascript
module.exports = {
    apps: [
        {
            name: 'bezhas-chat',
            script: './chat/chat-server.js',
            instances: 4, // 4 instancias (cluster mode)
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                CHAT_SERVER_PORT: 3002
            },
            error_file: './logs/chat-error.log',
            out_file: './logs/chat-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            max_memory_restart: '500M'
        }
    ]
};
```

**Comandos PM2:**

```powershell
# Iniciar
pm2 start ecosystem.config.js

# Ver estado
pm2 status

# Logs en tiempo real
pm2 logs bezhas-chat

# Restart
pm2 restart bezhas-chat

# Stop
pm2 stop bezhas-chat

# Monitoreo
pm2 monit
```

### Docker Deployment

**Dockerfile:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3002

CMD ["node", "chat/chat-server.js"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  chat-server:
    build: .
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

**Comandos Docker:**

```powershell
# Build y start
docker-compose up -d

# Logs
docker-compose logs -f chat-server

# Stop
docker-compose down
```

---

## 🛠️ Troubleshooting

### Error: Redis Connection Failed

**Síntoma:**
```
Redis error: connect ECONNREFUSED
```

**Solución:**
```powershell
# Verificar que Redis esté corriendo
docker ps | grep redis

# Iniciar Redis si no está corriendo
docker start redis-bezhas

# O iniciar con docker-compose
docker-compose up redis -d
```

### Error: Socket.IO Module Not Found

**Síntoma:**
```
Error: Cannot find module 'socket.io'
```

**Solución:**
```powershell
cd backend
npm install socket.io @socket.io/redis-adapter
```

### Error: Port 3002 Already in Use

**Síntoma:**
```
Error: listen EADDRINUSE: address already in use :::3002
```

**Solución:**
```powershell
# Encontrar proceso usando el puerto
netstat -ano | findstr :3002

# Matar proceso (reemplaza PID)
taskkill /PID <PID> /F

# O cambiar puerto en .env
CHAT_SERVER_PORT=3003
```

### Warning: BEZ-Coin Contract Not Configured

**Síntoma:**
```
WARN: BEZ-Coin contract address not configured
```

**Solución:**
```bash
# Agregar a .env
BEZ_COIN_CONTRACT_ADDRESS=0x1234...abcd
BLOCKCHAIN_PROVIDER_URL=https://polygon-rpc.com
```

### Error: Credit API Unavailable

**Síntoma:**
```
WARN: Credit API unavailable, falling back to blockchain
```

**Solución:**
1. Si tienes Credit API, verificar que esté corriendo
2. Si no, es normal - el sistema usa blockchain como fallback
3. Para desarrollo, el sistema simula saldos

### Mensajes Bloqueados por Gatekeeper

**Síntoma:**
Cliente recibe `creditError` event

**Solución:**
```javascript
// Verificar saldo del usuario
curl http://localhost:3002/api/credits/stats/user123

// Agregar créditos (admin endpoint)
curl -X POST http://localhost:3002/api/credits/reset/user123 \
  -H "x-admin-token: your_admin_token"
```

---

## 📚 Próximos Pasos

### Implementaciones Pendientes

1. **Credit Service API**:
   - Crear microservicio dedicado para transacciones
   - Endpoints: `/balance`, `/charge`, `/add`, `/history`
   - Base de datos: PostgreSQL o MongoDB

2. **JWT Authentication**:
   - Implementar verificación en `authenticationMiddleware()`
   - Validar tokens en handshake

3. **Message Persistence**:
   - Guardar mensajes en base de datos
   - Implementar carga de historial

4. **AI Agent Integration**:
   - Endpoint para procesar menciones `@AgenteIA`
   - Integración con modelo de IA

5. **Redis Migration**:
   - Migrar `wordCounters` Map() a Redis con TTL
   - Migrar `activeSessions` a Redis

### Migraciones de Producción

#### Migrar Counters a Redis

**Antes (chatGatekeeper.js):**
```javascript
const wordCounters = new Map();
```

**Después:**
```javascript
const Redis = require('ioredis');
const redis = new Redis(/* config */);

async function getWordCount(userId) {
    const count = await redis.get(`words:${userId}`);
    return parseInt(count) || 0;
}

async function setWordCount(userId, count) {
    await redis.setex(`words:${userId}`, 86400, count); // TTL 24h
}
```

---

## 📊 Monitoring & Metrics

### Health Checks

```powershell
# Sistema de salud
curl http://localhost:3002/health

# Estadísticas del chat
curl http://localhost:3002/api/chat/stats
```

### Logs

```powershell
# Logs en tiempo real (PM2)
pm2 logs bezhas-chat

# Logs con Docker
docker-compose logs -f chat-server

# Filtrar por nivel
pm2 logs bezhas-chat | grep ERROR
```

### Métricas Clave

- **Conexiones activas**: `io.engine.clientsCount`
- **Mensajes por segundo**: Log automático cada 5 min
- **Credit balance checks**: Counter en logs
- **Mensajes bloqueados**: `creditError` events

---

## 🎓 Recursos

- [Socket.IO Documentation](https://socket.io/docs/v4/)
- [Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)

---

## 💡 Soporte

Para issues, contactar al equipo de DevOps en:
- **Email**: devops@bezhas.com
- **Slack**: #bezhas-chat-support
- **GitHub**: https://github.com/bezhas/bezhas-web3/issues

---

**Versión:** 1.0.0  
**Última actualización:** 2024  
**Autor:** BeZhas DevOps Team
