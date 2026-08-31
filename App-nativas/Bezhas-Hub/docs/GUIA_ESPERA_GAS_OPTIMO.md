# ⏳ Esperando Gas Óptimo - Polygon Mainnet

## 📊 Estado Actual

**Fecha**: 19 de Enero, 2026  
**Balance**: 43.06 MATIC disponibles  
**Problema**: Gas price demasiado alto para desplegar Quality Oracle  
**Solución**: Esperar a que baje el gas y reintentar

---

## 🔍 Monitorear Gas en Tiempo Real

### Opción 1: PolygonScan Gas Tracker (Recomendado)
```
https://polygonscan.com/gastracker
```

**Gas Óptimo para Desplegar**:
- ✅ **Gas Price < 50 Gwei**: Excelente momento
- 🟡 **Gas Price 50-100 Gwei**: Aceptable
- ❌ **Gas Price > 100 Gwei**: Esperar

### Opción 2: Comando PowerShell
```powershell
# Verificar gas price actual
$response = Invoke-RestMethod -Method Post -Uri "https://polygon-rpc.com" `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}'

$gasPriceWei = [bigint]::Parse($response.result.TrimStart('0x'), 'AllowHexSpecifier')
$gasPriceGwei = [decimal]$gasPriceWei / 1000000000
Write-Host "Gas Price Actual: $gasPriceGwei Gwei"

if ($gasPriceGwei -lt 50) {
    Write-Host "✅ GAS ÓPTIMO - Momento ideal para desplegar" -ForegroundColor Green
} elseif ($gasPriceGwei -lt 100) {
    Write-Host "🟡 GAS ACEPTABLE - Puedes desplegar" -ForegroundColor Yellow
} else {
    Write-Host "❌ GAS ALTO - Espera un poco más" -ForegroundColor Red
}
```

### Opción 3: Script de Monitoreo Automático
```powershell
# Guardar como: monitor-gas.ps1
Write-Host "🔍 Monitoreando Gas de Polygon..." -ForegroundColor Cyan
Write-Host "Presiona Ctrl+C para detener`n"

