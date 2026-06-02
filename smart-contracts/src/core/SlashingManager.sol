// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

interface IValidatorRegistryForSlashing {
    function slash(address operator, uint256 amount, string calldata reason) external;
    function isActiveValidator(address operator) external view returns (bool);
    function getStakedAmount(address operator) external view returns (uint256);
    function recordExpectedHeartbeat(address operator) external;
    function validators(address operator) external view returns (
        address, string memory, uint256, uint256, uint256, 
        uint256, uint256, uint256, uint256, uint256, uint256, uint8, bool, bool
    );
}

/**
 * @title SlashingManager
 * @dev Gestiona penalizaciones para validadores que incumplen SLAs.
 * Integrado con ValidatorRegistry — ejecuta slashes basados en condiciones
 * reportadas por Aegis AI oracle o monitoreo automatizado.
 *
 * Condiciones de slash:
 *   1. Downtime prolongado (>4 horas sin heartbeat): 2% del stake
 *   2. Datos fraudulentos (detectado por AI):        5% del stake
 *   3. Inactividad DAO (3+ épocas sin votar):         1% del stake
 *   4. Sequencer failure (no produce bloques):        3% del stake
 *   5. Double-signing / conflictos:                  10% del stake
 *
 * Protecciones:
 *   - Cooldown de 24h entre slashes al mismo validador
 *   - Máximo 25% del stake slasheable por período de 30 días
 *   - Appeals posible vía DAO (propuesta de reversión)
 */
