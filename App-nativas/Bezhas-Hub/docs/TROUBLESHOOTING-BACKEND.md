# 🔧 TROUBLESHOOTING - Backend No Funciona

## 📅 15 de Octubre, 2025

---

## ❌ PROBLEMA ACTUAL

El backend parece estar corriendo (`Backend server running on http://127.0.0.1:3001`) pero no responde a peticiones.

---

## 🔍 DIAGNÓSTICO

### **Síntomas:**
- ✅ El servidor dice estar corriendo
- ❌ Los endpoints no responden
- ❌ `curl`/`Invoke-WebRequest` fallan con "No es posible conectar"

### **Posibles Causas:**

1. **Puerto bloqueado por firewall**
2. **Servidor crasheó silenciosamente**
3. **Configuración de CORS incorrecta**
4. **Error en el código del servidor**

---

## ✅ SOLUCIÓN PASO A PASO

### **Paso 1: Detener TODOS los procesos Node**

```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### **Paso 2: Verificar que el puerto 3001 esté libre**

```powershell
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
```

Si hay algo, matarlo:
```powershell
$processId = (Get-NetTCPConnection -LocalPort 3001).OwningProcess
Stop-Process -Id $processId -Force
```

### **Paso 3: Iniciar el servidor en modo verbose**

```powershell
cd "D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Web\bezhas-web3\backend"
$env:DEBUG="*"
node server.js
```

### **Paso 4: En OTRA terminal, probar el endpoint**

```powershell
# Esperar 3 segundos para que el servidor arranque
Start-Sleep -Seconds 3

# Probar endpoint básico
Invoke-RestMethod -Uri "http://127.0.0.1:3001/" -Method GET
```

**Resultado esperado:**
```json
{
  "status": "ok",
  "service": "bezhas-backend",
  "port": 3001,
  "time": "2025-10-15T..."
}
```

### **Paso 5: Probar endpoint de health**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/health" -Method GET
```

**Resultado esperado:**
```json
{ "ok": true }
```

### **Paso 6: Probar endpoint de verificación**

```powershell
$body = @{
    email = "test@example.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:3001/api/auth/send-verification" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Verification code sent to your email"
}
```

**Y en la terminal del servidor verás:**
```
📧 Sending verification code 123456 to test@example.com
```

---

## 🔥 SI NADA FUNCIONA

### **Opción 1: Reinstalar dependencias**

```powershell
cd backend
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json -Force
npm install
node server.js
```

### **Opción 2: Verificar que ethers esté instalado**

```powershell
cd backend
npm list ethers
```

Si no está instalado:
```powershell
npm install ethers@6
```

### **Opción 3: Verificar el archivo auth.routes.js**

Asegúrate de que el archivo `backend/routes/auth.routes.js` tenga esta línea al inicio:

```javascript
const { ethers } = require('ethers');
```

---

## 🐛 DEBUGGING AVANZADO

### **Ver todos los endpoints registrados:**

Agregar al final de `server.js` (antes del `server.listen`):

```javascript
// Debug: Mostrar todas las rutas registradas
console.log('\n📋 Rutas registradas:');
app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(`  ${Object.keys(r.route.methods)[0].toUpperCase()} ${r.route.path}`);
  }
});
console.log('\n');
```

### **Agregar logs detallados:**

En `server.js`, después de la línea `app.use('/api/auth', authRoutes);`:

```javascript
app.use('/api/auth', (req, res, next) => {
  console.log(`🔵 Auth request: ${req.method} ${req.path}`);
  next();
}, authRoutes);
```

---

## 📝 CHECKLIST DE VERIFICACIÓN

### **Backend:**

- [ ] Puerto 3001 libre
- [ ] Servidor Node corriendo (sin crashes)
- [ ] Mensaje "Backend server running on http://127.0.0.1:3001"
- [ ] No hay errores aparte de Redis
- [ ] authRoutes registrado correctamente

### **Firewall:**

- [ ] Windows Firewall permite Node.js
- [ ] Puerto 3001 no está bloqueado

### **Código:**

- [ ] `ethers` está en package.json
- [ ] `auth.routes.js` tiene `require('ethers')`
- [ ] Todos los endpoints tienen `router.post(...)`
- [ ] `module.exports = router` al final

---

## 💡 ALTERNATIVA: Usar Puerto Diferente

Si el puerto 3001 está causando problemas, usa otro:

### **En backend/.env o backend/config.js:**

```env
PORT=3002
```

### **En frontend/.env:**

```env
VITE_API_URL=http://localhost:3002
```

### **Reiniciar ambos servidores**

---

## 🆘 ÚLTIMA OPCIÓN

Si ABSOLUTAMENTE NADA funciona, reinstalar Node.js:

1. Desinstalar Node.js
2. Descargar versión LTS desde https://nodejs.org
3. Instalar Node.js
4. Verificar: `node --version` y `npm --version`
5. Reinstalar dependencias backend:
   ```powershell
   cd backend
   npm install
   node server.js
   ```

---

## 📞 INFORMACIÓN PARA DEBUG

Por favor, proporciona:

1. **Versión de Node.js:**
   ```powershell
   node --version
   ```

2. **Versión de npm:**
   ```powershell
   npm --version
   ```

3. **Output completo del servidor** (primeras 50 líneas)

4. **Errores específicos del frontend** (copiar de consola del navegador)

5. **Resultado de:**
   ```powershell
   Get-NetTCPConnection -LocalPort 3001
   ```

---

**📅 Creado:** 15 de Octubre, 2025  
**🔧 Troubleshooting Guide**  
**👨‍💻 GitHub Copilot**
