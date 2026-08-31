# 🧪 Testing Rápido - BezCoin Blockchain Integration

## 🎯 Objetivo
Verificar que todas las funciones blockchain funcionan correctamente antes de deploy.

---

## ⚙️ Setup Inicial

### 1. Iniciar Red Local
```bash
# Terminal 1 - Hardhat Node
npx hardhat node

# Debería ver:
# Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/
# Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
# Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
```

### 2. Deploy Contratos
```bash
# Terminal 2
npx hardhat run scripts/deploy.js --network localhost

# Debería ver:
# ✅ BezhasToken deployed to: 0x5FbDB...
# ✅ TokenSale deployed to: 0x0165...
```

### 3. Iniciar Frontend
```bash
# Terminal 3
cd frontend
npm run dev

# Debería ver:
# VITE v5.4.20  ready in 1234 ms
# ➜  Local:   http://localhost:5173/
```

### 4. Configurar MetaMask
```
1. Agregar red local:
   - Network Name: Hardhat Local
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 31337
   - Currency: ETH

2. Importar cuenta de prueba:
   - Private Key de Account #0 o #1 (desde npx hardhat node)
   - Ejemplo: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

## 🧪 Tests Manuales

### ✅ Test 1: Verificar Balance Inicial
**Objetivo:** Confirmar que el sistema lee el balance correcto desde blockchain

**Pasos:**
1. Abrir http://localhost:5173
2. Conectar wallet (MetaMask)
3. Abrir consola del navegador (F12)
4. Buscar en consola:

**Esperado:**
```
✅ Balance fetched: 0.0 BEZ
👂 Escuchando eventos Transfer en blockchain...
```

**Si sale error:**
- Verificar que Hardhat node está corriendo
- Verificar direcciones en `contract-config.js`
- Verificar red en MetaMask (debe ser Hardhat Local)

---

### ✅ Test 2: Comprar Tokens con ETH
**Objetivo:** Probar buyWithETH() completo con gas estimation

**Pasos:**
1. En la app, hacer click en "Comprar BEZ" o icono de wallet
2. Seleccionar tab "Comprar con ETH"
3. Ingresar: `0.01` ETH
4. Debería mostrar: "Recibirás: 100 BEZ" (aprox)
5. Click "Comprar Tokens"
6. Confirmar en MetaMask
7. Observar consola

**Consola Esperada:**
```
⛽ Gas estimado: 65421
💵 Gas price: 1.5 gwei
💰 Costo total estimado: 0.01009 ETH
📤 Compra enviada: 0xabc123def456...
⏳ Esperando confirmación...
✅ Compra confirmada en bloque: 2
💎 Tokens recibidos del evento: 100.0 BEZ
✅ Balance fetched: 100.0 BEZ
```

**Toast Esperado:**
1. 🔄 "Confirma la compra en tu wallet..."
2. ⏳ "Esperando confirmación... 0xabc123..."
3. ✅ "¡Compra exitosa! Recibiste 100.00 BEZ"

**Indicador Pendiente:**
```
┌─────────────────────────────────────┐
│  🔄  Transacción en Proceso        │
│  Preparando compra...               │
└─────────────────────────────────────┘
```

**Verificar:**
- ✅ Balance actualizado a 100 BEZ en header
- ✅ Transacción aparece en historial
- ✅ Block number y gas used guardados

---

### ✅ Test 3: Transfer entre Cuentas
**Objetivo:** Probar transfer() con validaciones

**Pasos:**
1. Copiar dirección de Account #1: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
2. Ir a perfil o modal de transfer
3. Pegar dirección destino
4. Ingresar: `10` BEZ
5. Click "Transferir"
6. Confirmar en MetaMask

**Consola Esperada:**
```
⛽ Gas estimado para transferencia: 51234
📤 Transferencia enviada: 0xdef456ghi789...
✅ Transferencia confirmada en bloque: 3
✅ Balance fetched: 90.0 BEZ
```

**Toast:**
1. 🔄 "Confirma la transferencia en tu wallet..."
2. ✅ "¡10 BEZ transferidos exitosamente!"

**Verificar:**
- ✅ Balance disminuyó de 100 a 90 BEZ
- ✅ Transacción en historial con tipo 'transfer'

---

### ✅ Test 4: Event Listener - Recibir Tokens
**Objetivo:** Probar que los event listeners funcionan

**Pasos:**
1. Abrir app en Account #0 (la que tiene 90 BEZ)
2. En MetaMask, cambiar a Account #1
3. Abrir otra pestaña en http://localhost:5173
4. Conectar Account #1 (debería tener 10 BEZ del test anterior)
5. Desde Account #1, enviar 5 BEZ de vuelta a Account #0
6. **IMPORTANTE:** Volver a la pestaña de Account #0 y observar

**Consola Account #0 (receptor):**
```
📥 Transfer detectado (entrada): {
  from: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  value: '5.0',
  txHash: '0xjkl012mno345...',
  block: 4
}
✅ Balance fetched: 95.0 BEZ
```

**Toast en Account #0:**
```
🎉 "¡Recibiste 5.00 BEZ! 💰"
```

**Verificar:**
- ✅ Balance se actualizó automáticamente sin refresh
- ✅ Toast apareció sin intervención del usuario
- ✅ Event listener está funcionando

---

### ✅ Test 5: Donar con Mensaje
**Objetivo:** Probar donate() con parámetro message

**Pasos:**
1. Ir a perfil de otro usuario
2. Click en "Donar BEZ" o botón de propina
3. Ingresar: `5` BEZ
4. Escribir mensaje: "¡Gran contenido! 🔥"
5. Click "Enviar Donación"

**Consola:**
```
💝 Donación enviada: 0xpqr678stu901...
📝 Mensaje: ¡Gran contenido! 🔥
✅ Donación confirmada en bloque: 5
```

**Toast:**
```
✅ "¡Donación de 5 BEZ enviada exitosamente! 💝"
```

**Verificar:**
- ✅ Transacción guardada con type: 'donate'
- ✅ Mensaje incluido en el registro
- ✅ Emoji 💝 en logs

---

### ✅ Test 6: Validaciones y Errores

#### Test 6.1: Dirección Inválida
**Pasos:**
1. Intentar transfer a: `0xinvalid`

**Esperado:**
```
❌ Error: Invalid recipient address
🔴 Toast: "Dirección de destinatario inválida"
```

#### Test 6.2: Self-Transfer
**Pasos:**
1. Intentar transfer a tu propia dirección

**Esperado:**
```
❌ Error: Cannot transfer to yourself
🔴 Toast: "No puedes transferir a ti mismo"
```

#### Test 6.3: Fondos Insuficientes
**Pasos:**
1. Intentar comprar con más ETH del disponible
2. Ejemplo: Ingresar `10000` ETH

**Esperado:**
```
❌ Error: Insufficient ETH balance
🔴 Toast: "Fondos ETH insuficientes"
```

#### Test 6.4: Rechazar Transacción
**Pasos:**
1. Intentar cualquier transacción
2. En MetaMask, click "Reject"

**Esperado:**
```
❌ Error code: ACTION_REJECTED
🔴 Toast: "Transacción rechazada"
```

#### Test 6.5: Balance BEZ Insuficiente
**Pasos:**
1. Intentar transfer de 1000 BEZ (más de lo que tienes)

**Esperado:**
```
❌ Error: Insufficient balance. You have 90 BEZ but need 1000 BEZ
🔴 Toast: "Balance insuficiente"
```

---

### ✅ Test 7: Timeout y Retry

#### Test 7.1: Simular Red Lenta
**Pasos:**
1. En DevTools, ir a Network tab
2. Throttling → Slow 3G
3. Intentar fetch balance

**Esperado:**
```
⏳ Timeout detectado, reintentando... 1
⏳ Timeout detectado, reintentando... 2
❌ Error final después de 2 reintentos
🔴 Toast: "Error al obtener balance"
```

---

### ✅ Test 8: Gas Estimation

**Objetivo:** Verificar que el gas se estima correctamente

**Pasos:**
1. Hacer cualquier transacción (compra, transfer, donate)
2. Observar consola antes de confirmar

**Esperado:**
```
⛽ Gas estimado: 65000
📊 Gas con buffer (20%): 78000
💰 Costo estimado: 0.000117 ETH
```

**Verificar:**
- ✅ Gas estimate es realista (50k-100k para ERC20)
- ✅ Buffer del 20% aplicado
- ✅ Costo calculado correctamente

---

### ✅ Test 9: Transaction Details

**Objetivo:** Verificar que se guardan todos los detalles

**Pasos:**
1. Hacer una compra
2. Ir a "Historial" o abrir consola
3. Inspeccionar objeto transaction

**Esperado:**
```javascript
{
  type: 'buy',
  amount: '100',
  txHash: '0xabc123...',
  blockNumber: 2,
  gasUsed: '65421',
  timestamp: 1234567890,
  status: 'completed',
  method: 'ETH'
}
```

**Verificar:**
- ✅ txHash presente
- ✅ blockNumber > 0
- ✅ gasUsed es string
- ✅ timestamp reciente
- ✅ status = 'completed'

---

### ✅ Test 10: UI Pending Indicator

**Objetivo:** Verificar que el indicador visual funciona

**Pasos:**
1. Iniciar cualquier transacción
2. Observar esquina inferior derecha

**Esperado:**
- ✅ Aparece componente animado
- ✅ Spinner rotando
- ✅ Mensaje cambia: "Preparando..." → "Esperando..." → "Enviado..."
- ✅ Desaparece al confirmar
- ✅ Color púrpura durante proceso
- ✅ Color rojo si error

---

## 📊 Checklist de Verificación

Marca cada test completado:

### Tests Básicos:
- [ ] Balance inicial se muestra correctamente
- [ ] Event listeners se inicializan (ver "👂" en consola)
- [ ] Conectar/desconectar wallet funciona

### Tests de Compra:
- [ ] buyWithETH con 0.01 ETH funciona
- [ ] Gas se estima correctamente
- [ ] Balance se actualiza después de compra
- [ ] Toast progresivo aparece
- [ ] Transacción se guarda con detalles

### Tests de Transfer:
- [ ] Transfer exitoso entre cuentas
- [ ] Validación de dirección funciona
- [ ] Self-transfer es rechazado
- [ ] Balance insuficiente muestra error

### Tests de Donate:
- [ ] Donate con mensaje funciona
- [ ] Mensaje se guarda en transacción
- [ ] Emoji 💝 aparece en logs

### Tests de Event Listeners:
- [ ] Transfer entrante detectado automáticamente
- [ ] Balance se actualiza sin refresh
- [ ] Toast "¡Recibiste X BEZ!" aparece
- [ ] Transfer saliente también detectado

### Tests de Errores:
- [ ] Dirección inválida rechazada
- [ ] Self-transfer rechazado
- [ ] Fondos insuficientes (ETH y BEZ)
- [ ] Transacción rechazada en wallet
- [ ] Timeout con retry funciona

### Tests de UI:
- [ ] PendingTransactionIndicator aparece
- [ ] Mensajes cambian correctamente
- [ ] Indicador desaparece al finalizar
- [ ] Toasts no se duplican

---

## 🐛 Problemas Comunes

### Problema: "Balance no se muestra"
**Solución:**
```bash
# 1. Verificar red
await ethereum.request({ method: 'eth_chainId' })
# Debe ser 0x7a69 (31337 en hex)

