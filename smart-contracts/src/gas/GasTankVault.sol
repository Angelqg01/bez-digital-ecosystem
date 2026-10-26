// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title GasTankVault
 * @notice Bóveda de BEZ de BeZhas para pagar COMISIONES DE PROTOCOLO en nombre de una organización, p. ej. los
 *         100 BEZ de `RWAFactory.tokenizeAsset`, que el contrato cobra con `transferFrom(msg.sender, …)`.
 *
 *         Dentro de un lote ERC-4337 de la smart account del usuario:
 *           1. vault.pullProtocolFee(...)   → la bóveda envía el BEZ a la smart account (msg.sender)
 *           2. BEZ.approve(target, amount)
 *           3. target.tokenizeAsset(...)    → cobra la comisión a la smart account
 *
 *         Cada retirada exige una firma del servicio de políticas que ata: organización, destinatario (= quien
 *         llama), contrato y función destino, importe, caducidad y un nonce de un solo uso. Además hay una regla
 *         por (destino, selector) con importe máximo, un tope diario global, pausa y suspensión por organización.
 *
 *         LÍMITE CONOCIDO: la bóveda no puede comprobar que la smart account use el BEZ en el destino indicado.
 *         Lo garantiza el servicio de políticas, que solo firma `pullProtocolFee` dentro de UserOps cuyo calldata
 *         ya inspeccionó (y esa misma calldata está cubierta por la firma del paymaster).
 */
contract GasTankVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public immutable bez;

    mapping(address => bool) public isSigner;
    mapping(bytes32 => bool) public orgSuspended;
    /// @dev destino => selector => importe máximo por retirada (0 = no permitido)
    mapping(address => mapping(bytes4 => uint256)) public feeCap;
    mapping(bytes32 => bool) public usedNonce;

    uint256 public dailyCap;
    uint256 public spentToday;
    uint256 public lastDay;
    bool public paused;

    event SignerSet(address indexed signer, bool allowed);
    event OrgSuspended(bytes32 indexed orgId, bool suspended);
    event FeeRuleSet(address indexed target, bytes4 indexed selector, uint256 maxAmount);
    event DailyCapSet(uint256 cap);
    event PausedSet(bool paused);
    event ProtocolFeeFunded(bytes32 indexed orgId, address indexed to, address indexed target, bytes4 selector, uint256 amount, bytes32 nonce);
    event Rescued(address indexed to, uint256 amount);

    error PausedError();
    error OrgIsSuspended(bytes32 orgId);
    error Expired();
    error NonceUsed();
    error RuleNotAllowed(address target, bytes4 selector);
    error AmountAboveRule(uint256 amount, uint256 cap);
    error DailyCapExceeded(uint256 wouldSpend, uint256 cap);
    error BadSignature();

    constructor(IERC20 _bez, address admin, address firstSigner, uint256 _dailyCap) Ownable(admin) {
        bez = _bez;
        dailyCap = _dailyCap;
        isSigner[firstSigner] = true;
        emit SignerSet(firstSigner, true);
        emit DailyCapSet(_dailyCap);
    }

    function pullProtocolFee(
        bytes32 orgId,
        address target,
        bytes4 selector,
        uint256 amount,
        uint48 validUntil,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant {
        if (paused) revert PausedError();
        if (orgSuspended[orgId]) revert OrgIsSuspended(orgId);
        if (block.timestamp > validUntil) revert Expired();
        if (usedNonce[nonce]) revert NonceUsed();

        uint256 cap = feeCap[target][selector];
        if (cap == 0) revert RuleNotAllowed(target, selector);
        if (amount == 0 || amount > cap) revert AmountAboveRule(amount, cap);

        bytes32 digest = getHash(orgId, msg.sender, target, selector, amount, validUntil, nonce).toEthSignedMessageHash();
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || !isSigner[recovered]) revert BadSignature();

        uint256 today = block.timestamp / 1 days;
        if (today != lastDay) {
            lastDay = today;
            spentToday = 0;
        }
        if (spentToday + amount > dailyCap) revert DailyCapExceeded(spentToday + amount, dailyCap);

        usedNonce[nonce] = true;
        spentToday += amount;
        bez.safeTransfer(msg.sender, amount);
        emit ProtocolFeeFunded(orgId, msg.sender, target, selector, amount, nonce);
    }

    function getHash(
        bytes32 orgId,
        address to,
        address target,
        bytes4 selector,
        uint256 amount,
        uint48 validUntil,
        bytes32 nonce
    ) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), orgId, to, target, selector, amount, validUntil, nonce));
    }

    // ═══ Administración ═══════════════════════════════════════════════════════════════

    function setSigner(address signer, bool allowed) external onlyOwner {
        isSigner[signer] = allowed;
        emit SignerSet(signer, allowed);
    }

    function suspendOrg(bytes32 orgId, bool suspended) external onlyOwner {
        orgSuspended[orgId] = suspended;
        emit OrgSuspended(orgId, suspended);
    }

    function setFeeRule(address target, bytes4 selector, uint256 maxAmount) external onlyOwner {
        feeCap[target][selector] = maxAmount;
        emit FeeRuleSet(target, selector, maxAmount);
    }

    function setDailyCap(uint256 cap) external onlyOwner {
        dailyCap = cap;
        emit DailyCapSet(cap);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PausedSet(value);
    }

    /// @notice Saca BEZ de la bóveda (solo el owner, que debe ser un multisig).
    function rescue(address to, uint256 amount) external onlyOwner {
        bez.safeTransfer(to, amount);
        emit Rescued(to, amount);
    }
}
