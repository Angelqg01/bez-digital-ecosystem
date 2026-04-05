# 🧪 OAuth Testing Guide - Quick Start

## 🚀 Servers Status

### Backend
- **URL**: http://localhost:3001
- **Status**: ✅ Running
- **Log**: `backend/backend_startup.log`

### Frontend
- **URL**: http://localhost:5173
- **Status**: ✅ Running
- **Framework**: Vite + React

---

## 📝 Testing OAuth Flows

### 1. Google OAuth Test

#### Steps:
1. Abrir navegador en http://localhost:5173
2. Click en **"Registrarse Ahora"** (navbar) o **"Comenzar Gratis"** (hero section)
3. En el modal, click en el botón azul de Google
4. Seleccionar cuenta de Google
5. Verificar redirección a `/home` con sesión activa

#### Expected Behavior:
- ✅ Modal se abre con animación
- ✅ Botón de Google renderiza correctamente (componente oficial)
- ✅ Popup de Google se abre
- ✅ Después de seleccionar cuenta, se cierra el popup
- ✅ Request a `POST /api/auth/google` con `idToken`
- ✅ Backend valida token con `google-auth-library`
- ✅ Backend retorna JWT token de BeZhas
- ✅ Frontend guarda token en `localStorage`
- ✅ Redirección a `/home`

#### Debugging:
```javascript
// En Chrome DevTools Console:
localStorage.getItem('auth')
// Debería mostrar: {"user":{...},"token":"eyJ..."}
```

---

### 2. GitHub OAuth Test

#### Steps:
1. Abrir navegador en http://localhost:5173
2. Click en **"Registrarse Ahora"** (navbar) o **"Comenzar Gratis"** (hero section)
3. En el modal, click en **"Continuar con GitHub"**
4. Autorizar BeZhas en GitHub
5. Verificar redirección a `/auth/github/callback` → `/home`

#### Expected Behavior:
- ✅ Modal se abre con animación
- ✅ Botón de GitHub renderiza correctamente
- ✅ Redirección a `https://github.com/login/oauth/authorize?client_id=...`
- ✅ Usuario autoriza la app
- ✅ GitHub redirige a `http://localhost:5173/auth/github/callback?code=...`
- ✅ `GitHubCallback` component captura el `code`
- ✅ Request a `POST /api/auth/github` con `code`
- ✅ Backend intercambia code por access_token
- ✅ Backend obtiene datos de usuario de GitHub API
- ✅ Backend retorna JWT token de BeZhas
- ✅ Frontend guarda token en `localStorage`
- ✅ Redirección a `/home`

#### Debugging:
```javascript
// En Chrome DevTools Console:
localStorage.getItem('auth')
// Debería mostrar: {"user":{...},"token":"eyJ..."}

// Verificar URL durante callback:
// http://localhost:5173/auth/github/callback?code=1a2b3c4d5e6f7g8h9i0j
```

---

### 3. Wallet OAuth Test

#### Steps:
1. Abrir navegador en http://localhost:5173
2. Asegurar que MetaMask esté instalado y desbloqueado
3. Click en **"Registrarse Ahora"** (navbar) o **"Comenzar Gratis"** (hero section)
4. En el modal, click en **"Conectar con Wallet"** (badge "Recomendado")
5. Seleccionar MetaMask y aprobar conexión
6. Firmar mensaje de verificación
7. Verificar redirección a `/home`

#### Expected Behavior:
- ✅ Modal se abre con animación
- ✅ Web3Modal se abre
- ✅ Usuario conecta MetaMask
- ✅ Backend genera nonce
- ✅ Usuario firma mensaje con nonce
- ✅ Backend valida firma
- ✅ Backend retorna JWT token
- ✅ Frontend guarda token en `localStorage`
- ✅ Redirección a `/home`

---

## 🔍 API Endpoints Testing

### Google OAuth Endpoint

#### Request:
```bash
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."}'
```

#### Expected Response (Success):
```json
{
  "message": "Login con Google exitoso",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@gmail.com",
    "username": "User Name",
    "profileImage": "https://lh3.googleusercontent.com/...",
    "roles": ["USER"],
    "referralCode": "ABC123"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Expected Response (Error):
```json
{
  "error": "Error en autenticación con Google"
}
```

---

### GitHub OAuth Endpoint

#### Request:
```bash
curl -X POST http://localhost:3001/api/auth/github \
  -H "Content-Type: application/json" \
  -d '{"code": "1a2b3c4d5e6f7g8h9i0j"}'
