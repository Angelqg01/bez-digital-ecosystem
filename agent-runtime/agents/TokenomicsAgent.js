/**
 * BeZhas Agent Runtime — TokenomicsAgent
 * Monitorea el ecosistema tokenómico BEZ y actúa ante:
 *   - Anomalías en staking (caídas bruscas, APY spike)
 *   - Slashing de validators
 *   - Transferencias grandes sospechosas
 *   - Flujos anormales en bridges cross-chain
 *   - Cambios de gobernanza (nuevas propuestas)
 *
 * Se comunica con:
 *   ← TokenomicsConnector (datos on-chain)
 *   → SecurityAgent (amenazas críticas)
 *   → Telegram (notificaciones y HITL)
 *   → MemoryManager (historial tokenómico)
 */

'use strict';

const BaseAgent = require('../BaseAgent');
const { TokenomicsEngine } = require('../sdk/tokenomics-engine');
const { ethers } = require('ethers');

// Umbrales de alerta
const THRESHOLDS = {
  stakingDropPercent:     5,    // % caída de staking que activa alerta
  stakingDropCritical:    15,   // % caída crítica
  largeTransferBEZ:       100_000,
  bridgeFlowHigh:         500_000, // BEZ en un solo bridge tx
  apySpikeFactor:         2,    // APY se dobla en un snapshot
  validatorCountDropMin:  2,    // si caen 2+ validators a la vez
};

class TokenomicsAgent extends BaseAgent {
  constructor(opts = {}) {
    super({
      id:           'tokenomics-agent',
      name:         'BeZhas Tokenomics Agent',
      capabilities: [
        'tokenomics:monitor',
        'tokenomics:analyze',
        'tokenomics:report',
        'staking:alert',
        'bridge:alert',
        'governance:monitor',
      ],
      version: '1.0.0',
      ...opts,
    });

    const rpcUrl   = opts.rpcUrl || process.env.RPC_URL || 'http://localhost:8545';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.engine = new TokenomicsEngine({ provider });

    this._tokenomicsConnector = opts.connector || opts.tokenomicsConnector || null;
    this._alertHistory        = [];
    this._lastSnapshot        = null;
    this._reportSchedule      = null;
  }

  // ─── INICIALIZACIÓN ───────────────────────────────────────────────────────

  async initialize() {
    if (!this._tokenomicsConnector) return;

    // Suscribir a eventos del TokenomicsConnector
    this._tokenomicsConnector.on('anomaly:detected', async (anomaly) => {
      await this._handleAnomaly(anomaly);
    });

    this._tokenomicsConnector.on('validator:slashed', async (evt) => {
      await this._handleSlashing(evt);
    });

    this._tokenomicsConnector.on('large:transfer', async (evt) => {
      await this._handleLargeTransfer(evt);
    });

    this._tokenomicsConnector.on('bridge:deposit', async (evt) => {
      await this._handleBridgeDeposit(evt);
    });

    this._tokenomicsConnector.on('snapshot', async (state) => {
      this._lastSnapshot = state;
      await this.memory?.remember(this.id, 'last_snapshot', state);
    });

    // Reporte diario automático a las 8:00 UTC (mock)
    this._scheduleDaily();

    console.log('[TokenomicsAgent] 📊 Inicializado y escuchando tokenomics');
  }

  async shutdown() {
    if (this._reportSchedule) {
      clearTimeout(this._reportSchedule);
      clearInterval(this._reportSchedule);
      this._reportSchedule = null;
    }
  }

  async checkAnomalies() {
    try {
        const supply = await this.engine.getTotalSupply();
        const tvl = await this.engine.getTVL();
        
        console.log(`[TokenomicsAgent] Check: Supply=${supply}, TVL=${tvl}`);

        // Lógica de detección básica
        if (parseFloat(tvl) < parseFloat(supply) * 0.05) {
            await this._handleAnomaly({
                type: 'low_staking_participation',
                severity: 'warning',
                details: { supply, tvl, percent: (parseFloat(tvl)/parseFloat(supply)*100).toFixed(2) }
            });
        }
    } catch (error) {
        console.error('[TokenomicsAgent] Error checking anomalies:', error);
    }
  }

  // ─── EXECUTE — TAREAS DESDE AgentManager ─────────────────────────────────

  async execute(task) {
    switch (task.type) {
      case 'tokenomics:analyze': return this._analyzeEcosystem(task);
      case 'tokenomics:report':  return this._generateReport(task);
      case 'staking:alert':      return this._handleAnomaly(task.payload);
      case 'bridge:alert':       return this._handleBridgeDeposit(task.payload);
      default:
        throw new Error(`TokenomicsAgent no soporta: ${task.type}`);
    }
  }

  // ─── ANÁLISIS COMPLETO DEL ECOSISTEMA ────────────────────────────────────

