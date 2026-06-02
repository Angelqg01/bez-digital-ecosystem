# 🤖 Multi-Provider AI Service - Quick Start

## ✅ Installation Complete!

El sistema multi-proveedor de IA está **instalado y listo para usar**.

## 🚀 Quick Start

### 1. Configure API Keys

Copia el archivo de ejemplo y añade tus API keys:

```bash
cd backend
cp .env.example .env
```

Edita `.env` y añade al menos una API key:

```bash
# Mínimo recomendado (OpenAI)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx

# Opcional: Otros proveedores
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
GOOGLE_API_KEY=xxxxxxxxxxxxx
```

### 2. Test the Service

```bash
node test-ai-service.js
```

Deberías ver:
```
✅ OpenAI client initialized
✅ Anthropic client initialized
...
```

### 3. Start the Server

```bash
npm start
```

### 4. Test the API

```powershell
# Ver modelos disponibles
Invoke-RestMethod -Uri "http://localhost:3001/api/ai/models" -Method Get

# Ver agentes
Invoke-RestMethod -Uri "http://localhost:3001/api/ai/agents" -Method Get
```

## 📚 Available Providers

| Provider | Models | Status |
|----------|--------|--------|
| OpenAI | GPT-4o, GPT-4o-mini, GPT-4 Turbo, GPT-4, GPT-3.5 Turbo | ✅ Ready |
| Anthropic | Claude 3 Opus, Sonnet, Haiku | ✅ Ready |
| Google | Gemini Pro, Gemini 1.5 Pro, Gemini 1.5 Flash | ✅ Ready |
| xAI | Grok 2, Grok 1.5 | ✅ Ready |
| DeepSeek | DeepSeek Chat, DeepSeek Coder | ✅ Ready |

## 🎯 API Endpoints

### Chat (Non-streaming)
```javascript
POST /api/ai/chat
{
  "agentId": "bezhas-assistant",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ]
}
```

### Chat (Streaming)
```javascript
POST /api/ai/chat/stream
{
  "agentId": "web3-expert",
  "messages": [
    { "role": "user", "content": "Explain Web3" }
  ]
}
```

### Get Available Models
```javascript
GET /api/ai/models
```

Response:
```json
{
  "models": [
    {
      "id": "gpt-4o",
      "provider": "openai",
      "name": "GPT-4o",
      "contextWindow": 128000,
      "maxTokens": 4096
    },
    ...
  ],
  "availableProviders": ["openai", "anthropic", "google"],
  "totalModels": 26
}
```

### Agent Management

```javascript
// Get all agents
GET /api/ai/agents

// Create agent
POST /api/ai/agents
{
  "name": "My Custom Agent",
  "provider": "anthropic",
  "model": "claude-3-sonnet-20240229",
  "systemPrompt": "You are a helpful assistant...",
  ...
}

// Update agent
PUT /api/ai/agents/:id

// Toggle agent
PATCH /api/ai/agents/:id

// Delete agent
DELETE /api/ai/agents/:id
```

## 🎨 Frontend Integration

El Panel Admin ya tiene el AgentCreatorAdvanced integrado:

1. Ve a **Admin Panel** → **Chat & IA**
2. Click en **"Crear Agente Especializado"**
3. Configura las 7 secciones:
   - Info & Details
   - Knowledge Base
   - Behavior & Personality
   - Model Configuration (selecciona proveedor y modelo)
   - Functions & Tools
   - Content Moderation
   - Advanced Settings

## 📖 Documentation

Para más detalles, ver:
- `AI_PROVIDERS_GUIDE.md` - Guía completa de proveedores
- `backend/services/ai-provider.service.js` - Código del servicio
- `backend/routes/ai.routes.js` - Endpoints de la API

## 🔥 Features

- ✅ 5 proveedores de IA soportados
- ✅ 26 modelos disponibles
- ✅ Streaming en todos los proveedores
- ✅ Moderación de contenido
- ✅ Selección automática de proveedor
- ✅ Formato de mensajes unificado
- ✅ Manejo de errores robusto
- ✅ Singleton pattern para eficiencia

## 🛠️ Troubleshooting

### Error: "Provider not available"
- Verifica que la API key esté configurada en `.env`
- Reinicia el servidor: `npm start`

### Error: "Invalid API key"
- Verifica que la key sea correcta
- Revisa que no tenga espacios al inicio/final
- Para OpenAI: debe empezar con `sk-`
- Para Anthropic: debe empezar con `sk-ant-`

### No aparecen modelos en el frontend
- Verifica que al menos un proveedor esté configurado
- Revisa el console log del servidor
- Prueba el endpoint: `GET /api/ai/models`

## 📞 Support

Si necesitas ayuda:
1. Revisa el console log del servidor
2. Ejecuta `node test-ai-service.js`
3. Verifica la configuración en `.env`

---

✨ **Ready to create amazing AI agents!**
