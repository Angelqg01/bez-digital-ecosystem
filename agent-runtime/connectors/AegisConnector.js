/**
 * BeZhas Agent Runtime — AegisConnector
 * Runtime off-chain de AEGIS: procesa alertas de seguridad on-chain
 * y ejecuta análisis ML sobre transacciones sospechosas.
 *
 * Consume: AegisSecurityProvider.sol (on-chain)
 * Produce: eventos para SecurityAgent → OpenClaw → Telegram
 */

'use strict';

const EventEmitter = require('events');

// Niveles de severidad (espejo del enum del contrato)
const SEVERITY = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const SEVERITY_LABELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

class AegisConnector extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      rpcUrl:           config.rpcUrl || process.env.RPC_URL || 'http://localhost:8545',
      aegisAddress:     config.aegisAddress || config.aegisProviderAddress || process.env.AEGIS_PROVIDER_ADDRESS,
      pollIntervalMs:   config.pollIntervalMs || 10_000,    // 10s polling
      anomalyThreshold: config.anomalyThreshold || 0.75,    // umbral ML
      ...config,
    };

    this._running     = false;
    this._pollTimer   = null;
    this._lastBlock   = 0;

    // Historial de alertas en memoria (complementado con Redis via MemoryManager)
    this._alertHistory = [];
    this._maxHistory   = 500;
  }

  // ─────────────────────────────────────────────
  // CICLO DE VIDA
  // ─────────────────────────────────────────────

  async start() {
    if (this._running) return;
    this._running = true;
    console.log('[AegisConnector] 🛡️  AEGIS runtime iniciado');

    // Primer bloque de referencia
    try {
      this._lastBlock = await this._getLatestBlock();
    } catch {
      this._lastBlock = 0;
    }

    this._pollTimer = setInterval(() => this._poll(), this.config.pollIntervalMs);
    this.emit('started');
  }

  async stop() {
    if (!this._running) return;
    clearInterval(this._pollTimer);
    this._running = false;
    console.log('[AegisConnector] 🛑 AEGIS runtime detenido');
    this.emit('stopped');
  }

  // ─────────────────────────────────────────────
  // POLLING DE EVENTOS (HTTP JSON-RPC)
  // ─────────────────────────────────────────────

  async _poll() {
    try {
      const latestBlock = await this._getLatestBlock();
      if (latestBlock <= this._lastBlock) return;

      const events = await this._fetchAegisEvents(this._lastBlock + 1, latestBlock);
      this._lastBlock = latestBlock;

      for (const event of events) {
        await this._processEvent(event);
      }
    } catch (err) {
      console.error('[AegisConnector] ❌ Error en polling:', err.message);
    }
  }

  async _processEvent(event) {
    const { type, data } = event;

    switch (type) {
      case 'ThreatDetected': {
        const alert = {
          id:         data.threatId,
          target:     data.target,
          severity:   Number(data.severity),
          severityLabel: SEVERITY_LABELS[Number(data.severity)] || 'UNKNOWN',
          threatType: data.threatType,
          timestamp:  new Date().toISOString(),
          source:     'on-chain',
        };

        this._addToHistory(alert);

        // Análisis ML local
        const analysis = await this._analyzeLocally(alert);
        alert.mlScore     = analysis.score;
        alert.mlVerdict   = analysis.verdict;
        alert.recommended = analysis.recommendation;

        console.log(`[AegisConnector] 🚨 Amenaza [${alert.severityLabel}]: ${alert.threatType} → score: ${alert.mlScore.toFixed(2)}`);

        // Emitir para que SecurityAgent lo procese
        this.emit('threat:detected', alert);

        // Si es CRITICAL, emitir también como emergencia
        if (alert.severity >= SEVERITY.CRITICAL) {
          this.emit('threat:critical', alert);
        }
        break;
      }

      case 'SecurityCheckFailed': {
        const failure = {
          checkId: data.checkId,
          subject: data.subject,
          reason:  data.reason,
          timestamp: new Date().toISOString(),
        };
        console.log(`[AegisConnector] ⚠️  Security check fallido: ${failure.subject} — ${failure.reason}`);
        this.emit('security:check:failed', failure);
        break;
      }

      default:
        break;
    }
  }

  // ─────────────────────────────────────────────
  // ANÁLISIS ML LOCAL (sin red neuronal real aquí,
  // listo para conectar con modelos Python/GGUF)
  // ─────────────────────────────────────────────

  async _analyzeLocally(alert) {
    // Lógica heurística base — en producción reemplazar con
    // llamada a Python ML service (XGBoost/LightGBM del ai-engine)
    let score = alert.severity * 0.25; // base por severidad

    // Bonus por tipo de amenaza conocido
    const highRiskTypes = ['REENTRANCY', 'FLASH_LOAN', 'ORACLE_MANIPULATION', 'SANDWICH_ATTACK'];
    if (highRiskTypes.includes(alert.threatType?.toUpperCase())) {
      score = Math.min(1, score + 0.35);
    }

    // Ruido aleatorio mínimo para simulación
    score = Math.min(1, score + (Math.random() * 0.1));

    const verdict = score >= this.config.anomalyThreshold
      ? 'ANOMALY_CONFIRMED'
      : 'WITHIN_NORMAL';

    const recommendation =
      score >= 0.9   ? 'BLOCK_IMMEDIATELY'   :
      score >= 0.75  ? 'REQUIRE_APPROVAL'     :
      score >= 0.5   ? 'FLAG_FOR_REVIEW'      :
                       'MONITOR_ONLY';

    return { score, verdict, recommendation };
  }

  // ─────────────────────────────────────────────
  // FETCH EVENTOS (JSON-RPC getLogs)
  // ─────────────────────────────────────────────

  async _fetchAegisEvents(fromBlock, toBlock) {
    if (!this.config.aegisAddress) return [];

    // Keccak256 de las firmas de eventos
    const THREAT_TOPIC    = '0x' + this._keccak('ThreatDetected(bytes32,address,uint8,string)');
    const SEC_FAIL_TOPIC  = '0x' + this._keccak('SecurityCheckFailed(bytes32,address,string)');

    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getLogs',
      params: [{
        address:   this.config.aegisAddress,
        fromBlock: `0x${fromBlock.toString(16)}`,
        toBlock:   `0x${toBlock.toString(16)}`,
        topics:    [[THREAT_TOPIC, SEC_FAIL_TOPIC]],
      }],
    };

    try {
      const res = await fetch(this.config.rpcUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(5000),
      });
      const { result = [] } = await res.json();

      // Parsear logs a objetos legibles
      return result.map(log => this._parseLog(log, THREAT_TOPIC));
    } catch (err) {
      console.error('[AegisConnector] ❌ Error getLogs:', err.message);
      return [];
    }
  }

  _parseLog(log, threatTopic) {
    const isThreat = log.topics[0]?.toLowerCase() === threatTopic.toLowerCase();
    return {
      type: isThreat ? 'ThreatDetected' : 'SecurityCheckFailed',
      data: {
        threatId:   log.topics[1] || log.topics[0],
        target:     '0x' + (log.topics[2] || '').slice(-40),
        severity:   parseInt(log.topics[3] || '0', 16),
        threatType: this._decodeString(log.data),
      },
      blockNumber: parseInt(log.blockNumber, 16),
      txHash: log.transactionHash,
    };
  }

  // ─────────────────────────────────────────────
  // HISTORIAL DE ALERTAS
  // ─────────────────────────────────────────────

  _addToHistory(alert) {
    this._alertHistory.unshift(alert);
    if (this._alertHistory.length > this._maxHistory) {
      this._alertHistory = this._alertHistory.slice(0, this._maxHistory);
    }
  }

  getAlertHistory(limit = 50) {
    return this._alertHistory.slice(0, limit);
  }

  getStats() {
    const total    = this._alertHistory.length;
    const critical = this._alertHistory.filter(a => a.severity >= SEVERITY.CRITICAL).length;
    const high     = this._alertHistory.filter(a => a.severity === SEVERITY.HIGH).length;
    return { total, critical, high, lastBlock: this._lastBlock };
  }

  // ─────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────

  async _getLatestBlock() {
    const res = await fetch(this.config.rpcUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      signal:  AbortSignal.timeout(3000),
    });
    const { result } = await res.json();
    return parseInt(result, 16);
  }

  _decodeString(hexData) {
    // Decodificación básica de string ABI-encoded
    try {
      if (!hexData || hexData === '0x') return 'UNKNOWN';
      const clean = hexData.startsWith('0x') ? hexData.slice(2) : hexData;
      const offset = parseInt(clean.slice(0, 64), 16) * 2;
      const length = parseInt(clean.slice(offset, offset + 64), 16) * 2;
      const strHex = clean.slice(offset + 64, offset + 64 + length);
      return Buffer.from(strHex, 'hex').toString('utf8');
    } catch {
      return 'UNKNOWN';
    }
  }

  _keccak(signature) {
    // Placeholder — en producción usar ethers.id() del BlockchainConnector
    // Aquí retornamos hashes conocidos para los eventos principales
    const hashes = {
      'ThreatDetected(bytes32,address,uint8,string)':   'a3d78a3e4b3d...placeholder',
      'SecurityCheckFailed(bytes32,address,string)':    'b4e89f5c6a7b...placeholder',
    };
    return hashes[signature] || '0000000000000000000000000000000000000000000000000000000000000000';
  }

  async healthCheck() {
    const stats = this.getStats();
    return {
      status:    this._running ? 'running' : 'stopped',
      lastBlock: this._lastBlock,
      alerts:    stats,
    };
  }
}

module.exports = AegisConnector;
