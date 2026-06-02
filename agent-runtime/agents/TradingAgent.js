/**
 * BeZhas Agent Runtime — TradingAgent
 * Agente de trading algorítmico con HITL obligatorio.
 * Integra: MCP Server (22 tools) + IBKR + XGBoost/LightGBM.
 *
 * NUNCA ejecuta trades sin confirmación humana salvo que
 * hitlEnabled=false explícitamente (modo backtest).
 */

'use strict';

const BaseAgent = require('../BaseAgent');

// Pares de trading soportados en BeZhas
const SUPPORTED_PAIRS = [
  'BEZ/USDT', 'BEZ/BNB', 'BEZ/ETH', 'BEZ/MATIC', 'BEZ/USDC',
];

class TradingAgent extends BaseAgent {
  constructor(opts = {}) {
    super({
      id:           'trading-agent',
      name:         'BeZhas Trading Agent',
      capabilities: ['trade:execute', 'trade:analyze', 'trade:backtest', 'portfolio:analyze'],
      version:      '1.0.0',
      ...opts,
    });

    this._tradesExecuted = 0;
    this._tradeHistory   = [];
  }

  // ─────────────────────────────────────────────
  // EXECUTE
  // ─────────────────────────────────────────────

  async execute(task) {
    switch (task.type) {
      case 'trade:execute':   return this._handleTradeRequest(task);
      case 'trade:analyze':   return this._analyzeOpportunity(task);
      case 'trade:backtest':  return this._runBacktest(task);
      case 'portfolio:analyze': return this._analyzePortfolio(task);
      default:
        throw new Error(`TradingAgent no soporta tipo: ${task.type}`);
    }
  }

  // ─────────────────────────────────────────────
  // TRADE REQUEST — FLUJO PRINCIPAL
  // ─────────────────────────────────────────────

  async _handleTradeRequest(task) {
    const { pair, side, amount, strategy, reason } = task.payload;

    // Validación básica
    if (!SUPPORTED_PAIRS.includes(pair)) {
      throw new Error(`Par no soportado: ${pair}. Soportados: ${SUPPORTED_PAIRS.join(', ')}`);
    }
    if (!['BUY', 'SELL'].includes(side?.toUpperCase())) {
      throw new Error(`Side inválido: ${side}. Debe ser BUY o SELL`);
    }

    console.log(`[TradingAgent] 📊 Trade solicitado: ${side} ${amount} ${pair}`);

    // 1. Análisis previo al trade
    const marketAnalysis = await this._quickMarketAnalysis(pair, side, amount);

    // 2. Verificación AEGIS — ¿hay alertas activas en el par?
    const securityClear = await this._checkAegisClearance(pair);
    if (!securityClear.clear) {
      await this.notify(
        `⚠️ *Trade bloqueado por AEGIS*\nPar: ${pair}\nMotivo: ${securityClear.reason}`,
        { level: 'warning' }
      );
      return { blocked: true, reason: securityClear.reason, action: 'aegis-blocked' };
    }

    // 3. Preparar contexto HITL
    const hitlContext = {
      type:      'trade:confirmation',
      title:     `📈 Confirmar Trade — ${side} ${pair}`,
      trade: { pair, side, amount, strategy, reason },
      analysis:  marketAnalysis,
      riskLevel: marketAnalysis.riskLevel,
      estimatedImpact: `${marketAnalysis.priceImpact?.toFixed(4)}%`,
    };

    // 4. HITL — SIEMPRE requerido para trades reales
    const { approved, response } = await this.requireApproval(task.id, hitlContext);

    if (!approved) {
      console.log(`[TradingAgent] ⏭️  Trade rechazado por usuario: ${pair}`);
      await this.notify(`❌ Trade rechazado\n${side} ${amount} ${pair}\nMotivo: ${response || 'Usuario rechazó'}`, { level: 'info' });
      return { approved: false, reason: response };
    }

    // 5. Ejecutar trade
    const result = await this._executeTrade({ pair, side, amount, strategy });

    // 6. Persistir en memoria
    await this.remember(`trade:${task.id}`, {
      trade: { pair, side, amount, strategy },
      result,
      executedAt: new Date().toISOString(),
    });

    this._tradesExecuted++;
    this._tradeHistory.push({ pair, side, amount, result, executedAt: new Date().toISOString() });

    // 7. Notificar resultado
    await this.notify(
      `✅ *Trade ejecutado*\n${side} ${amount} ${pair}\nPrecio: ${result.executedPrice}\nFee: ${result.fee}\nTX: \`${result.txHash || 'offchain'}\``,
      { level: 'success' }
    );

    return result;
  }

  // ─────────────────────────────────────────────
  // ANÁLISIS DE MERCADO
  // ─────────────────────────────────────────────