  async _analyzeEcosystem(task) {
    const snapshot = this._lastSnapshot
      || await this._tokenomicsConnector?.takeSnapshot()
      || await this._getMockSnapshot();

    const analysis = await this.think(`
Analiza el siguiente estado del ecosistema tokenómico de BeZhas Blockchain (BEZ-Coin):

SUPPLY:
  Total: ${snapshot.supply?.total || '?'} BEZ
  En staking: ${snapshot.supply?.staked || '?'} BEZ (${snapshot.supply?.stakedPercent || '?'}%)
  Circulante: ${snapshot.supply?.circulating || '?'} BEZ

STAKING:
  Total staked: ${snapshot.staking?.totalStaked || '?'} BEZ
  APY actual: ${snapshot.staking?.apy || '?'}%
  Epoch actual: ${snapshot.staking?.epoch || '?'}

VALIDATORS:
  Total activos: ${snapshot.validators?.total || '?'}
  Total slashed: ${snapshot.validators?.totalSlashed || '?'} BEZ

PAGOS:
  Volumen total: ${snapshot.payments?.totalVolume || '?'} BEZ
  Transacciones: ${snapshot.payments?.txCount || '?'}

Proporciona:
1. Evaluación de la salud tokenómica (1-10)
2. Puntos positivos del ecosistema
3. Riesgos o señales de alerta identificadas
4. Recomendaciones concretas (máx 3)

Responde en español, de forma concisa y técnica.
`, { maxTokens: 700 });

    const result = {
      analysis,
      snapshot,
      healthScore: this._calculateHealthScore(snapshot),
      timestamp:   new Date().toISOString(),
    };

    await this.notify(
      `📊 *Análisis Tokenómico BeZhas*\n\n` +
      `Health Score: ${result.healthScore}/10\n` +
      `Supply circulante: ${parseFloat(snapshot.supply?.circulating || '0').toLocaleString()} BEZ\n` +
      `Staking APY: ${snapshot.staking?.apy || '?'}%\n` +
      `Validators activos: ${snapshot.validators?.total || '?'}\n\n` +
      `${analysis.slice(0, 400)}`,
      { level: 'info' }
    );

    await this.remember('last_analysis', result);
    return result;
  }

  // ─── REPORTE PERIÓDICO ────────────────────────────────────────────────────

  async _generateReport(task) {
    const snapshot   = this._lastSnapshot || await this._getMockSnapshot();
    const prevReport = await this.recall('last_report');

    const prompt = `
Genera un reporte ejecutivo diario del ecosistema tokenómico BeZhas para los operadores de la plataforma.

Estado actual:
${JSON.stringify(snapshot, null, 2).slice(0, 1500)}

${prevReport ? `Estado anterior (comparación):
${JSON.stringify(prevReport.snapshot, null, 2).slice(0, 500)}` : ''}

El reporte debe incluir:
- Resumen ejecutivo (2-3 frases)
- KPIs clave: supply, staking APY, validators, TVL farming, volumen pagos
- Cambios vs período anterior
- Alertas o puntos de atención
- Recomendaciones para el equipo

Formato: texto estructurado, conciso. Responde en español.`;

    const report = await this.think(prompt, { maxTokens: 800 });

    const result = { report, snapshot, generatedAt: new Date().toISOString() };
    await this.remember('last_report', result);

    await this.notify(`📋 *Reporte Diario — BeZhas Tokenomics*\n\n${report.slice(0, 600)}`, { level: 'info' });

    return result;
  }

  // ─── HANDLERS DE EVENTOS ──────────────────────────────────────────────────

  async _handleAnomaly(anomaly) {
    console.log(`[TokenomicsAgent] 🚨 Anomalía tokenómica: ${anomaly.type}`);
    
    // Emitir evento para el AgentServer / Frontend
    if (typeof this.manager?.emit === 'function') {
      this.manager.emit('tokenomics:anomaly', anomaly);
    }

    this._alertHistory.unshift({ ...anomaly, detectedAt: new Date().toISOString() });

    const analysis = await this.think(`
Se detectó una anomalía tokenómica en BeZhas:
Tipo: ${anomaly.type}
Severidad: ${anomaly.severity}
Detalle: ${JSON.stringify(anomaly)}

Explica en 2-3 frases qué significa esto para el ecosistema BEZ y qué acción se recomienda.
Responde en español.
`, { maxTokens: 256 });

    const isCritical = anomaly.severity === 'critical';

    await this.notify(
      `${isCritical ? '🔴' : '⚠️'} *Anomalía Tokenómica*\n` +
      `Tipo: \`${anomaly.type}\`\n` +
      `Severidad: ${anomaly.severity?.toUpperCase()}\n\n` +
      `${analysis}`,
      { level: isCritical ? 'critical' : 'warning' }
    );

    // Si es crítico, escalar al SecurityAgent via AgentManager
    if (isCritical && this.manager) {
      await this.manager.dispatch({
        type:     'security:check',
        priority: 'high',
        source:   'tokenomics-agent',
        payload:  { address: null, checkType: 'tokenomics-anomaly', anomaly },
      });
    }

    await this.remember(`anomaly:${Date.now()}`, anomaly);
    return { handled: true, analysis };
  }

