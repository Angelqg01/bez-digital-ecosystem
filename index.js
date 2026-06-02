/**
 * BeZhas — AEGIS Security Layer (fusionado con Agent Runtime + AI Engine)
 * ─────────────────────────────────────────────────────────────────────────────
 * AEGIS actúa como capa de seguridad transversal para todos los módulos.
 * Todos los mensajes que entran desde Telegram/WhatsApp/Discord pasan
 * PRIMERO por AEGIS antes de llegar al orquestador.
 *
 * Flujo unificado:
 *   Canal (Telegram) → AEGIS Auth → Intent Router → Agent (AI Engine) → Respuesta
 *                   ↗ AEGIS Audit ←────────────────────────────────────↙
 * ─────────────────────────────────────────────────────────────────────────────
 */

import 'dotenv/config';
import { Redis } from 'ioredis';

// ── Módulos internos (se importan desde sus carpetas una vez fusionados) ───────
// import { TelegramClient }      from '../messaging-mcp/src/telegram.js';
// import { RedisMemoryManager }  from '../agent-runtime/src/memory/RedisMemoryManager.js';
// import { HumanInLoopManager }  from '../agent-runtime/src/humanInLoop/HumanInLoopManager.js';
// import { OpenClawOrchestrator} from '../openclaw/src/OpenClawOrchestrator.js';
// import { OllamaProvider }      from '../openclaw/src/providers/OllamaProvider.js';
// import { ModelRouter }         from '../openclaw/src/router/ModelRouter.js';

// ── AEGIS: Roles y permisos ───────────────────────────────────────────────────
export const ROLES = {
  ADMIN:    { level: 100, can: ['*'] },
  OPERATOR: { level: 50,  can: ['trade', 'message', 'read', 'lead_gen', 'blockchain_read'] },
  VIEWER:   { level: 10,  can: ['read', 'message'] },
  BOT:      { level: 5,   can: ['message', 'alert_receive'] }
};

// ── AEGIS: Security Manager ───────────────────────────────────────────────────
export class AEGISSecurityManager {
  constructor(redis) {
    this.redis  = redis;
    this.prefix = 'bezhas:aegis:';
  }

  // Verificar si un userId tiene el rol requerido
  async authorize(userId, requiredAction) {
    const userRole = await this._getUserRole(userId);
    const role     = ROLES[userRole] || ROLES.VIEWER;

    if (role.can.includes('*')) return { authorized: true, role: userRole };
    if (role.can.includes(requiredAction)) return { authorized: true, role: userRole };

    return { authorized: false, role: userRole, required: requiredAction };
  }

  async _getUserRole(userId) {
    const key  = `${this.prefix}user:${userId}:role`;
    const role = await this.redis.get(key).catch(() => null);
    // Verificar contra lista de usuarios autorizados del .env
    const authorized = (process.env.TELEGRAM_AUTHORIZED_USERS || '').split(',').map(s => s.trim());
    if (authorized.includes(userId)) return role || 'OPERATOR';
    return role || 'VIEWER';
  }

  // Audit log de todas las acciones
  async audit(event) {
    if (!this.redis) return;
    const entry = {
      ...event,
      ts:  Date.now(),
      iso: new Date().toISOString()
    };
    try {
      await this.redis.lpush(`${this.prefix}audit:log`, JSON.stringify(entry));
      await this.redis.ltrim(`${this.prefix}audit:log`, 0, 9_999);  // últimas 10k entradas
    } catch { /* no bloquear si Redis está caído */ }
  }

  // Rate limiting por userId
  async checkRateLimit(userId, action = 'message', maxPerMin = 20) {
    if (!this.redis) return { allowed: true };
    const key  = `${this.prefix}rl:${userId}:${action}`;
    const now  = Date.now();
    const pipe = this.redis.pipeline();
    pipe.zremrangebyscore(key, 0, now - 60_000);
    pipe.zadd(key, now, `${now}`);
    pipe.zcard(key);
    pipe.expire(key, 70);
    const results = await pipe.exec();
    const count   = results[2][1];
    return { allowed: count <= maxPerMin, count, max: maxPerMin };
  }