  async _quickMarketAnalysis(pair, side, amount) {
    const prompt = `
Analiza brevemente la oportunidad de trading:
- Par: ${pair}
- Acción: ${side}
- Cantidad: ${amount}
- Contexto: ecosistema BeZhas (BNB Chain + Polygon)

Evalúa: nivel de riesgo (LOW/MEDIUM/HIGH), condiciones de mercado actuales,
y si es un buen momento para este trade.
Sé breve (máx 3 frases). Responde en español.`;

    const text = await this.think(prompt, { maxTokens: 256 });

    // Simulación de métricas — en producción conectar al MCP Server
    return {
      summary:     text,
      riskLevel:   this._estimateRisk(pair, amount),
      priceImpact: Math.random() * 0.5, // % impacto estimado
      analyzedAt:  new Date().toISOString(),
    };
  }

  async _analyzeOpportunity(task) {
    const { pair, timeframe = '1h' } = task.payload;
    console.log(`[TradingAgent] 🔍 Analizando oportunidad: ${pair} (${timeframe})`);

    const prompt = `
Analiza la oportunidad de trading para ${pair} en el timeframe ${timeframe}.
Contexto: plataforma BeZhas DeFi en BNB Chain + Polygon.
Considera: tendencia, soportes/resistencias, y volumen.
Sé conciso. Responde en español.`;

    const analysis = await this.think(prompt, { maxTokens: 512 });

    await this.notify(
      `📊 *Análisis ${pair}* (${timeframe})\n${analysis.slice(0, 300)}`,
      { level: 'info' }
    );

    return { pair, timeframe, analysis, analyzedAt: new Date().toISOString() };
  }

  async _analyzePortfolio(task) {
    const memories = await this.recallAll();
    const tradeKeys = Object.keys(memories).filter(k => k.startsWith('trade:'));
    const trades = tradeKeys.map(k => memories[k]).filter(Boolean);

    return {
      totalTrades: this._tradesExecuted,
      recentTrades: this._tradeHistory.slice(-10),
      portfolioSize: trades.length,
      analyzedAt: new Date().toISOString(),
    };
  }

  async _runBacktest(task) {
    const { strategy, pair, fromDate, toDate } = task.payload;
    console.log(`[TradingAgent] 🧪 Backtest: ${strategy} en ${pair}`);
    // Placeholder — conectar con Python ML engine en Sprint 3
    return {
      strategy, pair, fromDate, toDate,
      note: 'Backtest pendiente de conexión con Python ML engine (Sprint 3)',
    };
  }

  // ─────────────────────────────────────────────
  // EJECUCIÓN REAL DEL TRADE
  // ─────────────────────────────────────────────

  async _executeTrade({ pair, side, amount, strategy }) {
    // TODO Sprint 3: Conectar con IBKR API y DEX on-chain
    // Por ahora retorna simulación para tests de integración

    const mockPrice   = 0.00234 + Math.random() * 0.0005;
    const mockFee     = (amount * mockPrice * 0.001).toFixed(6);

    console.log(`[TradingAgent] ⚡ Ejecutando ${side} ${amount} ${pair} @ ${mockPrice.toFixed(6)}`);

    return {
      status:        'simulated',  // cambiar a 'confirmed' cuando IBKR esté integrado
      pair,
      side,
      amount,
      executedPrice: mockPrice.toFixed(6),
      fee:           mockFee,
      txHash:        null,         // null hasta integración DEX
      strategy,
      executedAt:    new Date().toISOString(),
      note:          'Modo simulación — integración IBKR/DEX pendiente Sprint 3',
    };
  }

  // ─────────────────────────────────────────────
  // AEGIS CLEARANCE CHECK
  // ─────────────────────────────────────────────

  async _checkAegisClearance(pair) {
    // Verificar si hay alertas AEGIS activas que afecten este par
    const recentThreats = await this.recall('recent_aegis_threats') || [];
    const pairToken = pair.split('/')[0]; // 'BEZ' de 'BEZ/USDT'

    const relevantThreat = recentThreats.find(t =>
      t.threatType?.includes('PRICE_MANIPULATION') || t.severity >= 3
    );

    if (relevantThreat) {
      return { clear: false, reason: `Amenaza AEGIS activa: ${relevantThreat.threatType}` };
    }

    return { clear: true };
  }

  // ─────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────

  _estimateRisk(pair, amount) {
    if (amount > 10000) return 'HIGH';
    if (amount > 1000)  return 'MEDIUM';
    return 'LOW';
  }

  getStats() {
    return {
      ...super.getStats(),
      tradesExecuted: this._tradesExecuted,
      recentTrades:   this._tradeHistory.slice(-5),
    };
  }

  _systemPrompt() {
    return `Eres el Trading Agent de BeZhas — experto en trading algorítmico DeFi.
Operas en BNB Chain y Polygon con el token BEZ-Coin y 5 pares de trading.
Siempre priorizas la seguridad del capital. NUNCA recomiendas trades sin análisis previo.
Eres preciso, cuantitativo y conservador ante la incertidumbre.
Responde siempre en español.`;
  }
}

module.exports = TradingAgent;
