/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║        BEZHAS TELEGRAM BOT — Interfaz de Comunicación       ║
 * ║  Conecta con bezhas-agent-server.js para IA 24/7           ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * SETUP:
 * 1. Ve a Telegram → busca @BotFather
 * 2. Escribe /newbot → sigue instrucciones → copia el TOKEN
 * 3. Pega el token en el .env como TELEGRAM_BOT_TOKEN=...
 * 4. Ejecuta: node telegram-bot.js
 */

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios       = require("axios");

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const AGENT_URL   = process.env.AGENT_URL || "http://localhost:3099";
const ALLOWED_IDS = process.env.TELEGRAM_ALLOWED_IDS
  ? process.env.TELEGRAM_ALLOWED_IDS.split(",").map(id => parseInt(id.trim()))
  : []; // Vacío = permite a todos (configura en .env para seguridad)

if (!BOT_TOKEN) {
  console.error("❌ ERROR: TELEGRAM_BOT_TOKEN no configurado en .env");
  console.error("   1. Ve a @BotFather en Telegram");
  console.error("   2. /newbot → copia el token");
  console.error("   3. Añade TELEGRAM_BOT_TOKEN=tu_token en .env");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// ── USER STATE ────────────────────────────────────────────────────
const userState = new Map(); // userId -> { agent, mode, lastActivity }

function getState(userId) {
  if (!userState.has(userId)) {
    userState.set(userId, { agent: "auto", mode: "chat", lastActivity: Date.now() });
  }
  return userState.get(userId);
}

function setState(userId, updates) {
  const current = getState(userId);
  userState.set(userId, { ...current, ...updates, lastActivity: Date.now() });
}

// ── AUTH ──────────────────────────────────────────────────────────
function isAuthorized(userId) {
  if (ALLOWED_IDS.length === 0) return true; // Sin restricción
  return ALLOWED_IDS.includes(userId);
}

// ── API CALL ──────────────────────────────────────────────────────
async function callAgentAPI(endpoint, data) {
  try {
    const response = await axios.post(`${AGENT_URL}${endpoint}`, data, { timeout: 60000 });
    return response.data;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      throw new Error("⚠️ El servidor BeZhas Agent no está corriendo.\nEjecuta: node bezhas-agent-server.js");
    }
    throw new Error(error.response?.data?.error || error.message);
  }
}

// ── FORMAT MESSAGE ────────────────────────────────────────────────
function formatOutput(result, mode = "full") {
  if (!result.success) return `❌ Error: ${result.error}`;

  const agentHeader = `${result.emoji || "🤖"} *${result.agent || "Agente"}*\n${"─".repeat(30)}\n`;

  if (mode === "compact") return result.output;
  return agentHeader + result.output;
}

// ── KEYBOARDS ─────────────────────────────────────────────────────
const MAIN_KEYBOARD = {
  reply_markup: {
    keyboard: [
      ["🔍 Sabueso", "📊 Auditor"],
      ["✉️ Diplomático", "🤝 Negociador"],
      ["🧠 Supervisor", "⚡ Auto"],
      ["✉️ Generar Email", "🎯 Análisis M&A"],
      ["📊 Estado Sistema", "ℹ️ Ayuda"],
    ],
    resize_keyboard: true,
    persistent: true,
  },
};

const AGENT_MAP = {
  "🔍 Sabueso": "sabueso",
  "📊 Auditor": "auditor",
  "✉️ Diplomático": "diplomatico",
  "🤝 Negociador": "negociador",
  "🧠 Supervisor": "supervisor",
  "⚡ Auto": "auto",
};

// ── COMMANDS ──────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  if (!isAuthorized(userId)) {
    return bot.sendMessage(userId, "❌ No tienes acceso a BeZhas Agent.");
  }

  setState(userId, { agent: "auto" });

  await bot.sendMessage(userId, `
🏛️ *BEZHAS AI AGENT 24/7*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bienvenido al sistema de inteligencia comercial de BeZhas.

*5 Agentes activos:*
🔍 *Sabueso* — Inteligencia de mercado
📊 *Auditor* — Análisis M&A y financiero
✉️ *Diplomático* — Emails ejecutivos
🤝 *Negociador* — Follow-up y objeciones
🧠 *Supervisor* — Estrategia y orquestación

*Comandos disponibles:*
/agent — Seleccionar agente
/email — Generar email personalizado
/manda — Análisis M&A de empresa
/status — Estado del sistema
/clear — Limpiar historial
/help — Ayuda completa

Escríbeme directamente y el sistema enruta automáticamente al agente correcto. 🚀
  `, { ...MAIN_KEYBOARD, parse_mode: "Markdown" });
});