  // Obtener últimas N entradas del audit log
  async getAuditLog(limit = 50) {
    if (!this.redis) return [];
    const raw = await this.redis.lrange(`${this.prefix}audit:log`, 0, limit - 1);
    return raw.map(r => JSON.parse(r));
  }
}

// ── Función de bootstrap integrada ───────────────────────────────────────────
export async function bootstrapBeZhasBlockchain() {
  console.log('🚀 [BeZhas Blockchain] Iniciando stack unificado...\n');

  // 1. Redis
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryStrategy: t => Math.min(t * 200, 3_000),
    lazyConnect:   true,
    enableOfflineQueue: false
  });
  try {
    await redis.connect();
    await redis.ping();
    console.log('✅ [1/6] Redis conectado');
  } catch (e) {
    console.warn('⚠️  [1/6] Redis no disponible:', e.message);
  }

  // 2. AEGIS Security
  const aegis = new AEGISSecurityManager(redis);
  console.log('✅ [2/6] AEGIS Security Manager listo');

  // 3-6: los demás módulos se importan dinámicamente para no romper
  // el arranque si alguna dependencia falta en desarrollo
  let telegram, memory, hil, ollama, orchestrator;

  try {
    console.log('📦 [3/6] Importando módulos...');
    console.log('   - telegram.js');
    const { TelegramClient }       = await import('./core/telegram.js');
    console.log('   - RedisMemoryManager.js');
    const { RedisMemoryManager }   = await import('./core/RedisMemoryManager.js');
    console.log('   - HumanInLoopManager.js');
    const { HumanInLoopManager }   = await import('./core/HumanInLoopManager.js');
    console.log('   - OllamaProvider.js');
    const { OllamaProvider }       = await import('./core/OllamaProvider.js');
    console.log('   - OpenClawOrchestrator.js');
    const { OpenClawOrchestrator } = await import('./core/OpenClawOrchestrator.js');

    console.log('🚀 Iniciando bots de Telegram...');
    const activeBots = [];
    const botConfigs = [
      { id: 'director',  token: process.env.TELEGRAM_TOKEN_DIRECTOR || process.env.TELEGRAM_BOT_TOKEN, agentId: 'director-agent' },
      { id: 'finance',   token: process.env.TELEGRAM_TOKEN_FINANCE,   agentId: 'finance-agent' },
      { id: 'marketing', token: process.env.TELEGRAM_TOKEN_MARKETING, agentId: 'marketing-agent' },
      { id: 'devops',    token: process.env.TELEGRAM_TOKEN_DEVOPS,    agentId: 'devops-agent' },
      { id: 'legal',     token: process.env.TELEGRAM_TOKEN_LEGAL,     agentId: 'legal-agent' }
    ].filter(b => b.token);

    for (const b of botConfigs) {
      console.log(`[Telegram] Inicializando Bot ${b.id.toUpperCase()} (@${b.agentId})`);
      const client = new TelegramClient({
        token:           b.token,
        agentId:         b.agentId,
        alertChatId:     process.env.TELEGRAM_ALERT_CHAT_ID,
        authorizedUsers: process.env.TELEGRAM_AUTHORIZED_USERS || ''
      });
      await client.initialize(redis);
      activeBots.push(client);
    }
    
    console.log(`✅ [3/6] ${activeBots.length} Bots de Telegram iniciados`);
    telegram = activeBots.find(b => b.agentId === 'director-agent') || activeBots[0];

    // 4. Memory + HIL
    memory = new RedisMemoryManager(redis);
    hil    = new HumanInLoopManager({ telegram, memory }, {
      skipInDev:   process.env.NODE_ENV !== 'production',
      alertChatId: process.env.TELEGRAM_ALERT_CHAT_ID
    });
    console.log('✅ [4/6] Memory Manager + Human-in-Loop');

    // 5. Ollama (nuevos modelos)
    ollama = new OllamaProvider();
    let ollamaInfo = await ollama.getSystemInfo();

    if (!ollamaInfo.available) {
      console.log('🔄 [5/6] Intentando iniciar Ollama localmente...');
      try {
        const { spawn } = await import('child_process');
        const ollamaProcess = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
        ollamaProcess.unref(); // Dejar corriendo en background
        
        // Esperar a que levante el servidor (hasta 5 segundos)
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 1000));
          ollamaInfo = await ollama.getSystemInfo();
          if (ollamaInfo.available) break;
        }
      } catch (err) {
        console.warn(`⚠️ No se pudo iniciar Ollama automáticamente: ${err.message}`);
      }
    }
    if (ollamaInfo.available) {
      const models = ollamaInfo.models?.map(m => m.name).join(', ') || 'ninguno';
      console.log(`✅ [5/6] Ollama ${ollamaInfo.version} | modelos: ${models}`);
      if (ollamaInfo.missing_recommended?.length > 0) {
        console.warn(`⚠️  Modelos recomendados faltantes: ${ollamaInfo.missing_recommended.join(', ')}`);
        console.warn('   Ejecuta: node scripts/ollama-status.js');
      }
    } else {
      console.warn('⚠️  [5/6] Ollama no disponible. Solo modelos cloud.');
    }

    // 6. Orchestrator + wire-up AEGIS
    orchestrator = new OpenClawOrchestrator({ telegram, memory, hil, ollama });

    // 6. Conectar Bots de Telegram con el Orchestrator
    for (const botClient of activeBots) {
      botClient.onMessage('*', async (payload) => {
        const { text, chatId, userId, username, agentId, isAuthorized } = payload;
        const sessionId = `${botClient.agentId}:${chatId}`;

        // AEGIS: rate limiting
        const { allowed } = await aegis.checkRateLimit(userId);
        if (!allowed) return { text: '⚠️ Demasiadas solicitudes. Espera un momento.' };

        // AEGIS: autorización
        const { authorized, role } = await aegis.authorize(userId, 'message');

        // AEGIS: audit log
        await aegis.audit({
          type:    'telegram_message',
          module:  botClient.agentId,
          userId,
          username,
          chatId,
          text:    text.slice(0, 200),
          role,
          authorized
        });

        if (!authorized) {
          return { text: '🔒 No tienes acceso a este departamento de BeZhas. Contacta con el administrador.' };
        }

        // Procesar con orchestrator (usando el agentId específico del bot)
        const result = await orchestrator.process({ 
          sessionId, 
          text, 
          userId, 
          isAuthorized, 
          agentId: agentId || botClient.agentId 
        });
        return { text: result.text };
      });
    }

    console.log('✅ [6/6] AEGIS → Orchestrator Multi-Bot wire-up completado\n');

  } catch (err) {
    console.error('❌ Error en bootstrap:', err.message);
    console.error('   Revisa que todos los módulos existan y el .env esté configurado');
  }

  // Alerta de inicio
  if (telegram) {
    try {
      await telegram.sendMessage(
        process.env.TELEGRAM_ALERT_CHAT_ID,
        '🚀 *BeZhas Blockchain ONLINE*\n\nAEGIS \\+ Agentes \\+ AI Engine iniciados correctamente\\.', {
          parse_mode: 'MarkdownV2'
        }
      );
    } catch { /* Telegram puede no estar configurado todavía */ }
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => { await redis.quit(); process.exit(0); });
  process.on('SIGINT',  async () => { await redis.quit(); process.exit(0); });

  return { redis, aegis, telegram, memory, hil, ollama, orchestrator };
}

// Arrancar si se ejecuta directamente
import { fileURLToPath } from 'url';
const isMain = process.argv[1] && (fileURLToPath(import.meta.url) === process.argv[1] || process.argv[1].endsWith('index.js'));

if (isMain) {
  bootstrapBeZhasBlockchain().catch(console.error);
}
