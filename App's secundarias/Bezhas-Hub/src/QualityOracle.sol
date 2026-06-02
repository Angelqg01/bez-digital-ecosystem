// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title QualityOracle
 * @author BeZhas Team
 * @notice Oráculo de Calidad Universal para validar productos, servicios, NFTs, RWA, 
 *         logística, SDK, posts y todas las interacciones del ecosistema BeZhas.
 * @dev Sistema multi-sector con validadores descentralizados y penalizaciones por calidad.
 */
contract QualityOracle is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    //                              ROLES
    // ═══════════════════════════════════════════════════════════════════════
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    // ═══════════════════════════════════════════════════════════════════════
    //                              ENUMS
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice Tipos de entidades que pueden ser validadas
    enum EntityType {
        PRODUCT,        // Productos físicos del marketplace
        SERVICE,        // Servicios profesionales
        NFT,            // NFTs del ecosistema
        RWA,            // Real World Assets (inmuebles, vehículos, etc.)
        LOGISTICS,      // Envíos y logística
        SDK_INTERACTION,// Interacciones con el SDK de terceros
        POST,           // Contenido social (posts, artículos)
        REVIEW,         // Reseñas y valoraciones
        TRANSACTION     // Transacciones comerciales
    }

    /// @notice Estados de validación
    enum ValidationStatus {
        PENDING,        // Esperando validación
        IN_REVIEW,      // En proceso de revisión
        APPROVED,       // Aprobado con calidad verificada
        REJECTED,       // Rechazado por baja calidad
        DISPUTED,       // En disputa
        RESOLVED        // Disputa resuelta
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                              STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Configuración por tipo de entidad
    struct EntityConfig {
        uint256 minQualityThreshold;    // Umbral mínimo de calidad (0-100)
        uint256 collateralRequired;     // Colateral requerido en BEZ
        uint256 validationFee;          // Fee de validación
        uint256 penaltyMultiplier;      // Multiplicador de penalización (base 100)
        uint256 rewardMultiplier;       // Multiplicador de recompensa por alta calidad
        bool requiresHumanReview;       // Si requiere revisión humana adicional
        bool isActive;                  // Si este tipo está activo
    }

    /// @notice Registro de validación
    struct ValidationRecord {
        uint256 id;
        EntityType entityType;
        bytes32 entityHash;             // Hash único de la entidad
        address owner;                  // Propietario/creador
        address validator;              // Validador asignado
        uint8 qualityScore;             // Puntuación 0-100
        uint8 aiScore;                  // Puntuación de IA (opcional)
        ValidationStatus status;
        uint256 collateralLocked;
        uint256 timestamp;
        uint256 resolvedAt;
        string metadataURI;             // IPFS/Arweave URI con detalles
    }

    /// @notice Perfil de validador
    struct ValidatorProfile {
        uint256 totalValidations;
        uint256 successfulValidations;
        uint256 disputesLost;
        uint256 reputationScore;        // 0-10000 (100.00%)
        uint256 stakedAmount;
        bool isActive;
    }

    /// @notice Estadísticas globales por sector
    struct SectorStats {
        uint256 totalValidations;
        uint256 totalApproved;
        uint256 totalRejected;
        uint256 totalDisputes;
        uint256 averageQuality;
        uint256 totalCollateralLocked;
        uint256 totalFeesCollected;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════

    IERC20 public immutable bezToken;
    address public treasuryDAO;         // Wallet DAO para fees y penalizaciones
    
    uint256 public validationCounter;
    uint256 public constant PRECISION = 10000;
    uint256 public disputeTimeout = 7 days;
    uint256 public validatorMinStake = 1000 ether; // 1000 BEZ mínimo para ser validador

    // Mappings principales
    mapping(EntityType => EntityConfig) public entityConfigs;
    mapping(uint256 => ValidationRecord) public validations;
    mapping(bytes32 => uint256) public entityToValidation; // entityHash => validationId
    mapping(address => ValidatorProfile) public validators;
    mapping(EntityType => SectorStats) public sectorStats;
    
    // Historial por usuario
    mapping(address => uint256[]) public userValidations;
    mapping(address => uint256) public userReputationScore;

    // ═══════════════════════════════════════════════════════════════════════
    //                              EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event ValidationRequested(
        uint256 indexed validationId,
        EntityType indexed entityType,
        address indexed owner,
        bytes32 entityHash,
        uint256 collateral
    );
    
    event ValidationCompleted(
        uint256 indexed validationId,
        address indexed validator,
        uint8 qualityScore,
        ValidationStatus status
    );
    
    event DisputeRaised(
        uint256 indexed validationId,
        address indexed disputer,
        string reason
    );
    
    event DisputeResolved(
        uint256 indexed validationId,
        address indexed winner,
        uint256 penaltyAmount
    );
    
    event ValidatorRegistered(address indexed validator, uint256 stakedAmount);
    event ValidatorSlashed(address indexed validator, uint256 slashedAmount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event EntityConfigUpdated(EntityType indexed entityType);
    event FeesDistributed(uint256 toTreasury, uint256 toValidators, uint256 burned);

    // ═══════════════════════════════════════════════════════════════════════
    //                            CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor(address _bezToken, address _treasuryDAO) {
        require(_bezToken != address(0), "QO: Invalid token");
        require(_treasuryDAO != address(0), "QO: Invalid treasury");
        
        bezToken = IERC20(_bezToken);
        treasuryDAO = _treasuryDAO;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(DAO_ROLE, _treasuryDAO);

        // Configuración inicial por tipo de entidad
        _initializeEntityConfigs();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                       INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    function _initializeEntityConfigs() internal {
        // Productos: Alto colateral, validación estricta
        entityConfigs[EntityType.PRODUCT] = EntityConfig({
            minQualityThreshold: 60,
            collateralRequired: 100 ether,
            validationFee: 5 ether,
            penaltyMultiplier: 150,
            rewardMultiplier: 120,
            requiresHumanReview: true,
            isActive: true
        });

        // Servicios: Colateral medio, revisión humana
        entityConfigs[EntityType.SERVICE] = EntityConfig({
            minQualityThreshold: 70,
            collateralRequired: 200 ether,
            validationFee: 10 ether,
            penaltyMultiplier: 200,
            rewardMultiplier: 130,
            requiresHumanReview: true,
            isActive: true
        });

        // NFTs: Validación automática posible
        entityConfigs[EntityType.NFT] = EntityConfig({
            minQualityThreshold: 50,
            collateralRequired: 50 ether,
            validationFee: 2 ether,
            penaltyMultiplier: 100,
            rewardMultiplier: 110,
            requiresHumanReview: false,
            isActive: true
        });

        // RWA: Máximo colateral, validación estricta
        entityConfigs[EntityType.RWA] = EntityConfig({
            minQualityThreshold: 80,
            collateralRequired: 1000 ether,
            validationFee: 50 ether,
            penaltyMultiplier: 300,
            rewardMultiplier: 150,
            requiresHumanReview: true,
            isActive: true
        });

        // Logística: Validación de envíos
        entityConfigs[EntityType.LOGISTICS] = EntityConfig({
            minQualityThreshold: 75,
            collateralRequired: 150 ether,
            validationFee: 8 ether,
            penaltyMultiplier: 180,
            rewardMultiplier: 125,
            requiresHumanReview: false,
            isActive: true
        });

        // SDK Interactions: Automático
        entityConfigs[EntityType.SDK_INTERACTION] = EntityConfig({
            minQualityThreshold: 40,
            collateralRequired: 10 ether,
            validationFee: 1 ether,
            penaltyMultiplier: 100,
            rewardMultiplier: 105,
            requiresHumanReview: false,
            isActive: true
        });

        // Posts: Social content
        entityConfigs[EntityType.POST] = EntityConfig({
            minQualityThreshold: 30,
            collateralRequired: 5 ether,
            validationFee: 0.5 ether,
            penaltyMultiplier: 100,
            rewardMultiplier: 110,
            requiresHumanReview: false,
            isActive: true
        });

        // Reviews: Validación de reseñas
        entityConfigs[EntityType.REVIEW] = EntityConfig({
            minQualityThreshold: 50,
            collateralRequired: 20 ether,
            validationFee: 2 ether,
            penaltyMultiplier: 120,
            rewardMultiplier: 115,
            requiresHumanReview: false,
            isActive: true
        });

        // Transacciones comerciales
        entityConfigs[EntityType.TRANSACTION] = EntityConfig({
            minQualityThreshold: 60,
            collateralRequired: 50 ether,
            validationFee: 5 ether,
            penaltyMultiplier: 150,
            rewardMultiplier: 120,
            requiresHumanReview: false,
            isActive: true
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      CORE VALIDATION FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Solicitar validación de calidad para una entidad
     * @param _entityType Tipo de entidad a validar
     * @param _entityHash Hash único de la entidad
     * @param _metadataURI URI con metadatos adicionales
     */
    function requestValidation(
        EntityType _entityType,
        bytes32 _entityHash,
        string calldata _metadataURI
    ) external nonReentrant whenNotPaused returns (uint256) {
        EntityConfig memory config = entityConfigs[_entityType];
        require(config.isActive, "QO: Entity type not active");
        require(entityToValidation[_entityHash] == 0, "QO: Already validated");

        uint256 totalRequired = config.collateralRequired + config.validationFee;
        bezToken.safeTransferFrom(msg.sender, address(this), totalRequired);

        validationCounter++;
        uint256 validationId = validationCounter;

        validations[validationId] = ValidationRecord({
            id: validationId,
            entityType: _entityType,
            entityHash: _entityHash,
            owner: msg.sender,
            validator: address(0),
            qualityScore: 0,
            aiScore: 0,
            status: ValidationStatus.PENDING,
            collateralLocked: config.collateralRequired,
            timestamp: block.timestamp,
            resolvedAt: 0,
            metadataURI: _metadataURI
        });

        entityToValidation[_entityHash] = validationId;
        userValidations[msg.sender].push(validationId);

        // Actualizar estadísticas del sector
        sectorStats[_entityType].totalValidations++;
        sectorStats[_entityType].totalCollateralLocked += config.collateralRequired;
        sectorStats[_entityType].totalFeesCollected += config.validationFee;

        emit ValidationRequested(validationId, _entityType, msg.sender, _entityHash, config.collateralRequired);

        return validationId;
    }

    /**
     * @notice Validar una entidad (solo validadores autorizados)
     * @param _validationId ID de la validación
     * @param _qualityScore Puntuación de calidad (0-100)
     * @param _aiScore Puntuación de IA si aplica
     */
    function validateEntity(
        uint256 _validationId,
        uint8 _qualityScore,
        uint8 _aiScore
    ) external onlyRole(VALIDATOR_ROLE) nonReentrant {
        ValidationRecord storage record = validations[_validationId];
        require(record.status == ValidationStatus.PENDING || record.status == ValidationStatus.IN_REVIEW, "QO: Invalid status");
        require(_qualityScore <= 100, "QO: Invalid score");

        EntityConfig memory config = entityConfigs[record.entityType];
        
        record.validator = msg.sender;
        record.qualityScore = _qualityScore;
        record.aiScore = _aiScore;
        record.resolvedAt = block.timestamp;

        // Actualizar perfil del validador
        validators[msg.sender].totalValidations++;

        if (_qualityScore >= config.minQualityThreshold) {
            record.status = ValidationStatus.APPROVED;
            sectorStats[record.entityType].totalApproved++;
            
            // Devolver colateral + bonus por alta calidad
            uint256 bonus = 0;
            if (_qualityScore >= 90) {
                bonus = (record.collateralLocked * (config.rewardMultiplier - 100)) / 100;
            }
            
            bezToken.safeTransfer(record.owner, record.collateralLocked + bonus);
            
            // Actualizar reputación del usuario
            _updateUserReputation(record.owner, true, _qualityScore);
            validators[msg.sender].successfulValidations++;
        } else {
            record.status = ValidationStatus.REJECTED;
            sectorStats[record.entityType].totalRejected++;
            
            // Calcular penalización
            uint256 penalty = (record.collateralLocked * config.penaltyMultiplier) / 100;
            if (penalty > record.collateralLocked) {
                penalty = record.collateralLocked;
            }
            
            // Enviar penalización a Treasury DAO
            bezToken.safeTransfer(treasuryDAO, penalty);
            
            // Devolver resto al usuario
            uint256 remaining = record.collateralLocked - penalty;
            if (remaining > 0) {
                bezToken.safeTransfer(record.owner, remaining);
            }
            
            _updateUserReputation(record.owner, false, _qualityScore);
        }

        // Actualizar promedio de calidad del sector
        _updateSectorAverageQuality(record.entityType, _qualityScore);

        emit ValidationCompleted(_validationId, msg.sender, _qualityScore, record.status);
    }

    /**
     * @notice Levantar una disputa sobre una validación
     * @param _validationId ID de la validación
     * @param _reason Razón de la disputa
     */
    function raiseDispute(
        uint256 _validationId,
        string calldata _reason
    ) external nonReentrant {
        ValidationRecord storage record = validations[_validationId];
        require(
            record.owner == msg.sender || record.validator == msg.sender,
            "QO: Not authorized"
        );
        require(
            record.status == ValidationStatus.APPROVED || 
            record.status == ValidationStatus.REJECTED,
            "QO: Cannot dispute"
        );
        require(
            block.timestamp <= record.resolvedAt + disputeTimeout,
            "QO: Dispute timeout"
        );

        record.status = ValidationStatus.DISPUTED;
        sectorStats[record.entityType].totalDisputes++;

        emit DisputeRaised(_validationId, msg.sender, _reason);
    }

    /**
     * @notice Resolver una disputa (solo árbitros)
     * @param _validationId ID de la validación
     * @param _inFavorOfOwner Si la resolución favorece al propietario
     */
    function resolveDispute(
        uint256 _validationId,
        bool _inFavorOfOwner
    ) external onlyRole(ARBITRATOR_ROLE) nonReentrant {
        ValidationRecord storage record = validations[_validationId];
        require(record.status == ValidationStatus.DISPUTED, "QO: Not disputed");

        record.status = ValidationStatus.RESOLVED;
        record.resolvedAt = block.timestamp;

        uint256 penaltyAmount = record.collateralLocked / 10; // 10% como penalización

        if (_inFavorOfOwner) {
            // Slashear al validador
            _slashValidator(record.validator, penaltyAmount);
            bezToken.safeTransfer(record.owner, penaltyAmount);
            validators[record.validator].disputesLost++;
            emit DisputeResolved(_validationId, record.owner, penaltyAmount);
        } else {
            // Penalizar al propietario
            bezToken.safeTransfer(treasuryDAO, penaltyAmount);
            _updateUserReputation(record.owner, false, 0);
            emit DisputeResolved(_validationId, record.validator, penaltyAmount);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                       VALIDATOR MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Registrarse como validador
     * @param _stakeAmount Cantidad a stakear
     */
    function registerAsValidator(uint256 _stakeAmount) external nonReentrant {
        require(_stakeAmount >= validatorMinStake, "QO: Insufficient stake");
        require(!validators[msg.sender].isActive, "QO: Already validator");

        bezToken.safeTransferFrom(msg.sender, address(this), _stakeAmount);

        validators[msg.sender] = ValidatorProfile({
            totalValidations: 0,
            successfulValidations: 0,
            disputesLost: 0,
            reputationScore: 5000, // Empieza en 50%
            stakedAmount: _stakeAmount,
            isActive: true
        });

        _grantRole(VALIDATOR_ROLE, msg.sender);

        emit ValidatorRegistered(msg.sender, _stakeAmount);
    }

    /**
     * @notice Slashear stake de un validador
     */
    function _slashValidator(address _validator, uint256 _amount) internal {
        ValidatorProfile storage profile = validators[_validator];
        
        uint256 slashAmount = _amount;
        if (slashAmount > profile.stakedAmount) {
            slashAmount = profile.stakedAmount;
        }
        
        profile.stakedAmount -= slashAmount;
        profile.reputationScore = profile.reputationScore > 500 
            ? profile.reputationScore - 500 
            : 0;
        
        // Si stake cae por debajo del mínimo, desactivar
        if (profile.stakedAmount < validatorMinStake) {
            profile.isActive = false;
            _revokeRole(VALIDATOR_ROLE, _validator);
        }

        bezToken.safeTransfer(treasuryDAO, slashAmount);

        emit ValidatorSlashed(_validator, slashAmount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                       INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    function _updateUserReputation(address _user, bool _positive, uint8 _score) internal {
        uint256 currentRep = userReputationScore[_user];
        if (currentRep == 0) currentRep = 5000; // Base 50%
        
        if (_positive) {
            uint256 bonus = uint256(_score) * 10;
            userReputationScore[_user] = currentRep + bonus > PRECISION 
                ? PRECISION 
                : currentRep + bonus;
        } else {
            uint256 penalty = (100 - uint256(_score)) * 10;
            userReputationScore[_user] = currentRep > penalty 
                ? currentRep - penalty 
                : 0;
        }
    }

    function _updateSectorAverageQuality(EntityType _entityType, uint8 _score) internal {
        SectorStats storage stats = sectorStats[_entityType];
        uint256 totalScores = stats.totalApproved + stats.totalRejected;
        if (totalScores == 0) {
            stats.averageQuality = _score;
        } else {
            stats.averageQuality = 
                ((stats.averageQuality * (totalScores - 1)) + _score) / totalScores;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                         VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function getValidation(uint256 _validationId) external view returns (ValidationRecord memory) {
        return validations[_validationId];
    }

    function getUserValidations(address _user) external view returns (uint256[] memory) {
        return userValidations[_user];
    }

    function getSectorStats(EntityType _entityType) external view returns (SectorStats memory) {
        return sectorStats[_entityType];
    }

    function getValidatorProfile(address _validator) external view returns (ValidatorProfile memory) {
        return validators[_validator];
    }

    function getEntityConfig(EntityType _entityType) external view returns (EntityConfig memory) {
        return entityConfigs[_entityType];
    }

    function isValidated(bytes32 _entityHash) external view returns (bool, uint8) {
        uint256 validationId = entityToValidation[_entityHash];
        if (validationId == 0) return (false, 0);
        
        ValidationRecord memory record = validations[validationId];
        return (record.status == ValidationStatus.APPROVED, record.qualityScore);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                         ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function updateEntityConfig(
        EntityType _entityType,
        uint256 _minQualityThreshold,
        uint256 _collateralRequired,
        uint256 _validationFee,
        uint256 _penaltyMultiplier,
        uint256 _rewardMultiplier,
        bool _requiresHumanReview,
        bool _isActive
    ) external onlyRole(DAO_ROLE) {
        entityConfigs[_entityType] = EntityConfig({
            minQualityThreshold: _minQualityThreshold,
            collateralRequired: _collateralRequired,
            validationFee: _validationFee,
            penaltyMultiplier: _penaltyMultiplier,
            rewardMultiplier: _rewardMultiplier,
            requiresHumanReview: _requiresHumanReview,
            isActive: _isActive
        });

        emit EntityConfigUpdated(_entityType);
    }

    function updateTreasury(address _newTreasury) external onlyRole(ADMIN_ROLE) {
        require(_newTreasury != address(0), "QO: Invalid address");
        address oldTreasury = treasuryDAO;
        treasuryDAO = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    function updateDisputeTimeout(uint256 _timeout) external onlyRole(ADMIN_ROLE) {
        disputeTimeout = _timeout;
    }

    function updateValidatorMinStake(uint256 _minStake) external onlyRole(DAO_ROLE) {
        validatorMinStake = _minStake;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Recuperar tokens enviados por error
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyRole(ADMIN_ROLE) {
        IERC20(_token).safeTransfer(treasuryDAO, _amount);
    }
}
