# Sistema de Chat BeZhas

## 🚀 Descripción General

El sistema de chat de BeZhas es una plataforma de mensajería completa integrada con inteligencia artificial que permite:

- **Chat con IA**: Asistente virtual disponible 24/7 para todos los usuarios
- **Mensajería directa**: Chat privado entre usuarios
- **Grupos**: Conversaciones grupales
- **Chat empresarial**: Comunicación con empresas verificadas
- **Foros**: Discusiones temáticas
- **Modo Admin/Dev**: IA mejorada para administradores y desarrolladores

## 📂 Estructura de Archivos

### Frontend
```
frontend/src/
├── pages/
│   └── ChatPage.jsx           # Página principal del chat
└── config/
    └── sidebarConfig.jsx      # Configuración con acceso directo al chat
```

### Backend
```
backend/
└── routes/
    └── chat.routes.js         # Rutas API del chat y IA
```

## 🎨 Características del Frontend

### ChatPage Component

**Ubicación**: `frontend/src/pages/ChatPage.jsx`

**Características principales**:

1. **Interface dividida en 3 secciones**:
   - Sidebar con lista de conversaciones
   - Área de mensajes central
   - Modal para crear nuevos chats

2. **Funcionalidades**:
   - ✅ Chat con IA en tiempo real
   - ✅ Búsqueda de conversaciones
   - ✅ Filtros por tipo (Todos, IA, Directos, Grupos)
   - ✅ Indicadores de estado en línea
   - ✅ Estados de mensaje (enviando, enviado, leído, fallido)
   - ✅ Historial persistente en localStorage (para IA)
   - ✅ Soporte para adjuntar archivos (próximamente)
   - ✅ Emojis (próximamente)
   - ✅ Llamadas de voz/video (próximamente)
   - ✅ Responsive: móvil y desktop

3. **Estados del mensaje**:
   - `sending`: Enviando (spinner)
   - `sent`: Enviado (✓)
   - `read`: Leído (✓✓)
   - `failed`: Fallido (✗)

4. **Tipos de chat**:
   - `ai`: Chat con IA
   - `direct`: Chat directo
   - `group`: Grupo
   - `forum`: Foro
   - `business`: Empresa

## 🔧 API Endpoints

### Backend Routes

**Ubicación**: `backend/routes/chat.routes.js`

#### 1. Chat con IA
```
POST /api/chat
```
**Descripción**: Envía un mensaje al asistente de IA

**Body**:
```json
{
  "message": "string",
  "context": {
    "isAdmin": false,
    "user": {}
  }
}
```

**Response**:
```json
{
  "success": true,
  "reply": "string",
  "timestamp": 1234567890
}
```

#### 2. Obtener conversaciones
```
GET /api/chat/conversations/:address
```
**Descripción**: Obtiene todas las conversaciones del usuario

**Response**:
```json
{
  "success": true,
  "chats": [
    {
      "id": "string",
      "type": "ai|direct|group|forum",
      "name": "string",
      "avatar": "string",
      "lastMessage": "string",
      "timestamp": 1234567890,
      "unread": 0,
      "online": true
    }
  ]
}
```

#### 3. Obtener mensajes
```
GET /api/chat/messages/:chatId/:address
```
**Descripción**: Obtiene todos los mensajes de un chat específico

**Response**:
```json
{
  "success": true,
  "messages": [
    {
      "id": "string",
      "sender": "me|ai|address",
      "content": "string",
      "timestamp": 1234567890,
      "status": "sending|sent|read|failed"
    }
  ]
}
```

#### 4. Enviar mensaje
```
POST /api/chat/send
```
**Descripción**: Envía un mensaje a un chat

**Body**:
```json
{
  "chatId": "string",
  "sender": "address",
  "content": "string",
  "timestamp": 1234567890
}
```

**Response**:
```json
{
  "success": true,
  "messageId": "string",
  "message": {}
}
```

#### 5. Crear nuevo chat
```
POST /api/chat/create
```
**Descripción**: Crea una nueva conversación

**Body**:
```json
{
  "type": "direct|group|forum",
  "name": "string",
  "members": ["address1", "address2"],
  "creator": "address"
}
```

**Response**:
```json
{
  "success": true,
  "chat": {}
}
```

#### 6. Chat Admin (Privado)
```
POST /api/chat/admin
```
**Descripción**: Chat especial para admin/dev con IA mejorada

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Body**:
```json
{
  "message": "string"
}
```

**Response**:
```json
{
  "success": true,
  "reply": "[Admin Mode] respuesta...",
  "timestamp": 1234567890,
  "isAdmin": true
}
```

#### 7. Estado en línea
```
GET /api/chat/online
POST /api/chat/online
```
**Descripción**: Obtener/actualizar usuarios en línea

## 🤖 Sistema de IA

### IA Simple (Fallback)

El sistema incluye un motor de IA basado en reglas con respuestas predefinidas para:

- Saludos
- Ayuda general
- Wallet y transacciones
- Staking y recompensas
- NFTs y colecciones
- Soporte técnico

### OpenAI Integration (Opcional)

Si se configura `OPENAI_API_KEY`, el sistema usa GPT-3.5-turbo con:

**System Prompt**:
```
Eres el asistente virtual de BeZhas, una plataforma Web3 de redes sociales 
y marketplace. Eres amigable, útil y conocedor de blockchain, NFTs, staking 
y la plataforma BeZhas. Responde en español de manera concisa y clara.
```

