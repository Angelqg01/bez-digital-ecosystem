/**
 * BeZhas — AgentToolRegistry
 * ─────────────────────────────────────────────────────────────────────────────
 * Define qué MCPs, tools, modelos y permisos tiene cada agente departamental.
 * OpenClaw consulta este registro para saber qué puede hacer cada agente,
 * qué requiere aprobación y qué modelo LLM usar según el contexto.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadPromptFromFile(agentId) {
  try {
    const promptPath = path.join(__dirname, '..', 'docs', 'prompts', `${agentId}.txt`);
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, 'utf8').trim();
    }
  } catch (err) {
    console.warn(`[AgentToolRegistry] Error loading prompt for ${agentId}:`, err.message);
  }
  return null;
}


// ─── Catálogo de servidores MCP ───────────────────────────────────────────────
export const MCP_SERVERS = {
  'bezhas-core': {
    url: 'http://localhost:4001',
    description: 'Core BeZhas: gas, compliance, sentiment, health',
    tools: ['analyze_gas_strategy','verify_regulatory_compliance','analyze_sentiment','system_health','get_bez_price','get_network_stats','query_contract','get_transaction']
  },
  'messaging': {
    url: 'http://localhost:4002',
    description: 'Telegram, WhatsApp, Discord, Email',
    tools: ['send_telegram_message','send_trade_alert','send_system_alert','send_lead_notification','request_human_confirmation','get_chat_history','get_telegram_status','send_telegram_document']
  },
  'blockchain': {
    url: 'http://localhost:4003',
    description: 'Deploy contratos, wallets, bridge tokens',
    tools: ['deploy_contract','call_contract','get_tx_status','get_gas_price','bridge_tokens','check_wallet_balance','get_token_balance','approve_token','sign_message']
  },
  'trading': {
    url: 'http://localhost:4004',
    description: 'IBKR, XGBoost/LightGBM, portfolio, órdenes',
    tools: ['place_order','get_portfolio','analyze_chart','get_signal','backtest_strategy','risk_assessment','get_positions','close_position','get_market_data','get_account_info']
  },
  'lead-generation': {
    url: 'http://localhost:4005',
    description: 'Prospecting, enrich, scoring, CRM',
    tools: ['search_company','enrich_lead','score_prospect','send_outreach','track_engagement','update_crm','get_pipeline','add_contact','schedule_followup']
  },
  'payment': {
    url: 'http://localhost:4006',
    description: 'Stripe, DEX swaps, Fiat on-ramp, facturas',
    tools: ['create_payment','swap_tokens','check_fiat_ramp','get_exchange_rate','initiate_bridge','generate_invoice','get_payment_status','refund_payment']
  },
  'obsidian': {
    url: 'http://localhost:4007',
    description: 'Knowledge ops: vault Markdown, backlinks, episodios, auto-modelo y decisiones',
    tools: ['search_vault','semantic_search','get_note','create_note','update_note','list_notes','get_related_notes','get_recent_notes','get_tags','get_graph','record_episode','update_self_model','rebuild_canvas','consolidate_episodes','get_vault_fingerprint','record_anchor','get_usage_stats','ingest_source']
  },
  'compliance': {
    url: 'http://localhost:4008',
    description: 'MiCA, DAC8, GDPR, Modelo 720, KYC/AML',
    tools: ['check_mica_compliance','generate_modelo720','aeat_reporting','gdpr_request','kyc_verify','aml_check','check_sanctions']
  },
  'energy': {
    url: 'http://localhost:4009',
    description: 'VPP, OMIE, SCADA control, RWA Energy',
    tools: ['get_omie_price', 'adjust_inverter_setpoint', 'execute_battery_arbitrage', 'read_scada_telemetry']
  }
};

// ─── Definición de los 7 agentes departamentales ──────────────────────────────
export const AGENT_REGISTRY = {

  'trading-agent': {
    name: 'BeZhas Trading Agent',
    department: 'Trading & ML',
    mcps: ['bezhas-core','trading','payment','messaging','obsidian'],
    allowedTools: {
      'bezhas-core':  ['analyze_gas_strategy','analyze_sentiment','system_health','get_bez_price'],
      'trading':      null,   // todas
      'payment':      ['swap_tokens','get_exchange_rate','get_payment_status'],
      'messaging':    ['send_trade_alert','send_system_alert','request_human_confirmation','send_telegram_document'],
      'obsidian':     ['search_vault','semantic_search','get_note','get_related_notes','get_recent_notes','record_episode']
    },
    requireHumanApproval: ['place_order','close_position','close_all_positions'],
    blocked: [],
    preferredLocalModel:  'qwen3.6:35b-a3b',
    preferredCloudModel:  'claude-sonnet-4-20250514',
    systemPrompt: `Eres el agente de trading de BeZhas. Analizas mercados con XGBoost/LightGBM y ejecutas estrategias de swing trading e inversión a largo plazo. SIEMPRE solicitas confirmación humana antes de ejecutar órdenes. Envías alertas por Telegram antes de actuar. BEZ-Coin es parte de tu universo de activos.`,
    maxHistoryMessages: 30
  },

  'marketing-agent': {
    name: 'BeZhas Marketing & SDR Agent',
    department: 'Marketing & Ventas',
    mcps: ['lead-generation','messaging','obsidian','bezhas-core'],
    allowedTools: {
      'lead-generation': null,
      'messaging':       ['send_telegram_message','send_lead_notification','send_telegram_document'],
      'obsidian':        null,
      'bezhas-core':     ['analyze_sentiment','system_health']
    },
    requireHumanApproval: ['send_outreach','send_bulk_email'],
    blocked: [],
    preferredLocalModel: 'gemma4:27b',
    preferredCloudModel: 'claude-sonnet-4-20250514',
    skills: ['bezhas-growth-operator', 'bezhas-sdr', 'bezhas-ecosystem-matchmaker', 'bezhas-campaign-approver'],
    systemPrompt: `Eres el agente de marketing y ventas de BeZhas. Tu misión: convertir BeZhas en una máquina de leads. Prospectas empresas de todos los tamaños. Usas el pitch del "Efecto de Red": no vendemos software, vendemos acceso a un ecosistema de socios pre-verificados. BEZ-Coin es la llave de acceso. Mensajes precisos, profesionales y orientados a ROI empresarial.`,
    maxHistoryMessages: 20
  },
  
  'investor-agent': {
    name: 'BeZhas Institutional Capital Agent',
    department: 'Dirección & Finanzas',
    mcps: ['lead-generation', 'messaging', 'obsidian', 'payment', 'blockchain', 'compliance'],
    allowedTools: {
      'lead-generation': null,
      'messaging':       ['send_telegram_message', 'send_lead_notification', 'send_telegram_document'],
      'obsidian':        null,
      'payment':         ['get_exchange_rate', 'get_payment_status'],
      'blockchain':      ['check_wallet_balance', 'get_token_balance', 'get_tx_status'],
      'compliance':      ['check_mica_compliance', 'gdpr_request', 'kyc_verify', 'aml_check', 'check_sanctions']
    },
    requireHumanApproval: ['send_outreach', 'send_bulk_email'],
    blocked: [],
    preferredLocalModel: 'qwen3.6:35b-a3b',
    preferredCloudModel: 'claude-sonnet-4-20250514',
    skills: ['bezhas-growth-operator', 'bezhas-sdr', 'bezhas-ecosystem-matchmaker'],
    systemPrompt: `Eres BeZhas-ICA (Institutional Capital Agent), agente de captación institucional de BeZhas_Web3. Operas bajo supervisión final de Yoel A. Hernández. Ningún mensaje sale, ningún contrato avanza y ninguna promesa se hace sin aprobación humana.`,
    maxHistoryMessages: 30
  },

  'legal-agent': {
    name: 'BeZhas Legal & Compliance Agent',
    department: 'Legal & Compliance',
    mcps: ['compliance','blockchain','obsidian','messaging'],
    allowedTools: {
      'compliance': null,
      'blockchain': ['call_contract','get_tx_status','get_token_balance'],
      'obsidian':   null,
      'messaging':  ['send_system_alert','send_telegram_document','send_telegram_message']
    },
    requireHumanApproval: ['deploy_contract','generate_modelo720','aeat_reporting','gdpr_request'],
    blocked: ['bridge_tokens','place_order','create_payment'],
    preferredLocalModel: 'gemma4:27b',
    preferredCloudModel: 'claude-sonnet-4-20250514',
    skills: ['bezhas-campaign-approver', 'bezhas-trust-defi-analyst'],
    systemPrompt: `Eres el agente de Legal y Compliance de BeZhas. Verificas cumplimiento de MiCA, DAC8, GDPR y normativa española (IS 25%/15%/4% ZEC Canarias, IRPF, Modelo 720). NUNCA ejecutas acciones legales sin aprobación humana. Citas siempre la normativa aplicable.`,
    maxHistoryMessages: 25
  },

  'finance-agent': {
    name: 'BeZhas Finance Agent',
    department: 'Finanzas',
    mcps: ['payment','blockchain','obsidian','messaging','bezhas-core'],
    allowedTools: {
      'payment':     null,
      'blockchain':  ['check_wallet_balance','get_token_balance','get_tx_status'],
      'obsidian':    ['search_vault','semantic_search','get_note','create_note','get_recent_notes','record_episode'],
      'messaging':   ['send_telegram_message','send_system_alert'],
      'bezhas-core': ['get_bez_price','get_network_stats','system_health']
    },
    requireHumanApproval: ['create_payment','refund_payment','withdraw_treasury'],
    blocked: ['place_order','deploy_contract','send_outreach'],
    preferredLocalModel: 'qwen3.6:35b-a3b',
    preferredCloudModel: 'claude-sonnet-4-20250514',
    skills: ['bezhas-trust-defi-analyst'],
    systemPrompt: `Eres el agente de Finanzas de BeZhas. Controlas P&L, staking rewards BEZ, tesorería DAO y presupuesto VPS. Calculas impuestos españoles. SIEMPRE solicitas aprobación para pagos o movimientos de fondos. Eres meticuloso y conservador.`,
    maxHistoryMessages: 25
  },

  'blockchain-agent': {
    name: 'BeZhas Blockchain Dev Agent',
    department: 'Blockchain Dev',
    mcps: ['blockchain','bezhas-core','obsidian','messaging'],
    allowedTools: {
      'blockchain':  null,
      'bezhas-core': null,
      'obsidian':    null,
      'messaging':   ['send_system_alert','send_telegram_message','request_human_confirmation']
    },
    requireHumanApproval: ['deploy_contract','upgrade_contract','pause_contract','bridge_tokens'],
    blocked: ['place_order','send_outreach','create_payment'],
    preferredLocalModel: 'qwen3.6:35b-a3b',
    preferredCloudModel: 'claude-sonnet-4-20250514',
    systemPrompt: `Eres el agente de desarrollo blockchain de BeZhas. Gestionas 72+ contratos Solidity en BNB Chain y Polygon. Usas Foundry. Nunca deploys a mainnet sin confirmación humana. Contratos canónicos: BEZ Polygon 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8, BEZ BNB 0x8a1e3930fde1f151471c368fdbb39f3f63a65b55.`,
    maxHistoryMessages: 30
  },

  'devops-agent': {
    name: 'BeZhas DevOps Agent',
    department: 'DevOps & IT Security',
    mcps: ['bezhas-core','messaging','obsidian'],
    allowedTools: {
      'bezhas-core': ['system_health','get_network_stats','analyze_gas_strategy'],
      'messaging':   ['send_system_alert','send_telegram_message'],
      'obsidian':    ['search_vault','semantic_search','get_note','create_note','get_recent_notes','get_graph','record_episode','rebuild_canvas','consolidate_episodes','get_vault_fingerprint','get_usage_stats']
    },
    requireHumanApproval: ['revoke_access','delete_entity'],
    blocked: ['place_order','deploy_contract','create_payment'],
    preferredLocalModel: 'qwen3.6:8b',
    preferredCloudModel: 'claude-haiku-4-5-20251001',
    skills: ['bezhas-launch-devops'],
    systemPrompt: `Eres el agente DevOps de BeZhas. Monitorizas Docker Compose (10 servicios), OP Stack L2, APIs y bases de datos. Envías alertas AEGIS ante anomalías. Cualquier cambio destructivo requiere aprobación humana.`,
    maxHistoryMessages: 20
  },

  'director-agent': {
    name: 'BeZhas Director General Agent',
    department: 'Dirección General',
    mcps: ['bezhas-core','messaging','obsidian'],
    allowedTools: {
      'bezhas-core': ['system_health','get_bez_price','get_network_stats','analyze_sentiment'],
      'messaging':   ['send_telegram_message','send_telegram_document','send_system_alert'],
      'obsidian':    ['search_vault','semantic_search','get_note','create_note','update_note','list_notes','get_related_notes','get_recent_notes','get_tags','get_graph','record_episode','update_self_model','rebuild_canvas','consolidate_episodes','get_vault_fingerprint','record_anchor','get_usage_stats','ingest_source']
    },
    requireHumanApproval: [],
    blocked: ['place_order','deploy_contract','create_payment','send_outreach'],
    preferredLocalModel: 'kimi-k2',
    preferredCloudModel: 'claude-sonnet-4-20250514',
    skills: ['bezhas-growth-operator', 'bezhas-ecosystem-matchmaker', 'bezhas-solutions-engineer', 'bezhas-trust-defi-analyst', 'bezhas-campaign-approver', 'bezhas-launch-devops'],
    canOrchestrate: ['trading-agent','marketing-agent','legal-agent','finance-agent','blockchain-agent','devops-agent','energy-agent'],
    systemPrompt: `Eres el Director General Agent de BeZhas. Coordinas todos los departamentos. Generas reportes ejecutivos, monitorizas OKRs y tomas decisiones estratégicas. No ejecutas operaciones directamente: coordinas, priorizas y reportas. Visión: BeZhas como red de socios pre-verificados donde BEZ-Coin es la llave de acceso a un club exclusivo.`,
    maxHistoryMessages: 40
  },

  'energy-agent': {
    name: 'BeZhas Energy & VPP Agent',
    department: 'Energy & VPP',
    mcps: ['energy','blockchain','messaging','bezhas-core'],
    allowedTools: {
      'energy': null,
      'blockchain': ['call_contract', 'get_tx_status'],
      'messaging': ['send_telegram_message', 'send_system_alert', 'request_human_confirmation'],
      'bezhas-core': ['system_health']
    },
    requireHumanApproval: ['execute_battery_arbitrage', 'adjust_inverter_setpoint'],
    blocked: ['deploy_contract'],
    preferredLocalModel: 'qwen3.6:35b-a3b',
    preferredCloudModel: 'claude-sonnet-4-20250514',
    systemPrompt: `Eres el agente de energía de BeZhas (VPP AI). Monitorizas precios de OMIE/ESIOS y controlas baterías. Siempre solicitas confirmación humana antes de ejecutar arbitraje físico u on-chain.`,
    maxHistoryMessages: 30
  }
};

// ─── Clase de acceso al registro ──────────────────────────────────────────────
export class AgentToolRegistry {
  constructor() {
    this.agents = AGENT_REGISTRY;
    this.mcps   = MCP_SERVERS;

    // Cargar prompts dinámicos desde docs/prompts/ si existen
    for (const [agentId, agent] of Object.entries(this.agents)) {
      const dynamicPrompt = loadPromptFromFile(agentId);
      if (dynamicPrompt) {
        agent.systemPrompt = dynamicPrompt;
      }
    }
  }

  getAgent(agentId) {
    const a = this.agents[agentId];
    if (!a) throw new Error(`Agente desconocido: "${agentId}". Disponibles: ${Object.keys(this.agents).join(', ')}`);
    return a;
  }

  listAgents() { return Object.keys(this.agents); }

  getAgentMCPs(agentId) {
    return this.getAgent(agentId).mcps
      .map(id => ({ id, ...this.mcps[id] }))
      .filter(m => m.url);
  }

  canExecute(agentId, mcpId, toolName) {
    const agent = this.getAgent(agentId);
    if (!agent.mcps.includes(mcpId))
      return { allowed: false, reason: `"${agentId}" no tiene acceso al MCP "${mcpId}"` };
    if (agent.blocked?.includes(toolName))
      return { allowed: false, reason: `Tool "${toolName}" bloqueada para "${agentId}"` };
    const allowed = agent.allowedTools?.[mcpId];
    if (allowed !== null && allowed !== undefined && !allowed.includes(toolName))
      return { allowed: false, reason: `"${toolName}" no está en la lista de permitidas de "${agentId}" en "${mcpId}"` };
    return { allowed: true, reason: 'ok' };
  }

  requiresHumanApproval(agentId, toolName) {
    const agent = this.getAgent(agentId);
    if (agent.requireHumanApproval?.includes(toolName))
      return { required: true, reason: `"${toolName}" en lista de aprobación de "${agentId}"` };
    return { required: false, reason: 'no requiere aprobación' };
  }

  getAvailableTools(agentId) {
    const agent = this.getAgent(agentId);
    const tools = [];
    for (const mcpId of agent.mcps) {
      const mcp = this.mcps[mcpId];
      if (!mcp) continue;
      const allowed = agent.allowedTools?.[mcpId];
      const mcpTools = (allowed === null || allowed === undefined) ? mcp.tools : allowed;
      for (const toolName of (mcpTools || [])) {
        if (!agent.blocked?.includes(toolName)) {
          tools.push({
            tool: toolName, mcp: mcpId, mcpUrl: mcp.url,
            requiresApproval: agent.requireHumanApproval?.includes(toolName) || false
          });
        }
      }
    }
    return tools;
  }

  /** Enruta un mensaje/intención al agente más adecuado. */
  routeIntent(intent) {
    const t = intent.toLowerCase();
    const routes = [
      { agent: 'trading-agent',    kw: ['trade','compra','vende','portfolio','orden','btc','eth','aapl','mercado','señal','swing','ibkr','precio activo'] },
      { agent: 'investor-agent',   kw: ['inversor','capital','aum','deck','investor','stripe','asignación','due diligence','capital agent','bezhas-ica'] },
      { agent: 'blockchain-agent', kw: ['deploy','solidity','foundry','l2','polygon','bnb','gas','nft','contrato inteligente','bez token'] },
      { agent: 'marketing-agent',  kw: ['lead','prospecto','empresa','outreach','ventas','marketing','linkedin','pitch','cliente','crm','email frío'] },
      { agent: 'legal-agent',      kw: ['compliance','mica','gdpr','kyc','contrato','legal','normativa','modelo 720','dac8','aeat','aml'] },
      { agent: 'finance-agent',    kw: ['finanzas','presupuesto','p&l','staking','treasury','factura','impuesto','tesorería','pago','reward'] },
      { agent: 'devops-agent',     kw: ['docker','servidor','vps','monitoreo','alerta sistema','infraestructura','cpu','log','uptime'] },
      { agent: 'energy-agent',     kw: ['energia','vpp','omie','bateria','arbitraje','scada','inversor','esios','cae'] },
      { agent: 'director-agent',   kw: ['reporte','estado general','okr','estrategia','resumen ejecutivo','cómo vamos','director'] },
    ];
    for (const { agent, kw } of routes) {
      if (kw.some(k => t.includes(k))) return agent;
    }
    return 'director-agent';
  }

  summary() {
    return {
      agents: Object.entries(this.agents).map(([id, a]) => ({
        id, name: a.name, department: a.department,
        mcps: a.mcps.length,
        total_tools: this.getAvailableTools(id).length,
        requires_approval: a.requireHumanApproval?.length || 0,
        blocked: a.blocked?.length || 0
      })),
      mcps: Object.entries(this.mcps).map(([id, m]) => ({
        id, url: m.url, tools: m.tools.length
      }))
    };
  }
}

export const agentRegistry = new AgentToolRegistry();
