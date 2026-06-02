// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LogisticsContainer is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;

    // --- CONFIGURACIÓN ECONÓMICA (Del ContentValidator) ---
    IERC20 public bezCoin;
    address public treasuryWallet;
    uint256 public validationFeeBezCoin;
    uint256 public validationFeeNative;

    // --- ESTRUCTURAS DE DATOS ---
    struct Checkpoint {
        string location;
        string status;
        uint256 timestamp;
        address updatedBy;
    }

    struct ContainerData {
        string idManual; 
        bytes32 contentHash; // Hash del Manifiesto de Carga (Integridad)
        string contentType;  // Ej: "Electronics", "Perishables"
        bool isDelivered;
        bool isValidated;    // Estado de validación oficial
    }

    // Mapeos
    mapping(uint256 => ContainerData) public containersData;
    mapping(uint256 => Checkpoint[]) public history;
    mapping(address => bool) public authorizedOperators; 
    mapping(address => bool) public customsAuthorities; // Aduanas

    // --- EVENTOS ---
    event ContainerMinted(uint256 indexed tokenId, string idManual, bytes32 contentHash, address owner);
    event StatusUpdated(uint256 indexed tokenId, string location, string status, address operator);
    event ValidationRevoked(uint256 indexed tokenId, address revokedBy, string reason);
    event FeesUpdated(uint256 feeBezCoin, uint256 feeNative);

    constructor(
        address _bezCoinToken,
        address _treasuryWallet,
        uint256 _feeBezCoin,
        uint256 _feeNative
    ) ERC721("Logistics NFT", "LNFT") {
        bezCoin = IERC20(_bezCoinToken);
        treasuryWallet = _treasuryWallet;
        validationFeeBezCoin = _feeBezCoin;
        validationFeeNative = _feeNative;
        authorizedOperators[msg.sender] = true;
    }

    // --- MODIFIERS ---
    modifier onlyAuthorized() {
        require(authorizedOperators[msg.sender] || owner() == msg.sender, "No autorizado: Operador");
        _;
    }

    modifier onlyCustoms() {
        require(customsAuthorities[msg.sender] || owner() == msg.sender, "No autorizado: Aduana");
        _;
    }

    // --- FUNCIONES DE GESTIÓN ---
    function setFees(uint256 _feeBezCoin, uint256 _feeNative) external onlyOwner {
        validationFeeBezCoin = _feeBezCoin;
        validationFeeNative = _feeNative;
        emit FeesUpdated(_feeBezCoin, _feeNative);
    }

    function setAuthority(address _addr, bool _isCustoms) external onlyOwner {
        customsAuthorities[_addr] = _isCustoms;
    }

    function setOperator(address _addr, bool _isOperator) external onlyOwner {
        authorizedOperators[_addr] = _isOperator;
    }

    // --- CORE LOGISTICS + VALIDATION ---

    // 1. Registrar Contenedor pagando con BezCoin
    function mintWithBezCoin(
        address to,
        string memory _idManual,
        bytes32 _contentHash,
        string memory _contentType,
        string memory _initialLocation,
        string memory _tokenURI
    ) public returns (uint256) {
        // Cobrar Fee
        require(bezCoin.transferFrom(msg.sender, treasuryWallet, validationFeeBezCoin), "Fallo pago BezCoin");
        return _mintInternal(to, _idManual, _contentHash, _contentType, _initialLocation, _tokenURI);
    }

    // 2. Registrar Contenedor pagando con Native Token (ETH/BNB)
    function mintWithNative(
        address to,
        string memory _idManual,
        bytes32 _contentHash,
        string memory _contentType,
        string memory _initialLocation,
        string memory _tokenURI
    ) public payable returns (uint256) {
        require(msg.value >= validationFeeNative, "Pago insuficiente");
        (bool sent, ) = treasuryWallet.call{value: msg.value}("");
        require(sent, "Fallo envio ETH a tesoreria");
        
        return _mintInternal(to, _idManual, _contentHash, _contentType, _initialLocation, _tokenURI);
    }

    // Lógica interna de creación
    function _mintInternal(
        address to,
        string memory _idManual,
        bytes32 _contentHash,
        string memory _contentType,
        string memory _initialLocation,
        string memory _tokenURI
    ) internal returns (uint256) {
        _tokenIds++;
        uint256 newItemId = _tokenIds;

        _mint(to, newItemId);
        _setTokenURI(newItemId, _tokenURI);

        containersData[newItemId] = ContainerData({
            idManual: _idManual,
            contentHash: _contentHash,
            contentType: _contentType,
            isDelivered: false,
            isValidated: true // Inicialmente validado al pagar
        });

        _updateHistory(newItemId, _initialLocation, "Registered & Validated");
        emit ContainerMinted(newItemId, _idManual, _contentHash, to);
        return newItemId;
    }

    // 3. Revocar Validación (Funcionalidad crítica del ContentValidator)
    function revokeValidation(uint256 tokenId, string memory reason) public onlyCustoms {
        require(_exists(tokenId), "Container no existe");
        containersData[tokenId].isValidated = false;
        
        _updateHistory(tokenId, "Customs Authority", string(abi.encodePacked("REVOKED: ", reason)));
        emit ValidationRevoked(tokenId, msg.sender, reason);
    }

    // 4. Actualizar Estado (Logística estándar)
    function updateStatus(uint256 tokenId, string memory _location, string memory _status) public onlyAuthorized {
        require(_exists(tokenId), "Contenedor inexistente");
        require(containersData[tokenId].isValidated, "Bloqueado: Validacion revocada");
        require(!containersData[tokenId].isDelivered, "Ya entregado");

        _updateHistory(tokenId, _location, _status);

        if (keccak256(bytes(_status)) == keccak256(bytes("Delivered"))) {
            containersData[tokenId].isDelivered = true;
        }

        emit StatusUpdated(tokenId, _location, _status, msg.sender);
    }

    function _updateHistory(uint256 tokenId, string memory _location, string memory _status) internal {
        history[tokenId].push(Checkpoint({
            location: _location,
            status: _status,
            timestamp: block.timestamp,
            updatedBy: msg.sender
        }));
    }

    function getContainerDetails(uint256 tokenId) public view returns (ContainerData memory) {
        return containersData[tokenId];
    }
}