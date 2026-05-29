# Error Log — Feedback Loop BeZhas IA

> Registro de errores y soluciones para aprendizaje continuo.
> La IA debe consultar este archivo ANTES de investigar un problema conocido.

---

### [2026-03-11] ERROR: DEADLINE_EXCEEDED en GCP Cloud Run
- **Síntoma**: Deployment falla con timeout durante health check
- **Causa**: Server cargaba todas las rutas pesadas antes de `listen()`
- **Solución**: Lazy-load de rutas después de `server.listen()` callback
- **Estado**: ✅ Resuelto
- **Archivos afectados**: `backend/server.js`
- **Ref**: Conversación `61bb351c`

---

### [2026-03-03] ERROR: BullMQ connection refused (Upstash limits)
- **Síntoma**: `ECONNREFUSED` al inicializar BullMQ, server no arranca
- **Causa**: Upstash Redis free tier agotado (10K comandos/día)
- **Solución**: `DISABLE_BULLMQ=true` env var, BullMQ condicional en `payment.routes.js`
- **Estado**: ✅ Resuelto
- **Archivos afectados**: `backend/routes/payment.routes.js`, `backend/server.js`
- **Ref**: Conversación `c3347188`

---

### [2026-03-11] ERROR: Hot Wallet insufficient MATIC for gas
- **Síntoma**: `Hot Wallet needs MATIC for gas fees` en dispenseTokens
- **Causa**: Hot Wallet sin MATIC suficiente para pagar gas de transferencia ERC20
- **Solución**: Enviar al menos 0.01 MATIC al hot wallet address
- **Estado**: ✅ Resuelto
- **Archivos afectados**: `backend/services/fiat-gateway.service.js`
