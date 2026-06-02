// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title L2Sequencer
 * @dev Wrapper on-chain que registra el estado operativo del sequencer L2.
 * Permite que el Agente IA (OpenClawAgent) pause/reanude la producción de bloques
 * como respuesta a señales de seguridad de Aegis.
 *
 * En producción, este contrato se despliega como pre-deploy en la L2 y su estado
 * es consultado por op-node/op-geth para determinar si debe producir bloques.
 *
 * Integración:
 *   - OpenClawAgent llama a pauseByAI() cuando detecta riesgo HIGH/CRITICAL
 *   - RotationManager puede forzar la reanudación si la pausa se extiende demasiado
 *   - Emite eventos para que el off-chain monitor actúe en consecuencia
 */
contract L2Sequencer is AccessControl {
    bytes32 public constant AI_OPERATOR_ROLE = keccak256("AI_OPERATOR_ROLE");
    bytes32 public constant ROTATION_MANAGER_ROLE = keccak256("ROTATION_MANAGER_ROLE");

    // ─── Estado ──────────────────────────────────────────────────────
    bool public isPausedByAI;
    uint256 public lastPauseTimestamp;
    uint256 public lastResumeTimestamp;
    string public pauseReason;

    uint256 public totalPauses;
    uint256 public totalPauseDuration;

    // Auto-resume after 1 hour if AI doesn't resume manually
    uint256 public constant MAX_PAUSE_DURATION = 1 hours;

    // ─── Eventos ─────────────────────────────────────────────────────
    event SequencerPausedByAI(address indexed operator, string reason, uint256 timestamp);
    event SequencerResumedByAI(address indexed operator, uint256 pauseDuration);
    event SequencerAutoResumed(uint256 pauseDuration);
    event AIExecutionConfirmed(address indexed agent, string action, uint256 signalId);

    constructor(address defaultAdmin) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CONTROL DE PAUSA
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @dev Pausa el sequencer. Solo AI_OPERATOR_ROLE (OpenClawAgent).
     */
    function pauseByAI(string calldata reason) external onlyRole(AI_OPERATOR_ROLE) {
        require(!isPausedByAI, "SEQ: already paused");

        isPausedByAI = true;
        lastPauseTimestamp = block.timestamp;
        pauseReason = reason;
        totalPauses++;

        emit SequencerPausedByAI(msg.sender, reason, block.timestamp);
    }

    /**
     * @dev Reanuda el sequencer. AI_OPERATOR_ROLE o ROTATION_MANAGER_ROLE.
     */
    function resumeByAI() external {
        require(
            hasRole(AI_OPERATOR_ROLE, msg.sender) || hasRole(ROTATION_MANAGER_ROLE, msg.sender),
            "SEQ: not authorized"
        );
        _resume();
    }

    /**
     * @dev Auto-resume si la pausa excede MAX_PAUSE_DURATION. Cualquiera puede llamar.
     */
    function autoResume() external {
        require(isPausedByAI, "SEQ: not paused");
        require(
            block.timestamp >= lastPauseTimestamp + MAX_PAUSE_DURATION,
            "SEQ: max pause not reached"
        );

        uint256 duration = block.timestamp - lastPauseTimestamp;
        isPausedByAI = false;
        lastResumeTimestamp = block.timestamp;
        totalPauseDuration += duration;
        pauseReason = "";

        emit SequencerAutoResumed(duration);
    }

    /**
     * @dev Emite confirmación de ejecución IA. Llamado por OpenClawAgent
     *      para registrar que una acción de seguridad fue ejecutada con éxito.
     */
    function confirmAIExecution(
        address agent,
        string calldata action,
        uint256 signalId
    ) external onlyRole(AI_OPERATOR_ROLE) {
        emit AIExecutionConfirmed(agent, action, signalId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISTAS
    // ═══════════════════════════════════════════════════════════════════

    function getStatus() external view returns (
        bool paused,
        string memory reason,
        uint256 pausedSince,
        uint256 pauseCount,
        uint256 cumulativePauseDuration
    ) {
        return (isPausedByAI, pauseReason, lastPauseTimestamp, totalPauses, totalPauseDuration);
    }

    function pauseTimeRemaining() external view returns (uint256) {
        if (!isPausedByAI) return 0;
        uint256 elapsed = block.timestamp - lastPauseTimestamp;
        if (elapsed >= MAX_PAUSE_DURATION) return 0;
        return MAX_PAUSE_DURATION - elapsed;
    }

    // ─── Internal ────────────────────────────────────────────────────

    function _resume() internal {
        require(isPausedByAI, "SEQ: not paused");

        uint256 duration = block.timestamp - lastPauseTimestamp;
        isPausedByAI = false;
        lastResumeTimestamp = block.timestamp;
        totalPauseDuration += duration;
        pauseReason = "";

        emit SequencerResumedByAI(msg.sender, duration);
    }
}
