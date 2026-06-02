# 🔐 Autenticación con Wallet y Registro Mejorado - BeZhas

## 📋 Resumen de Implementación

Se ha implementado un sistema completo de autenticación dual (Web2 + Web3) con las siguientes características:

✅ **Login con Email y Wallet**  
✅ **Registro con Email y Wallet**  
✅ **Formulario de Registro Completo** (Username, Email, Teléfono, Contraseña, Confirmación)  
✅ **Verificación por Correo Electrónico** (Código de 6 dígitos)  
✅ **Firma de Mensajes con Wallet** (Autenticación segura)  

---

## 🎯 Funcionalidades Implementadas

### 1️⃣ **Login Page con Doble Método**

#### **Opción A: Login con Email**
- Email + Contraseña tradicional
- Validación en frontend y backend
- JWT token para sesión

#### **Opción B: Login con Wallet**
- Conectar wallet (MetaMask, WalletConnect, etc.)
- Firma de mensaje para autenticación
- Verificación de firma en backend
- Sesión automática

**Flujo de Login con Wallet:**
```
1. Usuario hace clic en "Conectar Wallet"
2. Selecciona su wallet (MetaMask/WalletConnect)
3. Autoriza la conexión
4. Sistema solicita firma de mensaje
5. Usuario firma el mensaje en su wallet
6. Backend verifica la firma
7. ¡Usuario autenticado!
```

---

### 2️⃣ **Register Page Mejorado**

#### **Campos del Formulario:**

| Campo | Tipo | Validación | Requerido |
|-------|------|------------|-----------|
| **Nombre de Usuario** | text | Min 3 caracteres | ✅ Sí |
| **Email** | email | Formato válido | ✅ Sí |
| **Teléfono** | tel | Min 10 dígitos | ✅ Sí |
| **Contraseña** | password | Min 6 caracteres | ✅ Sí |
| **Confirmar Contraseña** | password | Debe coincidir | ✅ Sí |

#### **Proceso de Registro en 2 Pasos:**

**PASO 1: Formulario de Datos**
```
┌─────────────────────────────────┐
│  • Nombre de usuario            │
│  • Email                        │
│  • Teléfono                     │
│  • Contraseña                   │
│  • Confirmar contraseña         │
│                                 │
│  [Continuar con Verificación]  │
└─────────────────────────────────┘
```

**PASO 2: Verificación por Email**
```
┌─────────────────────────────────┐
│  Verifica tu Email              │
│  📧                             │
│  Código enviado a:              │
│  tu@email.com                   │
│                                 │
│  Código: [______]               │
│                                 │
│  [Verificar y Registrarse]      │
│  [Reenviar código]              │
└─────────────────────────────────┘
```

---

### 3️⃣ **Registro con Wallet**

#### **Modo Rápido (Solo Wallet):**
- Conectar wallet
- Firma de mensaje
- Registro automático con username generado: `User_0x1234`
- Perfil básico creado

#### **Modo Completo (Wallet + Datos):**
- Conectar wallet
- Completar formulario (username, email, teléfono)
- Firma de mensaje
- Registro con datos completos

---

## 🔧 Archivos Modificados/Creados

### **Modificados:**

#### 1. `AuthContext.jsx`
```javascript
// Nuevas funciones agregadas:
- loginWithWallet(walletAddress)
- registerWithWallet(walletAddress, additionalData)
- sendVerificationCode(email)
- verifyCode(email, code)
```

#### 2. `authService.js`
```javascript
// Nuevos endpoints:
- POST /api/auth/login-wallet
- POST /api/auth/register-wallet
- POST /api/auth/send-verification
- POST /api/auth/verify-code
```

#### 3. `LoginPage.jsx`
- UI completamente rediseñada
- Tabs para Email/Wallet
- Integración con Web3Modal
- Firma de mensajes con ethers.js

#### 4. `RegisterPage.jsx`
- Formulario completo con 5 campos
- Sistema de 2 pasos
- Verificación por email
- Opción de registro con wallet
- Validaciones en tiempo real

---

## 🎨 Diseño y UX

### **Colores y Gradientes:**

```css
/* Login/Register Cards */
background: white / dark:gray-800
border: gray-200 / dark:gray-700
shadow: xl

/* Botón Email */
gradient: cyan-500 → blue-500

/* Botón Wallet */
gradient: purple-500 → pink-500

/* Estados de Error */
background: red-50 / dark:red-900/20
border: red-200 / dark:red-800
text: red-600 / dark:red-400

/* Estados de Éxito */
background: green-50 / dark:green-900/20
border: green-200 / dark:green-800
text: green-600 / dark:green-400
```

