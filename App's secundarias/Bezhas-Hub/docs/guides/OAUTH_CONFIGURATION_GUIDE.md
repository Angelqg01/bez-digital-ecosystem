# OAuth Configuration Guide - Google, Facebook, X (Twitter) & GitHub

## 🔐 Google OAuth 2.0 Setup

### 1. Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita **Google+ API** (para obtener datos de perfil)

### 2. Configurar OAuth Consent Screen

1. Ve a **APIs & Services > OAuth consent screen**
2. Selecciona **External** (para usuarios de cualquier cuenta Google)
3. Completa la información:
   - **App name**: BeZhas Web3
   - **User support email**: tu-email@bez.digital
   - **Developer contact**: tu-email@bez.digital
4. **Scopes**: Agrega `email`, `profile`, `openid`
5. Guarda y continúa

### 3. Crear Credenciales OAuth 2.0

1. Ve a **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > OAuth client ID**
3. Tipo de aplicación: **Web application**
4. Configurar:
   - **Name**: BeZhas Web3 Frontend
   - **Authorized JavaScript origins**:
     - `http://localhost:5173` (desarrollo)
     - `https://tu-dominio.com` (producción)
   - **Authorized redirect URIs**:
     - `http://localhost:5173/auth/google/callback` (desarrollo)
     - `https://tu-dominio.com/auth/google/callback` (producción)
5. Click **CREATE**

### 4. Copiar Credenciales

```env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxx
```

Agrega estas variables a tu `.env`:

```bash
# OAuth - Google
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET_HERE
```

---

## 📘 Facebook OAuth Setup

### 1. Crear App en Facebook Developers

