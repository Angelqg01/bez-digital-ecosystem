/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         BEZHAS AI AGENT 24/7 — SERVER v1.0.0               ║
 * ║     Marketing · M&A · Token Sales · Blockchain Adoption     ║
 * ║                                                              ║
 * ║  Integra con: Telegram Bot, WhatsApp, REST API local        ║
 * ║  Compatible con: agent-runtime BeZhas existente             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const bodyParser = require("body-parser");
const Anthropic  = require("@anthropic-ai/sdk");
const fs         = require("fs");
const path       = require("path");
const crypto     = require("crypto");

const app    = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const AGENT_API_KEY = process.env.BEZHAS_AGENT_API_KEY || process.env.INTERNAL_API_KEY;

if (process.env.NODE_ENV === "production" && !AGENT_API_KEY) {
  throw new Error("BEZHAS_AGENT_API_KEY or INTERNAL_API_KEY is required in production");
}

const allowedOrigins = (process.env.CORE_CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(bodyParser.json());

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireAgentAuth(req, res, next) {
  if (!AGENT_API_KEY && process.env.NODE_ENV !== "production") return next();
  const key = req.headers["x-internal-key"] || req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!timingSafeEqualString(key, AGENT_API_KEY)) {
    return res.status(401).json({ success: false, error: "Agent authentication required" });
  }
  next();
}

const rateBuckets = new Map();
function agentRateLimit(req, res, next) {
  const key = req.ip || "unknown";
  const now = Date.now();
  const bucket = rateBuckets.get(key) || { start: now, count: 0 };
  if (now - bucket.start > 60000) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > Number(process.env.AGENT_RATE_LIMIT_PER_MIN || 30)) {
    return res.status(429).json({ success: false, error: "Rate limit exceeded" });
  }
  next();
}

// ── BEZHAS KNOWLEDGE BASE ─────────────────────────────────────────
const BEZHAS_KB = `
BEZHAS — BASE DE CONOCIMIENTO COMPLETA (USO INTERNO DE AGENTES)

TOKEN & BLOCKCHAIN:
- Red: L2 propietaria sobre Polygon Mainnet (no fork)
- Contrato BEZ-Coin: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
- Supply total: 3.000.000.000 BEZ-Coin
- Precio presale fijo: €0,10 por token
- FDV: €300.000.000
- En venta (presale 70%): 2.100.000.000 tokens → máx €210M
- Yield anual: 12% sobre posición
- Staking trimestral: 5% × 4 = 20%/año adicional
- ROI total año 1: +32%
- DAO governance: posiciones ≥ €1.000.000
- Listado DeFi: 1 Julio 2026
- Compra: https://buy.stripe.com/14A5kD2A89Su4Vo3Mfew806
- Fundador: Yoel A. Hernandez | LinkedIn: https://www.linkedin.com/company/80822195
- Email: info.bezcoin@bez.digital

PLANES SAAS:
1. BeZhas Starter — €119,79/mes (IVA incl.)
   - Hasta 500 automatizaciones IA/mes
   - 1 Smart Contract (Smart Escrow)
   - 1 Nodo privado BeZhas Nexus
   - Margen BeZhas: 77% | Ahorro cliente: ~€450/mes

2. BeZhas Pro — €603,79/mes (IVA incl.)
   - Hasta 5.000 automatizaciones agénticas
   - Integración ERP (Universal Bridge API)
   - Dashboard DeFi Copilot
   - Pagos automáticos ERC-3643
   - Margen BeZhas: 60% | Ahorro cliente: ~€3.500/mes

3. BeZhas Enterprise — €3.023,79/mes (IVA incl.)
   - Hasta 50.000 llamadas IA (uso justo)
   - Nodo MCP Dedicado (máxima privacidad)
   - Quality Oracle IA a medida
   - Sub-DAOs corporativas personalizadas
   - Integraciones White-Label
   - Margen BeZhas: 34% | Ahorro cliente: ~€25.000/mes

MECÁNICA WEB3 (confidencial):
- Cliente paga en € vía Stripe/SEPA
- Backend ejecuta calculateSmartSwap
- Compra BEZ automáticamente en Yield Hub
- Genera buy pressure permanente sobre el token

SECTORES OBJETIVO:
- Logística & Navieras: trazabilidad contenedores, BoL digital, DvP instantáneo
- Trade Finance: Cartas de Crédito automáticas, factoring de fletes
- Real Estate: fraccionalización, RWA-backed lending
- Biotech/Salud: privacidad datos, DAO investigación
- Energía: créditos de carbono tokenizados, parques solares fraccionados
- Banca: liquidez instantánea, colateralización
- Seguros Marítimos: validación pólizas on-chain
- Manufactura: certificación calidad automática
- Aduanas: digitalización declaraciones

MODELO M&A TOKEN-FOR-EQUITY:
- Objetivo: adquirir 15%-51% de empresas satélite del ecosistema
- Pago: 40-60% fiat + BEZ-Coin bloqueado staking 3-5 años
- Beneficios empresa adquirida: DAO governance + liquidez preferente
- Efecto: empresa adquirida arrastra a todo su ecosistema de proveedores

AGENTES DEL SISTEMA:
- El Sabueso: Inteligencia de mercado, búsqueda de prospectos 24/7
- El Auditor: Score M&A 0-100, análisis financiero, viabilidad Token-for-Equity
- El Diplomático: Emails ejecutivos hiper-personalizados por sector e idioma
- El Negociador: Follow-up, gestión de respuestas, conversión de objeciones
- El Supervisor: Orquestación, decisiones estratégicas, síntesis ejecutiva

REGLA DE LENGUAJE EXTERNO (obligatoria en todos los outputs):
❌ NUNCA usar: blockchain, crypto, DeFi, token, NFT, wallet, descentralizado, Web3
✅ SIEMPRE usar: red empresarial, infraestructura, activo de utilidad, rendimiento de red,
   protocolo, ecosistema, créditos de plataforma, gobernanza participativa, acuerdo programable
`;

