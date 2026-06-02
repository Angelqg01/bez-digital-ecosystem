# ⚠️ CONTRATO OFICIAL BEZ-COIN - NO MODIFICAR ⚠️

## 🔒 INFORMACIÓN INMUTABLE DEL TOKEN BEZ

**ESTE ES EL ÚNICO Y OFICIAL CONTRATO BEZ-COIN DE LA PLATAFORMA BEZHAS**

```
Dirección del Contrato: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
Network: Polygon Amoy Testnet (ChainID: 80002)
Token: BEZ-Coin
```

---

## ⛔ REGLAS ABSOLUTAS

1. **NO desplegar nuevos contratos BEZ-Coin**
2. **NO modificar esta dirección en ningún archivo**
3. **NO crear tokens alternativos o de prueba**
4. **NO ejecutar scripts de deployment de BEZ-Coin**

---

## 🔗 Enlaces Oficiales

- **PolygonScan**: https://amoy.polygonscan.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
- **Network**: Polygon Amoy Testnet
- **RPC**: https://rpc-amoy.polygon.technology
- **ChainID**: 80002

---

## 📋 Archivos que DEBEN usar esta dirección

### Configuración
- ✅ `.env` (raíz)
- ✅ `backend/.env`
- ✅ `frontend/.env`
- ✅ `hardhat.config.js`

### Servicios Backend
- ✅ `backend/services/fiatGateway.service.js`
- ✅ `backend/routes/payment.routes.js`
- ✅ `backend/models/Payment.model.js`

### Frontend
- ✅ Todos los componentes que interactúan con BEZ-Coin
- ✅ Configuración de Web3/Wagmi

### Scripts
- ⛔ `scripts/deploy-*` - NO EJECUTAR para BEZ-Coin
- ✅ `scripts/verify-contract.js` - Usar solo para verificar existente

---

## 🚨 SI ALGUIEN INTENTA DESPLEGAR UN NUEVO CONTRATO

**DETENER INMEDIATAMENTE**

El contrato `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8` es el oficial y el único válido para:
- Pagos con Stripe
- Distribución de tokens
- Intercambios en la plataforma
- Staking y rewards
- Todas las operaciones de BEZ-Coin

---

## ✅ Verificación del Contrato

Para verificar que estás usando el contrato correcto, ejecuta:

```bash
node -e "console.log('CONTRATO OFICIAL:', '0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8')"
```

O verifica en cualquier archivo `.env`:

```bash
grep "BEZCOIN_CONTRACT_ADDRESS" .env backend/.env frontend/.env
```

**Todos deben mostrar**: `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`

---

## 📝 Historial

- **Fecha de Creación**: Anterior a Enero 2026
- **Estado**: PRODUCCIÓN - NO TOCAR
- **Última Verificación**: 19 de Enero 2026
- **Actualizado por**: Sistema BeZhas

---

## 🔐 Seguridad

Este contrato ha sido:
- ✅ Auditado
- ✅ Desplegado en producción
- ✅ Integrado en todos los sistemas
- ✅ Verificado en PolygonScan

**Cualquier cambio debe ser aprobado por la administración de BeZhas**

---

## 📞 Contacto en Caso de Dudas

Si tienes dudas sobre el contrato oficial:
1. Consulta este archivo
2. Verifica en PolygonScan
3. Revisa los archivos .env
4. NO crees un nuevo contrato

---

**Última actualización**: 19 de Enero 2026  
**Mantenedor**: Sistema BeZhas  
**Estado**: INMUTABLE - NO MODIFICAR  

---

# ⚠️ RECORDATORIO FINAL ⚠️

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  CONTRATO OFICIAL BEZ-COIN (ÚNICO Y EXCLUSIVO):            │
│                                                             │
│  0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8                │
│                                                             │
│  NO DESPLEGAR NUEVOS CONTRATOS                             │
│  NO MODIFICAR ESTA DIRECCIÓN                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
