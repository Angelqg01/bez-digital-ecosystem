/**
 * BeZhas Agent Runtime — BlockchainConnector
 * Escucha eventos on-chain emitidos por:
 *   - OpenClawAgent.sol      (agent tasks, workflow triggers)
 *   - AegisSecurityProvider.sol (security alerts)
 *   - BeZhasWorkflowRegistry.sol (workflow events)
 *
 * Conecta con Ollama local (localhost:11434) como fallback LLM
 * durante el modo Opción 1 de desarrollo.
 *
 * NOTA: Requiere que el nodo local (op-geth) esté corriendo.
 * En desarrollo: Ollama arranca manualmente antes que este proceso.
 * En producción (futuro): migrar a Docker Compose Opción 3.
 */

'use strict';

const EventEmitter = require('events');
const { ethers } = require('ethers');

// ABIs mínimas — sólo los eventos que nos interesan
const OPENCLAW_AGENT_ABI = [
  'event AgentTaskRequested(bytes32 indexed taskId, string taskType, bytes payload)',
  'event AgentTaskCompleted(bytes32 indexed taskId, bool success, bytes result)',
  'event AegisAlertRaised(bytes32 indexed alertId, uint8 severity, string alertType, bytes data)',
  'event WorkflowTriggered(bytes32 indexed workflowId, address indexed initiator, bytes params)',
  'function executeAgentTask(bytes32 taskId, bytes calldata result) external',
  'function reportAegisAlert(bytes32 alertId, uint8 severity, bytes calldata report) external',
];

const AEGIS_PROVIDER_ABI = [
  'event ThreatDetected(bytes32 indexed threatId, address indexed target, uint8 severity, string threatType)',
  'event SecurityCheckPassed(bytes32 indexed checkId, address indexed subject)',
  'event SecurityCheckFailed(bytes32 indexed checkId, address indexed subject, string reason)',
  'function submitThreatReport(bytes32 threatId, bytes calldata reportData) external',
];

const WORKFLOW_REGISTRY_ABI = [
  'event WorkflowRegistered(bytes32 indexed workflowId, string name, address owner)',
  'event WorkflowExecuted(bytes32 indexed workflowId, bool success)',
];

