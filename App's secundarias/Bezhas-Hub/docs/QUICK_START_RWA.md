# 🎯 QUICK START - RWA SYSTEM

## 📋 CONTRACT ADDRESSES (POLYGON MAINNET)

```
BeZhasRWAFactory: 0x9847BcF0a8e6cC0664d2D44Cecb366577F267aac
BeZhasVault:      0x9520dDcB37B0a60aEf0601fc34c198930B2d0b10
BEZ-Coin:         0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
```

## ⚡ CONFIGURACIÓN RÁPIDA (5 MINUTOS)

### 1. Configurar Environment Variables
Editar `frontend/.env` y agregar:

```bash
VITE_RWA_FACTORY_ADDRESS=0x9847BcF0a8e6cC0664d2D44Cecb366577F267aac
VITE_RWA_VAULT_ADDRESS=0x9520dDcB37B0a60aEf0601fc34c198930B2d0b10
VITE_PINATA_API_KEY=tu_api_key
VITE_PINATA_SECRET_KEY=tu_secret
```

### 2. Reiniciar Frontend
```bash
cd frontend
npm run dev
```

### 3. Probar Tokenización
1. Ir a http://localhost:5173/create
2. Click en "Real Estate (RWA)"
3. Seguir wizard de 4 pasos
4. Necesitas: >100 BEZ en wallet
5. Verificar en PolygonScan

---

## 🎨 CATEGORÍAS DISPONIBLES

| ID | Categoría | Ejemplo |
|----|-----------|---------|
| 0 | Inmueble | Casa, Apartamento |
| 1 | Hotel | Suite de Hotel |
| 2 | Local | Tienda, Oficina |
| 3 | Ropa | Vestido de Lujo |
| 4 | Coche | Ferrari, Lamborghini |
| 5 | Barco | Yate, Velero |
| 6 | Helicóptero | Helicóptero Privado |
| 7 | Objeto | Arte, Joya |

---

## 💰 COSTOS

- **Tokenización**: 100 BEZ (~$1 USD)
- **Gas**: ~0.0075 MATIC (~$0.01 USD)
- **Total por Asset**: ~$1.01 USD

---

## 📖 DOCUMENTACIÓN COMPLETA

- `RWA_SYSTEM_DOCUMENTATION.md` - Guía técnica
- `RWA_DEPLOYMENT_SUMMARY.md` - Resumen deployment
- `SESION_COMPLETA_RWA.md` - Sesión completa

---

## 🔗 LINKS ÚTILES

- **Factory**: https://polygonscan.com/address/0x9847BcF0a8e6cC0664d2D44Cecb366577F267aac
- **Vault**: https://polygonscan.com/address/0x9520dDcB37B0a60aEf0601fc34c198930B2d0b10
- **Pinata**: https://pinata.cloud

---

## ✅ CHECKLIST

- [ ] Pinata API configurada
- [ ] .env actualizado con contratos
- [ ] Frontend reiniciado
- [ ] Wallet con >100 BEZ
- [ ] Primera tokenización completada