  async _handleSlashing(evt) {
    console.log(`[TokenomicsAgent] ⚔️  Slashing detectado: ${evt.validator} → ${evt.amount} BEZ`);

    const impact = parseFloat(evt.amount);
    const level  = impact > 100_000 ? 'critical' : impact > 10_000 ? 'warning' : 'info';

    await this.notify(
      `⚔️ *Validator Slashed*\n` +
      `Validator: \`${evt.validator.slice(0, 10)}...${evt.validator.slice(-6)}\`\n` +
      `Cantidad quemada: ${parseFloat(evt.amount).toLocaleString()} BEZ\n` +
      `Motivo: ${evt.reason || 'No especificado'}\n` +
      `_${impact > 10_000 ? '⚠️ Impacto significativo en supply' : 'Impacto menor'}_`,
      { level }
    );

    await this.remember('last_slashing', evt);
    this._alertHistory.unshift({ type: 'slashing', ...evt, detectedAt: new Date().toISOString() });
  }

  async _handleLargeTransfer(evt) {
    const amount = parseFloat(evt.amount);
    if (amount < THRESHOLDS.largeTransferBEZ) return;

    console.log(`[TokenomicsAgent] 💸 Transferencia grande: ${amount.toLocaleString()} BEZ`);

    await this.notify(
      `💸 *Transferencia Grande*\n` +
      `Cantidad: ${amount.toLocaleString()} BEZ\n` +
      `De: \`${evt.from?.slice(0, 10)}...\`\n` +
      `A: \`${evt.to?.slice(0, 10)}...\`\n` +
      `${amount > 1_000_000 ? '⚠️ _Investigar posible whale movement_' : ''}`,
      { level: amount > 1_000_000 ? 'warning' : 'info' }
    );
  }

  async _handleBridgeDeposit(evt) {
    const amount = parseFloat(evt.amount);
    if (amount < THRESHOLDS.bridgeFlowHigh) return;

    await this.notify(
      `🌉 *Bridge — Flujo Alto*\n` +
      `Bridge: ${evt.bridge || 'desconocido'}\n` +
      `Cantidad: ${amount.toLocaleString()} BEZ\n` +
      `De: \`${evt.from?.slice(0, 10)}...\`\n` +
      `Destino: \`${evt.recipient?.slice(0, 10)}...\``,
      { level: 'info' }
    );
  }

  // ─── SCORE DE SALUD TOKENÓMICA ────────────────────────────────────────────

  _calculateHealthScore(snapshot) {
    let score = 10;

    // Penalizar si staking < 20% del supply
    const stakedPct = parseFloat(snapshot.supply?.stakedPercent || '0');
    if (stakedPct < 10) score -= 3;
    else if (stakedPct < 20) score -= 1;

    // Penalizar si hay slashing reciente
    const slashed = parseFloat(snapshot.validators?.totalSlashed || '0');
    if (slashed > 1_000_000) score -= 2;
    else if (slashed > 100_000) score -= 1;

    // Penalizar si hay alertas críticas recientes
    const criticals = this._alertHistory.filter(a => a.severity === 'critical').length;
    score -= Math.min(3, criticals);

    return Math.max(1, score);
  }

  async _getMockSnapshot() {
    return {
      supply:     { total: '1000000000', staked: '250000000', circulating: '750000000', stakedPercent: '25.00' },
      staking:    { totalStaked: '250000000', apy: 18.5, epoch: 42 },
      validators: { total: 12, totalSlashed: '5000' },
      payments:   { totalVolume: '1250000', txCount: 847 },
      timestamp:  new Date().toISOString(),
    };
  }

  _scheduleDaily() {
    // Simular reporte diario (en producción usar cron)
    const now       = new Date();
    const nextRun   = new Date(now);
    nextRun.setUTCHours(8, 0, 0, 0);
    if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
    const delay = nextRun - now;

    this._reportSchedule = setTimeout(async () => {
      await this._generateReport({ type: 'tokenomics:report', source: 'scheduler' });
      this._reportSchedule = setInterval(() => this._generateReport({ type: 'tokenomics:report', source: 'scheduler' }), 86_400_000);
      this._reportSchedule.unref?.();
    }, delay);
    this._reportSchedule.unref?.();
  }

  // ─── STATS ────────────────────────────────────────────────────────────────

  getStats() {
    return {
      ...super.getStats(),
      alertsHandled: this._alertHistory.length,
      lastSnapshot:  this._lastSnapshot?.timestamp,
      criticalAlerts: this._alertHistory.filter(a => a.severity === 'critical').length,
    };
  }

  _systemPrompt() {
    return `Eres el Tokenomics Agent de BeZhas Blockchain — experto en la economía del token BEZ-Coin.
Monitoras: supply total, staking (StakingPool.sol), farming (LiquidityFarming.sol), 
validators (ValidatorRegistry.sol + SlashingManager.sol), bridges cross-chain, 
pagos (BeZhasPayment.sol) y gobernanza (GovernanceSystem.sol).
Identificas anomalías tokenómicas y escalas problemas críticos al equipo.
Eres técnico, preciso y orientado a la sostenibilidad del ecosistema BEZ.
Responde siempre en español.`;
  }
}

module.exports = TokenomicsAgent;
