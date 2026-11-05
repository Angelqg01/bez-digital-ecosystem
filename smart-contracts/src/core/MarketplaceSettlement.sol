// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MarketplaceSettlement — liquidación en BEZ del API Marketplace, sin custodia de BeZhas
 * @notice El consumidor paga un listing y, en la MISMA transacción, el importe se reparte entre el
 *         proveedor y la comisión de BeZhas. Cada parte retira lo suyo (pull payment).
 *
 * Por qué así (docs/API_MARKETPLACE_DISENO.md, «On-chain»):
 *   · BeZhas no puede mover saldos ajenos: ningún rol tiene una función que saque fondos de un
 *     proveedor ni que los redirija. `withdraw` sólo paga a `msg.sender` lo que tiene acreditado.
 *   · La comisión tiene un techo `immutable` fijado en el despliegue y el admin sólo puede BAJARLA.
 *   · El destino de la comisión (`treasury`) es `immutable`: la wallet de tesorería registrada.
 *   · `pause()` bloquea pagos y altas, nunca retiradas.
 *   · La dirección de cobro y el precio de un listing los cambia sólo su proveedor. BeZhas registra
 *     el listing (tras el KYB y la revisión) y puede desactivarlo, pero no apuntarlo a otra cuenta.
 *
 * v1: un pago por compra (suscripción o dataset). El pago por llamada on-chain se deja para después.
 */
contract MarketplaceSettlement is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    uint16 public constant BPS = 10_000;

    IERC20 public immutable token;
    address public immutable treasury;
    uint16 public immutable maxFeeBps;
    uint16 public feeBps;

    struct Listing {
        address provider;   // a quién se acredita
        uint128 price;      // en unidades del token
        bool active;
    }

    mapping(bytes32 => Listing) public listings;
    mapping(address => uint256) public balanceOf;   // saldo retirable por cuenta
    uint256 public totalOwed;                       // suma de balanceOf: invariante contra el saldo del contrato
    mapping(address => uint256) public nonces;      // por pagador, para purchaseId únicos

    event ListingRegistered(bytes32 indexed listingId, address indexed provider, uint256 price);
    event ListingActiveSet(bytes32 indexed listingId, bool active);
    event ListingPriceSet(bytes32 indexed listingId, uint256 price);
    event ListingProviderSet(bytes32 indexed listingId, address indexed oldProvider, address indexed newProvider);
    event Paid(
        bytes32 indexed purchaseId,
        bytes32 indexed listingId,
        address indexed payer,
        address provider,
        uint256 price,
        uint256 fee
    );
    event Withdrawn(address indexed account, uint256 amount);
    event FeeLowered(uint16 oldFeeBps, uint16 newFeeBps);

    error ZeroAddress();
    error FeeTooHigh();
    error FeeCanOnlyDecrease();
    error ListingExists();
    error ListingNotFound();
    error ListingInactive();
    error NotProvider();
    error PriceZero();
    error PriceAboveMax(uint256 price, uint256 maxPrice);
    error NothingToWithdraw();
    error UnexpectedTransferAmount();

    constructor(IERC20 token_, address treasury_, address admin_, uint16 maxFeeBps_, uint16 feeBps_) {
        if (address(token_) == address(0) || treasury_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        // 20 % es el techo del plan comercial; el contrato no admite más ni aunque se despliegue mal.
        if (maxFeeBps_ > 2_000 || feeBps_ > maxFeeBps_) revert FeeTooHigh();
        token = token_;
        treasury = treasury_;
        maxFeeBps = maxFeeBps_;
        feeBps = feeBps_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
    }

    // ── Listings ──────────────────────────────────────────────────────────────

    function registerListing(bytes32 listingId, address provider, uint128 price)
        external
        onlyRole(REGISTRAR_ROLE)
        whenNotPaused
    {
        if (provider == address(0)) revert ZeroAddress();
        if (price == 0) revert PriceZero();
        if (listings[listingId].provider != address(0)) revert ListingExists();
        listings[listingId] = Listing({provider: provider, price: price, active: true});
        emit ListingRegistered(listingId, provider, price);
    }

    /// @notice Suspender o reactivar. No toca saldos ni la cuenta de cobro.
    function setListingActive(bytes32 listingId, bool active) external onlyRole(REGISTRAR_ROLE) {
        if (listings[listingId].provider == address(0)) revert ListingNotFound();
        listings[listingId].active = active;
        emit ListingActiveSet(listingId, active);
    }

    function setPrice(bytes32 listingId, uint128 price) external {
        Listing storage l = _ownListing(listingId);
        if (price == 0) revert PriceZero();
        l.price = price;
        emit ListingPriceSet(listingId, price);
    }

    /// @notice El proveedor mueve el cobro de SUS ventas futuras a otra cuenta. Lo ya acreditado no se mueve.
    function setProvider(bytes32 listingId, address newProvider) external {
        Listing storage l = _ownListing(listingId);
        if (newProvider == address(0)) revert ZeroAddress();
        emit ListingProviderSet(listingId, l.provider, newProvider);
        l.provider = newProvider;
    }

    function _ownListing(bytes32 listingId) private view returns (Listing storage l) {
        l = listings[listingId];
        if (l.provider == address(0)) revert ListingNotFound();
        if (l.provider != msg.sender) revert NotProvider();
    }

    // ── Pago ──────────────────────────────────────────────────────────────────

    /**
     * @param maxPrice el precio que el consumidor vio: si el proveedor lo sube entre medias, revierte
     *        en vez de cobrar de más.
     * @return purchaseId id del pago, el que el backend usa para activar la suscripción.
     */
    function pay(bytes32 listingId, uint256 maxPrice)
        external
        whenNotPaused
        nonReentrant
        returns (bytes32 purchaseId)
    {
        Listing memory l = listings[listingId];
        if (l.provider == address(0)) revert ListingNotFound();
        if (!l.active) revert ListingInactive();
        if (l.price > maxPrice) revert PriceAboveMax(l.price, maxPrice);

        uint256 price = l.price;
        uint256 fee = (price * feeBps) / BPS;

        // Efectos antes de la interacción (CEI).
        purchaseId = keccak256(abi.encode(block.chainid, address(this), listingId, msg.sender, nonces[msg.sender]++));
        balanceOf[l.provider] += price - fee;
        balanceOf[treasury] += fee;
        totalOwed += price;

        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), price);
        // Un token con comisión por transferencia dejaría saldos acreditados sin respaldo.
        if (token.balanceOf(address(this)) - before != price) revert UnexpectedTransferAmount();

        emit Paid(purchaseId, listingId, msg.sender, l.provider, price, fee);
    }

    // ── Retirada ──────────────────────────────────────────────────────────────

    /// @notice Siempre abierta, también en pausa: nadie puede bloquear el dinero de otro.
    function withdraw() external nonReentrant returns (uint256 amount) {
        amount = balanceOf[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        balanceOf[msg.sender] = 0;
        totalOwed -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ── Administración (sin acceso a fondos) ──────────────────────────────────

    function lowerFee(uint16 newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newFeeBps >= feeBps) revert FeeCanOnlyDecrease();
        emit FeeLowered(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
