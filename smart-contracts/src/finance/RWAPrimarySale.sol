// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @dev Lo que RWAPrimarySale necesita del RWAFactory desplegado. El struct
 *      replica `BeZhasRWAFactory.Asset` campo a campo: el ABI del getter
 *      depende del orden.
 */
interface IRWAFactory {
    struct Asset {
        string name;
        uint8 category;
        string legalDocumentCID;
        string imagesCID;
        uint256 totalSupply;
        uint256 valuationUSD;
        uint256 pricePerFraction;
        uint256 estimatedYield;
        address creator;
        string location;
        uint256 createdAt;
        bool isActive;
    }

    function getAsset(uint256 assetId) external view returns (Asset memory);
    function isVerified(uint256 assetId, address investor) external view returns (bool);
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) external;
}

/**
 * @title RWAPrimarySale
 * @notice Venta primaria de fracciones de un activo del RWAFactory, pagada en BEZ.
 *
 * @dev ⚠️ PENDIENTE DE AUDITORÍA Y DE DICTAMEN (MiFID II): fracciones con
 *      valoración y rendimiento estimado pueden ser instrumentos financieros.
 *      No se despliega en red principal sin las dos cosas.
 *
 *      Diseño NO CUSTODIO, que es lo que sostiene el argumento regulatorio:
 *        · Las fracciones no salen de la wallet del emisor hasta la compra: el
 *          emisor da `setApprovalForAll` a este contrato y la compra las mueve
 *          directamente emisor → comprador.
 *        · El BEZ va directamente comprador → emisor (neto) y comprador →
 *          tesorería (comisión). Este contrato nunca tiene saldo de nadie.
 *        · La comisión y la tesorería son inmutables. El owner sólo puede pausar
 *          compras nuevas: no hay ninguna función que mueva fondos o fracciones.
 *
 *      KYC más estricto que el del factory: el factory sólo exige verificación
 *      en categorías de alto valor si la transferencia es ≥10 % del supply, y eso
 *      se esquiva comprando en trozos. Aquí, en esas categorías, el comprador
 *      tiene que estar verificado SIEMPRE (`isVerified` del propio factory).
 */
contract RWAPrimarySale is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    /// Comisión máxima admisible al desplegar (10 %).
    uint16 public constant MAX_FEE_BPS = 1000;

    IRWAFactory public immutable factory;
    IERC20 public immutable bez;
    address public immutable treasury;
    uint16 public immutable feeBps;

    struct Listing {
        uint256 assetId;
        address seller;
        uint256 pricePerFraction; // en unidades mínimas de BEZ
        uint256 remaining;        // fracciones aún a la venta
        bool active;
    }

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed listingId, uint256 indexed assetId, address indexed seller, uint256 amount, uint256 pricePerFraction);
    event Bought(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 paid, uint256 fee);
    event Cancelled(uint256 indexed listingId);

    error NotCreator();
    error AssetInactive();
    error NotApproved();
    error InsufficientFractions();
    error ListingClosed();
    error NotSeller();
    error ZeroAmount();
    error PriceAboveMax();
    error KycRequired();
    error FeeTooHigh();
    error ZeroAddress();

    constructor(address _factory, address _bez, address _treasury, uint16 _feeBps) Ownable(msg.sender) {
        if (_factory == address(0) || _bez == address(0) || _treasury == address(0)) revert ZeroAddress();
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        factory = IRWAFactory(_factory);
        bez = IERC20(_bez);
        treasury = _treasury;
        feeBps = _feeBps;
    }

    /**
     * @notice Pone a la venta `amount` fracciones de `assetId`. Sólo el creador
     *         del activo (venta PRIMARIA) y sólo si ya aprobó este contrato.
     */
    function list(uint256 assetId, uint256 amount, uint256 pricePerFraction)
        external whenNotPaused returns (uint256 listingId)
    {
        if (amount == 0 || pricePerFraction == 0) revert ZeroAmount();
        IRWAFactory.Asset memory a = factory.getAsset(assetId);
        if (a.creator != msg.sender) revert NotCreator();
        if (!a.isActive) revert AssetInactive();
        if (!factory.isApprovedForAll(msg.sender, address(this))) revert NotApproved();
        if (factory.balanceOf(msg.sender, assetId) < amount) revert InsufficientFractions();

        listingId = ++listingCount;
        listings[listingId] = Listing({
            assetId: assetId, seller: msg.sender, pricePerFraction: pricePerFraction, remaining: amount, active: true
        });
        emit Listed(listingId, assetId, msg.sender, amount, pricePerFraction);
    }

    /// El emisor retira lo que quede a la venta. Las fracciones nunca salieron de su wallet.
    function cancel(uint256 listingId) external {
        Listing storage l = listings[listingId];
        if (l.seller != msg.sender) revert NotSeller();
        l.active = false;
        emit Cancelled(listingId);
    }

    /**
     * @notice Compra `amount` fracciones. `maxPricePerFraction` protege al
     *         comprador si el precio de la oferta no es el que vio.
     */
    function buy(uint256 listingId, uint256 amount, uint256 maxPricePerFraction)
        external nonReentrant whenNotPaused
    {
        if (amount == 0) revert ZeroAmount();
        Listing storage l = listings[listingId];
        if (!l.active || l.remaining < amount) revert ListingClosed();
        if (l.pricePerFraction > maxPricePerFraction) revert PriceAboveMax();

        IRWAFactory.Asset memory a = factory.getAsset(l.assetId);
        if (!a.isActive) revert AssetInactive();
        if (_altoValor(a.category) && !factory.isVerified(l.assetId, msg.sender)) revert KycRequired();

        uint256 total = amount * l.pricePerFraction;
        uint256 fee = (total * feeBps) / 10_000;

        // Efectos antes de las interacciones (el receptor ERC-1155 puede ser un contrato).
        l.remaining -= amount;
        if (l.remaining == 0) l.active = false;

        address seller = l.seller;
        bez.safeTransferFrom(msg.sender, seller, total - fee);
        if (fee > 0) bez.safeTransferFrom(msg.sender, treasury, fee);
        factory.safeTransferFrom(seller, msg.sender, l.assetId, amount, "");

        emit Bought(listingId, msg.sender, amount, total, fee);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// INMUEBLE, HOTEL, BARCO, HELICOPTERO: el mismo criterio que el factory.
    function _altoValor(uint8 category) private pure returns (bool) {
        return category == 0 || category == 1 || category == 5 || category == 6;
    }
}