// ── AGENT PERSONAS ────────────────────────────────────────────────
const AGENT_PERSONAS = {
  sabueso: {
    name: "El Sabueso",
    role: "Market Intelligence Agent",
    emoji: "🔍",
    system: `Eres El Sabueso de BeZhas — el agente de inteligencia de mercado.
Tu función: identificar y analizar empresas objetivo con precisión quirúrgica.
Estilo: conciso, datos concretos, formato estructurado.
Siempre termina con: "PRÓXIMA ACCIÓN RECOMENDADA: [acción específica]"`,
  },
  auditor: {
    name: "El Auditor",
    role: "Financial Analysis Agent",
    emoji: "📊",
    system: `Eres El Auditor de BeZhas — el agente de análisis financiero y M&A.
Tu función: evaluar viabilidad de adquisición, calcular scores y estructurar deals.
Estilo: riguroso, datos financieros, tablas cuando proceda.
Siempre incluye: Score M&A (0-100), estructura del deal, riesgos.`,
  },
  diplomatico: {
    name: "El Diplomático",
    role: "Outreach & Communication Agent",
    emoji: "✉️",
    system: `Eres El Diplomático de BeZhas — el agente de comunicaciones ejecutivas.
Tu función: redactar emails, mensajes y propuestas que cierran contratos de millones.
Estilo: ejecutivo, confiado, específico. Nunca genérico. Nunca mendigues atención.
REGLA ABSOLUTA: NUNCA usar palabras crypto/blockchain en comunicaciones externas.
Usa: "red empresarial", "infraestructura", "activo de utilidad", "rendimiento de red".`,
  },
  negociador: {
    name: "El Negociador",
    role: "Follow-up & Response Agent",
    emoji: "🤝",
    system: `Eres El Negociador de BeZhas — el agente de seguimiento y conversión.
Tu función: clasificar respuestas, manejar objeciones y convertirlas en oportunidades.
Estilo: empático pero firme. Siempre redirige hacia el valor, nunca hacia el precio.
Clasifica siempre: [POSITIVO/NEUTRO/NEGATIVO] + respuesta sugerida.`,
  },
  supervisor: {
    name: "El Supervisor",
    role: "Orchestrator Agent",
    emoji: "🧠",
    system: `Eres El Supervisor de BeZhas — el agente orquestador maestro.
Tu función: coordinar estrategia global, tomar decisiones de alto nivel, sintetizar.
Estilo: visión de negocio, perspectiva amplia, recomendaciones accionables.
Siempre estructura: SITUACIÓN → ANÁLISIS → DECISIÓN → PRÓXIMOS PASOS.`,
  },
};