1. Ve a [Facebook Developers](https://developers.facebook.com/)
2. Click **My Apps > Create App**
3. Selecciona **Consumer** como tipo de app
4. Completa:
   - **App display name**: BeZhas Web3
   - **App contact email**: tu-email@bez.digital
5. Click **Create App**

### 2. Configurar Facebook Login

1. En el dashboard de tu app, ve a **Add Product**
2. Encuentra **Facebook Login** y click **Set Up**
3. Selecciona **Web** como plataforma
4. En **Site URL**, ingresa:
   - Desarrollo: `http://localhost:5173`
   - Producción: `https://tu-dominio.com`

### 3. Configurar Valid OAuth Redirect URIs

1. Ve a **Facebook Login > Settings**
2. En **Valid OAuth Redirect URIs**, agrega:
   - `http://localhost:5173/auth/facebook/callback` (desarrollo)
   - `https://tu-dominio.com/auth/facebook/callback` (producción)
3. Guarda cambios

### 4. Configurar Permisos

1. Ve a **App Review > Permissions and Features**
2. Solicita permisos para:
   - `email` (aprobado automáticamente)
   - `public_profile` (aprobado automáticamente)

### 5. Copiar Credenciales

1. Ve a **Settings > Basic**
2. Copia **App ID** y **App Secret**

```bash
# OAuth - Facebook
FACEBOOK_APP_ID=YOUR_FACEBOOK_APP_ID_HERE
FACEBOOK_APP_SECRET=YOUR_FACEBOOK_APP_SECRET_HERE
```

---

## � X (Twitter) OAuth 2.0 Setup

### 1. Crear App en X Developer Portal

1. Ve a [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Click **+ Create Project** o usa proyecto existente
3. Crea una nueva **App** dentro del proyecto
4. Completa:
   - **App name**: BeZhas Web3
   - **Use case**: Solicitar autenticación de usuarios

### 2. Configurar OAuth 2.0

1. En tu app, ve a **Settings > User authentication settings**
2. Click **Set up** o **Edit**
3. Configurar:
   - **App permissions**: Read
   - **Type of App**: Web App
   - **Callback URI / Redirect URL**:
     - `http://localhost:5173/auth/x/callback` (desarrollo)
     - `https://tu-dominio.com/auth/x/callback` (producción)
   - **Website URL**: `http://localhost:5173` o tu dominio
4. Guarda cambios

### 3. Habilitar OAuth 2.0

1. Ve a **Keys and tokens**
2. En la sección **OAuth 2.0 Client ID and Client Secret**:
   - Click **Generate** si no están generadas
   - Copia **Client ID** y **Client Secret**

### 4. Copiar Credenciales

```bash
# OAuth - X (Twitter)
X_CLIENT_ID=YOUR_X_CLIENT_ID_HERE
X_CLIENT_SECRET=YOUR_X_CLIENT_SECRET_HERE
```

**⚠️ Importante:**
- X no siempre proporciona email del usuario
- Requiere nivel de acceso "Elevated" para acceso completo a API v2
- Para desarrollo, puedes solicitar **Essential access** (gratis)

---

## 🐙 GitHub OAuth Setup

### 1. Crear OAuth App en GitHub

1. Ve a [GitHub Settings > Developer settings](https://github.com/settings/developers)
2. Click **OAuth Apps > New OAuth App**
3. Completa:
   - **Application name**: BeZhas Web3
   - **Homepage URL**:
     - Desarrollo: `http://localhost:5173`
     - Producción: `https://tu-dominio.com`
   - **Application description**: BeZhas Web3 Social Network
   - **Authorization callback URL**:
     - `http://localhost:5173/auth/github/callback` (desarrollo)
     - `https://tu-dominio.com/auth/github/callback` (producción)
4. Click **Register application**

### 2. Generar Client Secret

1. En la página de tu OAuth App, click **Generate a new client secret**
2. Copia el **Client Secret** inmediatamente (solo se muestra una vez)
3. También copia el **Client ID**

### 3. Configurar Scopes

GitHub OAuth usa scopes para permisos. Los básicos son:
- `read:user` - Leer perfil público del usuario
- `user:email` - Acceder al email del usuario

Estos se configuran en el frontend al iniciar el flow OAuth.

### 4. Copiar Credenciales

```bash
# OAuth - GitHub
GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID_HERE
GITHUB_CLIENT_SECRET=YOUR_GITHUB_CLIENT_SECRET_HERE
```

**✅ Ventajas de GitHub OAuth:**
- Setup muy simple (no requiere revisión)
- Funciona inmediatamente
- Popular entre desarrolladores
- Incluye avatar del usuario automáticamente

---

## �🔧 Implementación en Backend

### Instalar Dependencias

```bash
cd backend
pnpm add google-auth-library axios
```

### Actualizar auth.routes.js

El código ya tiene la estructura preparada. Solo necesitas descomentar las líneas de producción:

**Google OAuth:**
```javascript
// Descomentar en producción:
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const ticket = await client.verifyIdToken({ 
  idToken, 
  audience: process.env.GOOGLE_CLIENT_ID 
});
const payload = ticket.getPayload();

// Comentar/eliminar el mock:
// const payload = { email: `google_user_${Date.now()}@gmail.com`, ... };
```

**Facebook OAuth:**
```javascript
// Descomentar en producción:
const axios = require('axios');
const response = await axios.get(
  `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`
);
const userData = response.data;

// Comentar/eliminar el mock:
// const userData = { email: `fb_user_${Date.now()}@facebook.com`, ... };
```

**X (Twitter) OAuth:**
```javascript
// Descomentar en producción:
const axios = require('axios');
const response = await axios.get('https://api.twitter.com/2/users/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` },
  params: { 'user.fields': 'id,name,username,profile_image_url' }
});
const userData = response.data.data;

// Comentar/eliminar el mock:
// const userData = { id: `x_${Date.now()}`, ... };
```

**GitHub OAuth:**
```javascript
// Descomentar en producción:
const axios = require('axios');

// Paso 1: Intercambiar code por access_token
const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
  client_id: process.env.GITHUB_CLIENT_ID,
  client_secret: process.env.GITHUB_CLIENT_SECRET,
  code: code
}, {
  headers: { 'Accept': 'application/json' }
});

const accessToken = tokenResponse.data.access_token;

// Paso 2: Obtener datos del usuario
const userResponse = await axios.get('https://api.github.com/user', {
  headers: { 
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github.v3+json'
  }
});

const userData = userResponse.data;

// Comentar/eliminar el mock:
// const userData = { id: `gh_${Date.now()}`, ... };
```

---

## 🎨 Implementación en Frontend

### Instalar Dependencias

```bash
cd frontend
pnpm add @react-oauth/google react-facebook-login
```

### Configurar Google en AuthPage.jsx

```javascript
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