while ($true) {
    $response = Invoke-RestMethod -Method Post -Uri "https://polygon-rpc.com" `
      -ContentType "application/json" `
      -Body '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}' `
      -ErrorAction SilentlyContinue
    
    if ($response.result) {
        $gasPriceWei = [bigint]::Parse($response.result.TrimStart('0x'), 'AllowHexSpecifier')
        $gasPriceGwei = [decimal]$gasPriceWei / 1000000000
        
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] Gas Price: $gasPriceGwei Gwei" -NoNewline
        
        if ($gasPriceGwei -lt 50) {
            Write-Host " ✅ ÓPTIMO" -ForegroundColor Green
        } elseif ($gasPriceGwei -lt 100) {
            Write-Host " 🟡 ACEPTABLE" -ForegroundColor Yellow
        } else {
            Write-Host " ❌ ALTO" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Seconds 60  # Verificar cada minuto
}
```

---

## 🚀 Comandos para Desplegar Cuando el Gas Baje

### 1. Verificar Balance (Siempre Primero)
```bash
node -e "const https = require('https'); const data = JSON.stringify({jsonrpc:'2.0',method:'eth_getBalance',params:['0x52Df82920CBAE522880dD7657e43d1A754eD044E','latest'],id:1}); const options = {hostname:'polygon-rpc.com',port:443,path:'/',method:'POST',headers:{'Content-Type':'application/json'}}; const req = https.request(options, (res) => {let body=''; res.on('data',(d)=>{body+=d}); res.on('end',()=>{try{const json=JSON.parse(body); const wei=BigInt(json.result); const matic=Number(wei)/1e18; console.log('Balance:', matic.toFixed(4), 'MATIC');}catch(e){console.log('Error:', body);}})}); req.on('error',(e)=>{console.error('Error:',e.message)}); req.write(data); req.end();"
```

### 2. Verificar Gas Price Actual
```bash
node -e "const https = require('https'); const data = JSON.stringify({jsonrpc:'2.0',method:'eth_gasPrice',params:[],id:1}); const options = {hostname:'polygon-rpc.com',port:443,path:'/',method:'POST',headers:{'Content-Type':'application/json'}}; const req = https.request(options, (res) => {let body=''; res.on('data',(d)=>{body+=d}); res.on('end',()=>{const json=JSON.parse(body); const gwei=Number(BigInt(json.result))/1e9; console.log('Gas Price:', gwei.toFixed(2), 'Gwei');}}); req.on('error',(e)=>{console.error(e.message)}); req.write(data); req.end();"
```

### 3. Desplegar Quality Oracle (Cuando Gas < 50 Gwei)
```bash
# Opción A: Script directo (Recomendado)
node scripts/deploy-quality-oracle-direct.js

# Opción B: Con Hardhat
pnpm exec hardhat run scripts/deploy-quality-oracle.js --network polygon
```

### 4. Verificar Despliegue en PolygonScan
Después de desplegar, verifica en:
```
https://polygonscan.com/address/<ESCROW_ADDRESS>
```

---

## 📋 Checklist Pre-Despliegue

Antes de ejecutar el comando de despliegue:

- [ ] Gas Price < 50 Gwei (verificar en PolygonScan)
- [ ] Balance > 0.2 MATIC (para cubrir gas + margen)
- [ ] Contratos compilados (`pnpm run compile`)
- [ ] Variables .env configuradas
- [ ] Hot Wallet private key respaldada

---

## ⏰ Mejores Momentos para Desplegar

Según patrones históricos de Polygon:

### Mejores Horas (UTC)
- **02:00 - 06:00 UTC** (Madrugada en América)
- **14:00 - 17:00 UTC** (Mañana en América)

### Mejores Días
- **Martes a Jueves**: Generalmente menos congestión
- **Fines de semana**: Variable, pero a veces buen gas

### Evitar
- ❌ Lunes (inicio de semana, más actividad)
- ❌ Viernes tarde (cierre de semana trading)
- ❌ Horarios pico: 18:00 - 22:00 UTC

---

## 🔄 Proceso Completo Cuando el Gas Baje

```powershell
# 1. Verificar gas
node -e "..." # Ver comando arriba

# 2. Si gas < 50 Gwei, verificar balance
node -e "..." # Ver comando arriba

# 3. Desplegar
Write-Host "`n🚀 Desplegando Quality Oracle...`n" -ForegroundColor Cyan
node scripts/deploy-quality-oracle-direct.js

# 4. Si tiene éxito, actualizar .env
# Copiar la dirección del contrato desplegado y agregar:
# QUALITY_ESCROW_ADDRESS=0x...
```

---

## 💾 Dirección del Contrato Desplegado

Cuando el despliegue sea exitoso, guarda aquí la información:

```bash
# Deployment Info (Completar después del despliegue)
QUALITY_ESCROW_ADDRESS=
DEPLOYMENT_DATE=
TRANSACTION_HASH=
GAS_USED=
GAS_PRICE_GWEI=
TOTAL_COST_MATIC=
```

Luego actualizar:
- `backend/.env`: Agregar `QUALITY_ESCROW_ADDRESS`
- `frontend/.env`: Agregar `VITE_QUALITY_ESCROW_ADDRESS`

---

## 🆘 Si el Despliegue Falla Nuevamente

1. **Revisar error**: Leer el mensaje de error completo
2. **Verificar nonce**: Puede estar desincronizado
   ```bash
   # Limpiar caché de Hardhat
   rm -rf cache/ artifacts/
   pnpm run compile
   ```
3. **Intentar RPC alternativo**: Cambiar en scripts a:
   - `https://1rpc.io/matic`
   - `https://rpc-mainnet.matic.network`
4. **Considerar Opción A**: Configurar Alchemy/Infura RPC privado

---

## 📞 Recursos Útiles

- **Gas Tracker**: https://polygonscan.com/gastracker
- **Network Status**: https://status.polygon.technology/
- **Gas Price API**: https://gasstation.polygon.technology/v2
- **Block Explorer**: https://polygonscan.com/

---

## ✅ Sistema Listo

Todo está configurado y listo. Solo esperamos el momento óptimo:

- ✅ Configuración de red: Polygon Mainnet
- ✅ Balance verificado: 43.06 MATIC
- ✅ Scripts actualizados y funcionando
- ✅ Documentación completa
- ⏳ **Esperando gas < 50 Gwei**

---

**Próximo paso**: Ejecutar `monitor-gas.ps1` o verificar https://polygonscan.com/gastracker cada hora hasta que el gas baje.

**Última actualización**: 19 Enero 2026  
**Estado**: Esperando condiciones óptimas de gas
