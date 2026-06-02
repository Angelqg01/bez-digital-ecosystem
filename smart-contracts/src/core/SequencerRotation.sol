// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

interface IValidatorRegistryForSequencer {
    function isActiveValidator(address operator) external view returns (bool);
    function getValidatorTier(address operator) external view returns (uint8);
    function getStakedAmount(address operator) external view returns (uint256);
    function getActiveSequencerCandidates() external view returns (address[] memory);
}

/**
 * @title SequencerRotation
 * @dev Gestiona la rotación del sequencer activo entre validadores Gold/Platinum.
 * En OP Stack, el sequencer es quien produce bloques L2. Este contrato determina
 * on-chain quién es el sequencer autorizado por epoch, permitiendo descentralización
 * progresiva del rollup.
 *
 * Modelo de rotación:
 *   - Un epoch dura configurable bloques (default: 7200 = ~4 horas a 2s/bloque)
 *   - Al final de cada epoch, el siguiente candidato en la cola toma el turno
 *   - La cola se ordena por: stake * contributionWeight
 *   - Si el sequencer falla (no produce bloques), se puede forzar rotación
 *   - Solo validadores tier >= 3 (Gold/Platinum) son candidatos a sequencer
 */
contract SequencerRotation is AccessControl {
    bytes32 public constant ROTATION_MANAGER_ROLE = keccak256("ROTATION_MANAGER_ROLE");

    IValidatorRegistryForSequencer public validatorRegistry;

    // ─── Configuración de Epoch ──────────────────────────────────────
    uint256 public epochLength = 7200; // ~4 horas a 2s/bloque
    uint256 public currentEpoch;
    uint256 public epochStartBlock;

    // ─── Estado del Sequencer ────────────────────────────────────────
    address public activeSequencer;
    address[] public sequencerQueue;
    uint256 public currentQueueIndex;
    
    // Historial de performance por epoch
    struct EpochRecord {
        address sequencer;
        uint256 startBlock;
        uint256 endBlock;
        uint256 blocksProduced;
        bool    completed;         // true si terminó normalmente, false si fue forzado
    }
    
    mapping(uint256 => EpochRecord) public epochHistory;
    mapping(address => uint256) public totalEpochsServed;
    mapping(address => uint256) public totalBlocksProduced;

    // ─── Fees del sequencer ──────────────────────────────────────────
    uint256 public sequencerFeeShareBps = 5000; // 50% de tx fees al sequencer activo
    mapping(address => uint256) public accumulatedFees;

    // ─── Eventos ─────────────────────────────────────────────────────
    event EpochAdvanced(uint256 indexed epoch, address indexed newSequencer);
    event SequencerQueueUpdated(uint256 queueLength);
    event ForcedRotation(uint256 indexed epoch, address indexed oldSequencer, string reason);
    event BlocksReported(uint256 indexed epoch, address indexed sequencer, uint256 blocksProduced);
    event FeesAccumulated(address indexed sequencer, uint256 amount);
    event EpochLengthUpdated(uint256 oldLength, uint256 newLength);
    event FeeShareUpdated(uint256 oldShare, uint256 newShare);

    constructor(address _validatorRegistry, address defaultAdmin) {
        validatorRegistry = IValidatorRegistryForSequencer(_validatorRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(ROTATION_MANAGER_ROLE, defaultAdmin);
        
        epochStartBlock = block.number;
        currentEpoch = 0;
    }

    // ─── Actualizar la cola de sequencers (desde ValidatorRegistry) ──

    function refreshSequencerQueue() external onlyRole(ROTATION_MANAGER_ROLE) {
        address[] memory candidates = validatorRegistry.getActiveSequencerCandidates();
        require(candidates.length > 0, "SR: no eligible sequencers");

        delete sequencerQueue;

        // Ordenar por stake (mayor primero) — bubble sort simple para sets pequeños
        address[] memory sorted = _sortByStake(candidates);
        
        for (uint256 i = 0; i < sorted.length; i++) {
            sequencerQueue.push(sorted[i]);
        }
        
        currentQueueIndex = 0;

        // Si no hay sequencer activo, asignar el primero
        if (activeSequencer == address(0) && sequencerQueue.length > 0) {
            activeSequencer = sequencerQueue[0];
            emit EpochAdvanced(currentEpoch, activeSequencer);
        }

        emit SequencerQueueUpdated(sequencerQueue.length);
    }

    // ─── Avanzar al siguiente epoch ──────────────────────────────────

    function advanceEpoch() external onlyRole(ROTATION_MANAGER_ROLE) {
        require(block.number >= epochStartBlock + epochLength, "SR: epoch not finished");
        require(sequencerQueue.length > 0, "SR: empty queue");

        // Registrar epoch completado
        epochHistory[currentEpoch] = EpochRecord({
            sequencer: activeSequencer,
            startBlock: epochStartBlock,
            endBlock: block.number,
            blocksProduced: 0, // Se actualiza con reportBlocks
            completed: true
        });

        if (activeSequencer != address(0)) {
            totalEpochsServed[activeSequencer]++;
        }

        // Avanzar al siguiente candidato
        currentEpoch++;
        currentQueueIndex = (currentQueueIndex + 1) % sequencerQueue.length;
        
        address nextSequencer = sequencerQueue[currentQueueIndex];
        
        // Verificar que sigue siendo eligible
        if (!validatorRegistry.isActiveValidator(nextSequencer) || 
            validatorRegistry.getValidatorTier(nextSequencer) < 3) {
            // Buscar el siguiente válido
            nextSequencer = _findNextEligible(currentQueueIndex);
        }

        activeSequencer = nextSequencer;
        epochStartBlock = block.number;

        emit EpochAdvanced(currentEpoch, activeSequencer);
    }

    // ─── Rotación forzada (si el sequencer falla) ────────────────────

    function forceRotation(string calldata reason) external onlyRole(ROTATION_MANAGER_ROLE) {
        require(activeSequencer != address(0), "SR: no active sequencer");
        require(sequencerQueue.length > 1, "SR: need at least 2 candidates");

        address oldSequencer = activeSequencer;

        // Registrar epoch como no completado
        epochHistory[currentEpoch] = EpochRecord({
            sequencer: oldSequencer,
            startBlock: epochStartBlock,
            endBlock: block.number,
            blocksProduced: 0,
            completed: false
        });

        // Avanzar
        currentEpoch++;
        currentQueueIndex = (currentQueueIndex + 1) % sequencerQueue.length;
        activeSequencer = _findNextEligible(currentQueueIndex);
        epochStartBlock = block.number;

        emit ForcedRotation(currentEpoch - 1, oldSequencer, reason);
        emit EpochAdvanced(currentEpoch, activeSequencer);
    }

    // ─── Reportar bloques producidos (off-chain monitor) ─────────────

    function reportBlocksProduced(uint256 epoch, uint256 blocksProduced) 
        external onlyRole(ROTATION_MANAGER_ROLE) 
    {
        require(epoch <= currentEpoch, "SR: future epoch");
        EpochRecord storage record = epochHistory[epoch];
        require(record.sequencer != address(0), "SR: no record");

        record.blocksProduced = blocksProduced;
        totalBlocksProduced[record.sequencer] += blocksProduced;

        emit BlocksReported(epoch, record.sequencer, blocksProduced);
    }

    // ─── Acumular fees para sequencer (llamado por sistema) ──────────

    function accumulateFees(address sequencer, uint256 amount) 
        external onlyRole(ROTATION_MANAGER_ROLE) 
    {
        accumulatedFees[sequencer] += amount;
        emit FeesAccumulated(sequencer, amount);
    }

    // ─── Admin ───────────────────────────────────────────────────────

    function setEpochLength(uint256 newLength) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newLength >= 600, "SR: epoch too short"); // Min ~20 min
        emit EpochLengthUpdated(epochLength, newLength);
        epochLength = newLength;
    }

    function setSequencerFeeShare(uint256 newShareBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newShareBps <= 10000, "SR: exceeds 100%");
        emit FeeShareUpdated(sequencerFeeShareBps, newShareBps);
        sequencerFeeShareBps = newShareBps;
    }

    function setValidatorRegistry(address _registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_registry != address(0), "SR: zero address");
        validatorRegistry = IValidatorRegistryForSequencer(_registry);
    }

    // ─── Vistas ──────────────────────────────────────────────────────

    function getSequencerQueueLength() external view returns (uint256) {
        return sequencerQueue.length;
    }

    function getEpochInfo() external view returns (
        uint256 epoch,
        address sequencer,
        uint256 startBlock,
        uint256 blocksRemaining,
        uint256 queuePosition
    ) {
        uint256 elapsed = block.number > epochStartBlock ? block.number - epochStartBlock : 0;
        uint256 remaining = elapsed >= epochLength ? 0 : epochLength - elapsed;
        return (
            currentEpoch,
            activeSequencer,
            epochStartBlock,
            remaining,
            currentQueueIndex
        );
    }

    function getSequencerStats(address sequencer) external view returns (
        uint256 epochsServed,
        uint256 blocksProducedTotal,
        uint256 fees,
        bool isCurrentSequencer
    ) {
        return (
            totalEpochsServed[sequencer],
            totalBlocksProduced[sequencer],
            accumulatedFees[sequencer],
            activeSequencer == sequencer
        );
    }

    function isSequencerTurn(address operator) external view returns (bool) {
        return activeSequencer == operator;
    }

    // ─── Internal ────────────────────────────────────────────────────

    function _findNextEligible(uint256 startIdx) internal view returns (address) {
        for (uint256 i = 0; i < sequencerQueue.length; i++) {
            uint256 idx = (startIdx + i) % sequencerQueue.length;
            address candidate = sequencerQueue[idx];
            if (validatorRegistry.isActiveValidator(candidate) && 
                validatorRegistry.getValidatorTier(candidate) >= 3) {
                return candidate;
            }
        }
        revert("SR: no eligible sequencer found");
    }

    function _sortByStake(address[] memory candidates) internal view returns (address[] memory) {
        // Simple bubble sort — sequencer sets are small (< 100)
        for (uint256 i = 0; i < candidates.length; i++) {
            for (uint256 j = i + 1; j < candidates.length; j++) {
                if (validatorRegistry.getStakedAmount(candidates[j]) > 
                    validatorRegistry.getStakedAmount(candidates[i])) {
                    (candidates[i], candidates[j]) = (candidates[j], candidates[i]);
                }
            }
        }
        return candidates;
    }
}