// Wrap tu componente:
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <GoogleLogin
    onSuccess={(credentialResponse) => {
      handleGoogleAuth(credentialResponse.credential); // ID Token
    }}
    onError={() => {
      console.log('Login Failed');
    }}
  />
</GoogleOAuthProvider>
```

### Instalar Dependencias

```bash
cd frontend
pnpm add @react-oauth/google react-facebook-login react-twitter-auth @octokit/oauth-app
```

### Configurar Google en AuthPage.jsx

```javascript
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';

// Wrap tu componente:
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <GoogleLogin
    onSuccess={(credentialResponse) => {
      handleGoogleAuth(credentialResponse.credential); // ID Token
    }}
    onError={() => {
      console.log('Login Failed');
    }}
  />
</GoogleOAuthProvider>
```

### Configurar Facebook en AuthPage.jsx

```javascript
import FacebookLogin from 'react-facebook-login';

<FacebookLogin
  appId={import.meta.env.VITE_FACEBOOK_APP_ID}
  fields="name,email,picture"
  callback={(response) => {
    if (response.accessToken) {
      handleFacebookAuth(response.accessToken);
    }
  }}
  icon="fa-facebook"
/>
```

### Configurar X (Twitter) en AuthPage.jsx

```javascript
// X requiere OAuth 2.0 PKCE flow (más complejo)
// Opción recomendada: Usar popup y manejar callback

const handleXAuth = async () => {
  const clientId = import.meta.env.VITE_X_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/x/callback`;
  
  // Generar PKCE code verifier y challenge
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await sha256(codeVerifier);
  
  sessionStorage.setItem('x_code_verifier', codeVerifier);
  
  // Redirigir a X para autorización
  const authUrl = `https://twitter.com/i/oauth2/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=tweet.read%20users.read&` +
    `state=${generateRandomString(32)}&` +
    `code_challenge=${codeChallenge}&` +
    `code_challenge_method=S256`;
    
  window.location.href = authUrl;
};

// En XCallback.jsx (callback route):
useEffect(() => {
  const code = new URLSearchParams(window.location.search).get('code');
  const codeVerifier = sessionStorage.getItem('x_code_verifier');
  
  if (code && codeVerifier) {
    fetch('/api/auth/x-twitter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, codeVerifier })
    }).then(/* ... */);
  }
}, []);
```

### Configurar GitHub en AuthPage.jsx

```javascript
// GitHub OAuth es más simple (no requiere PKCE)
const handleGitHubAuth = () => {
  const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
  const redirectUri = `${window.location.origin}/auth/github/callback`;
  const scope = 'read:user user:email';
  
  // Redirigir a GitHub para autorización
  window.location.href = `https://github.com/login/oauth/authorize?` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent(scope)}`;
};

// En GitHubCallback.jsx (callback route):
useEffect(() => {
  const code = new URLSearchParams(window.location.search).get('code');
  
  if (code) {
    fetch('/api/auth/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    .then(res => res.json())
    .then(data => {
      localStorage.setItem('token', data.token);
      navigate('/dashboard');
    });
  }
}, []);
```
    }
  }}
  icon="fa-facebook"
/>
```

### Variables de Entorno Frontend (.env)

```bash
# Frontend OAuth Config
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID_HERE
VITE_FACEBOOK_APP_ID=YOUR_FACEBOOK_APP_ID_HERE
```

---

## ✅ Checklist de Activación

### Google OAuth
- [ ] Proyecto creado en Google Cloud Console
- [ ] Google+ API habilitada
- [ ] OAuth Consent Screen configurado
- [ ] Credenciales OAuth 2.0 creadas
- [ ] `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en backend `.env`
- [ ] `VITE_GOOGLE_CLIENT_ID` en frontend `.env`
- [ ] Código de producción descomentado en `auth.routes.js`
- [ ] `google-auth-library` instalada
- [ ] Frontend configurado con `@react-oauth/google`

### Facebook OAuth
- [ ] App creada en Facebook Developers
- [ ] Facebook Login configurado
- [ ] Valid OAuth Redirect URIs agregadas
- [ ] Permisos `email` y `public_profile` solicitados
- [ ] `FACEBOOK_APP_ID` y `FACEBOOK_APP_SECRET` en backend `.env`
- [ ] `VITE_FACEBOOK_APP_ID` en frontend `.env`
- [ ] Código de producción descomentado en `auth.routes.js`
- [ ] `axios` instalada para Facebook Graph API
- [ ] Frontend configurado con `react-facebook-login`