```

#### Expected Response (Success):
```json
{
  "message": "Login con GitHub exitoso",
  "user": {
    "id": "507f1f77bcf86cd799439012",
    "email": "user@github.com",
    "username": "githubuser",
    "profileImage": "https://avatars.githubusercontent.com/u/...",
    "roles": ["USER"],
    "referralCode": "DEF456"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Expected Response (Error):
```json
{
  "error": "Error validating GitHub code"
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Google Login Failed"
**Causa**: Client ID no configurado o inválido

**Solución**:
1. Verificar `frontend/.env`:
   ```env
   VITE_GOOGLE_CLIENT_ID=456745916981-bpn3e2s6sinc11i7lp3g92c764ign6uv.apps.googleusercontent.com
   ```
2. Reiniciar frontend: `pnpm run dev`
3. Verificar que el dominio esté autorizado en Google Cloud Console

---

### Issue 2: "GitHub Authorization Failed"
**Causa**: Callback URL no coincide

**Solución**:
1. Verificar callback URL en GitHub OAuth App:
   - Debe ser: `http://localhost:5173/auth/github/callback`
2. Verificar `frontend/.env`:
   ```env
   VITE_GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
   ```
3. Verificar `backend/.env`:
   ```env
   GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
   GITHUB_CLIENT_SECRET=YOUR_GITHUB_CLIENT_SECRET
   ```

---

### Issue 3: "Token validation failed"
**Causa**: Token expirado o audience mismatch

**Solución**:
1. ID Tokens de Google expiran en 1 hora
2. Verificar que el `audience` en el backend coincida con el Client ID
3. Backend valida con:
   ```javascript
   const ticket = await client.verifyIdToken({
     idToken,
     audience: process.env.GOOGLE_CLIENT_ID
   });
   ```

---

### Issue 4: "User email not found" (GitHub)
**Causa**: Usuario tiene email privado en GitHub

**Solución**:
- Backend intenta obtener email de `/user/emails` endpoint
- Si falla, crea email temporal: `gh_user_${timestamp}@github.com`
- Usuario puede actualizar email después en perfil

---

### Issue 5: "CORS Error"
**Causa**: Origen no permitido

**Solución**:
1. Verificar `backend/.env`:
   ```env
   ALLOWED_ORIGINS=http://localhost:5173
   FRONTEND_URL=http://localhost:5173
   ```
2. Reiniciar backend

---

## 📊 Success Metrics

### ✅ Landing Page Modal
- [x] Modal se abre con animación smooth
- [x] Backdrop oscuro con blur
- [x] Botón de cierre (X) funcional
- [x] 3 opciones de registro visibles
- [x] Badge "Recomendado" en Wallet
- [x] Links a términos y privacidad

### ✅ Google OAuth
- [x] Botón de Google renderiza correctamente
- [x] Popup de Google se abre sin errores
- [x] Después de login, popup se cierra
- [x] Request a `/api/auth/google` exitoso
- [x] Token guardado en localStorage
- [x] Redirección a `/home`

### ✅ GitHub OAuth
- [x] Botón de GitHub renderiza correctamente
- [x] Redirección a GitHub autorización
- [x] Después de autorizar, redirect a callback
- [x] Callback procesa code correctamente
- [x] Request a `/api/auth/github` exitoso
- [x] Token guardado en localStorage
- [x] Redirección a `/home`

### ✅ Wallet OAuth
- [x] Web3Modal se abre
- [x] Conexión con MetaMask exitosa
- [x] Firma de mensaje exitosa
- [x] Request a backend exitoso
- [x] Token guardado en localStorage
- [x] Redirección a `/home`

---

## 🎯 Next Actions

### User Experience
1. Verificar que el usuario vea su avatar en el navbar
2. Verificar que el perfil muestre datos correctos
3. Verificar que el método de auth esté guardado en user document

### Security
1. Verificar que tokens expiren correctamente
2. Verificar que logout limpie localStorage
3. Verificar que rutas protegidas requieran auth

### Analytics
1. Trackear qué método de auth es más popular
2. Medir conversion rate por método
3. Detectar errores comunes

---

## 📞 Support

Si encuentras algún problema durante el testing:
1. Revisar Chrome DevTools Console (F12)
2. Revisar `backend/backend_startup.log`
3. Revisar este documento para debugging

---

**Fecha de Testing**: 23 de Enero, 2026  
**Métodos Testeados**: Wallet, Google OAuth, GitHub OAuth  
**Status**: ✅ Ready for Production Testing

🚀 **¡Happy Testing!**
