# 🎯 Guía Rápida de Testing - BeZhas Auth System

## 📅 15 de Octubre, 2025

---

## 🚀 QUICK START

### **1. Iniciar Backend**

```powershell
cd backend
node server.js
```

**Verificar que esté corriendo:**
```
✅ Backend server running on http://127.0.0.1:3001
✅ WebSocket server ready for connections
```

---

### **2. Iniciar Frontend**

```powershell
cd frontend
npm run dev
```

**Verificar que esté corriendo:**
```
✅ VITE v5.x.x ready in xxx ms
✅ Local: http://localhost:5173/
```

---

## 🧪 TESTING MANUAL

### **Test 1: Verificación de Email (Sin Wallet)**

#### **Paso 1: Ir a Registro**
```
http://localhost:5173/register
```

#### **Paso 2: Llenar Formulario**
- **Username:** testuser
- **Email:** test@example.com
- **Phone:** +1234567890
- **Password:** password123
- **Confirm Password:** password123

#### **Paso 3: Clic en "Continuar con Verificación"**

**Resultado esperado:**
- ✅ El formulario desaparece
- ✅ Aparece pantalla de verificación
- ✅ En consola del servidor backend verás:
  ```
  📧 Sending verification code 123456 to test@example.com
  ```

#### **Paso 4: Ingresar Código**
- Copiar el código de 6 dígitos de la consola del servidor
- Pegarlo en el campo de verificación

#### **Paso 5: Clic en "Verificar y Registrarse"**

**Resultado esperado:**
- ✅ Mensaje de éxito
- ✅ Usuario creado
- ✅ Redirigido a home o dashboard

---

### **Test 2: Registro con Wallet**

#### **Paso 1: Ir a Registro**
```
http://localhost:5173/register
```

#### **Paso 2: Seleccionar Tab "Wallet"**

#### **Paso 3: Clic en "Conectar Wallet"**

**Resultado esperado:**
- ✅ Web3Modal se abre
- ✅ Lista de wallets disponibles

#### **Paso 4: Seleccionar MetaMask**

**Resultado esperado:**
- ✅ MetaMask popup abre
- ✅ Solicita autorización

#### **Paso 5: Autorizar Conexión**

**Resultado esperado:**
- ✅ Wallet conectada
- ✅ Dirección visible en interfaz
- ✅ Botones de registro habilitados

#### **Paso 6: Opción A - Registro Rápido**

**Clic en "Registrarse con Wallet"**

**Resultado esperado:**
- ✅ MetaMask solicita firma de mensaje
- ✅ Mensaje: "Registrarse en BeZhas..."
- ✅ Usuario firma el mensaje
- ✅ Cuenta creada automáticamente
- ✅ Username generado: `User_0x1234`

#### **Paso 6: Opción B - Registro con Datos**

**Llenar formulario adicional:**
- Username
- Email (opcional)
- Phone (opcional)

**Clic en "Registrarse con Datos Completos"**

**Resultado esperado:**
- ✅ MetaMask solicita firma
- ✅ Cuenta creada con datos personalizados

---

### **Test 3: Login con Email**

#### **Paso 1: Ir a Login**
```
http://localhost:5173/login
```

#### **Paso 2: Tab "Email" (por defecto)**

#### **Paso 3: Ingresar Credenciales**
- **Email:** test@example.com
- **Password:** password123

#### **Paso 4: Clic en "Iniciar Sesión"**

**Resultado esperado:**
- ✅ Autenticación exitosa
- ✅ Token JWT guardado
- ✅ Redirigido a home
- ✅ Header muestra usuario conectado

---

### **Test 4: Login con Wallet**

#### **Paso 1: Ir a Login**
```
http://localhost:5173/login
```

#### **Paso 2: Seleccionar Tab "Wallet"**

#### **Paso 3: Clic en "Conectar Wallet"**

**Resultado esperado:**
- ✅ Web3Modal abre
- ✅ Seleccionar MetaMask
- ✅ Autorizar conexión
- ✅ Dirección visible

#### **Paso 4: Clic en "Iniciar Sesión con Wallet"**

**Resultado esperado:**
- ✅ MetaMask solicita firma
- ✅ Mensaje: "Iniciar sesión en BeZhas..."
- ✅ Usuario firma
- ✅ Autenticación exitosa
- ✅ Redirigido a home

---

## 📊 CHECKLIST DE TESTING

### **Backend**

- [ ] Servidor corriendo en puerto 3001
- [ ] GET /api/health responde OK
- [ ] POST /api/auth/send-verification funciona
- [ ] Código aparece en consola del servidor
- [ ] POST /api/auth/verify-code valida correctamente
- [ ] POST /api/auth/register-wallet crea usuario
- [ ] POST /api/auth/login-wallet autentica usuario

### **Frontend**

- [ ] Frontend corriendo en puerto 5173
- [ ] RegisterPage carga correctamente
- [ ] LoginPage carga correctamente
- [ ] Web3Modal abre al clic en "Conectar Wallet"
- [ ] MetaMask se conecta correctamente
- [ ] Formulario de registro valida campos
- [ ] Sistema de verificación funciona
- [ ] Login con email funciona
- [ ] Login con wallet funciona

### **Integración**

- [ ] Frontend se comunica con backend
- [ ] No hay errores 500 en consola
- [ ] Tokens JWT se guardan correctamente
- [ ] AuthContext mantiene estado de usuario
- [ ] Redirecciones funcionan después de login/registro
- [ ] Header muestra información de usuario

---

**📅 Última Actualización:** 15 de Octubre, 2025  
**🚀 Versión:** 2.0.0  
**⏱️ Tiempo Estimado de Testing:** 15-20 minutos  
**👨‍💻 Creado por:** GitHub Copilot
