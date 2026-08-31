// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ContentValidator
 * @author BeZhas Development Team
 * @notice Contrato para certificar contenido en blockchain de forma inmutable
 * @dev Permite validación con pago en BezCoin o validación delegada (para pagos FIAT)
 */
contract ContentValidator is Ownable, ReentrancyGuard, Pausable {
    
    // ============================================
    // VARIABLES DE ESTADO
    // ============================================
    
    /// @notice Token BezCoin para pagos cripto
    IERC20 public bezCoinToken;
    
    /// @notice Tarifa de validación en BezCoin (con 18 decimales)
    uint256 public validationFeeBezCoin;
    
    /// @notice Tarifa de validación en Wei (para pagos ETH/MATIC)
    uint256 public validationFeeNative;
    
    /// @notice Contador de validaciones totales
    uint256 public totalValidations;
    
    /// @notice Wallet que recibe los pagos
    address public treasuryWallet;
    
    /// @notice Direcciones autorizadas para validaciones delegadas (backend)
    mapping(address => bool) public authorizedValidators;
    
    // ============================================
    // ESTRUCTURAS DE DATOS
    // ============================================
    
    /**
     * @notice Estructura que almacena los datos de cada validación
     * @param contentHash Hash SHA-256 del contenido (para verificar integridad)
     * @param author Dirección del wallet del autor del contenido
     * @param timestamp Momento exacto de la validación
     * @param contentUri URI para acceder al contenido (puede ser IPFS o DB ID)
     * @param contentType Tipo de contenido (post, reel, article, etc.)
     * @param validationId ID único de validación
     * @param paymentMethod Método de pago usado (crypto/fiat)
     * @param isActive Estado de la validación (para posibles revocaciones)
     */
    struct ContentValidation {
        bytes32 contentHash;
        address author;
        uint256 timestamp;
        string contentUri;
        string contentType;
        uint256 validationId;
        PaymentMethod paymentMethod;
        bool isActive;
    }
    
    /// @notice Métodos de pago soportados
    enum PaymentMethod {
        BezCoin,
        NativeCurrency,
        FiatDelegated
    }
    
    // ============================================
    // MAPPINGS Y STORAGE
    // ============================================
    
    /// @notice Mapping de hash de contenido => datos de validación
    mapping(bytes32 => ContentValidation) public validations;
    
    /// @notice Mapping de autor => array de hashes de sus contenidos validados
    mapping(address => bytes32[]) public authorValidations;
    
    /// @notice Mapping para verificar si un hash ya fue validado
    mapping(bytes32 => bool) public isValidated;
    
    /// @notice Mapping de validationId => contentHash
    mapping(uint256 => bytes32) public validationIdToHash;
    
    // ============================================
    // EVENTOS
    // ============================================
    
    /**
     * @notice Emitido cuando se valida contenido exitosamente
     */
    event ContentValidated(
        bytes32 indexed contentHash,
        address indexed author,
        uint256 timestamp,
        string contentUri,
        string contentType,
        uint256 validationId,
        PaymentMethod paymentMethod
    );
    
    /**
     * @notice Emitido cuando se actualiza la tarifa de validación
     */
    event ValidationFeeUpdated(
        uint256 newFeeBezCoin,
        uint256 newFeeNative
    );
    
    /**
     * @notice Emitido cuando se revoca una validación
     */
    event ValidationRevoked(
        bytes32 indexed contentHash,
        address indexed revokedBy,
        string reason
    );
    
    /**
     * @notice Emitido cuando se añade/remueve un validador autorizado
     */
    event ValidatorAuthorizationChanged(
        address indexed validator,
        bool authorized
    );
    
    // ============================================
    // MODIFICADORES
    // ============================================
    
    /**
     * @notice Solo validadores autorizados (para pagos FIAT)
     */
    modifier onlyAuthorizedValidator() {
        require(
            authorizedValidators[msg.sender] || msg.sender == owner(),
            "No autorizado para validar"
        );
        _;
    }
    
    /**
     * @notice Verifica que el contenido no esté ya validado
     */
    modifier notAlreadyValidated(bytes32 _contentHash) {
        require(!isValidated[_contentHash], "Contenido ya validado");
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @param _bezCoinToken Dirección del token BezCoin
     * @param _initialFeeBezCoin Tarifa inicial en BezCoin (ej: 10 * 10**18 = 10 BEZ)
     * @param _initialFeeNative Tarifa inicial en moneda nativa (ej: 0.01 MATIC)
     * @param _treasuryWallet Wallet que recibirá los pagos
     */
    constructor(
        address _bezCoinToken,
        uint256 _initialFeeBezCoin,
        uint256 _initialFeeNative,
        address _treasuryWallet
    ) Ownable(msg.sender) {
        require(_bezCoinToken != address(0), "Token invalido");
        require(_treasuryWallet != address(0), "Treasury invalido");
        
        bezCoinToken = IERC20(_bezCoinToken);
        validationFeeBezCoin = _initialFeeBezCoin;
        validationFeeNative = _initialFeeNative;
        treasuryWallet = _treasuryWallet;
        
        // El deployer es validador autorizado por defecto
        authorizedValidators[msg.sender] = true;
    }
    
    // ============================================
    // FUNCIONES PRINCIPALES
    // ============================================
    
    /**
     * @notice Valida contenido pagando con BezCoin
     * @param _contentHash Hash SHA-256 del contenido
     * @param _contentUri URI del contenido (IPFS, DB ID, etc.)
     * @param _contentType Tipo de contenido (post, reel, article)
     */
    function validateWithBezCoin(
        bytes32 _contentHash,
        string memory _contentUri,
        string memory _contentType
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        notAlreadyValidated(_contentHash) 
    {
        require(_contentHash != bytes32(0), "Hash invalido");
        require(bytes(_contentUri).length > 0, "URI invalida");
        
        // Transferir BezCoin del usuario al treasury
        require(
            bezCoinToken.transferFrom(msg.sender, treasuryWallet, validationFeeBezCoin),
            "Pago BezCoin fallido"
        );
        
        // Registrar validación
        _registerValidation(
            _contentHash,
            msg.sender,
            _contentUri,
            _contentType,
            PaymentMethod.BezCoin
        );
    }
    
    /**
     * @notice Valida contenido pagando con moneda nativa (ETH/MATIC)
     * @param _contentHash Hash SHA-256 del contenido
     * @param _contentUri URI del contenido
     * @param _contentType Tipo de contenido
     */
    function validateWithNative(
        bytes32 _contentHash,
        string memory _contentUri,
        string memory _contentType
    ) 
        external 
        payable
        nonReentrant 
        whenNotPaused 
        notAlreadyValidated(_contentHash) 
    {
        require(_contentHash != bytes32(0), "Hash invalido");
        require(bytes(_contentUri).length > 0, "URI invalida");
        require(msg.value >= validationFeeNative, "Pago insuficiente");
        
        // Transferir exceso de vuelta al usuario
        if (msg.value > validationFeeNative) {
            payable(msg.sender).transfer(msg.value - validationFeeNative);
        }
        
        // Transferir pago al treasury
        payable(treasuryWallet).transfer(validationFeeNative);
        
        // Registrar validación
        _registerValidation(
            _contentHash,
            msg.sender,
            _contentUri,
            _contentType,
            PaymentMethod.NativeCurrency
        );
    }
    
    /**
     * @notice Valida contenido de forma delegada (para pagos FIAT procesados por backend)
     * @dev Solo puede ser llamada por validadores autorizados
     * @param _contentHash Hash SHA-256 del contenido
     * @param _author Dirección del autor del contenido
     * @param _contentUri URI del contenido
     * @param _contentType Tipo de contenido
     */
    function validateDelegated(
        bytes32 _contentHash,
        address _author,
        string memory _contentUri,
        string memory _contentType
    ) 
        external 
        onlyAuthorizedValidator
        nonReentrant 
        whenNotPaused 
        notAlreadyValidated(_contentHash) 
    {
        require(_contentHash != bytes32(0), "Hash invalido");
        require(_author != address(0), "Autor invalido");
        require(bytes(_contentUri).length > 0, "URI invalida");
        
        // Registrar validación en nombre del autor
        _registerValidation(
            _contentHash,
            _author,
            _contentUri,
            _contentType,
            PaymentMethod.FiatDelegated
        );
    }
    
    /**
     * @notice Función interna para registrar validaciones
     */
    function _registerValidation(
        bytes32 _contentHash,
        address _author,
        string memory _contentUri,
        string memory _contentType,
        PaymentMethod _paymentMethod
    ) internal {
        totalValidations++;
        
        // Crear registro de validación
        ContentValidation memory validation = ContentValidation({
            contentHash: _contentHash,
            author: _author,
            timestamp: block.timestamp,
            contentUri: _contentUri,
            contentType: _contentType,
            validationId: totalValidations,
            paymentMethod: _paymentMethod,
            isActive: true
        });
        
        // Almacenar en mappings
        validations[_contentHash] = validation;
        isValidated[_contentHash] = true;
        authorValidations[_author].push(_contentHash);
        validationIdToHash[totalValidations] = _contentHash;
        
        // Emitir evento
        emit ContentValidated(
            _contentHash,
            _author,
            block.timestamp,
            _contentUri,
            _contentType,
            totalValidations,
            _paymentMethod
        );
    }
    
    // ============================================
    // FUNCIONES DE CONSULTA
    // ============================================
    
    /**
     * @notice Verifica si un contenido está validado
     */
    function isContentValidated(bytes32 _contentHash) external view returns (bool) {
        return isValidated[_contentHash] && validations[_contentHash].isActive;
    }
    
    /**
     * @notice Obtiene los datos completos de una validación
     */
    function getValidation(bytes32 _contentHash) 
        external 
        view 
        returns (ContentValidation memory) 
    {
        require(isValidated[_contentHash], "Contenido no validado");
        return validations[_contentHash];
    }
    
    /**
     * @notice Obtiene todos los contenidos validados por un autor
     */
    function getAuthorValidations(address _author) 
        external 
        view 
        returns (bytes32[] memory) 
    {
        return authorValidations[_author];
    }
    
    /**
     * @notice Obtiene validación por ID
     */
    function getValidationById(uint256 _validationId) 
        external 
        view 
        returns (ContentValidation memory) 
    {
        bytes32 hash = validationIdToHash[_validationId];
        require(hash != bytes32(0), "Validacion no existe");
        return validations[hash];
    }
    
    // ============================================
    // FUNCIONES DE ADMINISTRACIÓN
    // ============================================
    
    /**
     * @notice Actualiza las tarifas de validación
     */
    function updateValidationFees(
        uint256 _newFeeBezCoin,
        uint256 _newFeeNative
    ) external onlyOwner {
        validationFeeBezCoin = _newFeeBezCoin;
        validationFeeNative = _newFeeNative;
        emit ValidationFeeUpdated(_newFeeBezCoin, _newFeeNative);
    }
    
    /**
     * @notice Añade o remueve validadores autorizados
     */
    function setAuthorizedValidator(address _validator, bool _authorized) 
        external 
        onlyOwner 
    {
        require(_validator != address(0), "Direccion invalida");
        authorizedValidators[_validator] = _authorized;
        emit ValidatorAuthorizationChanged(_validator, _authorized);
    }
    
    /**
     * @notice Actualiza el wallet del treasury
     */
    function updateTreasuryWallet(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Treasury invalido");
        treasuryWallet = _newTreasury;
    }
    
    /**
     * @notice Revoca una validación (en casos de contenido ilegal/fraudulento)
     */
    function revokeValidation(bytes32 _contentHash, string memory _reason) 
        external 
        onlyOwner 
    {
        require(isValidated[_contentHash], "Contenido no validado");
        require(validations[_contentHash].isActive, "Ya revocado");
        
        validations[_contentHash].isActive = false;
        
        emit ValidationRevoked(_contentHash, msg.sender, _reason);
    }
    
    /**
     * @notice Pausa el contrato en caso de emergencia
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @notice Despausa el contrato
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @notice Retira fondos de emergencia (solo owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "Sin fondos");
        payable(owner()).transfer(balance);
    }
    
    // ============================================
    // RECEPCIÓN DE FONDOS
    // ============================================
    
    /**
     * @notice Permite al contrato recibir ETH/MATIC
     */
    receive() external payable {}
}