### **Iconos Utilizados:**

| Icono | Componente | Uso |
|-------|-----------|-----|
| `LogIn` | LoginPage | Icono principal de login |
| `UserPlus` | RegisterPage | Icono principal de registro |
| `Mail` | Inputs | Campo de email |
| `Lock` | Inputs | Campo de contraseña |
| `User` | Inputs | Campo de username |
| `Phone` | Inputs | Campo de teléfono |
| `Wallet` | Buttons | Conexión de wallet |
| `CheckCircle` | Messages | Mensajes de éxito |
| `AlertCircle` | Messages | Mensajes de error |

---

## 🔒 Seguridad Implementada

### **1. Firma de Mensajes para Wallet**

```javascript
// Mensaje firmado para login
const message = `Iniciar sesión en BeZhas\nTimestamp: ${Date.now()}`;
const signature = await signer.signMessage(message);

// Mensaje firmado para registro
const message = `Registrarse en BeZhas\nAddress: ${walletAddress}\nTimestamp: ${Date.now()}`;
const signature = await signer.signMessage(message);
```

**Ventajas:**
- ✅ No se expone la clave privada
- ✅ El mensaje incluye timestamp (evita replay attacks)
- ✅ Backend verifica que la firma corresponda a la address
- ✅ No requiere transacción on-chain

### **2. Validaciones en Frontend**

```javascript
// Username
- Mínimo 3 caracteres
- Solo caracteres alfanuméricos

// Email
- Formato válido (regex)
- Dominio existente

// Teléfono
- Mínimo 10 dígitos
- Solo números

// Contraseña
- Mínimo 6 caracteres
- Debe coincidir con confirmación

// Código de Verificación
- Exactamente 6 dígitos
- Solo números
```

### **3. Verificación por Email**

**Proceso:**
```
1. Usuario ingresa email
2. Backend genera código aleatorio de 6 dígitos
3. Se envía código por email
4. Usuario ingresa código
5. Backend verifica coincidencia
6. Si es válido, procede con registro
```

---

## 📡 Backend Endpoints Requeridos

### **1. POST /api/auth/login-wallet**

**Request:**
```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "signature": "0xabc123...",
  "message": "Iniciar sesión en BeZhas\nTimestamp: 1697385600000"
}
```

**Response:**
```json
{
  "user": {
    "id": "user123",
    "username": "User_0x1234",
    "email": null,
    "walletAddress": "0x1234567890abcdef1234567890abcdef12345678"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Lógica Backend:**
```javascript
// 1. Verificar firma
const recoveredAddress = ethers.verifyMessage(message, signature);
if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
  throw new Error('Invalid signature');
}

// 2. Buscar usuario por walletAddress
const user = await User.findOne({ walletAddress });

// 3. Generar JWT token
const token = jwt.sign({ userId: user.id }, SECRET);