// ── CONVERSATION MEMORY ───────────────────────────────────────────
const conversations = new Map(); // userId -> [messages]

function getHistory(userId) {
  if (!conversations.has(userId)) conversations.set(userId, []);
  return conversations.get(userId);
}

function addToHistory(userId, role, content) {
  const history = getHistory(userId);
  history.push({ role, content });
  // Keep last 20 messages to avoid token overflow
  if (history.length > 20) history.splice(0, 2);
}

// ── CORE AGENT FUNCTION ───────────────────────────────────────────
async function runAgent(agentId, userMessage, userId = "default") {
  const agent = AGENT_PERSONAS[agentId] || AGENT_PERSONAS.supervisor;
  const history = getHistory(userId);
  addToHistory(userId, "user", userMessage);

  const systemPrompt = `${agent.system}

BASE DE CONOCIMIENTO BEZHAS:
${BEZHAS_KB}

HISTORIAL RECIENTE: ${history.length} mensajes en memoria.
Usuario ID: ${userId}`;

  const messages = [
    ...history.slice(-10),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages,
    });

    const output = response.content[0].text;
    addToHistory(userId, "assistant", output);
    return { success: true, agent: agent.name, emoji: agent.emoji, output };
  } catch (error) {
    console.error(`Agent ${agentId} error:`, error.message);
    return { success: false, error: error.message };
  }
}

// ── AUTO-ROUTE: detect best agent ────────────────────────────────
function detectAgent(message) {
  const msg = message.toLowerCase();
  if (msg.includes("email") || msg.includes("correo") || msg.includes("redact") ||
      msg.includes("mensaje") || msg.includes("escrib") || msg.includes("draft"))
    return "diplomatico";
  if (msg.includes("m&a") || msg.includes("adquisi") || msg.includes("score") ||
      msg.includes("viabilidad") || msg.includes("financier") || msg.includes("valoraci"))
    return "auditor";
  if (msg.includes("busca") || msg.includes("empresa") || msg.includes("prospecto") ||
      msg.includes("mercado") || msg.includes("sector") || msg.includes("investiga"))
    return "sabueso";
  if (msg.includes("respond") || msg.includes("objeción") || msg.includes("objecion") ||
      msg.includes("follow") || msg.includes("seguimiento") || msg.includes("dijo"))
    return "negociador";
  return "supervisor";
}

// ════════════════════════════════════════════════════════════
// REST API ENDPOINTS
// ════════════════════════════════════════════════════════════

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "online",
    system: "BeZhas AI Agent 24/7",
    version: "1.0.0",
    agents: Object.keys(AGENT_PERSONAS),
    timestamp: new Date().toISOString(),
  });
});

// Run specific agent
app.post("/agent/:agentId", requireAgentAuth, agentRateLimit, async (req, res) => {
  const { agentId } = req.params;
  const { message, userId = "api-user" } = req.body;

  if (!message) return res.status(400).json({ error: "message is required" });
  if (!AGENT_PERSONAS[agentId]) return res.status(400).json({ error: `Unknown agent: ${agentId}. Use: ${Object.keys(AGENT_PERSONAS).join(", ")}` });

  console.log(`[${new Date().toLocaleTimeString()}] Agent: ${agentId} | User: ${userId}`);
  const result = await runAgent(agentId, message, userId);
  res.json(result);
});

