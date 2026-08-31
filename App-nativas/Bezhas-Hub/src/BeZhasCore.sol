// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BeZhasCore
 * @dev Contrato principal del Automation Engine de BeZhas
 * 
 * Funcionalidades:
 * - Ajuste dinámico de APY (controlado por ML)
 * - Ejecución automática de Halvings
 * - Sistema de roles (ADMIN, AUTOMATION, PAUSER)
 * - Pausas de emergencia
 * 
 * @author BeZhas Team
 */
contract BeZhasCore is AccessControl, Pausable, ReentrancyGuard {
    
    // ============ ROLES ============
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ STATE VARIABLES ============
    
    /// @notice APY actual en basis points (ej: 1200 = 12.00%)
    uint256 public currentAPY;
    
    /// @notice Tasa de emisión de tokens por bloque
    uint256 public emissionRate;
    
    /// @notice Supply total de tokens
    uint256 public totalSupply;
    
    /// @notice Número de halvings ejecutados
    uint256 public halvingCount;
    
    /// @notice Timestamp del último halving
    uint256 public lastHalvingTime;
    
    /// @notice APY mínimo permitido (5%)
    uint256 public constant MIN_APY = 500;
    
    /// @notice APY máximo permitido (50%)
    uint256 public constant MAX_APY = 5000;
    
    /// @notice Cooldown entre halvings (24 horas)
    uint256 public constant HALVING_COOLDOWN = 1 days;

    // ============ EVENTS ============
    
    /**
     * @dev Emitido cuando el APY es actualizado
     * @param oldAPY APY anterior en basis points
     * @param newAPY Nuevo APY en basis points
     * @param timestamp Timestamp del cambio
     */
    event APYUpdated(
        uint256 indexed oldAPY, 
        uint256 indexed newAPY, 
        uint256 timestamp
    );
    
    /**
     * @dev Emitido cuando se ejecuta un halving
     * @param newEmissionRate Nueva tasa de emisión
     * @param halvingCount Número de halving
     * @param timestamp Timestamp de ejecución
     */
    event HalvingExecuted(
        uint256 indexed newEmissionRate, 
        uint256 indexed halvingCount,
        uint256 timestamp
    );
    
    /**
     * @dev Emitido cuando se activa una pausa de emergencia
     * @param pauser Dirección que activó la pausa
     * @param reason Razón de la pausa
     * @param timestamp Timestamp de activación
     */
    event EmergencyPause(
        address indexed pauser, 
        string reason,
        uint256 timestamp
    );
    
    /**
     * @dev Emitido cuando se reanuda el sistema
     * @param admin Dirección que reanuó
     * @param timestamp Timestamp de reactivación
     */
    event SystemUnpaused(
        address indexed admin,
        uint256 timestamp
    );

    // ============ CONSTRUCTOR ============
    
    /**
     * @dev Inicializa el contrato con valores iniciales
     * @param initialAPY APY inicial en basis points
     * @param initialEmissionRate Tasa de emisión inicial
     */
    constructor(uint256 initialAPY, uint256 initialEmissionRate) {
        require(
            initialAPY >= MIN_APY && initialAPY <= MAX_APY,
            "BeZhasCore: Initial APY out of range"
        );
        require(
            initialEmissionRate > 0,
            "BeZhasCore: Emission rate must be > 0"
        );

        // Otorgar roles al deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        // Inicializar variables
        currentAPY = initialAPY;
        emissionRate = initialEmissionRate;
        totalSupply = 0;
        halvingCount = 0;
        lastHalvingTime = block.timestamp;
    }

    // ============ AUTOMATION FUNCTIONS ============
    
    /**
     * @dev Ajusta el APY de staking
     * @param newAPY Nuevo APY en basis points (500-5000)
     * 
     * Requisitos:
     * - Caller debe tener AUTOMATION_ROLE
     * - Sistema no debe estar pausado
     * - newAPY debe estar en rango permitido
     */
    function setStakingAPY(uint256 newAPY) 
        external 
        onlyRole(AUTOMATION_ROLE) 
        whenNotPaused 
    {
        require(
            newAPY >= MIN_APY && newAPY <= MAX_APY,
            "BeZhasCore: APY out of range (5%-50%)"
        );
        require(
            newAPY != currentAPY,
            "BeZhasCore: APY unchanged"
        );
        
        uint256 oldAPY = currentAPY;
        currentAPY = newAPY;

        emit APYUpdated(oldAPY, newAPY, block.timestamp);
    }

    /**
     * @dev Ejecuta un halving automático
     * @return success True si el halving fue exitoso
     * 
     * Requisitos:
     * - Caller debe tener AUTOMATION_ROLE
     * - Sistema no debe estar pausado
     * - Debe haber pasado el cooldown desde el último halving
     * - emissionRate debe ser > 0
     * 
     * Efectos:
     * - emissionRate se divide entre 2
     * - halvingCount incrementa en 1
     * - lastHalvingTime se actualiza
     */
    function executeHalving() 
        external 
        onlyRole(AUTOMATION_ROLE) 
        whenNotPaused 
        nonReentrant 
        returns (bool success) 
    {
        require(
            emissionRate > 0,
            "BeZhasCore: Emission rate already 0"
        );
        require(
            block.timestamp >= lastHalvingTime + HALVING_COOLDOWN,
            "BeZhasCore: Halving cooldown active"
        );

        // Ejecutar halving
        emissionRate = emissionRate / 2;
        halvingCount++;
        lastHalvingTime = block.timestamp;

        emit HalvingExecuted(emissionRate, halvingCount, block.timestamp);

        return true;
    }

    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Ajusta el APY manualmente (bypass automation)
     * @param newAPY Nuevo APY en basis points
     * 
     * Nota: Usar solo en emergencias o testing
     */
    function setStakingAPYManual(uint256 newAPY) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(
            newAPY >= MIN_APY && newAPY <= MAX_APY,
            "BeZhasCore: APY out of range"
        );
        
        uint256 oldAPY = currentAPY;
        currentAPY = newAPY;

        emit APYUpdated(oldAPY, newAPY, block.timestamp);
    }

    /**
     * @dev Ajusta la tasa de emisión manualmente
     * @param newEmissionRate Nueva tasa de emisión
     */
    function setEmissionRate(uint256 newEmissionRate) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(newEmissionRate > 0, "BeZhasCore: Invalid emission rate");
        
        emissionRate = newEmissionRate;
    }

    // ============ EMERGENCY FUNCTIONS ============
    
    /**
     * @dev Pausa todas las operaciones del sistema
     * @param reason Razón de la pausa
     * 
     * Requisitos:
     * - Caller debe tener PAUSER_ROLE
     * 
     * Efectos:
     * - Pausa setStakingAPY() y executeHalving()
     */
    function pause(string calldata reason) 
        external 
        onlyRole(PAUSER_ROLE) 
    {
        _pause();
        emit EmergencyPause(msg.sender, reason, block.timestamp);
    }

    /**
     * @dev Reanuda las operaciones del sistema
     * 
     * Requisitos:
     * - Caller debe tener ADMIN_ROLE
     */
    function unpause() 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        _unpause();
        emit SystemUnpaused(msg.sender, block.timestamp);
    }

    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Retorna el APY actual
     * @return APY en basis points
     */
    function getAPY() external view returns (uint256) {
        return currentAPY;
    }

    /**
     * @dev Retorna la tasa de emisión actual
     * @return Tasa de emisión
     */
    function getEmissionRate() external view returns (uint256) {
        return emissionRate;
    }

    /**
     * @dev Retorna el número de halvings ejecutados
     * @return Número de halvings
     */
    function getHalvingCount() external view returns (uint256) {
        return halvingCount;
    }

    /**
     * @dev Retorna el timestamp del último halving
     * @return Timestamp
     */
    function getLastHalvingTime() external view returns (uint256) {
        return lastHalvingTime;
    }

    /**
     * @dev Retorna el tiempo restante hasta que se pueda ejecutar el próximo halving
     * @return Segundos restantes (0 si ya puede ejecutarse)
     */
    function getHalvingCooldownRemaining() external view returns (uint256) {
        uint256 nextHalvingTime = lastHalvingTime + HALVING_COOLDOWN;
        
        if (block.timestamp >= nextHalvingTime) {
            return 0;
        }
        
        return nextHalvingTime - block.timestamp;
    }

    /**
     * @dev Retorna si el sistema está pausado
     * @return True si está pausado
     */
    function isPaused() external view returns (bool) {
        return paused();
    }

    /**
     * @dev Retorna información completa del sistema
     * @return apy APY actual
     * @return emission Tasa de emisión
     * @return halvings Número de halvings
     * @return lastHalving Timestamp del último halving
     * @return systemPaused Estado de pausa
     */
    function getSystemInfo() 
        external 
        view 
        returns (
            uint256 apy,
            uint256 emission,
            uint256 halvings,
            uint256 lastHalving,
            bool systemPaused
        ) 
    {
        return (
            currentAPY,
            emissionRate,
            halvingCount,
            lastHalvingTime,
            paused()
        );
    }
}