class BlockchainConnector extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      rpcUrl:                   config.rpcUrl || process.env.RPC_URL || 'http://localhost:8545',
      wsUrl:                    config.wsUrl  || process.env.WS_URL  || 'ws://localhost:8546',
      openClawAgentAddress:     config.openClawAgentAddress     || process.env.OPENCLAW_AGENT_ADDRESS,
      aegisProviderAddress:     config.aegisProviderAddress     || process.env.AEGIS_PROVIDER_ADDRESS,
      workflowRegistryAddress:  config.workflowRegistryAddress  || process.env.WORKFLOW_REGISTRY_ADDRESS,
      privateKey:               config.privateKey               || process.env.AGENT_PRIVATE_KEY,
      reconnectIntervalMs:      config.reconnectIntervalMs      || 5_000,
      ...config,
    };

    this.provider   = null;
    this.signer     = null;
    this._contracts = {};
    this._connected = false;
    this._listeners = [];
  }

  // ─────────────────────────────────────────────
  // CONEXIÓN
  // ─────────────────────────────────────────────

  async connect() {
    if (!this._hasConfiguredContracts()) {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      this._connected = true;
      console.log('[BlockchainConnector] 🔗 Sin contratos configurados; conector blockchain en modo idle');
      return;
    }

    try {
      // Intentar WebSocket primero (necesario para eventos en tiempo real)
      this.provider = new ethers.WebSocketProvider(this.config.wsUrl);
      this._attachProviderErrorHandlers();
      console.log('[BlockchainConnector] 🔗 Conectado via WebSocket:', this.config.wsUrl);
    } catch {
      // Fallback a HTTP (polling)
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      console.warn('[BlockchainConnector] ⚠️  WebSocket no disponible, usando HTTP polling');
    }

    // Signer para firmar transacciones (callback al contrato)
    if (this.config.privateKey) {
      this.signer = new ethers.Wallet(this.config.privateKey, this.provider);
      console.log('[BlockchainConnector] 🔑 Signer activo:', this.signer.address);
    }

    // Inicializar contratos
    this._initContracts();

    // Suscribir a eventos
    this._subscribeEvents();

    this._connected = true;

    // Manejar desconexiones del WebSocket
  }

  async disconnect() {
    // Eliminar listeners
    for (const { contract, event, handler } of this._listeners) {
      contract.off(event, handler);
    }
    this._listeners = [];

    if (this.provider?.destroy) await this.provider.destroy();
    this._connected = false;
    console.log('[BlockchainConnector] 🔌 Desconectado');
  }

  // ─────────────────────────────────────────────
  // INICIALIZACIÓN DE CONTRATOS
  // ─────────────────────────────────────────────

  _initContracts() {
    const signerOrProvider = this.signer || this.provider;

    if (this.config.openClawAgentAddress) {
      this._contracts.openClawAgent = new ethers.Contract(
        this.config.openClawAgentAddress,
        OPENCLAW_AGENT_ABI,
        signerOrProvider
      );
      console.log('[BlockchainConnector] 📄 OpenClawAgent.sol:', this.config.openClawAgentAddress);
    }

    if (this.config.aegisProviderAddress) {
      this._contracts.aegisProvider = new ethers.Contract(
        this.config.aegisProviderAddress,
        AEGIS_PROVIDER_ABI,
        signerOrProvider
      );
      console.log('[BlockchainConnector] 🛡️  AegisSecurityProvider.sol:', this.config.aegisProviderAddress);
    }

    if (this.config.workflowRegistryAddress) {
      this._contracts.workflowRegistry = new ethers.Contract(
        this.config.workflowRegistryAddress,
        WORKFLOW_REGISTRY_ABI,
        signerOrProvider
      );
      console.log('[BlockchainConnector] 📋 WorkflowRegistry.sol:', this.config.workflowRegistryAddress);
    }
  }

  // ─────────────────────────────────────────────
  // SUSCRIPCIÓN A EVENTOS ON-CHAIN
  // ─────────────────────────────────────────────

  _subscribeEvents() {
    const { openClawAgent, aegisProvider, workflowRegistry } = this._contracts;

    // ── OpenClawAgent.sol ──────────────────────
    if (openClawAgent) {
      this._on(openClawAgent, 'AgentTaskRequested', (taskId, taskType, payload, event) => {
        console.log('[BlockchainConnector] ⛓️  AgentTaskRequested:', taskId);
        this.emit('AgentTaskRequested', {
          taskId: taskId.toString(),
          taskType,
          payload: ethers.toUtf8String(payload),
          blockNumber: event.log.blockNumber,
          txHash: event.log.transactionHash,
        });
      });

      this._on(openClawAgent, 'AegisAlertRaised', (alertId, severity, alertType, data, event) => {
        console.log('[BlockchainConnector] 🚨 AegisAlertRaised — severidad:', severity);
        this.emit('AegisAlertRaised', {
          alertId: alertId.toString(),
          severity: Number(severity),
          alertType,
          data: ethers.toUtf8String(data),
          txHash: event.log.transactionHash,
        });
      });

      this._on(openClawAgent, 'WorkflowTriggered', (workflowId, initiator, params, event) => {
        console.log('[BlockchainConnector] 🔄 WorkflowTriggered:', workflowId);
        this.emit('WorkflowTriggered', {
          workflowId: workflowId.toString(),
          initiator,
          params: ethers.toUtf8String(params),
          txHash: event.log.transactionHash,
        });
      });
    }

    // ── AegisSecurityProvider.sol ──────────────
    if (aegisProvider) {
      this._on(aegisProvider, 'ThreatDetected', (threatId, target, severity, threatType, event) => {
        console.log('[BlockchainConnector] 🔴 ThreatDetected on-chain:', threatType);
        this.emit('ThreatDetected', {
          threatId: threatId.toString(),
          target,
          severity: Number(severity),
          threatType,
          txHash: event.log.transactionHash,
        });
      });

      this._on(aegisProvider, 'SecurityCheckFailed', (checkId, subject, reason) => {
        console.log('[BlockchainConnector] ⚠️  SecurityCheckFailed:', subject);
        this.emit('SecurityCheckFailed', { checkId: checkId.toString(), subject, reason });
      });
    }

    // ── WorkflowRegistry.sol ──────────────────
    if (workflowRegistry) {
      this._on(workflowRegistry, 'WorkflowExecuted', (workflowId, success) => {
        this.emit('WorkflowExecuted', {
          workflowId: workflowId.toString(),
          success,
        });
      });
    }

    console.log('[BlockchainConnector] 👂 Escuchando eventos on-chain...');
  }

  _on(contract, event, handler) {
    contract.on(event, handler);
    this._listeners.push({ contract, event, handler });
  }

  _hasConfiguredContracts() {
    return Boolean(
      this.config.openClawAgentAddress ||
      this.config.aegisProviderAddress ||
      this.config.workflowRegistryAddress
    );
  }

  _attachProviderErrorHandlers() {
    const sockets = [
      this.provider?.websocket,
      this.provider?._websocket,
      this.provider?._socket,
    ].filter(Boolean);

    for (const socket of sockets) {
      if (typeof socket.on !== 'function') continue;
      socket.on('error', (err) => {
        console.warn('[BlockchainConnector] WebSocket error:', err.message);
      });
      socket.on('close', () => {
        if (!this._connected) return;
        console.warn('[BlockchainConnector] 🔴 WebSocket cerrado. Reconectando...');
        this._connected = false;
        setTimeout(() => this.connect(), this.config.reconnectIntervalMs).unref?.();
      });
    }

    if (typeof this.provider?.on === 'function') {
      try {
        this.provider.on('error', (err) => {
          console.warn('[BlockchainConnector] Provider error:', err.message);
        });
      } catch {
        // Some ethers providers do not expose generic error events.
      }
    }
  }

  // ─────────────────────────────────────────────
  // TRANSACCIONES — RESPUESTA AL CONTRATO
  // ─────────────────────────────────────────────

  /** Reporta el resultado de una tarea al contrato OpenClawAgent.sol */
  async submitTaskResult(taskId, resultBytes) {
    this._requireSigner();
    const { openClawAgent } = this._contracts;
    const tx = await openClawAgent.executeAgentTask(
      ethers.id(taskId),
      ethers.toUtf8Bytes(JSON.stringify(resultBytes))
    );
    const receipt = await tx.wait();
    console.log('[BlockchainConnector] ✅ Resultado enviado on-chain. TX:', receipt.hash);
    return receipt;
  }

  /** Reporta una amenaza AEGIS al contrato */
  async submitAegisReport(alertId, reportData) {
    this._requireSigner();
    const { aegisProvider } = this._contracts;
    const tx = await aegisProvider.submitThreatReport(
      ethers.id(alertId),
      ethers.toUtf8Bytes(JSON.stringify(reportData))
    );
    const receipt = await tx.wait();
    console.log('[BlockchainConnector] 🛡️  Reporte AEGIS enviado. TX:', receipt.hash);
    return receipt;
  }

  // ─────────────────────────────────────────────
  // UTILIDADES
  // ─────────────────────────────────────────────

  async getBlockNumber() {
    return this.provider.getBlockNumber();
  }

  async getBalance(address) {
    const bal = await this.provider.getBalance(address);
    return ethers.formatEther(bal);
  }

  get isConnected() { return this._connected; }

  _requireSigner() {
    if (!this.signer) throw new Error('Se requiere privateKey para firmar transacciones');
  }

  async healthCheck() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      return { status: 'ok', blockNumber, connected: this._connected };
    } catch (err) {
      return { status: 'error', error: err.message, connected: false };
    }
  }
}

module.exports = BlockchainConnector;