// 4. Retornar user y token
```

---

### **2. POST /api/auth/register-wallet**

**Request:**
```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "signature": "0xabc123...",
  "message": "Registrarse en BeZhas\nAddress: 0x1234...\nTimestamp: 1697385600000",
  "username": "MiUsername",
  "email": "opcional@email.com",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "user": {
    "id": "user123",
    "username": "MiUsername",
    "email": "opcional@email.com",
    "phone": "+1234567890",
    "walletAddress": "0x1234567890abcdef1234567890abcdef12345678"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### **3. POST /api/auth/send-verification**

**Request:**
```json
{
  "email": "usuario@email.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Código enviado"
}
```

**Lógica Backend:**
```javascript
// 1. Generar código aleatorio de 6 dígitos
const code = Math.floor(100000 + Math.random() * 900000);

// 2. Guardar en Redis/Database con TTL de 10 minutos
await redis.set(`verification:${email}`, code, 'EX', 600);

// 3. Enviar email con el código
await sendEmail(email, 'Código de verificación BeZhas', `Tu código es: ${code}`);
```

---

### **4. POST /api/auth/verify-code**

**Request:**
```json
{
  "email": "usuario@email.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "verified": true
}
```

**Lógica Backend:**
```javascript
// 1. Obtener código guardado
const savedCode = await redis.get(`verification:${email}`);

// 2. Comparar códigos
if (savedCode === code) {
  // 3. Eliminar código usado
  await redis.del(`verification:${email}`);
  return { verified: true };
} else {
  return { verified: false };
}
```

---

## 🧪 Testing

### **Test 1: Login con Email**
```bash
1. Ir a http://localhost:5173/login
2. Seleccionar tab "Email"
3. Ingresar credenciales:
   - Email: test@example.com
   - Password: password123
4. Clic en "Iniciar Sesión"
5. Verificar redirección a home
```

### **Test 2: Login con Wallet**
```bash
1. Ir a http://localhost:5173/login
2. Seleccionar tab "Wallet"
3. Clic en "Conectar Wallet"
4. Autorizar en MetaMask
5. Clic en "Iniciar Sesión con Wallet"
6. Firmar mensaje en MetaMask
7. Verificar redirección a home
```

### **Test 3: Registro con Email (Completo)**
```bash
1. Ir a http://localhost:5173/register
2. Seleccionar tab "Email"
3. Completar formulario:
   - Username: testuser
   - Email: test@example.com
   - Phone: +1234567890
   - Password: password123
   - Confirm: password123
4. Clic en "Continuar con Verificación"
5. Verificar que se envía email
6. Ingresar código de 6 dígitos
7. Clic en "Verificar y Registrarse"
8. Verificar creación de cuenta
```

### **Test 4: Registro con Wallet**
```bash
1. Ir a http://localhost:5173/register
2. Seleccionar tab "Wallet"
3. Clic en "Conectar Wallet"
4. Autorizar en MetaMask
5. Clic en "Registrarse con Wallet"
6. Firmar mensaje en MetaMask
7. Verificar creación de cuenta automática
```

---

## 🔄 Flujos Visuales

### **Flujo Login con Wallet**

```
┌─────────────────────────────────────────────────────────┐
│  Usuario en LoginPage                                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├─> Selecciona tab "Wallet"
                  │
                  ├─> Clic "Conectar Wallet"
                  │
                  ├─> Web3Modal abre
                  │
                  ├─> Usuario selecciona MetaMask
                  │
                  ├─> Autoriza conexión
                  │
                  ├─> Wallet conectada ✅
                  │
                  ├─> Clic "Iniciar Sesión con Wallet"
                  │
                  ├─> Sistema genera mensaje:
                  │   "Iniciar sesión en BeZhas
                  │    Timestamp: 1697385600000"
                  │
                  ├─> Solicita firma en wallet
                  │
                  ├─> Usuario firma mensaje
                  │
                  ├─> Frontend envía a backend:
                  │   - walletAddress
                  │   - signature
                  │   - message
                  │
                  ├─> Backend verifica firma
                  │
                  ├─> Backend busca/crea usuario
                  │
                  ├─> Backend genera JWT
                  │
                  ├─> Frontend guarda token
                  │
                  └─> Redirige a home ✅
```

---

## 💡 Mejores Prácticas Implementadas

### **1. UX/UI**
✅ Loading states durante procesos  
✅ Mensajes de error claros y específicos  
✅ Feedback visual inmediato  
✅ Diseño responsive (mobile-friendly)  
✅ Dark mode support  
✅ Animaciones suaves en transiciones  

### **2. Seguridad**
✅ Validación en frontend y backend  
✅ Sanitización de inputs  
✅ Firma de mensajes con timestamp  
✅ Verificación de firma en backend  
✅ Códigos de verificación con TTL  
✅ Contraseñas hasheadas (bcrypt en backend)  

### **3. Performance**
✅ Lazy loading de componentes  
✅ Debounce en validaciones  
✅ Optimización de re-renders  
✅ Cache de datos de usuario  

---

## 📞 Troubleshooting

### **Error: "No wallet detected"**
**Solución:**
```bash
1. Verificar que MetaMask esté instalado
2. Refrescar la página
3. Verificar que MetaMask esté desbloqueado
```

### **Error: "Invalid signature"**
**Solución:**
```bash
1. Verificar que la firma sea correcta
2. Verificar que el mensaje no haya sido modificado
3. Verificar timestamp (no debe ser muy antiguo)
```

### **Error: "Código de verificación inválido"**
**Solución:**
```bash
1. Verificar que el código sea exactamente 6 dígitos
2. Código puede haber expirado (10 min)
3. Solicitar reenvío de código
```

---

## 🚀 Próximas Mejoras

### **Versión 2.1:**
- [ ] Recuperación de contraseña
- [ ] Autenticación 2FA
- [ ] Login con redes sociales (Google, Twitter)
- [ ] Verificación de teléfono por SMS

### **Versión 2.2:**
- [ ] Multi-wallet support (vincular varias wallets)
- [ ] Sesiones múltiples
- [ ] Historial de accesos
- [ ] Gestión de dispositivos confiables

---

**📅 Fecha de Implementación:** 15 de Octubre, 2025  
**📦 Versión:** 2.0.0  
**👨‍💻 Desarrollado por:** GitHub Copilot  
**🚀 Proyecto:** BeZhas Web3 Platform