### X (Twitter) OAuth
- [ ] App creada en X Developer Portal
- [ ] OAuth 2.0 configurado con PKCE
- [ ] Callback URI agregado
- [ ] Nivel de acceso configurado (Essential/Elevated)
- [ ] `X_CLIENT_ID` y `X_CLIENT_SECRET` en backend `.env`
- [ ] `VITE_X_CLIENT_ID` en frontend `.env`
- [ ] Código de producción descomentado en `auth.routes.js`
- [ ] Frontend configurado con PKCE flow

### GitHub OAuth
- [ ] OAuth App creada en GitHub
- [ ] Authorization callback URL configurado
- [ ] Client Secret generado y guardado
- [ ] `GITHUB_CLIENT_ID` y `GITHUB_CLIENT_SECRET` en backend `.env`
- [ ] `VITE_GITHUB_CLIENT_ID` en frontend `.env`
- [ ] Código de producción descomentado en `auth.routes.js`
- [ ] Frontend configurado con OAuth flow
- [ ] Callback route creado (`/auth/github/callback`)

---

## 🧪 Testing OAuth

### Google Testing
```bash
# 1. Verifica que el backend reciba el ID Token
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken": "GOOGLE_ID_TOKEN_FROM_FRONTEND"}'

# Respuesta esperada:
{
  "message": "Login con Google exitoso",
  "user": { "email": "user@gmail.com", ... },
  "token": "JWT_TOKEN"
}
```

### Facebook Testing
```bash
# 1. Verifica que el backend reciba el Access Token
curl -X POST http://localhost:3001/api/auth/facebook \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "FACEBOOK_ACCESS_TOKEN_FROM_FRONTEND"}'

# Respuesta esperada:
{
  "message": "Login con Facebook exitoso",
  "user": { "email": "user@facebook.com", ... },
  "token": "JWT_TOKEN"
}
```

### X (Twitter) Testing
```bash
# Test con tokens de OAuth 2.0
curl -X POST http://localhost:3001/api/auth/x-twitter \
  -H "Content-Type: application/json" \
  -d '{"accessToken": "X_ACCESS_TOKEN", "accessTokenSecret": "X_TOKEN_SECRET"}'

# Respuesta esperada:
{
  "message": "Login con X (Twitter) exitoso",
  "user": { "email": "user@x.com", "username": "xuser123", ... },
  "token": "JWT_TOKEN"
}
```

### GitHub Testing
```bash
# Test con authorization code
curl -X POST http://localhost:3001/api/auth/github \
  -H "Content-Type: application/json" \
  -d '{"code": "GITHUB_AUTHORIZATION_CODE"}'

# Respuesta esperada:
{
  "message": "Login con GitHub exitoso",
  "user": { "email": "user@github.com", "username": "githubuser", ... },
  "token": "JWT_TOKEN"
}
```

---

## 🔒 Seguridad en Producción

### 1. Validar Tokens del Lado del Servidor
✅ **Ya implementado** - El backend verifica tokens con Google/Facebook APIs

### 2. HTTPS Obligatorio
⚠️ OAuth solo funciona en HTTPS en producción (localhost es excepción)

### 3. Rate Limiting
✅ **Ya implementado** - Sistema de rate limiting activo en BeZhas

### 4. CORS Configurado
Asegúrate de que `ALLOWED_ORIGINS` en `.env` incluya tu dominio:
```bash
ALLOWED_ORIGINS=https://tu-dominio.com,http://localhost:5173
```

### 5. Secrets en Variables de Entorno
❌ **NUNCA** subas `.env` a Git
✅ Usa GitHub Secrets o servicios como Vault en producción

---

## 📚 Recursos Oficiales

- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Docs](https://developers.facebook.com/docs/facebook-login)
- [X (Twitter) OAuth 2.0 Docs](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- [GitHub OAuth Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [Polygon Amoy Faucet](https://faucet.polygon.technology/)

---

**Última actualización:** 14 de Enero, 2026  
**Estado:** Configuración lista para activación - 6 métodos de autenticación  
**Métodos Soportados:** Wallet (2), Email, Google, Facebook, X (Twitter), GitHub