bot.onText(/\/help/, async (msg) => {
  const userId = msg.from.id;
  await bot.sendMessage(userId, `
📖 *GUÍA DE USO — BEZHAS AGENT*

*MODO AUTO (recomendado):*
Simplemente escribe tu pregunta o tarea. El sistema detecta automáticamente qué agente usar.

*Ejemplos de uso directo:*
• _"Analiza Maersk Spain como objetivo M&A"_
• _"Redacta email para el CFO de CMA CGM"_
• _"¿Cómo respondo si me dicen que ya tienen SAP?"_
• _"Dame la estrategia para el sector portuario"_
• _"¿Qué dice el pipeline actual?"_

*Comandos especiales:*
/email empresa:CMA CGM sector:logística cargo:CFO plan:enterprise
/manda empresa:Metrovacesa sector:inmobiliario

*Seleccionar agente específico:*
Usa los botones del teclado para fijar un agente.

*BEZ-Coin:*
💰 Precio: €0,10 | ROI año 1: +32%
🛒 Comprar: https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806
  `, { parse_mode: "Markdown" });
});

bot.onText(/\/status/, async (msg) => {
  const userId = msg.from.id;
  try {
    const response = await axios.get(`${AGENT_URL}/status`, { timeout: 5000 });
    const data = response.data;
    const uptimeMins = Math.floor(data.uptime / 60);

    await bot.sendMessage(userId, `
⚡ *SISTEMA BEZHAS AGENT — ONLINE*

*Agentes:* ${data.agents.length}/5 activos
*Conversaciones activas:* ${data.activeConversations}
*Uptime:* ${uptimeMins} minutos

${data.agents.map(a => `${a.emoji} *${a.name}* — ${a.status.toUpperCase()}`).join("\n")}

_Servidor: ${AGENT_URL}_
    `, { parse_mode: "Markdown" });
  } catch {
    await bot.sendMessage(userId, `
❌ *Servidor offline*

El servidor BeZhas Agent no responde en ${AGENT_URL}

Para iniciarlo:
\`cd D:\\...\\agent-runtime && node bezhas-agent-server.js\`
    `, { parse_mode: "Markdown" });
  }
});

bot.onText(/\/clear/, async (msg) => {
  const userId = msg.from.id;
  try {
    await axios.delete(`${AGENT_URL}/history/${userId}`, { timeout: 5000 });
  } catch {}
  setState(userId, { agent: "auto" });
  await bot.sendMessage(userId, "🗑️ Historial borrado. Contexto reiniciado.", MAIN_KEYBOARD);
});

// /email comando rápido
bot.onText(/\/email (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  if (!isAuthorized(userId)) return;

  const params = {};
  const parts = match[1].split(" ");
  parts.forEach(p => {
    const [k, v] = p.split(":");
    if (k && v) params[k.toLowerCase()] = v;
  });

  if (!params.empresa) {
    return bot.sendMessage(userId, "Uso: /email empresa:NombreEmpresa sector:logística cargo:CFO plan:enterprise idioma:ES");
  }

  await bot.sendMessage(userId, `✉️ Generando email para *${params.empresa}*...`, { parse_mode: "Markdown" });

  try {
    const result = await callAgentAPI("/generate-email", {
      empresa: params.empresa,
      sector: params.sector || "empresarial",
      cargo: params.cargo || "Director",
      plan: params.plan || "enterprise",
      idioma: (params.idioma || "ES").toUpperCase(),
      userId: userId.toString(),
    });

    if (result.success) {
      await bot.sendMessage(userId, `📧 *ASUNTO:* ${result.subject}`, { parse_mode: "Markdown" });
      await bot.sendMessage(userId, result.body);
    } else {
      await bot.sendMessage(userId, `❌ Error: ${result.error}`);
    }
  } catch (err) {
    await bot.sendMessage(userId, `❌ ${err.message}`);
  }
});

// /manda comando rápido
bot.onText(/\/manda (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  if (!isAuthorized(userId)) return;

  const params = {};
  const parts = match[1].split(" ");
  parts.forEach(p => {
    const [k, v] = p.split(":");
    if (k && v) params[k.toLowerCase()] = v;
  });

  if (!params.empresa) {
    return bot.sendMessage(userId, "Uso: /manda empresa:NombreEmpresa sector:logística stake:30");
  }

  const analyzing = await bot.sendMessage(userId, `📊 *El Auditor* analizando *${params.empresa}*...`, { parse_mode: "Markdown" });

  try {
    const result = await callAgentAPI("/analyze-target", {
      empresa: params.empresa,
      sector: params.sector || "desconocido",
      revenue: params.revenue,
      stake: parseInt(params.stake) || 30,
    });

    await bot.deleteMessage(userId, analyzing.message_id);
    const formatted = formatOutput(result);

    // Split if too long
    if (formatted.length > 4000) {
      const chunks = formatted.match(/.{1,4000}/gs) || [];
      for (const chunk of chunks) {
        await bot.sendMessage(userId, chunk, { parse_mode: "Markdown" });
        await new Promise(r => setTimeout(r, 300));
      }
    } else {
      await bot.sendMessage(userId, formatted, { parse_mode: "Markdown" });
    }
  } catch (err) {
    await bot.sendMessage(userId, `❌ ${err.message}`);
  }
});

