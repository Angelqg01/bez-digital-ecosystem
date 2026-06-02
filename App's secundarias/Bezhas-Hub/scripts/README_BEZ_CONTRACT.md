# ⚠️ IMPORTANTE: CONTRATO BEZ-COIN OFICIAL ⚠️

## 🔐 Contrato Oficial Único

El contrato BEZ-Coin oficial de la plataforma BeZhas es:

```
0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
```

### 📍 Información del Contrato

- **Red**: Polygon Amoy Testnet (ChainID: 80002)
- **Explorador**: [Ver en PolygonScan](https://amoy.polygonscan.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8)
- **Status**: 🔴 PRODUCCIÓN - NO TOCAR
- **Documentación**: Ver [`CONTRATO_OFICIAL_BEZ.md`](../CONTRATO_OFICIAL_BEZ.md) en la raíz del proyecto

## 🚫 SCRIPTS DESHABILITADOS

Los siguientes scripts de deployment están **DESHABILITADOS** para prevenir la creación de contratos duplicados:

- ❌ `deploy-bezcoin.js` - **DESHABILITADO**
- ❌ `deploy-bez-simple.js` - **DESHABILITADO**
- ❌ `deploy-bez-standalone.js` - **DESHABILITADO**
- ❌ `deploy-direct.js` - **DESHABILITADO**

### ¿Por qué están deshabilitados?

El token BEZ-Coin ya está desplegado en producción y es el **único token oficial** de la plataforma. Crear nuevos contratos causaría:

1. ⚠️ **Fragmentación del ecosistema** - Múltiples contratos confusos
2. ⚠️ **Problemas de liquidez** - Tokens distribuidos entre contratos
3. ⚠️ **Confusión de usuarios** - ¿Cuál es el token real?
4. ⚠️ **Pérdida de confianza** - Cambios en el contrato principal

## ✅ SCRIPTS PERMITIDOS

Los siguientes scripts SÍ pueden usarse porque **usan** el contrato BEZ oficial existente:

- ✅ `deploy-quality-oracle.js` - Despliega Oracle usando BEZ oficial
- ✅ `deploy-quality-escrow.js` - Despliega Escrow usando BEZ oficial
- ✅ `deploy-nft-offers.js` - Sistema de ofertas NFT con BEZ
- ✅ `deploy-nft-rental.js` - Sistema de renta NFT con BEZ
- ✅ `deploy-dao.js` - DAO usando BEZ oficial
- ✅ `verify-contract-address.js` - Verifica que todos los archivos usen BEZ oficial

## 🔧 Uso Correcto

### Verificar Configuración

```bash
# Verificar que todos los archivos .env usen el contrato correcto
node scripts/verify-contract-address.js

# O usar PowerShell
./verify-contract.ps1
```

### Desplegar Otros Contratos

Cuando despliegues contratos que **usen** BEZ-Coin (como Oracle, Escrow, DAO):

```javascript
// ✅ CORRECTO - Usar contrato existente
const OFFICIAL_BEZ_CONTRACT = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8";

const oracle = await QualityOracle.deploy(OFFICIAL_BEZ_CONTRACT, ...);
```

```javascript
// ❌ INCORRECTO - NO HACER ESTO
const bezToken = await BezhasToken.deploy(...); // ¡NO!
```

## 📋 Checklist antes de Deployment

Antes de desplegar **cualquier** contrato:

- [ ] ¿El contrato usa BEZ-Coin? → Usar `0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8`
- [ ] ¿Es un contrato nuevo de BEZ-Coin? → **NO DESPLEGAR**
- [ ] ¿Leíste `CONTRATO_OFICIAL_BEZ.md`? → Leer primero
- [ ] ¿Verificaste con `verify-contract-address.js`? → Ejecutar antes

## 🆘 En Caso de Duda

1. **Lee**: [`CONTRATO_OFICIAL_BEZ.md`](../CONTRATO_OFICIAL_BEZ.md)
2. **Verifica**: Ejecuta `node scripts/verify-contract-address.js`
3. **Consulta**: Revisa este README
4. **NO despliegues**: Si tienes dudas, NO ejecutes scripts de deployment

## 🔗 Enlaces Importantes

- [Contrato en PolygonScan](https://amoy.polygonscan.com/address/0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8)
- [Documentación Oficial](../CONTRATO_OFICIAL_BEZ.md)
- [Guía de Configuración](../GUIA_CONFIGURACION_COMPLETA.md)

---

**⚠️ RECUERDA**: El contrato BEZ-Coin es **INMUTABLE** y **ÚNICO**. No crear duplicados.
