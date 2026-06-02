---
description: How to troubleshoot common BeZhas platform issues
---

# Troubleshoot BeZhas Issues

## Paso 1: Consultar SKILL del Feedback Loop
Antes de investigar, revisar errores conocidos:
- Abrir `_agents/skills/feedback-loop/error-log.md`
- Buscar si el error ya fue resuelto anteriormente
- Si existe: aplicar la solución documentada

## Paso 2: Verificar Health del Backend
```bash
curl http://localhost:3001/api/health
```
Si no responde:
- Verificar que el server está corriendo: `cd backend && npm run dev`
- Revisar logs por errores de conexión a MongoDB o Redis

## Paso 3: Verificar Servicios Externos
```bash
# MongoDB
node -e "const m = require('mongoose'); m.connect(process.env.MONGODB_URI).then(() => console.log('OK')).catch(e => console.error(e.message))"

# Redis (si aplica)
node -e "const Redis = require('ioredis'); const r = new Redis(process.env.REDIS_URL); r.ping().then(v => console.log(v)).catch(e => console.error(e.message))"
```

## Paso 4: Verificar Blockchain
```bash
# Hot Wallet balance
node -e "const {ethers}=require('ethers'); const p=new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL); p.getBalance(process.env.HOT_WALLET_ADDRESS).then(b=>console.log(ethers.formatEther(b),'MATIC'))"
```

## Paso 5: Registrar Solución
Si encontraste y resolviste un problema:
1. Añadir entrada en `_agents/skills/feedback-loop/error-log.md`
2. Actualizar el SKILL correspondiente si es relevante

## Errores Frecuentes (Quick Reference)

| Error | Causa | Solución |
|---|---|---|
| DEADLINE_EXCEEDED | Server tarda > 10s | Lazy-load rutas |
| ECONNREFUSED Redis | Upstash limits | DISABLE_BULLMQ=true |
| pathRegexp error | Express version mismatch | npm install path-to-regexp@0.1.7 |
| Hot Wallet gas | Sin MATIC | Fondear con 0.01 MATIC |
| Module not found | Dependencia faltante | npm install |
| CORS error | Origin no permitido | Añadir origin a cors config |