// ── MAIN MESSAGE HANDLER ──────────────────────────────────────────
bot.on("message", async (msg) => {
  if (msg.text?.startsWith("/")) return; // Already handled

  const userId   = msg.from.id;
  const text     = msg.text || "";
  const userName = msg.from.first_name || "Usuario";

  if (!isAuthorized(userId)) return;
  if (!text.trim()) return;

  const state = getState(userId);

  // Handle agent keyboard selection
  if (AGENT_MAP[text]) {
    const selectedAgent = AGENT_MAP[text];
    setState(userId, { agent: selectedAgent });
    const agentNames = { auto: "Auto-routing", sabueso: "El Sabueso", auditor: "El Auditor",
      diplomatico: "El Diplomático", negociador: "El Negociador", supervisor: "El Supervisor" };
    return bot.sendMessage(userId, `✅ Agente seleccionado: *${agentNames[selectedAgent]}*\n\nEscribe tu mensaje y responderé con ese agente.`,
      { parse_mode: "Markdown", ...MAIN_KEYBOARD });
  }

  // Estado button
  if (text === "📊 Estado Sistema") {
    return bot.emit("message", { ...msg, text: "/status" });
  }
  if (text === "ℹ️ Ayuda") {
    return bot.emit("message", { ...msg, text: "/help" });
  }
  if (text === "✉️ Generar Email") {
    return bot.sendMessage(userId, "Para generar un email personalizado usa:\n\n`/email empresa:NombreEmpresa sector:logística cargo:CFO plan:enterprise`",
      { parse_mode: "Markdown" });
  }
  if (text === "🎯 Análisis M&A") {
    return bot.sendMessage(userId, "Para analizar una empresa usa:\n\n`/manda empresa:NombreEmpresa sector:logística stake:30`",
      { parse_mode: "Markdown" });
  }

  // Show typing indicator
  await bot.sendChatAction(userId, "typing");

  // Determine agent
  const agentId = state.agent === "auto"
    ? detectAgentFromMessage(text)
    : state.agent;

  console.log(`[Telegram] ${userName} (${userId}) → Agent: ${agentId} | "${text.slice(0, 50)}..."`);

  // Loading message
  const loadingMsg = await bot.sendMessage(userId, `${getEmoji(agentId)} _Procesando..._`, { parse_mode: "Markdown" });

  try {
    const result = await callAgentAPI("/chat", {
      message: text,
      userId: userId.toString(),
      agent: agentId === "auto" ? undefined : agentId,
    });

    // Delete loading message
    await bot.deleteMessage(userId, loadingMsg.message_id);

    const formatted = formatOutput(result);

    // Handle long messages
    if (formatted.length > 4000) {
      const chunks = formatted.match(/.{1,4000}/gs) || [];
      for (const chunk of chunks) {
        await bot.sendMessage(userId, chunk, { parse_mode: "Markdown" });
        await new Promise(r => setTimeout(r, 400));
      }
    } else {
      await bot.sendMessage(userId, formatted, { parse_mode: "Markdown", ...MAIN_KEYBOARD });
    }
  } catch (err) {
    await bot.deleteMessage(userId, loadingMsg.message_id).catch(() => {});
    await bot.sendMessage(userId, `❌ *Error:* ${err.message}\n\nVerifica que \`bezhas-agent-server.js\` esté corriendo.`,
      { parse_mode: "Markdown" });
  }
});

// ── HELPERS ───────────────────────────────────────────────────────
function detectAgentFromMessage(msg) {
  const m = msg.toLowerCase();
  if (m.includes("email") || m.includes("correo") || m.includes("redact") ||
      m.includes("mensaje") || m.includes("escrib")) return "diplomatico";
  if (m.includes("m&a") || m.includes("adquisi") || m.includes("score") ||
      m.includes("viabilidad") || m.includes("financier")) return "auditor";
  if (m.includes("busca") || m.includes("empresa") || m.includes("prospecto") ||
      m.includes("mercado")) return "sabueso";
  if (m.includes("respond") || m.includes("objeción") || m.includes("objecion") ||
      m.includes("follow") || m.includes("seguimiento")) return "negociador";
  return "supervisor";
}

function getEmoji(agentId) {
  const emojis = { sabueso:"🔍", auditor:"📊", diplomatico:"✉️", negociador:"🤝", supervisor:"🧠" };
  return emojis[agentId] || "🤖";
}

// ── ERROR HANDLING ────────────────────────────────────────────────
bot.on("polling_error", (error) => {
  if (error.code === "ETELEGRAM") {
    console.error("❌ Token de Telegram inválido. Verifica TELEGRAM_BOT_TOKEN en .env");
  } else {
    console.error("Polling error:", error.message);
  }
});

process.on("SIGINT", () => {
  bot.stopPolling();
  console.log("\n👋 BeZhas Telegram Bot detenido.");
  process.exit(0);
});

console.log(`
╔══════════════════════════════════════════════════════════════╗
║         BEZHAS TELEGRAM BOT — CONECTANDO...                 ║
╚══════════════════════════════════════════════════════════════╝
Bot iniciado. Busca tu bot en Telegram y escribe /start
`);
