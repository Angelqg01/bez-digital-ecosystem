# 🪙 Guía de Fondeo para Deployment en Polygon Amoy

## ⚠️ Problema Detectado

Tu wallet tiene **0.0226 MATIC** pero el deployment necesita **~0.055 MATIC** de gas.

```
Balance actual: 0.022589672 MATIC
Costo estimado: 0.054950150 MATIC
Faltante:      ~0.032 MATIC
```

---

## ✅ Solución: Obtener MATIC en Polygon Amoy Testnet

### Opción 1: Polygon Faucet (Recomendado)

1. **Visita el faucet oficial:**
   ```
   https://faucet.polygon.technology/
   ```

2. **Pasos:**
   - Selecciona **"Polygon Amoy"** (POL testnet)
   - Ingresa tu wallet: `0x52Df82920CBAE522880dD7657e43d1A754eD044E`
   - Completa el CAPTCHA
   - Click en **"Submit"**
   - Espera 1-2 minutos

3. **Recibirás:** ~0.1 - 0.5 MATIC (suficiente para varios deployments)

---

### Opción 2: Alchemy Faucet

1. **URL:**
   ```
   https://www.alchemy.com/faucets/polygon-amoy
   ```

2. **Requisitos:**
   - Cuenta gratuita de Alchemy
   - Verifica con email

3. **Recibirás:** ~0.5 MATIC

---

### Opción 3: Chainlink Faucet

1. **URL:**
   ```
   https://faucets.chain.link/polygon-amoy
   ```

2. **Requisitos:**
   - Conectar wallet con MetaMask
   - Twitter/GitHub verificado (opcional para más tokens)

---

## 🔍 Verificar Balance

Una vez que recibas los fondos, verifica tu balance:

```powershell
npx hardhat run scripts/check-balance.js --network amoy
```

O manualmente en PolygonScan:
```
https://amoy.polygonscan.com/address/0x52Df82920CBAE522880dD7657e43d1A754eD044E
```

---

## 🚀 Reintentar Deployment

Cuando tengas suficiente MATIC (>0.1), ejecuta:

```powershell
npx hardhat run scripts/deploy-quality-oracle.js --network amoy
```

---

## 💡 Estimación de Costos

| Contrato | Gas Estimado | Costo (MATIC) |
|----------|--------------|---------------|
| BezhasToken | ~2.5M gas | ~0.025 MATIC |
| QualityEscrow | ~2M gas | ~0.020 MATIC |
| Grant Role | ~50k gas | ~0.0005 MATIC |
| **Total** | **~4.55M gas** | **~0.046 MATIC** |

**Recomendado:** Tener al menos **0.1 MATIC** para margen de seguridad.

---

## 📝 Script de Verificación de Balance

Crea `scripts/check-balance.js`:

\`\`\`javascript
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    const balanceInMatic = hre.ethers.formatEther(balance);
    
    console.log("Wallet:", deployer.address);
    console.log("Balance:", balanceInMatic, "MATIC");
    console.log("Network:", hre.network.name);
    
    if (parseFloat(balanceInMatic) < 0.05) {
        console.log("⚠️  Balance bajo! Necesitas al menos 0.1 MATIC");
        console.log("   Obtén MATIC en: https://faucet.polygon.technology/");
    } else {
        console.log("✅ Balance suficiente para deployment");
    }
}

main().catch(console.error);
\`\`\`

---

## 🔄 Después del Fondeo

1. **Verifica balance:** `node scripts/check-balance.js`
2. **Despliega contratos:** `npm run deploy:quality-oracle` (o el comando hardhat)
3. **Guarda las addresses** generadas
4. **Actualiza `.env`** con las nuevas addresses

---

## 🆘 Troubleshooting

### Error: "Invalid API Key"
- Algunos faucets requieren registro
- Usa Polygon oficial que es público

### Error: "Rate limited"
- Los faucets tienen límite de 1 request cada 24h
- Prueba con otro faucet
- O espera 24 horas

### Error: "Insufficient funds" persiste
- Verifica que estés en **Polygon Amoy** (chainId 80002)
- No en Polygon Mumbai (red antigua, deprecada)
- Confirma la transacción del faucet en PolygonScan

---

## ✅ Checklist

- [ ] Obtener MATIC del faucet
- [ ] Verificar balance >0.1 MATIC
- [ ] Confirmar network = amoy en hardhat.config.js
- [ ] Ejecutar deployment
- [ ] Guardar contract addresses
- [ ] Actualizar .env files

---

**Próximo paso:** Ve a https://faucet.polygon.technology/ y solicita MATIC para tu wallet.
