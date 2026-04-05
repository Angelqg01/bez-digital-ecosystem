# BeZhas AI Engine

Sistema completo de Inteligencia Artificial para la plataforma BeZhas Web3, inspirado en el plugin WordPress ai-engine.

## 🚀 Características

### Multi-Provider Support
- **OpenAI**: GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet
- **Google**: Gemini 1.5 Pro, Gemini 1.5 Flash
- **Mistral**: Mistral Large, Mistral Medium
- Arquitectura extensible para agregar más proveedores

### Agentes Predefinidos
1. **BeZhas Assistant** (Público, gpt-4o-mini)
   - Asistente oficial de la plataforma
   - Ayuda con BEZ tokens, NFTs, y navegación

2. **Web3 Expert** (VIP, gpt-4o)
   - Experto técnico en blockchain y DeFi
   - Consultas avanzadas sobre contratos inteligentes

3. **NFT Advisor** (Público, gpt-4o-mini)
   - Especialista en NFTs y arte digital
   - Asesoría para crear y vender NFTs

4. **Analytics Bot** (VIP, gpt-4o)
   - Analista de datos y métricas
   - Reportes de rendimiento y estadísticas

### Function Calling (Herramientas)

#### Web3 Tools
- `getBezBalance`: Obtiene balance de BEZ tokens
- `isVipUser`: Verifica estado VIP del usuario
- `getUserNFTs`: Lista NFTs del usuario
- `getMarketplaceListings`: Listados del marketplace

#### Platform Tools
- `getUserProfile`: Datos del perfil de usuario
- `searchPosts`: Búsqueda de posts
- `getTrendingTopics`: Temas tendencia
- `getUserStats`: Estadísticas del usuario

### Sistema de Costos
- Cálculo en **USD** basado en tokens de entrada/salida
- Conversión a **BEZ tokens** con multiplicador configurable
- Tracking de uso por modelo y usuario

### Streaming Support
- Chat streaming con Server-Sent Events (SSE)
- Respuestas en tiempo real
- Indicador de escritura animado

## 📂 Estructura del Proyecto

```
backend/src/ai/
├── core/
│   ├── types.ts           # Definiciones TypeScript
│   └── models.ts          # Catálogo de 11 modelos AI
├── engines/
│   ├── BaseEngine.ts      # Clase abstracta base
│   ├── OpenAIEngine.ts    # Implementación OpenAI
│   └── EngineFactory.ts   # Factory pattern
├── tools/
│   ├── registry.ts        # Registro de herramientas
│   ├── web3.ts            # Herramientas blockchain
│   └── platform.ts        # Herramientas de plataforma
└── services/
    ├── AgentService.ts    # Gestión de agentes
    └── ChatService.ts     # Servicio de chat

backend/src/routes/
└── ai.routes.ts           # API endpoints

frontend/src/
├── context/
│   └── AIContext.jsx      # Contexto React para AI
├── components/ai/
│   ├── AgentList.jsx      # Lista de agentes
│   ├── ChatWindow.jsx     # Ventana de chat
│   └── MessageBubble.jsx  # Bubble de mensaje
└── pages/
    ├── AIChat.jsx         # Página principal de AI chat
    └── admin/
        └── AdminAI.jsx    # Panel admin de AI
```

## 🔧 Instalación

### 1. Backend Setup

```bash
cd backend

# Instalar dependencias
npm install openai @anthropic-ai/sdk @google/generative-ai

# Configurar variables de entorno
cp .env.example .env
```

Edita `.env`:
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
BEZ_USD_RATE=0.1
```

### 2. Frontend Setup

```bash
cd frontend

# Instalar dependencias
npm install react-markdown react-syntax-highlighter
```

### 3. Iniciar Servidores

```bash
# Backend
cd backend
npm start  # Puerto 3001

# Frontend
cd frontend
npm run dev  # Puerto 5173
```

## 📡 API Endpoints

### Agentes

```bash
# Listar agentes
GET /api/ai/agents?visibility=public

# Obtener agente específico
GET /api/ai/agents/:id

# Crear agente (admin)
POST /api/ai/agents
{
  "name": "Mi Agente",
  "model": "gpt-4o",
  "systemPrompt": "Eres un asistente...",
  "visibility": "public",
  "functions": ["getBezBalance"]
}

# Actualizar agente (admin)
PUT /api/ai/agents/:id

# Eliminar agente (admin)
DELETE /api/ai/agents/:id
```

### Chat

```bash
# Chat normal
POST /api/ai/chat
{
  "agentId": "bezhas-assistant",
  "messages": [
    { "role": "user", "content": "Hola" }
  ],
  "userAddress": "0x..."
}

# Chat streaming
POST /api/ai/chat/stream
{
  "agentId": "web3-expert",
  "messages": [
    { "role": "user", "content": "Explica staking" }
  ]
}
```

### Modelos y Herramientas

```bash
# Listar modelos disponibles
GET /api/ai/models