# 2. Verificar contrato desplegado
const code = await provider.getCode(BezhasTokenAddress);
console.log('Contract code length:', code.length);
# Debe ser > 2

# 3. Re-deploy contratos
npx hardhat run scripts/deploy.js --network localhost
```

### Problema: "Events no se detectan"
**Solución:**
```javascript
// Verificar en consola:
console.log('Contracts initialized:', contractsInitialized);
// Debe ser true

// Forzar re-setup
window.location.reload();
```

### Problema: "Gas estimation fails"
**Solución:**
```bash
# Verificar balance ETH
const balance = await provider.getBalance(address);
console.log('ETH:', ethers.formatEther(balance));
# Debe tener al menos 0.1 ETH

# Usar cuenta de hardhat con ETH
# Account #0 tiene 10000 ETH por defecto
```

### Problema: "Transaction timeout"
**Solución:**
```javascript
// Aumentar timeout en BezCoinContext.jsx
const receipt = await Promise.race([
  tx.wait(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 300000) // 5 minutos
  )
]);
```

---

## 📈 Métricas de Éxito

Al finalizar todos los tests, deberías tener:

✅ **10/10 tests pasados**  
✅ **0 errores en consola** (excepto los esperados en tests de error)  
✅ **Balance actualizado** en tiempo real  
✅ **Historial de transacciones** con detalles completos  
✅ **Event listeners funcionando**  
✅ **Gas optimization working**  
✅ **UI feedback excelente**  

---

## 🚀 Siguiente Paso

Una vez completados todos estos tests:

1. ✅ Commit cambios:
```bash
git add .
git commit -m "feat: Complete blockchain integration with gas estimation, event listeners, and error handling"
```

2. ✅ Preparar deploy a testnet:
```bash
# Ver guía en BEZCOIN-BLOCKCHAIN-INTEGRATION.md
# Sección "Deploy a Sepolia"
```

3. ✅ Documentar resultados:
```markdown
# Crear archivo: TEST_RESULTS.md
- Fecha: [HOY]
- Tests pasados: 10/10
- Tiempo total: ~30 minutos
- Issues encontrados: [Listar si hubo]
- Próximo paso: Deploy a Sepolia
```

---

## 🎓 Tips de Testing

1. **Usa múltiples cuentas:** Account #0, #1, #2 para simular ecosistema real
2. **Observa la consola:** Los logs con emojis te guían
3. **Revisa MetaMask:** Confirma gas estimado vs real
4. **Prueba edge cases:** 0 BEZ, 0.000001 ETH, direcciones raras
5. **Simula errores:** Rechaza txs, desconecta wallet, cambia red

---

**¡Buena suerte con el testing! 🚀**

Si encuentras algún bug, revisa:
1. Consola del navegador (logs detallados)
2. Network tab (requests fallando)
3. MetaMask (confirmar red correcta)
4. Hardhat node (debe estar corriendo)

