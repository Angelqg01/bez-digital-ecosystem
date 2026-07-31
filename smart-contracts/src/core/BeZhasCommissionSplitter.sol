// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BeZhasCommissionSplitter
 * @notice Liquidación on-chain de la cascada de comisiones jerárquicas
 *         (holding/consorcio/naviera sobre sus subordinados) calculada
 *         off-chain por Bezhas-Hub/backend/services/commissionEngine.service.js.
 *
 * @dev Contrato NUEVO y aditivo — no modifica BeZhasPayment (ya desplegado).
 *      Sigue el mismo patrón de upgrade del proyecto ("nueva capacidad = nuevo
 *      contrato", ver comentario de bridgePayment en BeZhasPayment.sol).
 *
 *      El grafo de jerarquía (quién es padre de quién, con qué tasa) vive en
 *      Postgres — más barato de consultar/actualizar que on-chain. Este
 *      contrato SÓLO ejecuta la distribución atómica ya validada: recibe la
 *      lista de beneficiarios y su bps ya resueltos por el motor off-chain,
 *      y mueve los tokens en una única transacción. Por eso sólo SETTLER_ROLE
 *      (el backend) puede dispararlo — un payer no puede inventar su propia
 *      cascada de comisiones.
 *
 * Roles:
 *   - DEFAULT_ADMIN_ROLE: Configuración del contrato
 *   - SETTLER_ROLE:        Dispara la liquidación (backend, tras validar la
 *                           cadena de ancestros y el evento en Postgres)
 *   - OPERATOR_ROLE:       Puede pausar
 *   - TREASURY_ROLE:       Puede retirar las comisiones de plataforma
 */
contract BeZhasCommissionSplitter is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════════════
    bytes32 public constant SETTLER_ROLE  = keccak256("SETTLER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTES
    // ═══════════════════════════════════════════════════════════════════════════
    // Techo absoluto de niveles en cascada (coincide con MAX_CASCADE_LEVELS
    // del motor off-chain: commissionEngine.service.js).
    uint256 public constant MAX_BENEFICIARIES = 5;
    // Máximo repartido entre TODOS los niveles combinados (30%), para que un
    // fallo de cálculo off-chain nunca pueda drenar más de esto de un pago.
    uint16  public constant MAX_TOTAL_COMMISSION_BPS = 3000;

    // ═══════════════════════════════════════════════════════════════════════════
    // ESTADO
    // ═══════════════════════════════════════════════════════════════════════════
    IERC20  public immutable bezToken;
    address public treasury;
    uint16  public platformFeeBps;

    mapping(bytes32 => bool) public processedOrders;
    mapping(bytes32 => SplitRecord) public splits;
    uint256 public accruedFees;

    struct SplitRecord {
        address payer;
        address recipient;
        uint256 netAmount;
        uint256 platformFee;
        uint256 totalCommission;
        uint256 timestamp;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTOS
    // ═══════════════════════════════════════════════════════════════════════════
    event PaymentSplit(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        uint256 platformFee,
        uint256 totalCommission,
        uint256 timestamp
    );

    event CommissionPaid(
        bytes32 indexed orderId,
        address indexed beneficiary,
        uint8   level,
        uint256 amount
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
    error LengthMismatch();
    error TooManyBeneficiaries();
    error CommissionTooHigh();
    error NoFeesToWithdraw();

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
        _grantRole(SETTLER_ROLE,       _admin);
        _grantRole(TREASURY_ROLE,      _treasury);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LIQUIDACIÓN CON CASCADA DE COMISIONES
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * @notice Liquida un pago repartiendo comisión entre la cadena de
     *         ancestros de la organización que lo generó.
     * @dev `payer` debe haber aprobado a este contrato por al menos `amount`.
     *      Idempotente por `orderId` (mismo criterio que validation_events en
     *      Postgres: subject_org_id + tx_ref → orderId = keccak256 de ambos).
     * @param payer          Quien fondea el pago (la organización subordinada)
     * @param recipient      Destinatario del importe neto tras plataforma+comisiones
     * @param amount         Importe bruto total (wei, 18 decimales)
     * @param orderId        Idempotencia — debe ser único
     * @param beneficiaries  Wallets de los ancestros beneficiarios, en orden de nivel (1=padre directo)
     * @param bpsPerLevel    Basis points sobre `amount` para cada beneficiario (mismo índice que beneficiaries)
     */
    function settlePaymentWithCommissions(
        address payer,
        address recipient,
        uint256 amount,
        bytes32 orderId,
        address[] calldata beneficiaries,
        uint16[]  calldata bpsPerLevel
    ) external nonReentrant whenNotPaused onlyRole(SETTLER_ROLE) {
        if (payer == address(0) || recipient == address(0)) revert ZeroAddress();
        if (amount == 0)                  revert InsufficientAmount();
        if (processedOrders[orderId])     revert OrderAlreadyProcessed(orderId);
        if (beneficiaries.length != bpsPerLevel.length) revert LengthMismatch();
        if (beneficiaries.length > MAX_BENEFICIARIES)   revert TooManyBeneficiaries();

        uint256 totalCommissionBps;
        for (uint256 i = 0; i < beneficiaries.length; ) {
            if (beneficiaries[i] == address(0)) revert ZeroAddress();
            totalCommissionBps += bpsPerLevel[i];
            unchecked { ++i; }
        }
        if (totalCommissionBps > MAX_TOTAL_COMMISSION_BPS) revert CommissionTooHigh();

        uint256 platformFee     = (amount * platformFeeBps) / 10_000;
        uint256 totalCommission = (amount * totalCommissionBps) / 10_000;
        uint256 netToRecipient  = amount - platformFee - totalCommission;

        // Efectos antes de interacciones (checks-effects-interactions)
        processedOrders[orderId] = true;
        accruedFees += platformFee;
        splits[orderId] = SplitRecord({
            payer:           payer,
            recipient:       recipient,
            netAmount:       netToRecipient,
            platformFee:     platformFee,
            totalCommission: totalCommission,
            timestamp:       block.timestamp
        });

        if (platformFee > 0)    bezToken.safeTransferFrom(payer, address(this), platformFee);
        if (netToRecipient > 0) bezToken.safeTransferFrom(payer, recipient, netToRecipient);

        for (uint256 i = 0; i < beneficiaries.length; ) {
            uint256 amt = (amount * bpsPerLevel[i]) / 10_000;
            if (amt > 0) {
                bezToken.safeTransferFrom(payer, beneficiaries[i], amt);
                // i < MAX_BENEFICIARIES (5), enforced above — uint8(i+1) never truncates.
                // forge-lint: disable-next-line(unsafe-typecast)
                emit CommissionPaid(orderId, beneficiaries[i], uint8(i + 1), amt);
            }
            unchecked { ++i; }
        }

        emit PaymentSplit(orderId, payer, recipient, amount, platformFee, totalCommission, block.timestamp);
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
    function getSplit(bytes32 orderId) external view returns (SplitRecord memory) {
        return splits[orderId];
    }

    function isOrderProcessed(bytes32 orderId) external view returns (bool) {
        return processedOrders[orderId];
    }
}
