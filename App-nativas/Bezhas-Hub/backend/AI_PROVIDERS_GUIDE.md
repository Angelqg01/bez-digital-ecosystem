# 🤖 Guía de Configuración de Proveedores de IA

BeZhas soporta múltiples proveedores de IA para los agentes de chat. Esta guía te ayudará a configurar cada uno.

## 📋 Proveedores Soportados

### 1. OpenAI (GPT-4, GPT-3.5)
**Modelos disponibles:**
- `gpt-4o` - Más avanzado y rápido
- `gpt-4o-mini` - Rápido y económico
- `gpt-4-turbo` - Gran contexto
- `gpt-4` - Modelo clásico
- `gpt-3.5-turbo` - Económico y rápido

**Obtener API Key:**
1. Visita [platform.openai.com](https://platform.openai.com)
2. Crea una cuenta o inicia sesión
3. Ve a "API Keys" en el menú
4. Click en "Create new secret key"
5. Copia la key que empieza con `sk-`

**Configuración en `.env`:**
```bash
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
```

**Precio aproximado:**
- GPT-4o: $5 / 1M tokens input, $15 / 1M tokens output
- GPT-4o-mini: $0.15 / 1M tokens input, $0.60 / 1M tokens output

---

### 2. Anthropic (Claude 3)
**Modelos disponibles:**
- `claude-3-opus-20240229` - Más potente
- `claude-3-sonnet-20240229` - Balanceado
- `claude-3-haiku-20240307` - Más rápido

**Obtener API Key:**
1. Visita [console.anthropic.com](https://console.anthropic.com)
2. Crea una cuenta
3. Ve a "API Keys"
4. Click en "Create Key"
5. Copia la key que empieza con `sk-ant-`

**Configuración en `.env`:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxx
```

**Precio aproximado:**
- Claude 3 Opus: $15 / 1M tokens input, $75 / 1M tokens output
- Claude 3 Sonnet: $3 / 1M tokens input, $15 / 1M tokens output
- Claude 3 Haiku: $0.25 / 1M tokens input, $1.25 / 1M tokens output

**Ventajas:**
- Excelente para análisis de textos largos
- Muy bueno en seguir instrucciones
- Contexto de 200K tokens

---

### 3. Google (Gemini)
**Modelos disponibles:**
- `gemini-pro` - Modelo estándar
- `gemini-1.5-pro` - Contexto de 1M tokens
- `gemini-1.5-flash` - Rápido y eficiente

**Obtener API Key:**
1. Visita [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Inicia sesión con cuenta de Google
3. Click en "Create API Key"
4. Selecciona o crea un proyecto de Google Cloud
5. Copia la API key

**Configuración en `.env`:**
```bash
GOOGLE_API_KEY=AIzaSyxxxxxxxxxxxxx
```

**Precio aproximado:**
- Gemini Pro: GRATIS (con límites)
- Gemini 1.5 Pro: $7 / 1M tokens input, $21 / 1M tokens output
- Gemini 1.5 Flash: $0.35 / 1M tokens input, $1.05 / 1M tokens output

**Ventajas:**
- Gemini Pro es gratuito para uso básico
- Ventana de contexto gigante (1M tokens en 1.5)
- Buena integración con servicios de Google

---

### 4. xAI (Grok)
**Modelos disponibles:**
- `grok-2` - Última versión
- `grok-1.5` - Versión anterior

**Obtener API Key:**
1. Visita [x.ai](https://x.ai)
2. Solicita acceso a la API
3. Una vez aprobado, genera tu API key
4. Copia la key

**Configuración en `.env`:**
```bash
XAI_API_KEY=xai-xxxxxxxxxxxxx
```

**Precio:** Por determinar (actualmente en beta)

**Ventajas:**
- Acceso a información en tiempo real de X (Twitter)
- Estilo de conversación único

---

### 5. DeepSeek
**Modelos disponibles:**
- `deepseek-chat` - Chat general
- `deepseek-coder` - Especializado en código

**Obtener API Key:**
1. Visita [platform.deepseek.com](https://platform.deepseek.com)
2. Crea una cuenta
3. Ve a "API Keys"
4. Genera una nueva key
5. Copia la key que empieza con `sk-`

**Configuración en `.env`:**
```bash
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
```

**Precio aproximado:**
- DeepSeek Chat: $0.14 / 1M tokens input, $0.28 / 1M tokens output
- DeepSeek Coder: $0.14 / 1M tokens input, $0.28 / 1M tokens output

**Ventajas:**
- Muy económico
- DeepSeek Coder excelente para programación
- Buena calidad/precio

---

## 🚀 Configuración Rápida

1. **Copia el archivo de ejemplo:**
```bash
cd backend
cp .env.example .env
```

2. **Edita `.env` y añade tus API keys:**
```bash
# Mínimo recomendado (OpenAI)
OPENAI_API_KEY=sk-tu-key-aqui

# Opcional: Otros proveedores
ANTHROPIC_API_KEY=sk-ant-tu-key-aqui
GOOGLE_API_KEY=tu-key-aqui
```

3. **Reinicia el servidor:**
```bash
npm start
```

4. **Verifica en el console log:**
```
✅ OpenAI client initialized
✅ Anthropic client initialized
✅ Google Gemini client initialized
```

---

## 📊 Comparación Rápida

| Proveedor | Mejor Para | Precio | Contexto |
|-----------|------------|--------|----------|
| OpenAI GPT-4o | General, creativo | $$$ | 128K |
| OpenAI GPT-4o-mini | Rápido, económico | $ | 128K |
| Claude 3 Opus | Análisis profundo | $$$$ | 200K |
| Claude 3 Haiku | Respuestas rápidas | $ | 200K |
| Gemini Pro | GRATIS! | FREE | 32K |
| Gemini 1.5 Pro | Contexto masivo | $$ | 1M |
| DeepSeek Chat | Económico | $ | 32K |
| DeepSeek Coder | Programación | $ | 32K |

---

## 💡 Recomendaciones

### Para Empezar (Gratis):
1. **Google Gemini Pro** - Completamente gratis
2. Luego añade **OpenAI GPT-4o-mini** para pruebas

### Para Producción:
1. **OpenAI GPT-4o-mini** - Balance perfecto
2. **Claude 3 Sonnet** - Análisis de texto largo
3. **DeepSeek Chat** - Backup económico

### Para Casos Específicos:
- **Programación**: DeepSeek Coder
- **Análisis largo**: Claude 3 Opus o Gemini 1.5 Pro
- **Conversación rápida**: GPT-4o-mini o Claude 3 Haiku
- **Contexto masivo**: Gemini 1.5 Pro (1M tokens)

---

## 🔒 Seguridad

⚠️ **IMPORTANTE:**
- Nunca compartas tus API keys públicamente
- Añade `.env` a tu `.gitignore`
- Rota las keys periódicamente
- Usa variables de entorno en producción
- Monitorea el uso y costos

---

## 🧪 Probar Conexión

Desde el Panel Admin → Chat & IA → Modelos, verás:
- ✅ Proveedores disponibles
- Lista de modelos activos
- Número total de modelos

---

## 📞 Soporte

Si tienes problemas:
1. Verifica que la API key sea correcta
2. Revisa el console log del servidor
3. Comprueba que tienes créditos en la cuenta del proveedor
4. Revisa los límites de rate (peticiones por minuto)

---

## 📚 Recursos Adicionales

- [OpenAI Docs](https://platform.openai.com/docs)
- [Anthropic Docs](https://docs.anthropic.com)
- [Google AI Docs](https://ai.google.dev/docs)
- [DeepSeek Docs](https://platform.deepseek.com/docs)
