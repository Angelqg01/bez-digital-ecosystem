// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

interface IAegisSecurityProvider {
    function consumeSignal(uint256 signalId) external;
    function getLatestUnconsumedSignal() external view returns (uint256 signalId, bool found);
    function getSignal(uint256 signalId) external view returns (
        string memory signalType,
        uint8 level,
        uint256 timestamp,
        address reportedBy,
        bool consumed
    );
    function setComponentPause(bytes32 component, bool paused) external;
}

interface IL2Sequencer {
    function isPausedByAI() external view returns (bool);
    function pauseByAI(string calldata reason) external;
    function resumeByAI() external;
    function confirmAIExecution(address agent, string calldata action, uint256 signalId) external;
}

/**
 * @title OpenClawAgent
 * @notice Representación on-chain de un agente de IA del sistema BeZhas.
 * Permite gestionar permisos, habilidades (skills) y la identidad del agente
 * de forma inmutable y transparente.
 */
contract OpenClawAgent is AccessControl {
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @notice Minimum delay between agent-driven security actions (rate-limit).
    uint256 public constant ACTION_COOLDOWN = 60;

    IAegisSecurityProvider public aegis;
    IL2Sequencer public sequencer;
    address public slashingManager;

    uint256 public totalActionsExecuted;
    uint256 public totalSequencerPauses;
    uint256 public totalSlashes;
    uint256 public lastActionTimestamp;

    struct SecurityAction {
        uint256 signalId;
        string signalType;
        uint8 riskLevel;
        string actionTaken;
        uint256 timestamp;
    }

    SecurityAction[] internal securityActions;

    struct AgentInfo {
        string name;
        string department;
        string skillsHash; // Hash IPFS con la definición de herramientas/skills
        bool isActive;
        uint256 createdAt;
    }

    mapping(address => AgentInfo) public agents;
    address[] public agentList;

    event AgentRegistered(address indexed agentAddress, string name, string department);
    event AgentSkillsUpdated(address indexed agentAddress, string newSkillsHash);
    event AgentStatusChanged(address indexed agentAddress, bool isActive);
    event AIExecutionConfirmed(uint256 indexed signalId, string action, uint256 timestamp);

    constructor(
        address aegis_,
        address sequencer_,
        address slashingManager_,
        address admin
    ) {
        aegis = IAegisSecurityProvider(aegis_);
        sequencer = IL2Sequencer(sequencer_);
        slashingManager = slashingManager_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /**
     * @dev Registra un nuevo agente de IA.
     */
    function registerAgent(
        address agentAddress,
        string calldata name,
        string calldata department,
        string calldata skillsHash
    ) external onlyRole(MANAGER_ROLE) {
        require(agents[agentAddress].createdAt == 0, "Agent already registered");
        
        agents[agentAddress] = AgentInfo({
            name: name,
            department: department,
            skillsHash: skillsHash,
            isActive: true,
            createdAt: block.timestamp
        });
        
        agentList.push(agentAddress);
        emit AgentRegistered(agentAddress, name, department);
    }

    /**
     * @dev Actualiza el hash de habilidades de un agente.
     */
    function updateSkills(address agentAddress, string calldata newSkillsHash) 
        external 
        onlyRole(MANAGER_ROLE) 
    {
        require(agents[agentAddress].createdAt != 0, "Agent not found");
        agents[agentAddress].skillsHash = newSkillsHash;
        emit AgentSkillsUpdated(agentAddress, newSkillsHash);
    }

    /**
     * @dev Activa o desactiva un agente (ej. en caso de anomalía detectada por AEGIS).
     */
    function setAgentStatus(address agentAddress, bool status) 
        external 
        onlyRole(MANAGER_ROLE) 
    {
        require(agents[agentAddress].createdAt != 0, "Agent not found");
        agents[agentAddress].isActive = status;
        emit AgentStatusChanged(agentAddress, status);
    }

    // ─── Getters ──────────────────────────────────────────────────────────────

    function getAgentInfo(address agentAddress) external view returns (AgentInfo memory) {
        return agents[agentAddress];
    }

    function isAgentActive(address agentAddress) external view returns (bool) {
        return agents[agentAddress].isActive;
    }

    function getTotalAgents() external view returns (uint256) {
        return agentList.length;
    }

    // ─── AEGIS/L2 Security Automation ────────────────────────────────────────

    function processSecurityAction() external onlyRole(OPERATOR_ROLE) returns (uint256) {
        (uint256 signalId, bool found) = aegis.getLatestUnconsumedSignal();
        require(found, "No unconsumed signal");
        // Rate-limit consecutive agent actions (uses lastActionTimestamp set in _processSignal).
        require(
            lastActionTimestamp == 0 || block.timestamp >= lastActionTimestamp + ACTION_COOLDOWN,
            "OCA: cooldown active"
        );
        _processSignal(signalId);
        return signalId;
    }

    function processSignalById(uint256 signalId) external onlyRole(OPERATOR_ROLE) {
        _processSignal(signalId);
    }

    function resumeSequencer() external onlyRole(OPERATOR_ROLE) {
        sequencer.resumeByAI();
    }

    function getStats() external view returns (
        uint256 actions,
        uint256 pauses,
        uint256 slashes,
        uint256 lastAction
    ) {
        return (totalActionsExecuted, totalSequencerPauses, totalSlashes, lastActionTimestamp);
    }

    function getAction(uint256 index) external view returns (
        uint256 signalId,
        string memory signalType,
        uint8 riskLevel,
        string memory actionTaken,
        uint256 timestamp
    ) {
        SecurityAction storage action = securityActions[index];
        return (
            action.signalId,
            action.signalType,
            action.riskLevel,
            action.actionTaken,
            action.timestamp
        );
    }

    function _processSignal(uint256 signalId) internal {
        (string memory signalType, uint8 level, , , bool consumed) = aegis.getSignal(signalId);
        require(!consumed, "Signal already consumed");

        string memory actionTaken = "LOG_ONLY";
        if (level >= 3) {
            actionTaken = "PAUSE_SEQUENCER_HIGH";
            if (!sequencer.isPausedByAI()) {
                sequencer.pauseByAI(actionTaken);
                totalSequencerPauses++;
            }
            aegis.setComponentPause(keccak256(bytes("sequencer")), true);
            sequencer.confirmAIExecution(address(this), actionTaken, signalId);
        }

        aegis.consumeSignal(signalId);
        totalActionsExecuted++;
        lastActionTimestamp = block.timestamp;
        securityActions.push(SecurityAction({
            signalId: signalId,
            signalType: signalType,
            riskLevel: level,
            actionTaken: actionTaken,
            timestamp: block.timestamp
        }));

        emit AIExecutionConfirmed(signalId, actionTaken, block.timestamp);
    }
}
