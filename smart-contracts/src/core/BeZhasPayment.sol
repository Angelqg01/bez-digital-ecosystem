// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BeZhasPayment
 * @notice Contrato nativo de pagos del ecosistema BeZhas
 * @dev Soporta pagos directos en BEZ-Coin, comisiones configurables,
 *      reembolsos, y preparado para integración cross-chain via LayerZero.
 *
 * Funciones principales:
 *   - processPayment: Pago estándar BEZ-Coin en la misma red
 *   - batchPayment:   Múltiples pagos en una sola transacción
 *   - refundPayment:  Reembolso de un pago fallido
 *   - bridgePayment:  Pago cross-chain (placeholder LayerZero)
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE: Configuración del contrato
 *   - OPERATOR_ROLE:       Puede pausar y procesar reembolsos
 *   - TREASURY_ROLE:       Puede retirar las comisiones acumuladas
 */
contract BeZhasPayment is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════
    bytes32 public constant OPERATOR_ROLE  = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURY_ROLE  = keccak256("TREASURY_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // ESTADO
    // ═══════════════════════════════════════════════════════════════════════════
    IERC20  public immutable bezToken;      // BEZCoinV2 address
    address public treasury;                // Receptor de comisiones
    uint16  public platformFeeBps;          // Comisión plataforma (basis points, 10 = 0.1%)

    // Registro de pagos: orderId → payload
    mapping(bytes32 => PaymentRecord) public payments;
    // Protección anti-replay: orderId ya procesado
    mapping(bytes32 => bool) public processedOrders;
    // Comisiones acumuladas por cobrar
    uint256 public accruedFees;

    // ═══════════════════════════════════════════════════════════════════════════
    // STRUCTS
    // ═══════════════════════════════════════════════════════════════════════════
    struct PaymentRecord {
        address payer;
        address recipient;
        uint256 amount;        // Importe neto (sin comisión)
        uint256 fee;           // Comisión retenida
        uint256 timestamp;
        bytes32 orderId;
        string  memo;
        Status  status;
    }

    enum Status { PENDING, COMPLETED, REFUNDED, FAILED }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTOS
    // ═══════════════════════════════════════════════════════════════════════════
    event PaymentProcessed(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        uint256 fee,
        uint256 timestamp
    );

    event PaymentRefunded(
        bytes32 indexed orderId,
        address indexed payer,
        uint256 amount,
        uint256 timestamp
    );

    event BatchPaymentProcessed(
        address indexed payer,
        uint256 totalAmount,
        uint256 count,
        uint256 timestamp
    );

    event BridgePaymentInitiated(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        uint16  targetChainId
    );

    event FeesWithdrawn(address indexed treasury, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint16 oldFee, uint16 newFee);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORES
    // ═══════════════════════════════════════════════════════════════════════════
    error ZeroAddress();
    error OrderAlreadyProcessed(bytes32 orderId);
    error InsufficientAmount();
    error InvalidFee();
    error PaymentNotFound(bytes32 orderId);
    error PaymentNotRefundable(bytes32 orderId, Status status);
    error NoFeesToWithdraw();
    error BatchLengthMismatch();
    error BatchTooLarge();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    constructor(
        address _bezToken,
        address _treasury,
        uint16  _platformFeeBps,
        address _admin
    ) {
        if (_bezToken  == address(0)) revert ZeroAddress();
        if (_treasury  == address(0)) revert ZeroAddress();
        if (_admin     == address(0)) revert ZeroAddress();
        if (_platformFeeBps > 1000)   revert InvalidFee(); // Máximo 10%

        bezToken       = IERC20(_bezToken);
        treasury       = _treasury;
        platformFeeBps = _platformFeeBps;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE,      _admin);
        _grantRole(TREASURY_ROLE,      _treasury);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGO ESTÁNDAR
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * @notice Procesa un pago en BEZ-Coin
     * @param recipient Dirección que recibe el pago (neto)
     * @param amount    Cantidad total enviada por el payer (en wei, 18 decimales)
     * @param orderId   ID único del pedido (bytes32)
     * @param memo      Referencia o nota del pago (hasta 200 chars)
     */
    function processPayment(
        address recipient,
        uint256 amount,
        bytes32 orderId,
        string calldata memo
    ) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0)             revert InsufficientAmount();
        if (processedOrders[orderId]) revert OrderAlreadyProcessed(orderId);

        // Calcular comisión
        uint256 fee    = (amount * platformFeeBps) / 10_000;
        uint256 netAmt = amount - fee;

        // Marcar como procesado (anti-replay)
        processedOrders[orderId] = true;

        // Registrar pago
        payments[orderId] = PaymentRecord({
            payer:     msg.sender,
            recipient: recipient,
            amount:    netAmt,
            fee:       fee,
            timestamp: block.timestamp,
            orderId:   orderId,
            memo:      memo,
            status:    Status.COMPLETED
        });

        // Acumular fees
        accruedFees += fee;

        // Transferir tokens
        bezToken.safeTransferFrom(msg.sender, address(this), fee);    // Fee → contract
        bezToken.safeTransferFrom(msg.sender, recipient, netAmt);      // Net → recipient

        emit PaymentProcessed(orderId, msg.sender, recipient, netAmt, fee, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGO BATCH (múltiples en 1 tx)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * @notice Procesa múltiples pagos en una sola transacción
     * @dev Máximo 50 pagos por batch para evitar out-of-gas
     */
    function batchPayment(
        address[] calldata recipients,
        uint256[] calldata amounts,
        bytes32[] calldata orderIds,
        string[]  calldata memos
    ) external nonReentrant whenNotPaused {
        uint256 len = recipients.length;
        if (len != amounts.length || len != orderIds.length || len != memos.length)
            revert BatchLengthMismatch();
        if (len > 50) revert BatchTooLarge();

        uint256 totalAmount;
        uint256 totalFee;

        for (uint256 i = 0; i < len; ) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0)             revert InsufficientAmount();
            if (processedOrders[orderIds[i]]) revert OrderAlreadyProcessed(orderIds[i]);

            uint256 fee    = (amounts[i] * platformFeeBps) / 10_000;
            uint256 netAmt = amounts[i] - fee;

            processedOrders[orderIds[i]] = true;

            payments[orderIds[i]] = PaymentRecord({
                payer:     msg.sender,
                recipient: recipients[i],
                amount:    netAmt,
                fee:       fee,
                timestamp: block.timestamp,
                orderId:   orderIds[i],
                memo:      memos[i],
                status:    Status.COMPLETED
            });

            accruedFees += fee;
            totalFee    += fee;
            totalAmount += amounts[i];

            // Transferir neto al receptor
            bezToken.safeTransferFrom(msg.sender, recipients[i], netAmt);

            emit PaymentProcessed(orderIds[i], msg.sender, recipients[i], netAmt, fee, block.timestamp);

            unchecked { ++i; }
        }

        // Transferir todos los fees de una sola vez
        if (totalFee > 0) {
            bezToken.safeTransferFrom(msg.sender, address(this), totalFee);
        }

        emit BatchPaymentProcessed(msg.sender, totalAmount, len, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REEMBOLSO
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * @notice Reembolsa un pago estándar (COMPLETED) al payer original (solo OPERATOR).
     * @dev Solvencia garantizada y aislada por pago:
     *      - La porción `fee` la custodia este contrato (accruedFees) → se devuelve desde aquí.
     *      - La porción neta YA salió al recipient en processPayment; por eso el operator
     *        la FONDEA vía transferFrom (clawback de plataforma). Así el reembolso nunca
     *        drena las fees de otros pagos ni depende de fondos externos en el contrato.
     *      El operator debe haber aprobado a este contrato por al menos `record.amount`.
     *      Los pagos de bridge (status PENDING) no son reembolsables por esta vía.
     */
    function refundPayment(bytes32 orderId)
        external
        nonReentrant
        onlyRole(OPERATOR_ROLE)
    {
        PaymentRecord storage record = payments[orderId];
        if (record.payer == address(0))          revert PaymentNotFound(orderId);
        if (record.status != Status.COMPLETED)   revert PaymentNotRefundable(orderId, record.status);

        uint256 feePart = record.fee;   // custodiada en accruedFees
        uint256 netPart = record.amount; // entregada al recipient → la fondea el operator

        // Efectos antes de interacciones (checks-effects-interactions)
        record.status = Status.REFUNDED;
        accruedFees  -= feePart;

        // Devolver fee desde el balance del contrato
        if (feePart > 0) bezToken.safeTransfer(record.payer, feePart);
        // Operator fondea el neto del clawback (revierte limpio si no hay approve/saldo)
        if (netPart > 0) bezToken.safeTransferFrom(msg.sender, record.payer, netPart);

        emit PaymentRefunded(orderId, record.payer, netPart + feePart, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CROSS-CHAIN (Placeholder LayerZero)
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * @notice Inicia un pago cross-chain (requiere integración LayerZero)
     * @dev En esta versión: bloquea tokens localmente y emite evento.
     *      La lógica LayerZero se añadirá en BeZhasPaymentV2.
     */
    function bridgePayment(
        address recipient,
        uint256 amount,
        bytes32 orderId,
        uint16  targetChainId,
        string calldata memo
    ) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0)             revert InsufficientAmount();
        if (processedOrders[orderId]) revert OrderAlreadyProcessed(orderId);

        uint256 fee    = (amount * platformFeeBps) / 10_000;
        uint256 netAmt = amount - fee;

        processedOrders[orderId] = true;
        accruedFees += fee;

        payments[orderId] = PaymentRecord({
            payer:     msg.sender,
            recipient: recipient,
            amount:    netAmt,
            fee:       fee,
            timestamp: block.timestamp,
            orderId:   orderId,
            memo:      memo,
            status:    Status.PENDING  // PENDING hasta confirmar en destino
        });

        // Bloquear tokens en este contrato (escrow cross-chain)
        bezToken.safeTransferFrom(msg.sender, address(this), amount);

        emit BridgePaymentInitiated(orderId, msg.sender, recipient, netAmt, targetChainId);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMINISTRACIÓN
    // ═══════════════════════════════════════════════════════════════════════════
    function withdrawFees() external onlyRole(TREASURY_ROLE) {
        uint256 amount = accruedFees;
        if (amount == 0) revert NoFeesToWithdraw();
        accruedFees = 0;
        bezToken.safeTransfer(treasury, amount);
        emit FeesWithdrawn(treasury, amount);
    }

    function setTreasury(address _newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, _newTreasury);
        treasury = _newTreasury;
    }

    function setPlatformFee(uint16 _newFeeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_newFeeBps > 1000) revert InvalidFee(); // Máximo 10%
        emit FeeUpdated(platformFeeBps, _newFeeBps);
        platformFeeBps = _newFeeBps;
    }

    function pause()   external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════════════════════
    function getPayment(bytes32 orderId) external view returns (PaymentRecord memory) {
        return payments[orderId];
    }

    function isOrderProcessed(bytes32 orderId) external view returns (bool) {
        return processedOrders[orderId];
    }

    function calculateFee(uint256 amount) external view returns (uint256 fee, uint256 netAmount) {
        fee       = (amount * platformFeeBps) / 10_000;
        netAmount = amount - fee;
    }
}
