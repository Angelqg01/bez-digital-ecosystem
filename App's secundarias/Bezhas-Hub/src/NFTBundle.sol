// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title NFTBundle
 * @dev Contrato para crear y vender paquetes de múltiples NFTs
 * Permite crear colecciones limitadas con descuentos
 */
contract NFTBundle is Ownable, ReentrancyGuard {
    IERC20 public immutable paymentToken; // BEZ token
    
    uint256 private _bundleIdCounter;
    
    struct NFTItem {
        address nftContract;
        uint256 tokenId;
    }
    
    struct Bundle {
        uint256 bundleId;
        string name;
        string description;
        address creator;
        NFTItem[] items;
        uint256 totalPrice;        // Precio total del bundle
        uint256 originalPrice;     // Precio suma de items individuales
        uint256 discountPercent;   // Descuento en porcentaje (20 = 20%)
        uint256 maxSupply;         // Supply máximo (0 = ilimitado)
        uint256 sold;              // Cantidad vendida
        bool isActive;
        bool isLimited;            // Si es edición limitada
        uint256 createdAt;
        uint256 expiresAt;         // 0 = no expira
    }
    
    struct Purchase {
        uint256 bundleId;
        address buyer;
        uint256 purchasedAt;
        uint256 pricePaid;
    }
    
    // Bundles
    mapping(uint256 => Bundle) public bundles;
    mapping(address => uint256[]) public creatorBundles;
    
    // Purchases
    mapping(uint256 => Purchase[]) public bundlePurchases; // bundleId => purchases
    mapping(address => uint256[]) public userPurchases; // user => bundleIds
    
    // Fee del protocolo (250 = 2.5%)
    uint256 public protocolFee = 250;
    address public feeRecipient;
    
    // Eventos
    event BundleCreated(
        uint256 indexed bundleId,
        address indexed creator,
        string name,
        uint256 totalPrice,
        uint256 discountPercent
    );
    
    event BundlePurchased(
        uint256 indexed bundleId,
        address indexed buyer,
        uint256 pricePaid
    );
    
    event BundleUpdated(uint256 indexed bundleId);
    event BundleCancelled(uint256 indexed bundleId);
    
    constructor(address _paymentToken, address _feeRecipient) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @dev Crear un nuevo bundle
     */
    function createBundle(
        string memory name,
        string memory description,
        NFTItem[] memory items,
        uint256 totalPrice,
        uint256 originalPrice,
        uint256 discountPercent,
        uint256 maxSupply,
        bool isLimited,
        uint256 expiresAt
    ) external nonReentrant returns (uint256) {
        require(items.length >= 2, "Minimo 2 NFTs");
        require(items.length <= 20, "Maximo 20 NFTs");
        require(totalPrice > 0, "Precio invalido");
        require(discountPercent <= 90, "Descuento maximo 90%");
        require(
            expiresAt == 0 || expiresAt > block.timestamp,
            "Fecha expiracion invalida"
        );
        
        // Verificar ownership de todos los NFTs
        for (uint256 i = 0; i < items.length; i++) {
            require(
                IERC721(items[i].nftContract).ownerOf(items[i].tokenId) == msg.sender,
                "No eres owner del NFT"
            );
            
            // Transferir NFT al contrato (escrow)
            IERC721(items[i].nftContract).transferFrom(
                msg.sender,
                address(this),
                items[i].tokenId
            );
        }
        
        _bundleIdCounter++;
        uint256 bundleId = _bundleIdCounter;
        
        Bundle storage bundle = bundles[bundleId];
        bundle.bundleId = bundleId;
        bundle.name = name;
        bundle.description = description;
        bundle.creator = msg.sender;
        bundle.totalPrice = totalPrice;
        bundle.originalPrice = originalPrice;
        bundle.discountPercent = discountPercent;
        bundle.maxSupply = maxSupply;
        bundle.sold = 0;
        bundle.isActive = true;
        bundle.isLimited = isLimited;
        bundle.createdAt = block.timestamp;
        bundle.expiresAt = expiresAt;
        
        // Copiar items
        for (uint256 i = 0; i < items.length; i++) {
            bundle.items.push(items[i]);
        }
        
        creatorBundles[msg.sender].push(bundleId);
        
        emit BundleCreated(
            bundleId,
            msg.sender,
            name,
            totalPrice,
            discountPercent
        );
        
        return bundleId;
    }
    
    /**
     * @dev Comprar un bundle
     * @param bundleId ID del bundle
     */
    function purchaseBundle(uint256 bundleId) 
        external 
        nonReentrant 
    {
        Bundle storage bundle = bundles[bundleId];
        
        require(bundle.isActive, "Bundle no activo");
        require(
            bundle.expiresAt == 0 || block.timestamp <= bundle.expiresAt,
            "Bundle expirado"
        );
        require(
            bundle.maxSupply == 0 || bundle.sold < bundle.maxSupply,
            "Bundle sold out"
        );
        
        uint256 price = bundle.totalPrice;
        
        // Transferir pago
        require(
            paymentToken.transferFrom(msg.sender, address(this), price),
            "Transfer fallido"
        );
        
        // Calcular fee
        uint256 fee = (price * protocolFee) / 10000;
        uint256 creatorPayment = price - fee;
        
        // Pagar al creator y fee
        require(
            paymentToken.transfer(bundle.creator, creatorPayment),
            "Pago creator fallido"
        );
        require(
            paymentToken.transfer(feeRecipient, fee),
            "Pago fee fallido"
        );
        
        // Transferir todos los NFTs al comprador
        for (uint256 i = 0; i < bundle.items.length; i++) {
            IERC721(bundle.items[i].nftContract).transferFrom(
                address(this),
                msg.sender,
                bundle.items[i].tokenId
            );
        }
        
        // Registrar compra
        bundlePurchases[bundleId].push(Purchase({
            bundleId: bundleId,
            buyer: msg.sender,
            purchasedAt: block.timestamp,
            pricePaid: price
        }));
        
        userPurchases[msg.sender].push(bundleId);
        bundle.sold++;
        
        // Desactivar si alcanzó maxSupply
        if (bundle.maxSupply > 0 && bundle.sold >= bundle.maxSupply) {
            bundle.isActive = false;
        }
        
        emit BundlePurchased(bundleId, msg.sender, price);
    }
    
    /**
     * @dev Actualizar precio de un bundle
     */
    function updateBundlePrice(uint256 bundleId, uint256 newPrice) 
        external 
    {
        Bundle storage bundle = bundles[bundleId];
        require(bundle.creator == msg.sender, "No eres el creator");
        require(bundle.isActive, "Bundle no activo");
        require(bundle.sold == 0, "Ya hay ventas");
        require(newPrice > 0, "Precio invalido");
        
        bundle.totalPrice = newPrice;
        
        emit BundleUpdated(bundleId);
    }
    
    /**
     * @dev Cancelar bundle (solo si no hay ventas)
     */
    function cancelBundle(uint256 bundleId) external nonReentrant {
        Bundle storage bundle = bundles[bundleId];
        require(bundle.creator == msg.sender, "No eres el creator");
        require(bundle.isActive, "Bundle no activo");
        require(bundle.sold == 0, "Ya hay ventas");
        
        bundle.isActive = false;
        
        // Devolver NFTs al creator
        for (uint256 i = 0; i < bundle.items.length; i++) {
            IERC721(bundle.items[i].nftContract).transferFrom(
                address(this),
                msg.sender,
                bundle.items[i].tokenId
            );
        }
        
        emit BundleCancelled(bundleId);
    }
    
    /**
     * @dev Obtener items de un bundle
     */
    function getBundleItems(uint256 bundleId) 
        external 
        view 
        returns (NFTItem[] memory) 
    {
        return bundles[bundleId].items;
    }
    
    /**
     * @dev Obtener bundles de un creator
     */
    function getCreatorBundles(address creator) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return creatorBundles[creator];
    }
    
    /**
     * @dev Obtener compras de un usuario
     */
    function getUserPurchases(address user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userPurchases[user];
    }
    
    /**
     * @dev Obtener historial de compras de un bundle
     */
    function getBundlePurchaseHistory(uint256 bundleId) 
        external 
        view 
        returns (Purchase[] memory) 
    {
        return bundlePurchases[bundleId];
    }
    
    /**
     * @dev Actualizar protocol fee (solo owner)
     */
    function updateProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee maximo 10%");
        protocolFee = newFee;
    }
    
    /**
     * @dev Actualizar fee recipient (solo owner)
     */
    function updateFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "Direccion invalida");
        feeRecipient = newRecipient;
    }
}