// Auto-route (agent selected by content)
app.post("/chat", requireAgentAuth, agentRateLimit, async (req, res) => {
  const { message, userId = "api-user", agent } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  const agentId = agent || detectAgent(message);
  console.log(`[${new Date().toLocaleTimeString()}] Auto-routed to: ${agentId} | User: ${userId}`);
  const result = await runAgent(agentId, message, userId);
  res.json({ ...result, routedTo: agentId });
});

// Generate personalized email
app.post("/generate-email", requireAgentAuth, agentRateLimit, async (req, res) => {
  const { empresa, cargo, sector, idioma = "ES", plan = "enterprise", nombre = "", context = "" } = req.body;
  if (!empresa || !sector) return res.status(400).json({ error: "empresa and sector are required" });

  const planData = { starter: "€119,79/mes", pro: "€603,79/mes", enterprise: "€3.023,79/mes" };
  const task = `Redacta un email comercial ejecutivo ${idioma === "ES" ? "en español" : "in English"} para ${nombre || "el/la"} ${cargo} de ${empresa}.
SECTOR: ${sector} | PLAN: BeZhas ${plan} (${planData[plan] || planData.enterprise})
CONTEXTO: ${context || "ninguno"}
Incluye: dolor del sector con datos, solución BeZhas, ROI del plan, mención sutil del rendimiento extra de red, CTA.
Primera línea: ASUNTO: [asunto del email]. Luego el cuerpo. Máx 220 palabras.
REGLA: NUNCA usar palabras crypto/blockchain/token/DeFi.`;

  const result = await runAgent("diplomatico", task, `email-${empresa}`);
  if (result.success) {
    const lines = result.output.split("\n");
    const subjIdx = lines.findIndex(l => l.toUpperCase().startsWith("ASUNTO:"));
    const subject = subjIdx >= 0 ? lines[subjIdx].replace(/^ASUNTO:\s*/i, "").trim() : "(sin asunto)";
    const body = subjIdx >= 0 ? lines.slice(subjIdx + 1).filter(l => l.trim()).join("\n").trim() : result.output;
    res.json({ success: true, subject, body, agent: result.agent });
  } else {
    res.json(result);
  }
});

// M&A Analysis
app.post("/analyze-target", requireAgentAuth, agentRateLimit, async (req, res) => {
  const { empresa, sector, revenue, stake = 30 } = req.body;
  if (!empresa) return res.status(400).json({ error: "empresa is required" });

  const task = `Analiza ${empresa} (sector: ${sector || "desconocido"}, facturación: ${revenue || "desconocida"}) como objetivo M&A BeZhas.
Quiero adquirir el ${stake}%.
Dame: Score M&A (0-100), valoración estimada, estructura Token-for-Equity, argumentario para el fundador, efecto de red y riesgo principal.`;

  const result = await runAgent("auditor", task, `manda-${empresa}`);
  res.json(result);
});

// Clear conversation history
app.delete("/history/:userId", requireAgentAuth, (req, res) => {
  conversations.delete(req.params.userId);
  res.json({ success: true, message: `History cleared for user: ${req.params.userId}` });
});

// Get system status
app.get("/status", requireAgentAuth, (req, res) => {
  res.json({
    status: "online",
    agents: Object.entries(AGENT_PERSONAS).map(([id, a]) => ({
      id, name: a.name, role: a.role, emoji: a.emoji, status: "active",
    })),
    activeConversations: conversations.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── START SERVER ──────────────────────────────────────────────────
const PORT = process.env.AGENT_PORT || 3099;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║         BEZHAS AI AGENT 24/7 — ONLINE                       ║
╠══════════════════════════════════════════════════════════════╣
║  Server:    http://localhost:${PORT}                            ║
║  Agents:    5 activos (Sabueso, Auditor, Diplomático,        ║
║             Negociador, Supervisor)                          ║
║  Telegram:  ejecuta 'node telegram-bot.js' para activar      ║
╚══════════════════════════════════════════════════════════════╝

Endpoints disponibles:
  POST /chat                → Auto-routing inteligente
  POST /agent/:id           → Agente específico
  POST /generate-email      → Email personalizado con IA
  POST /analyze-target      → Análisis M&A
  GET  /status              → Estado del sistema
  `);
});

module.exports = app;
