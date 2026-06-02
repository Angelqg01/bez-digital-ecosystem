// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BeZhas RWA Factory
 * @dev Factory para crear activos tokenizados (Real World Assets) con ERC-1155
 * Soporta: Inmuebles, Hoteles, Vehículos, Objetos de Lujo
 */
contract BeZhasRWAFactory is ERC1155, Ownable, ReentrancyGuard, Pausable {
    IERC20 public immutable bezCoin;
    uint256 public tokenizationFee = 100 * 10**18; // 100 BEZ
    uint256 public assetCount;

    // Categorías de activos
    enum AssetCategory { 
        INMUEBLE,      // Casas, apartamentos
        HOTEL,         // Hoteles, resorts
        LOCAL,         // Locales comerciales
        ROPA,          // Moda, textiles
        COCHE,         // Vehículos terrestres
        BARCO,         // Yates, barcos
        HELICOPTERO,   // Aeronaves
        OBJETO         // Arte, joyas, coleccionables
    }

    struct Asset {
        string name;
        AssetCategory category;
        string legalDocumentCID;  // Hash IPFS de documentación legal
        string imagesCID;         // Hash IPFS de imágenes
        uint256 totalSupply;      // Total de fracciones
        uint256 valuationUSD;     // Valoración en USD
        uint256 pricePerFraction; // Precio en BEZ por fracción
        uint256 estimatedYield;   // APY estimado (en basis points: 850 = 8.5%)
        address creator;
        string location;          // Ubicación física o especificaciones
        uint256 createdAt;
        bool isActive;
    }

    mapping(uint256 => Asset) public assets;
    mapping(address => uint256[]) public creatorAssets; // Assets by creator
    mapping(uint256 => mapping(address => bool)) public isVerified; // KYC verification per asset

    event AssetTokenized(
        uint256 indexed assetId, 
        string name, 
        AssetCategory category,
        address indexed creator,
        uint256 totalSupply,
        uint256 valuationUSD
    );
    event FractionsTransferred(uint256 indexed assetId, address indexed from, address indexed to, uint256 amount);
    event AssetVerified(uint256 indexed assetId, address indexed investor);

    constructor() ERC1155("https://api.bezhas.com/rwa/metadata/{id}.json") Ownable(msg.sender) {
        bezCoin = IERC20(0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8);
    }

    /**
     * @dev Tokeniza un activo físico como fracciones ERC-1155
     * @param _name Nombre del activo
     * @param _category Categoría del activo
     * @param _legalCID Hash IPFS de documentación legal
     * @param _imagesCID Hash IPFS de imágenes
     * @param _supply Total de fracciones a crear
     * @param _valuationUSD Valoración total en USD
     * @param _pricePerFraction Precio en BEZ por fracción
     * @param _estimatedYield APY estimado (ej: 850 = 8.5%)
     * @param _location Ubicación o especificaciones
     */
    function tokenizeAsset(
        string memory _name,
        AssetCategory _category,
        string memory _legalCID,
        string memory _imagesCID,
        uint256 _supply,
        uint256 _valuationUSD,
        uint256 _pricePerFraction,
        uint256 _estimatedYield,
        string memory _location
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(_supply > 0, "Supply must be > 0");
        require(_valuationUSD > 0, "Valuation must be > 0");
        require(_pricePerFraction > 0, "Price must be > 0");
        require(bytes(_legalCID).length > 0, "Legal documentation required");

        // Cobrar fee de tokenización
        require(
            bezCoin.transferFrom(msg.sender, owner(), tokenizationFee),
            "Tokenization fee payment failed"
        );

        assetCount++;
        uint256 newAssetId = assetCount;

        // Crear registro del activo
        assets[newAssetId] = Asset({
            name: _name,
            category: _category,
            legalDocumentCID: _legalCID,
            imagesCID: _imagesCID,
            totalSupply: _supply,
            valuationUSD: _valuationUSD,
            pricePerFraction: _pricePerFraction,
            estimatedYield: _estimatedYield,
            creator: msg.sender,
            location: _location,
            createdAt: block.timestamp,
            isActive: true
        });

        creatorAssets[msg.sender].push(newAssetId);

        // Mintear las fracciones al creador
        _mint(msg.sender, newAssetId, _supply, "");

        emit AssetTokenized(
            newAssetId,
            _name,
            _category,
            msg.sender,
            _supply,
            _valuationUSD
        );

        return newAssetId;
    }

    /**
     * @dev Obtener información de un activo
     */
    function getAsset(uint256 assetId) external view returns (Asset memory) {
        require(assetId > 0 && assetId <= assetCount, "Invalid asset ID");
        return assets[assetId];
    }

    /**
     * @dev Obtener todos los activos de un creador
     */
    function getCreatorAssets(address creator) external view returns (uint256[] memory) {
        return creatorAssets[creator];
    }

    /**
     * @dev Verificar KYC para un inversor específico
     * Solo el owner puede verificar (plataforma BeZhas)
     */
    function verifyInvestor(uint256 assetId, address investor) external onlyOwner {
        require(assetId > 0 && assetId <= assetCount, "Invalid asset ID");
        isVerified[assetId][investor] = true;
        emit AssetVerified(assetId, investor);
    }

    /**
     * @dev Actualizar fee de tokenización
     */
    function updateTokenizationFee(uint256 newFee) external onlyOwner {
        tokenizationFee = newFee;
    }

    /**
     * @dev Actualizar URI base de metadata
     */
    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    /**
     * @dev Desactivar un activo (en caso de problemas legales)
     */
    function deactivateAsset(uint256 assetId) external onlyOwner {
        require(assetId > 0 && assetId <= assetCount, "Invalid asset ID");
        assets[assetId].isActive = false;
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Override para añadir verificación KYC en transferencias de alto valor
     * Para categorías INMUEBLE, HOTEL, BARCO, HELICOPTERO requiere verificación
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        Asset memory asset = assets[id];
        
        // Para activos de alto valor, requerir KYC
        if (
            asset.category == AssetCategory.INMUEBLE ||
            asset.category == AssetCategory.HOTEL ||
            asset.category == AssetCategory.BARCO ||
            asset.category == AssetCategory.HELICOPTERO
        ) {
            require(
                isVerified[id][to] || amount < asset.totalSupply / 10,
                "KYC verification required for large purchases"
            );
        }

        super.safeTransferFrom(from, to, id, amount, data);
        emit FractionsTransferred(id, from, to, amount);
    }
}