**Configuración**:
- Modelo: `gpt-3.5-turbo`
- Max tokens: 300
- Temperature: 0.7

### Detección de Keywords

El sistema detecta palabras clave para respuestas contextuales:

- `hola|hi|hello|hey` → Saludos
- `ayuda|help` → Menú de ayuda
- `wallet|billetera` → Info sobre wallet
- `staking|stake` → Info sobre staking
- `nft|token` → Info sobre NFTs
- `soporte|support` → Contacto con soporte

## 🎯 Acceso Directo

### Sidebar Navigation

**Ubicación**: `frontend/src/config/sidebarConfig.jsx`

El chat está disponible en la sección **Principal** del sidebar:

```jsx
{
  path: '/chat',
  icon: <MessageSquare size={22} />,
  label: 'Chat',
  description: 'Chat con IA y mensajería',
  roles: ['public', 'user', 'admin'],
  category: 'principal',
  badge: 'IA'
}
```

**Acceso**:
- Público: Todos pueden acceder al chat con IA
- Usuario: Acceso completo a todas las funciones
- Admin: Modo especial con IA mejorada

## 💾 Almacenamiento

### LocalStorage

**Chat con IA**:
```javascript
localStorage.setItem(`chat_ai-assistant_${address}`, JSON.stringify(messages));
```

**Estructura**:
```json
[
  {
    "id": "1234567890",
    "sender": "me|ai",
    "content": "mensaje",
    "timestamp": 1234567890,
    "status": "read"
  }
]
```

### In-Memory (Backend)

El backend utiliza Map para almacenamiento en memoria:

```javascript
const chats = new Map();      // address -> [chats]
const messages = new Map();   // chatId -> [messages]
const onlineUsers = new Set(); // Set of addresses
```

## 🔒 Seguridad

### Rate Limiting

Hereda el rate limiting global del servidor:
- 1000 requests por 15 minutos por IP

### Validación

- Mensajes vacíos rechazados
- Campos requeridos validados
- Errores manejados gracefully

### Autenticación

- Chat público: No requiere autenticación
- Chat admin: Requiere JWT con rol admin/dev
- Mensajes directos: Requieren wallet conectada

## 📱 Responsive Design

### Mobile (< 768px)
- Vista de lista O vista de chat (no ambas)
- Botón de retroceso para volver a la lista
- Overlay para cerrar sidebar

### Desktop (≥ 768px)
- Vista dividida: lista + chat
- Sidebar siempre visible
- No overlay

## 🚧 Próximas Funcionalidades

### En desarrollo:
- [ ] Adjuntar archivos (imágenes, documentos)
- [ ] Selector de emojis
- [ ] Llamadas de voz
- [ ] Videollamadas
- [ ] Mensajes encriptados end-to-end
- [ ] Notificaciones push
- [ ] Búsqueda en mensajes
- [ ] Mensajes programados
- [ ] Reacciones a mensajes
- [ ] Respuestas contextuales (reply)
- [ ] Editar mensajes enviados
- [ ] Eliminar mensajes

### Integraciones futuras:
- [ ] WebSocket para mensajes en tiempo real
- [ ] Blockchain para mensajes verificables
- [ ] IPFS para almacenamiento de archivos
- [ ] Smart contracts para grupos pagados
- [ ] NFTs como avatares
- [ ] Tokens BZH para premium features

## 🔧 Configuración

### Variables de Entorno

```env
# Opcional: Para IA avanzada
OPENAI_API_KEY=sk-...

# Backend
PORT=3001
NODE_ENV=development

# Frontend
VITE_API_URL=http://localhost:3001
```

### Instalación

1. **Backend**:
```bash
cd backend
npm install
# Si usas OpenAI:
npm install openai
```

2. **Frontend**:
```bash
cd frontend
npm install
```

### Iniciar servidores

```bash
# Backend
cd backend
npm start

# Frontend
cd frontend
npm run dev
```

## 🐛 Debugging

### Console Logs

El sistema incluye logs para:
- Conexión/desconexión de usuarios
- Envío/recepción de mensajes
- Errores de API
- Estados de carga

### Errores comunes

1. **"Cannot find module 'openai'"**
   - Instalar: `npm install openai`
   - O dejarlo sin instalar (usará IA simple)

2. **"Address is required"**
   - Conectar wallet antes de acceder al chat

3. **"Error loading conversations"**
   - Verificar que el backend esté corriendo
   - Revisar CORS settings

## 📊 Métricas

El sistema de chat registra:
- Mensajes enviados/recibidos
- Usuarios activos
- Tiempo de respuesta de IA
- Conversaciones creadas
- Errores y fallos

## 🤝 Contribuir

Para agregar nuevas funcionalidades:

1. **Frontend**: Editar `ChatPage.jsx`
2. **Backend**: Editar `chat.routes.js`
3. **IA**: Modificar `getAIResponse()` function
4. **Rutas**: Actualizar `App.jsx` y `sidebarConfig.jsx`

## 📝 Notas

- El chat con IA funciona sin backend (localStorage)
- Los chats regulares requieren backend activo
- Las respuestas de IA son instantáneas con fallback
- OpenAI es opcional pero recomendado para producción
- El sistema es escalable a WebSocket/Socket.io

## 📄 Licencia

Copyright © 2025 BeZhas. Todos los derechos reservados.
