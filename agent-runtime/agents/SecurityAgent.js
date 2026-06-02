/**
 * BeZhas Agent Runtime — SecurityAgent
 * Procesa alertas de AEGIS, evalúa amenazas con LLM y solicita
 * aprobación humana (HITL) para acciones de mitigación críticas.
 */

'use strict';

const BaseAgent = require('../BaseAgent');

class SecurityAgent extends BaseAgent {
  constructor(opts = {}) {
    super({
      id:           'security-agent',
      name:         'AEGIS Security Agent',
      capabilities: ['aegis:alert', 'security:check', 'threat:response'],
      version:      '1.0.0',
      ...opts,
    });

    this._mitigationHistory = [];
  }

  // ─────────────────────────────────────────────
  // EXECUTE — punto de entrada desde AgentManager
  // ─────────────────────────────────────────────

  async execute(task) {
    switch (task.type) {
      case 'aegis:alert':
        return this._handleAegisAlert(task);
      case 'security:check':
        return this._runSecurityCheck(task);
      default:
        throw new Error(`SecurityAgent no soporta tipo: ${task.type}`);
    }
  }

  // ─────────────────────────────────────────────
  // HANDLER PRINCIPAL — alerta AEGIS
  // ─────────────────────────────────────────────

  async _handleAegisAlert(task) {
    const threat = task.payload;
    console.log(`[SecurityAgent] 🚨 Procesando amenaza [${threat.severityLabel}]: ${threat.threatType}`);

    // 1. Análisis LLM para contexto y recomendación
    const analysis = await this._analyzeThreatWithLLM(threat);

    // 2. Notificar al canal (Telegram) con el análisis
    await this.notify(
      `🛡️ *AEGIS Alert* — ${threat.severityLabel}\n` +
      `Tipo: \`${threat.threatType}\`\n` +
      `Target: \`${threat.target}\`\n` +
      `ML Score: ${(threat.mlScore * 100).toFixed(1)}%\n` +
      `Recomendación: *${threat.recommended}*\n\n` +
      `📊 Análisis:\n${analysis.summary}`,
      { level: threat.severity >= 2 ? 'critical' : 'warning' }
    );

    // 3. Decisión basada en severidad + score ML
    let mitigationResult = null;

    if (threat.recommended === 'BLOCK_IMMEDIATELY') {
      // Acción automática — bloqueo sin HITL (sólo si score > 0.95)
      if (threat.mlScore > 0.95) {
        mitigationResult = await this._executeAutoBlock(task.id, threat);
      } else {
        // HITL requerido
        mitigationResult = await this._requestMitigationApproval(task.id, threat, analysis);
      }
    } else if (threat.recommended === 'REQUIRE_APPROVAL') {
      mitigationResult = await this._requestMitigationApproval(task.id, threat, analysis);
    } else {
      // FLAG_FOR_REVIEW o MONITOR_ONLY — sólo registrar
      mitigationResult = { action: 'monitored', auto: true };
    }

    // 4. Persistir en memoria del agente
    await this.remember(`threat:${threat.id}`, {
      threat,
      analysis,
      mitigation: mitigationResult,
      processedAt: new Date().toISOString(),
    });

    // 5. Reportar resultado on-chain si hay signer disponible
    if (this.blockchain?.signer && mitigationResult.action !== 'monitored') {
      try {
        await this.blockchain.submitAegisReport(threat.id, {
          verdict:    threat.mlVerdict,
          action:     mitigationResult.action,
          processedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('[SecurityAgent] ⚠️  No se pudo reportar on-chain:', err.message);
      }
    }

    this._mitigationHistory.push({ threat, mitigation: mitigationResult });

    return { threat, analysis, mitigation: mitigationResult };
  }

  // ─────────────────────────────────────────────
  // ANÁLISIS LLM
  // ─────────────────────────────────────────────

  async _analyzeThreatWithLLM(threat) {
    const prompt = `
Analiza la siguiente amenaza de seguridad blockchain detectada por AEGIS:

TIPO: ${threat.threatType}
SEVERIDAD: ${threat.severityLabel} (${threat.severity}/3)
TARGET: ${threat.target}
ML SCORE: ${(threat.mlScore * 100).toFixed(1)}%
RECOMENDACIÓN ML: ${threat.recommended}
FUENTE: ${threat.source}

Proporciona:
1. Un resumen breve (2-3 frases) explicando qué significa esta amenaza
2. El impacto potencial en el ecosistema BeZhas
3. Las acciones de mitigación recomendadas
4. Nivel de urgencia (INMEDIATO / PRÓXIMAS 4H / MONITOREAR)

Responde en español. Sé conciso y técnico.`;

    const text = await this.think(prompt, { maxTokens: 512 });

    // Parsear respuesta básica
    return {
      summary: text.slice(0, 500),
      rawAnalysis: text,
      analyzedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────
  // MITIGACIÓN
  // ─────────────────────────────────────────────

  async _executeAutoBlock(taskId, threat) {
    console.log(`[SecurityAgent] 🔴 AUTO-BLOCK para amenaza ${threat.id} (score: ${threat.mlScore})`);
    await this.notify(
      `🔴 *AUTO-BLOCK ejecutado*\nAmenaza ID: \`${threat.id}\`\nScore: ${(threat.mlScore * 100).toFixed(1)}% (umbral automático >95%)`,
      { level: 'critical' }
    );
    return { action: 'auto-blocked', taskId, auto: true };
  }

  async _requestMitigationApproval(taskId, threat, analysis) {
    try {
      const { approved, response } = await this.requireApproval(taskId, {
        type:        'security:mitigation',
        title:       `🛡️ Mitigación requerida — ${threat.threatType}`,
        description: analysis.summary,
        threat,
        options:     ['BLOQUEAR', 'MONITOREAR', 'IGNORAR'],
        urgent:      threat.severity >= 2,
      });

      if (approved) {
        console.log(`[SecurityAgent] ✅ Mitigación aprobada para ${threat.id}: ${response}`);
        return { action: 'approved-mitigation', response, taskId };
      } else {
        console.log(`[SecurityAgent] ⏭️  Mitigación rechazada para ${threat.id}`);
        return { action: 'rejected', response, taskId };
      }
    } catch (err) {
      // Timeout HITL — acción conservadora
      console.warn(`[SecurityAgent] ⏱️  HITL timeout para ${threat.id} — acción conservadora`);
      return { action: 'timeout-monitor', taskId };
    }
  }

  // ─────────────────────────────────────────────
  // HANDLERTHREAT (llamado directo desde AegisConnector)
  // ─────────────────────────────────────────────

  async handleThreat(threat) {
    // Wrapper para llamada directa (sin pasar por TaskQueue)
    return this._handleAegisAlert({
      id:      `direct_${Date.now()}`,
      type:    'aegis:alert',
      payload: threat,
      priority: threat.severity >= 2 ? 'critical' : 'high',
      source:  'aegis-connector',
    });
  }

  // ─────────────────────────────────────────────
  // SECURITY CHECK
  // ─────────────────────────────────────────────

  async _runSecurityCheck(task) {
    const { address, checkType } = task.payload;
    console.log(`[SecurityAgent] 🔍 Security check: ${checkType} para ${address}`);

    const history = await this.recall(`threat:history:${address}`) || [];
    const hasHistory = history.length > 0;

    await this.notify(
      `🔍 Security Check: \`${checkType}\`\nAddress: \`${address}\`\n${hasHistory ? '⚠️ Historial de amenazas previas detectado' : '✅ Sin historial previo'}`,
      { level: hasHistory ? 'warning' : 'info' }
    );

    return { address, checkType, hasHistory, history: history.slice(0, 5) };
  }

  // ─────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────

  getStats() {
    return {
      ...super.getStats(),
      mitigationsHandled: this._mitigationHistory.length,
      autoBlocked: this._mitigationHistory.filter(m => m.mitigation.action === 'auto-blocked').length,
    };
  }

  _systemPrompt() {
    return `Eres el AEGIS Security Agent de BeZhas Blockchain — experto en seguridad DeFi y blockchain.
Tu función es analizar amenazas detectadas on-chain (reentrancy, flash loans, manipulación de oráculos, sandwich attacks) 
y proporcionar análisis claros y accionables en español.
Siempre priorizas la seguridad del ecosistema BeZhas y los fondos de los usuarios.
Eres preciso, técnico y nunca alarmista innecesariamente.`;
  }
}

module.exports = SecurityAgent;