# Listar herramientas
GET /api/ai/tools
```

## 💻 Uso en Frontend

### Ejemplo básico

```jsx
import { AIProvider, useAI } from './context/AIContext'

function MyApp() {
  return (
    <AIProvider>
      <ChatComponent />
    </AIProvider>
  )
}

function ChatComponent() {
  const { agents, currentAgent, messages, sendMessage, selectAgent } = useAI()

  return (
    <div>
      {/* Lista de agentes */}
      <select onChange={(e) => selectAgent(e.target.value)}>
        {agents.map(agent => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>

      {/* Mensajes */}
      <div>
        {messages.map((msg, i) => (
          <div key={i}>{msg.content}</div>
        ))}
      </div>

      {/* Input */}
      <button onClick={() => sendMessage("Hola")}>
        Enviar
      </button>
    </div>
  )
}
```

### Páginas principales

- `/ai-chat` - Interfaz de chat con agentes
- `/admin/ai` - Panel de administración (agentes, modelos, tools, analytics)

## 🎨 Componentes Disponibles

### `<AgentList />`
Lista lateral de agentes con avatares, descripciones y badges VIP.

### `<ChatWindow />`
Ventana principal de chat con:
- Header del agente actual
- Lista de mensajes con scroll automático
- Input con soporte de streaming
- Indicador de carga animado

### `<MessageBubble />`
Bubble individual de mensaje con:
- Soporte Markdown + code highlighting
- Renderizado de tool calls
- Diseño diferenciado user/assistant

### `<AdminAI />`
Panel completo de administración con tabs:
- **Agentes**: CRUD de agentes
- **Modelos**: Tabla de modelos disponibles
- **Herramientas**: Lista de function calling tools
- **Analytics**: Dashboard de métricas (próximamente)

## 🔐 Seguridad

### Gating VIP
```jsx
// En AgentService.ts
const agent = await AgentService.getAgent('web3-expert')
if (agent.visibility === 'vip' && !isUserVip(userAddress)) {
  throw new Error('VIP access required')
}
```

### Rate Limiting
```javascript
// En ai.routes.ts (recomendado)
const rateLimit = require('express-rate-limit')

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests
})

router.use('/chat', aiLimiter)
```

## 📊 Monitoreo y Analytics

### Tracking de Costos
Cada respuesta incluye:
```json
{
  "usage": {
    "promptTokens": 150,
    "completionTokens": 250,
    "totalTokens": 400
  },
  "cost": {
    "usd": 0.015,
    "bez": 0.15
  }
}
```

### Métricas Recomendadas
- Total requests por agente
- Tokens consumidos por modelo
- Costos acumulados (USD + BEZ)
- Tiempo promedio de respuesta
- Errores y reintentos

## 🚀 Roadmap

### Fase 1 ✅ (Completa)
- [x] Arquitectura multi-provider
- [x] 4 agentes predefinidos
- [x] 8 function calling tools
- [x] Chat streaming
- [x] Frontend completo
- [x] Admin panel básico

### Fase 2 (En progreso)
- [ ] Integración real con contratos (viem)
- [ ] Database persistence (MongoDB)
- [ ] VIP gating funcional
- [ ] Rate limiting
- [ ] Analytics dashboard

### Fase 3 (Futuro)
- [ ] Embeddings y búsqueda semántica
- [ ] Fine-tuning de modelos
- [ ] Voice input/output
- [ ] Imagen generation (DALL-E, Midjourney)
- [ ] Knowledge base personalizada
- [ ] Multi-idioma

## 🛠️ Desarrollo

### Agregar un nuevo proveedor

1. Crear engine en `backend/src/ai/engines/`
```typescript
import BaseEngine from './BaseEngine'

export class NewProviderEngine extends BaseEngine {
  getDefaultBaseURL() { return 'https://api.newprovider.com' }
  
  async chat(request: AIRequest): Promise<AIResponse> {
    // Implementación
  }
  
  async *streamChat(request: AIRequest) {
    // Implementación
  }
}
```

2. Registrar en `EngineFactory.ts`
```typescript
case 'newprovider':
  return new NewProviderEngine(process.env.NEWPROVIDER_API_KEY!)
```

### Agregar una nueva herramienta

```typescript
// En backend/src/ai/tools/custom.ts
import { ToolRegistry } from './registry'

const myCustomTool = async (args: any, context: any) => {
  // Lógica de la herramienta
  return { result: 'data' }
}

ToolRegistry.register({
  type: 'function',
  function: {
    name: 'myCustomTool',
    description: 'Descripción de la herramienta',
    parameters: {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parámetro 1' }
      },
      required: ['param1']
    }
  }
}, myCustomTool)
```

## 📝 Licencia

MIT License - BeZhas Platform 2024
