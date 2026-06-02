// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title AegisSecurityProvider
 * @dev Contrato on-chain que actúa como puente entre el motor Aegis AI (off-chain)
 * y la infraestructura L2 (SlashingManager, SequencerRotation, Bridge).
 *
 * Modelo de operación:
 *   1. El Oracle de Aegis detecta amenazas (off-chain ML models)
 *   2. Publica señales de riesgo on-chain via triggerRiskSignal()
 *   3. Los contratos autorizados (OpenClawAgent) consumen las señales
 *   4. Acciones automáticas: pausa de sequencer, slash de validador, pausa de bridge
 *
 * Niveles de riesgo:
 *   - LOW (1):      Solo log, sin acción automática
 *   - MEDIUM (2):   Alerta + reducción de límites operativos
 *   - HIGH (3):     Pausa de componente afectado
 *   - CRITICAL (4): Pausa global de emergencia
 */
contract AegisSecurityProvider is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    // ─── Tipos ───────────────────────────────────────────────────────
    enum RiskLevel { NONE, LOW, MEDIUM, HIGH, CRITICAL }

    struct RiskSignal {
        string  signalType;     // e.g. "High_Slippage_Detected", "Double_Signing"
        RiskLevel level;
        uint256 timestamp;
        address reportedBy;
        bool    consumed;       // true once an agent has processed it
        bytes   metadata;       // Arbitrary data for the consumer
    }

    // ─── Storage ─────────────────────────────────────────────────────
    RiskSignal[] public riskSignals;
    uint256 public unconsumedCount;

    // Global emergency state
    bool public globalEmergency;

    // Per-component pause (component hash → paused)
    mapping(bytes32 => bool) public componentPaused;

    // ─── Eventos ─────────────────────────────────────────────────────
    event RiskSignalTriggered(
        uint256 indexed signalId,
        string  signalType,
        RiskLevel level,
        address indexed reportedBy
    );
    event RiskSignalConsumed(uint256 indexed signalId, address indexed consumer);
    event GlobalEmergencySet(bool active, address indexed by);
    event ComponentPauseSet(bytes32 indexed component, bool paused, address indexed by);

    constructor(address defaultAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ORACLE_ROLE, defaultAdmin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ORACLE: Publicar señales de riesgo
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @dev Publica una señal de riesgo con nivel por defecto HIGH.
     */
    function triggerRiskSignal(string calldata signalType) external onlyRole(ORACLE_ROLE) {
        _createSignal(signalType, RiskLevel.HIGH, "");
    }

    /**
     * @dev Publica una señal de riesgo con nivel y metadata específicos.
     */
    function triggerRiskSignalWithLevel(
        string calldata signalType,
        RiskLevel level,
        bytes calldata metadata
    ) external onlyRole(ORACLE_ROLE) {
        require(level != RiskLevel.NONE, "AEGIS: invalid level");
        _createSignal(signalType, level, metadata);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CONSUMER: Agentes IA consumen señales
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @dev Marca una señal como consumida. Solo CONSUMER_ROLE (OpenClawAgent).
     */
    function consumeSignal(uint256 signalId) external onlyRole(CONSUMER_ROLE) {
        require(signalId < riskSignals.length, "AEGIS: invalid signal");
        RiskSignal storage signal = riskSignals[signalId];
        require(!signal.consumed, "AEGIS: already consumed");

        signal.consumed = true;
        unconsumedCount--;

        emit RiskSignalConsumed(signalId, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  EMERGENCY: Pausas globales y por componente
    // ═══════════════════════════════════════════════════════════════════

    function setGlobalEmergency(bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalEmergency = active;
        emit GlobalEmergencySet(active, msg.sender);
    }

    function setComponentPause(bytes32 component, bool paused) external onlyRole(CONSUMER_ROLE) {
        componentPaused[component] = paused;
        emit ComponentPauseSet(component, paused, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISTAS
    // ═══════════════════════════════════════════════════════════════════

    function getSignalCount() external view returns (uint256) {
        return riskSignals.length;
    }

    function getSignal(uint256 signalId) external view returns (
        string memory signalType,
        RiskLevel level,
        uint256 timestamp,
        address reportedBy,
        bool consumed
    ) {
        RiskSignal storage s = riskSignals[signalId];
        return (s.signalType, s.level, s.timestamp, s.reportedBy, s.consumed);
    }

    function getLatestUnconsumedSignal() external view returns (uint256 signalId, bool found) {
        for (uint256 i = riskSignals.length; i > 0; i--) {
            if (!riskSignals[i - 1].consumed) {
                return (i - 1, true);
            }
        }
        return (0, false);
    }

    function isComponentPaused(string calldata component) external view returns (bool) {
        return componentPaused[keccak256(bytes(component))];
    }

    // ─── Internal ────────────────────────────────────────────────────

    function _createSignal(
        string calldata signalType,
        RiskLevel level,
        bytes memory metadata
    ) internal {
        uint256 signalId = riskSignals.length;
        riskSignals.push(RiskSignal({
            signalType: signalType,
            level: level,
            timestamp: block.timestamp,
            reportedBy: msg.sender,
            consumed: false,
            metadata: metadata
        }));
        unconsumedCount++;

        emit RiskSignalTriggered(signalId, signalType, level, msg.sender);

        // Auto-escalate CRITICAL to global emergency
        if (level == RiskLevel.CRITICAL) {
            globalEmergency = true;
            emit GlobalEmergencySet(true, msg.sender);
        }
    }
}
