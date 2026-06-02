# 🚀 Quality Oracle - Comandos Rápidos

## ⚡ Después de Fondear con MATIC

### 1️⃣ Verificar Balance

```powershell
npx hardhat run scripts/check-balance.js --network amoy
```

**Debe mostrar:** >0.1 MATIC ✅

---

### 2️⃣ Desplegar Contratos

```powershell
npx hardhat run scripts/deploy-quality-oracle.js --network amoy
```

**Guarda las addresses que te muestre:**
```
BezCoin deployed to: 0x...
QualityEscrow deployed to: 0x...
```

---

### 3️⃣ Actualizar Backend .env

Abre `backend/.env` y agrega:

```bash
BEZCOIN_ADDRESS=0x...              # Pega address de BezCoin
QUALITY_ESCROW_ADDRESS=0x...       # Pega address de QualityEscrow
```

---

### 4️⃣ Actualizar Frontend .env

Abre `frontend/.env` y agrega:

```bash
VITE_BEZCOIN_ADDRESS=0x...         # Misma address de BezCoin
VITE_QUALITY_ESCROW_ADDRESS=0x...  # Misma address de QualityEscrow
```

---

### 5️⃣ Reiniciar Servers

**Backend:**
```powershell
cd backend
npm start
```

**Frontend:**
```powershell
cd frontend
npm run dev
```

---

### 6️⃣ Testing Rápido

1. Abre: `http://localhost:5173`
2. Conecta tu wallet (Safe Wallet: `0x3EfC42095E8503d41Ad8001328FC23388E00e8a3`)
3. Ve a: `/admin/quality-oracle`
4. Crea un servicio de prueba:
   - Client wallet: tu misma wallet
   - Collateral: 10 BEZ
   - Initial quality: 90%

---

## 📋 Checklist Completo

- [ ] Fondear wallet con MATIC (>0.1)
- [ ] Verificar balance con check-balance.js
- [ ] Desplegar contratos con deploy-quality-oracle.js
- [ ] Copiar BezCoin address a backend/.env
- [ ] Copiar QualityEscrow address a backend/.env
- [ ] Copiar ambas addresses a frontend/.env
- [ ] Reiniciar backend (npm start)
- [ ] Reiniciar frontend (npm run dev)
- [ ] Conectar wallet en UI
- [ ] Navegar a /admin/quality-oracle
- [ ] Crear servicio de prueba
- [ ] Verificar en PolygonScan
- [ ] Finalizar servicio
- [ ] Validar penalty calculation

---

## 🔗 Links Útiles

**Faucet:**
- https://faucet.polygon.technology/

**PolygonScan Amoy:**
- https://amoy.polygonscan.com/

**Tu Wallet:**
- https://amoy.polygonscan.com/address/0x52Df82920CBAE522880dD7657e43d1A754eD044E

**Safe Wallet:**
- https://amoy.polygonscan.com/address/0x3EfC42095E8503d41Ad8001328FC23388E00e8a3

---

## 🆘 Solución de Problemas Rápidos

### "Insufficient funds" persiste
```powershell
# Verifica que estés en Amoy, no Mumbai
npx hardhat run scripts/check-balance.js --network amoy
```

### "Contract not configured" en UI
```bash
# Verifica que las addresses estén en frontend/.env
cat frontend/.env | grep VITE_QUALITY

# Debe mostrar:
# VITE_QUALITY_ESCROW_ADDRESS=0x...
# VITE_BEZCOIN_ADDRESS=0x...
```

### "Failed to fetch" en API
```bash
# Verifica backend/.env
cat backend/.env | grep QUALITY

# Reinicia backend
cd backend && npm start
```

### UI muestra "Connect wallet"
- Asegúrate de estar en Polygon Amoy (chainId 80002)
- Tu wallet debe ser una de las admin (Safe Wallet o 0x52Df...)

---

## 🎯 Verificación Final

Todo está ✅ cuando:

1. **Balance > 0.1 MATIC** en check-balance.js
2. **2 contratos desplegados** en PolygonScan
3. **4 addresses configuradas** en .env files
4. **Backend arranca sin errores** (puerto 3001)
5. **Frontend carga** (puerto 5173)
6. **Dashboard muestra stats** en /admin/quality-oracle
7. **Puedes crear servicio** sin errores
8. **Transacción visible** en PolygonScan

---

**¡Éxito! Quality Oracle operacional** 🎉