contract SlashingManager is AccessControl {
    bytes32 public constant SLASHER_ROLE = keccak256("SLASHER_ROLE");
    bytes32 public constant AEGIS_AI_ROLE = keccak256("AEGIS_AI_ROLE");

    IValidatorRegistryForSlashing public validatorRegistry;

    // ─── Configuración de Penalizaciones (en basis points del stake) ─
    uint256 public constant SLASH_DOWNTIME_BPS = 200;           // 2%
    uint256 public constant SLASH_FRAUDULENT_DATA_BPS = 500;    // 5%
    uint256 public constant SLASH_DAO_INACTIVITY_BPS = 100;     // 1%
    uint256 public constant SLASH_SEQUENCER_FAILURE_BPS = 300;  // 3%
    uint256 public constant SLASH_DOUBLE_SIGN_BPS = 1000;       // 10%

    uint256 public constant SLASH_COOLDOWN = 24 hours;
    uint256 public constant MAX_SLASH_PERIOD = 30 days;
    uint256 public constant MAX_SLASH_PER_PERIOD_BPS = 2500;    // 25% max en 30 días

    // ─── Tipos de infracción ─────────────────────────────────────────
    enum InfractionType {
        Downtime,
        FraudulentData,
        DAOInactivity,
        SequencerFailure,
        DoubleSigning
    }

    struct SlashRecord {
        address validator;
        InfractionType infraction;
        uint256 amount;
        uint256 timestamp;
        string  evidence;
        bool    appealed;
        bool    reversed;
    }

    // ─── Storage ─────────────────────────────────────────────────────
    mapping(address => uint256) public lastSlashTime;
    mapping(address => uint256) public slashedInPeriod;   // Acumulado en 30 días
    mapping(address => uint256) public periodStartTime;

    SlashRecord[] public slashHistory;
    mapping(address => uint256[]) public validatorSlashes; // validator => slashRecord IDs

    // Downtime tracking
    uint256 public downtimeThreshold = 4 hours;
    
    // DAO inactivity tracking
    mapping(address => uint256) public missedDAOVotes;
    uint256 public daoInactivityThreshold = 3;

    uint256 public totalSlashed;

    // ─── Eventos ─────────────────────────────────────────────────────
    event ValidatorSlashed(
        uint256 indexed slashId, 
        address indexed validator, 
        InfractionType infraction, 
        uint256 amount, 
        string evidence
    );
    event SlashAppealed(uint256 indexed slashId, address indexed validator);
    event SlashReversed(uint256 indexed slashId, address indexed validator, uint256 amountReturned);
    event DowntimeDetected(address indexed validator, uint256 lastHeartbeat, uint256 elapsed);
    event DAOInactivityRecorded(address indexed validator, uint256 missedVotes);

    constructor(address _validatorRegistry, address defaultAdmin) {
        validatorRegistry = IValidatorRegistryForSlashing(_validatorRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    // ─── Slash por Downtime ──────────────────────────────────────────

    function slashForDowntime(address validator, string calldata evidence) 
        external onlyRole(SLASHER_ROLE) 
    {
        _validateSlashPreconditions(validator);

        uint256 stake = validatorRegistry.getStakedAmount(validator);
        uint256 slashAmount = (stake * SLASH_DOWNTIME_BPS) / 10000;

        _executeSlash(validator, slashAmount, InfractionType.Downtime, evidence);
        emit DowntimeDetected(validator, 0, 0);
    }

    // ─── Slash por Datos Fraudulentos (Aegis AI) ─────────────────────

    function slashForFraudulentData(address validator, string calldata evidence) 
        external onlyRole(AEGIS_AI_ROLE) 
    {
        _validateSlashPreconditions(validator);

        uint256 stake = validatorRegistry.getStakedAmount(validator);
        uint256 slashAmount = (stake * SLASH_FRAUDULENT_DATA_BPS) / 10000;

        _executeSlash(validator, slashAmount, InfractionType.FraudulentData, evidence);
    }

    // ─── Slash por Inactividad en DAO ────────────────────────────────

    function recordMissedDAOVote(address validator) external onlyRole(SLASHER_ROLE) {
        missedDAOVotes[validator]++;
        emit DAOInactivityRecorded(validator, missedDAOVotes[validator]);

        if (missedDAOVotes[validator] >= daoInactivityThreshold) {
            _validateSlashPreconditions(validator);
            
            uint256 stake = validatorRegistry.getStakedAmount(validator);
            uint256 slashAmount = (stake * SLASH_DAO_INACTIVITY_BPS) / 10000;

            _executeSlash(validator, slashAmount, InfractionType.DAOInactivity, "3+ missed DAO votes");
            missedDAOVotes[validator] = 0; // Reset counter
        }
    }

    // ─── Slash por Fallo de Sequencer ────────────────────────────────

    function slashForSequencerFailure(address validator, string calldata evidence) 
        external onlyRole(SLASHER_ROLE) 
    {
        _validateSlashPreconditions(validator);

        uint256 stake = validatorRegistry.getStakedAmount(validator);
        uint256 slashAmount = (stake * SLASH_SEQUENCER_FAILURE_BPS) / 10000;

        _executeSlash(validator, slashAmount, InfractionType.SequencerFailure, evidence);
    }

    // ─── Slash por Double-Signing ────────────────────────────────────

    function slashForDoubleSigning(address validator, string calldata evidence) 
        external onlyRole(SLASHER_ROLE) 
    {
        _validateSlashPreconditions(validator);

        uint256 stake = validatorRegistry.getStakedAmount(validator);
        uint256 slashAmount = (stake * SLASH_DOUBLE_SIGN_BPS) / 10000;

        _executeSlash(validator, slashAmount, InfractionType.DoubleSigning, evidence);
    }

    // ─── Appeal (el validador puede apelar — la DAO decide) ──────────

    function appealSlash(uint256 slashId) external {
        require(slashId < slashHistory.length, "SM: invalid slash ID");
        SlashRecord storage record = slashHistory[slashId];
        require(record.validator == msg.sender, "SM: not your slash");
        require(!record.appealed, "SM: already appealed");
        require(!record.reversed, "SM: already reversed");

        record.appealed = true;
        emit SlashAppealed(slashId, msg.sender);
    }

    // ─── Revertir Slash (solo DAO/Admin tras appeal aprobado) ────────

    function reverseSlash(uint256 slashId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(slashId < slashHistory.length, "SM: invalid slash ID");
        SlashRecord storage record = slashHistory[slashId];
        require(record.appealed, "SM: not appealed");
        require(!record.reversed, "SM: already reversed");

        record.reversed = true;
        
        // Nota: la reversión real de fondos requiere que el Treasury/Admin deposite de vuelta
        // al ValidatorRegistry vía addStake. Este contrato solo registra la decisión.
        
        emit SlashReversed(slashId, record.validator, record.amount);
    }

    // ─── Resetear contador de votos DAO tras participación ───────────

    function resetDAOVoteCounter(address validator) external onlyRole(SLASHER_ROLE) {
        missedDAOVotes[validator] = 0;
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function setDowntimeThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newThreshold >= 1 hours, "SM: threshold too low");
        downtimeThreshold = newThreshold;
    }

    function setDAOInactivityThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newThreshold >= 1, "SM: must be at least 1");
        daoInactivityThreshold = newThreshold;
    }

    function setValidatorRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_registry != address(0), "SM: zero address");
        validatorRegistry = IValidatorRegistryForSlashing(_registry);
    }

    // ─── Vistas ──────────────────────────────────────────────────────

    function getSlashCount() external view returns (uint256) {
        return slashHistory.length;
    }

    function getValidatorSlashHistory(address validator) external view returns (uint256[] memory) {
        return validatorSlashes[validator];
    }

    function getSlashRecord(uint256 slashId) external view returns (
        address validator,
        InfractionType infraction,
        uint256 amount,
        uint256 timestamp,
        string memory evidence,
        bool appealed,
        bool reversed
    ) {
        require(slashId < slashHistory.length, "SM: invalid ID");
        SlashRecord storage r = slashHistory[slashId];
        return (r.validator, r.infraction, r.amount, r.timestamp, r.evidence, r.appealed, r.reversed);
    }

    function getSlashedInCurrentPeriod(address validator) external view returns (uint256) {
        if (block.timestamp > periodStartTime[validator] + MAX_SLASH_PERIOD) {
            return 0; // Period expired
        }
        return slashedInPeriod[validator];
    }

    // ─── Internal ────────────────────────────────────────────────────

    function _validateSlashPreconditions(address validator) internal view {
        require(validatorRegistry.isActiveValidator(validator), "SM: not active validator");
        require(
            block.timestamp >= lastSlashTime[validator] + SLASH_COOLDOWN,
            "SM: cooldown active"
        );
    }

    function _executeSlash(
        address validator, 
        uint256 amount, 
        InfractionType infraction, 
        string memory evidence
    ) internal {
        // Verificar límite de período
        if (block.timestamp > periodStartTime[validator] + MAX_SLASH_PERIOD) {
            periodStartTime[validator] = block.timestamp;
            slashedInPeriod[validator] = 0;
        }

        uint256 stake = validatorRegistry.getStakedAmount(validator);
        uint256 maxSlashable = (stake * MAX_SLASH_PER_PERIOD_BPS) / 10000;
        uint256 remainingAllowance = maxSlashable > slashedInPeriod[validator] 
            ? maxSlashable - slashedInPeriod[validator] 
            : 0;

        uint256 actualSlash = amount > remainingAllowance ? remainingAllowance : amount;
        require(actualSlash > 0, "SM: max slash per period reached");

        // Ejecutar slash en ValidatorRegistry
        validatorRegistry.slash(validator, actualSlash, evidence);

        // Registrar
        uint256 slashId = slashHistory.length;
        slashHistory.push(SlashRecord({
            validator: validator,
            infraction: infraction,
            amount: actualSlash,
            timestamp: block.timestamp,
            evidence: evidence,
            appealed: false,
            reversed: false
        }));

        validatorSlashes[validator].push(slashId);
        lastSlashTime[validator] = block.timestamp;
        slashedInPeriod[validator] += actualSlash;
        totalSlashed += actualSlash;

        emit ValidatorSlashed(slashId, validator, infraction, actualSlash, evidence);
    }
}
