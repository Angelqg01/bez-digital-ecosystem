// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BeZhasMarketplace is ReentrancyGuard, Ownable {
    IERC20 public bezhasToken;
    uint256 public vendorFee;
    uint256 public platformCommission; // Base 10000 (ej: 250 = 2.5%)
    
    // ============================================================
    // BURN MECHANISM - 0.4% de cada venta se envía a burn address
    // ============================================================
    address public constant BURN_ADDRESS = 0x89c23890c742d710265dD61be789C71dC8999b12;
    uint256 public burnRate = 40; // 0.4% = 40/10000
    bool public burnEnabled = true;

    // Mappings mínimos (Solo lo crítico para validar transacciones)
    mapping(address => bool) public isVendor;
    mapping(uint256 => uint256) public productPrices; // ID => Precio
    mapping(uint256 => address) public productSellers; // ID => Vendedor
    uint256 public productCounter;
    
    // Estadísticas de burn
    uint256 public totalBurned;

    // --- EVENTOS CLAVE PARA TU NODE.JS ---
    // Estos eventos son lo que tu backend escuchará
    event VendorStatusUpdated(address indexed user, bool status, uint256 timestamp);
    event ProductCreated(uint256 indexed id, address indexed seller, uint256 price, string metadataCID);
    event ProductSold(uint256 indexed id, address indexed buyer, uint256 price, uint256 timestamp);
    event PriceUpdated(uint256 indexed id, uint256 newPrice);
    
    // Eventos de Burn
    event TokensBurned(uint256 indexed productId, uint256 burnAmount, uint256 totalBurnedToDate);
    event BurnRateUpdated(uint256 oldRate, uint256 newRate);
    event BurnToggled(bool enabled);

    constructor(address _token, uint256 _fee, uint256 _commission) Ownable(msg.sender) {
        bezhasToken = IERC20(_token);
        vendorFee = _fee;
        platformCommission = _commission;
    }
    
    // ============================================================
    // ADMIN FUNCTIONS - Burn Configuration
    // ============================================================
    
    /**
     * @dev Actualiza la tasa de burn (solo owner)
     * @param _newRate Nueva tasa en base 10000 (ej: 40 = 0.4%)
     */
    function setBurnRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 500, "Max burn rate is 5%");
        uint256 oldRate = burnRate;
        burnRate = _newRate;
        emit BurnRateUpdated(oldRate, _newRate);
    }
    
    /**
     * @dev Habilita/deshabilita el burn (solo owner)
     */
    function toggleBurn(bool _enabled) external onlyOwner {
        burnEnabled = _enabled;
        emit BurnToggled(_enabled);
    }

    // 1. Registro de Vendedor (Sync con Backend)
    function registerAsVendor() external nonReentrant {
        require(!isVendor[msg.sender], "Ya eres vendedor");
        require(bezhasToken.transferFrom(msg.sender, owner(), vendorFee), "Pago fallido");
        
        isVendor[msg.sender] = true;
        emit VendorStatusUpdated(msg.sender, true, block.timestamp);
    }

    // 2. Crear Producto (Sync con Backend)
    // Nota: metadataCID es el hash de IPFS o el ID de tu DB si decides no usar IPFS para data
    function createProduct(uint256 _price, string memory _metadataCID) external {
        require(isVendor[msg.sender], "No autorizado");
        
        productCounter++;
        productPrices[productCounter] = _price;
        productSellers[productCounter] = msg.sender;

        emit ProductCreated(productCounter, msg.sender, _price, _metadataCID);
    }

    // 3. Comprar (Lógica Financiera con BURN)
    function buyProduct(uint256 _id) external nonReentrant {
        uint256 price = productPrices[_id];
        address seller = productSellers[_id];
        require(price > 0, "Producto no existe");
        
        // Calcular comisiones y burn
        uint256 commission = (price * platformCommission) / 10000;
        uint256 burnAmount = burnEnabled ? (price * burnRate) / 10000 : 0;
        uint256 sellerNet = price - commission - burnAmount;

        // 1. Cobrar el precio total al comprador
        require(bezhasToken.transferFrom(msg.sender, address(this), price), "Cobro fallido");
        
        // 2. Enviar comisión a la plataforma (owner)
        require(bezhasToken.transfer(owner(), commission), "Error comision");
        
        // 3. Enviar tokens al vendedor
        require(bezhasToken.transfer(seller, sellerNet), "Error pago vendedor");
        
        // 4. BURN: Enviar a la dirección de quemado (si está habilitado)
        if (burnEnabled && burnAmount > 0) {
            require(bezhasToken.transfer(BURN_ADDRESS, burnAmount), "Error burn");
            totalBurned += burnAmount;
            emit TokensBurned(_id, burnAmount, totalBurned);
        }

        // Opcional: Borrar precio para evitar re-compra si es item único
        // productPrices[_id] = 0; 

        emit ProductSold(_id, msg.sender, price, block.timestamp);
    }
    
    // ============================================================
    // VIEW FUNCTIONS
    // ============================================================
    
    /**
     * @dev Calcula el desglose de una compra
     * @param _price Precio del producto
     * @return commission Comisión de la plataforma
     * @return burn Cantidad a quemar
     * @return sellerNet Cantidad neta para el vendedor
     */
    function calculateFees(uint256 _price) external view returns (
        uint256 commission,
        uint256 burn,
        uint256 sellerNet
    ) {
        commission = (_price * platformCommission) / 10000;
        burn = burnEnabled ? (_price * burnRate) / 10000 : 0;
        sellerNet = _price - commission - burn;
    }
    
    /**
     * @dev Obtiene estadísticas del burn
     */
    function getBurnStats() external view returns (
        bool enabled,
        uint256 rate,
        uint256 totalBurnedAmount,
        address burnAddress
    ) {
        return (burnEnabled, burnRate, totalBurned, BURN_ADDRESS);
    }
}
