// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title FractionalNFT
 * @dev Contrato para fraccionalizar NFTs ERC721 en tokens ERC1155
 * Permite convertir NFTs costosos en múltiples fracciones comercializables
 */
contract FractionalNFT is ERC1155, Ownable, ReentrancyGuard {
    uint256 private _fractionIdCounter;
    
    struct FractionInfo {
        address nftContract;      // Contrato del NFT original
        uint256 tokenId;          // ID del token original
        address originalOwner;    // Dueño original del NFT
        uint256 totalFractions;   // Total de fracciones creadas
        uint256 pricePerFraction; // Precio por fracción en wei
        uint256 fractionsSold;    // Fracciones vendidas
        bool isActive;            // Si está activo para venta
        bool isReassembled;       // Si ya fue reensamblado
        uint256 createdAt;        // Timestamp de creación
    }
    
    // Mapeo de ID de fracción => Información
    mapping(uint256 => FractionInfo) public fractions;
    
    // Mapeo de holder => fractionId => cantidad de fracciones que posee
    mapping(address => mapping(uint256 => uint256)) public fractionsOwned;
    
    // Fee del protocolo (en basis points, 250 = 2.5%)
    uint256 public protocolFee = 250;
    address public feeRecipient;
    
    // Eventos
    event NFTFractionalized(
        uint256 indexed fractionId,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256 totalFractions,
        uint256 pricePerFraction
    );
    
    event FractionPurchased(
        uint256 indexed fractionId,
        address indexed buyer,
        uint256 amount,
        uint256 totalPrice
    );
    
    event NFTReassembled(
        uint256 indexed fractionId,
        address indexed newOwner,
        address nftContract,
        uint256 tokenId
    );
    
    event FractionPriceUpdated(
        uint256 indexed fractionId,
        uint256 oldPrice,
        uint256 newPrice
    );
    
    constructor(address _feeRecipient) ERC1155("https://api.bezhas.com/metadata/{id}.json") Ownable(msg.sender) {
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Fraccionalizar un NFT ERC721
     * @param nftContract Dirección del contrato NFT
     * @param tokenId ID del token a fraccionalizar
     * @param totalFractions Número total de fracciones a crear
     * @param pricePerFraction Precio por fracción en wei
     */
    function fractionalizeNFT(
        address nftContract,
        uint256 tokenId,
        uint256 totalFractions,
        uint256 pricePerFraction
    ) external nonReentrant returns (uint256) {
        require(totalFractions > 1, "Debe crear al menos 2 fracciones");
        require(totalFractions <= 10000, "Maximo 10000 fracciones");
        require(pricePerFraction > 0, "Precio debe ser mayor a 0");
        
        // Transferir el NFT al contrato
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        
        _fractionIdCounter++;
        uint256 fractionId = _fractionIdCounter;
        
        // Guardar información de la fracción
        fractions[fractionId] = FractionInfo({
            nftContract: nftContract,
            tokenId: tokenId,
            originalOwner: msg.sender,
            totalFractions: totalFractions,
            pricePerFraction: pricePerFraction,
            fractionsSold: 0,
            isActive: true,
            isReassembled: false,
            createdAt: block.timestamp
        });
        
        // Mintear todas las fracciones al owner original
        _mint(msg.sender, fractionId, totalFractions, "");
        fractionsOwned[msg.sender][fractionId] = totalFractions;
        
        emit NFTFractionalized(
            fractionId,
            nftContract,
            tokenId,
            totalFractions,
            pricePerFraction
        );
        
        return fractionId;
    }
    
    /**
     * @dev Comprar fracciones de un NFT
     * @param fractionId ID de la fracción
     * @param amount Cantidad de fracciones a comprar
     */
    function buyFractions(uint256 fractionId, uint256 amount) 
        external 
        payable 
        nonReentrant 
    {
        FractionInfo storage fraction = fractions[fractionId];
        require(fraction.isActive, "Fraccion no activa");
        require(!fraction.isReassembled, "NFT ya fue reensamblado");
        require(amount > 0, "Cantidad debe ser mayor a 0");
        
        uint256 totalPrice = fraction.pricePerFraction * amount;
        require(msg.value >= totalPrice, "ETH insuficiente");
        
        // Verificar que el owner original tiene suficientes fracciones
        require(
            fractionsOwned[fraction.originalOwner][fractionId] >= amount,
            "Fracciones insuficientes disponibles"
        );
        
        // Calcular fee del protocolo
        uint256 fee = (totalPrice * protocolFee) / 10000;
        uint256 sellerAmount = totalPrice - fee;
        
        // Transferir fracciones
        _safeTransferFrom(
            fraction.originalOwner,
            msg.sender,
            fractionId,
            amount,
            ""
        );
        
        // Actualizar contadores
        fractionsOwned[fraction.originalOwner][fractionId] -= amount;
        fractionsOwned[msg.sender][fractionId] += amount;
        fraction.fractionsSold += amount;
        
        // Transferir pagos
        payable(feeRecipient).transfer(fee);
        payable(fraction.originalOwner).transfer(sellerAmount);
        
        // Refund exceso
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }
        
        emit FractionPurchased(fractionId, msg.sender, amount, totalPrice);
    }
    
    /**
     * @dev Reensamblar el NFT original cuando alguien posee todas las fracciones
     * @param fractionId ID de la fracción
     */
    function reassembleNFT(uint256 fractionId) external nonReentrant {
        FractionInfo storage fraction = fractions[fractionId];
        require(!fraction.isReassembled, "NFT ya fue reensamblado");
        require(
            balanceOf(msg.sender, fractionId) == fraction.totalFractions,
            "Debes poseer todas las fracciones"
        );
        
        // Quemar todas las fracciones
        _burn(msg.sender, fractionId, fraction.totalFractions);
        fractionsOwned[msg.sender][fractionId] = 0;
        
        // Marcar como reensamblado
        fraction.isReassembled = true;
        fraction.isActive = false;
        
        // Transferir el NFT original al nuevo dueño
        IERC721(fraction.nftContract).transferFrom(
            address(this),
            msg.sender,
            fraction.tokenId
        );
        
        emit NFTReassembled(
            fractionId,
            msg.sender,
            fraction.nftContract,
            fraction.tokenId
        );
    }
    
    /**
     * @dev Actualizar precio por fracción (solo owner original)
     * @param fractionId ID de la fracción
     * @param newPrice Nuevo precio por fracción
     */
    function updateFractionPrice(uint256 fractionId, uint256 newPrice) 
        external 
    {
        FractionInfo storage fraction = fractions[fractionId];
        require(msg.sender == fraction.originalOwner, "Solo el owner original");
        require(fraction.isActive, "Fraccion no activa");
        require(!fraction.isReassembled, "NFT ya fue reensamblado");
        require(newPrice > 0, "Precio debe ser mayor a 0");
        
        uint256 oldPrice = fraction.pricePerFraction;
        fraction.pricePerFraction = newPrice;
        
        emit FractionPriceUpdated(fractionId, oldPrice, newPrice);
    }
    
    /**
     * @dev Toggle estado activo de una fracción
     * @param fractionId ID de la fracción
     */
    function toggleFractionActive(uint256 fractionId) external {
        FractionInfo storage fraction = fractions[fractionId];
        require(msg.sender == fraction.originalOwner, "Solo el owner original");
        require(!fraction.isReassembled, "NFT ya fue reensamblado");
        
        fraction.isActive = !fraction.isActive;
    }
    
    /**
     * @dev Actualizar fee del protocolo (solo owner)
     * @param newFee Nuevo fee en basis points
     */
    function updateProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee maximo 10%");
        protocolFee = newFee;
    }
    
    /**
     * @dev Actualizar receptor de fees (solo owner)
     * @param newRecipient Nueva dirección
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Direccion invalida");
        feeRecipient = newRecipient;
    }
    
    /**
     * @dev Obtener información de una fracción
     * @param fractionId ID de la fracción
     */
    function getFractionInfo(uint256 fractionId) 
        external 
        view 
        returns (FractionInfo memory) 
    {
        return fractions[fractionId];
    }
    
    /**
     * @dev Obtener cantidad de fracciones disponibles para compra
     * @param fractionId ID de la fracción
     */
    function getAvailableFractions(uint256 fractionId) 
        external 
        view 
        returns (uint256) 
    {
        FractionInfo memory fraction = fractions[fractionId];
        return fractionsOwned[fraction.originalOwner][fractionId];
    }
    
    /**
     * @dev Override para tracking de ownership
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal virtual override {
        super._update(from, to, ids, values);
        
        // Actualizar tracking si no es mint o burn
        if (from != address(0) && to != address(0)) {
            for (uint256 i = 0; i < ids.length; i++) {
                fractionsOwned[from][ids[i]] -= values[i];
                fractionsOwned[to][ids[i]] += values[i];
            }
        }
    }
}
