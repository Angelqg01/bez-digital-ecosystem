# 🏛️ BeZhas AI Agent 24/7 — Guía de Instalación

## Integración con `agent-runtime` existente

---

## 📋 Lo que incluye este paquete

| Archivo | Descripción |
|---|---|
| `bezhas-agent-server.js` | Servidor Express con los 5 agentes IA |
| `telegram-bot.js` | Bot de Telegram para comunicarte con el agente |
| `package.json` | Dependencias del proyecto |
| `.env.example` | Plantilla de configuración (copia a `.env`) |
| `INICIAR-BEZHAS-AGENT.bat` | Lanzador automático para Windows |

---

## ⚡ Instalación rápida (5 pasos)

### Paso 1 — Copiar archivos

Copia todos estos archivos a tu directorio:
```
D:\Documentos D\Documentos Yoe\BeZhas\BeZhas Blockchain\agent-runtime\
```

### Paso 2 — Configurar el .env

```bash
# En el directorio agent-runtime, copia el ejemplo:
copy .env.example .env
# Luego edita .env con Notepad y rellena tus API keys
```

**Variables OBLIGATORIAS:**
- `ANTHROPIC_API_KEY` → Tu key de https://console.anthropic.com
- `TELEGRAM_BOT_TOKEN` → Obtener de @BotFather en Telegram

### Paso 3 — Crear tu bot de Telegram

1. Abre Telegram en tu móvil o PC
2. Busca **@BotFather** y pulsa `Iniciar`
3. Escribe `/newbot`
4. Ponle un nombre: `BeZhas Agent`
5. Ponle un username: `bezhas_agent_bot` (o similar)
6. **Copia el TOKEN** que te da BotFather
7. Pégalo en tu `.env` como `TELEGRAM_BOT_TOKEN=...`

### Paso 4 — Obtener tu Telegram ID

1. Habla con **@userinfobot** en Telegram
2. Te dará tu User ID (ej: `123456789`)
3. Añádelo en `.env` como `TELEGRAM_ALLOWED_IDS=123456789`

### Paso 5 — Iniciar el sistema

**Opción A — Doble clic (más fácil):**
```
INICIAR-BEZHAS-AGENT.bat
```

**Opción B — Manual (dos terminales):**
```bash
# Terminal 1 — Servidor
node bezhas-agent-server.js

# Terminal 2 — Bot
node telegram-bot.js
```

---

## 🤖 Cómo usar el Bot de Telegram

Una vez iniciado, busca tu bot en Telegram y escribe `/start`

### Comandos disponibles

| Comando | Descripción |
|---|---|
| `/start` | Iniciar / Ver panel principal |
| `/help` | Guía de uso |
| `/status` | Estado del sistema |
| `/email empresa:CMA CGM sector:logística cargo:CFO` | Generar email con IA |
| `/manda empresa:Metrovacesa sector:inmobiliario` | Análisis M&A |
| `/clear` | Limpiar historial de conversación |

### Uso directo (sin comandos)

Simplemente escribe tu pregunta y el sistema enruta automáticamente:

```
"Analiza Maersk Spain como objetivo M&A"
→ 📊 El Auditor responde

"Redacta email para el CFO de CMA CGM"  
→ ✉️ El Diplomático responde

"¿Cómo respondo si me dicen que ya tienen SAP?"
→ 🤝 El Negociador responde

"Estrategia para dominar el sector portuario"
→ 🧠 El Supervisor responde
```

### Selección manual de agente

Usa los botones del teclado para fijar un agente específico:
- 🔍 Sabueso
- 📊 Auditor  
- ✉️ Diplomático
- 🤝 Negociador
- 🧠 Supervisor
- ⚡ Auto (recomendado)

---

## 🌐 API REST (para integrar con otros sistemas)

El servidor también expone endpoints REST:

```bash
# Auto-routing
POST http://localhost:3099/chat
{"message": "Analiza esta empresa", "userId": "yoel"}

# Agente específico
POST http://localhost:3099/agent/diplomatico
{"message": "Email para CFO de Maersk", "userId": "yoel"}

# Generar email
POST http://localhost:3099/generate-email
{"empresa": "Maersk", "cargo": "CFO", "sector": "logística", "idioma": "ES", "plan": "enterprise"}

# Análisis M&A
POST http://localhost:3099/analyze-target
{"empresa": "CMA CGM Ibérica", "sector": "logística", "stake": 30}

# Estado
GET http://localhost:3099/status
```

---

## 🔧 Integración con agent-runtime existente

Si ya tienes `agent-runtime` corriendo en otro puerto, cambia en `.env`:
```
AGENT_PORT=3099   # Puerto para BeZhas Agent (diferente al existente)
```

No hay conflicto si usas puertos distintos. Ambos pueden correr simultáneamente.

---

## ❓ Resolución de problemas

| Error | Solución |
|---|---|
| `ECONNREFUSED` | El servidor no está corriendo. Ejecuta `node bezhas-agent-server.js` |
| `TELEGRAM_BOT_TOKEN` inválido | Obtén nuevo token de @BotFather |
| `ANTHROPIC_API_KEY` inválido | Verifica en console.anthropic.com |
| Puerto en uso | Cambia `AGENT_PORT` en `.env` |
| `node_modules` falta | Ejecuta `npm install` |

---

## 📞 Soporte

- **Fundador:** Yoel A. Hernandez
- **LinkedIn:** https://www.linkedin.com/company/80822195
- **Email:** info.bezcoin@bez.digital
