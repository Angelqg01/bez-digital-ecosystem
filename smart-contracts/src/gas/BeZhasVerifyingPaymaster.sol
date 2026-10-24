// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";
import {IEntryPointV8, PackedUserOperation, PostOpMode} from "./IEntryPointV8.sol";

/**
 * @title BeZhasVerifyingPaymaster
 * @notice Paymaster ERC-4337 de patrocinio. BeZhas adelanta el gas (depósito en el EntryPoint) y lo carga
 *         OFF-CHAIN al Gas Tank de la organización. Un servicio de políticas firma cada UserOperation que
 *         aprueba; este contrato solo comprueba esa firma y los topes, y emite `GasCharged` para que el
 *         conciliador cierre la reserva con el coste real.
 *
 *  paymasterAndData = paymaster(20) | verificationGasLimit(16) | postOpGasLimit(16) | paymasterData
 *  paymasterData    = abi.encode(bytes32 orgId, uint48 validUntil, uint48 validAfter, uint256 maxCost) ++ firma(65)
 *
 *  La firma cubre los campos de la UserOp (sender, nonce, initCode, callData, límites de gas, tarifas y los
 *  límites de gas del paymaster), la cadena, este contrato y los datos de la organización: cambiar cualquier
 *  byte de la llamada invalida el patrocinio.
 *
 *  ERC-7562: la validación lee almacenamiento propio (firmantes, organizaciones suspendidas), que solo se
 *  permite a un paymaster CON STAKE en el EntryPoint. Hay que hacer `addStake` antes de operar en mainnet.
 *
 *  Quién firma: una clave de verificación DEDICADA y sin fondos (no la tesorería). Si se compromete, el daño
 *  está acotado por `maxCostPerOp` y por el depósito que se mantenga en el EntryPoint, y se revoca con `setSigner`.
 */
contract BeZhasVerifyingPaymaster is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    uint256 private constant PAYMASTER_VALIDATION_GAS_OFFSET = 20;
    uint256 private constant PAYMASTER_DATA_OFFSET = 52;
    uint256 private constant DATA_FIELDS_LEN = 128; // orgId + validUntil + validAfter + maxCost (4 palabras)
    uint256 private constant SIG_LEN = 65;

    uint256 private constant SIG_VALIDATION_FAILED = 1;

    IEntryPointV8 public immutable entryPoint;

    mapping(address => bool) public isSigner;
    mapping(bytes32 => bool) public orgSuspended;
    bool public paused;
    /// @notice Tope duro del coste máximo de una UserOp (wei), por encima de lo que firme el servicio.
    uint256 public maxCostPerOp;

    event SignerSet(address indexed signer, bool allowed);
    event OrgSuspended(bytes32 indexed orgId, bool suspended);
    event PausedSet(bool paused);
    event MaxCostPerOpSet(uint256 maxCost);
    /// @dev El conciliador off-chain liquida la reserva de `orgId` con `actualGasCost`.
    event GasCharged(bytes32 indexed orgId, address indexed sender, uint256 actualGasCost, uint256 actualUserOpFeePerGas, PostOpMode mode);

    error NotEntryPoint();
    error PausedError();
    error OrgIsSuspended(bytes32 orgId);
    error BadPaymasterData();
    error CostAboveSignedMax(uint256 maxCost, uint256 signedMax);
    error CostAboveCeiling(uint256 maxCost, uint256 ceiling);

    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint();
        _;
    }

    constructor(IEntryPointV8 _entryPoint, address admin, address firstSigner, uint256 _maxCostPerOp) Ownable(admin) {
        entryPoint = _entryPoint;
        maxCostPerOp = _maxCostPerOp;
        isSigner[firstSigner] = true;
        emit SignerSet(firstSigner, true);
        emit MaxCostPerOpSet(_maxCostPerOp);
    }

    // ═══ Validación (llamada por el EntryPoint) ═══════════════════════════════════════

    function validatePaymasterUserOp(PackedUserOperation calldata userOp, bytes32 /*userOpHash*/, uint256 maxCost)
        external
        onlyEntryPoint
        returns (bytes memory context, uint256 validationData)
    {
        if (paused) revert PausedError();
        bytes calldata pd = userOp.paymasterAndData;
        if (pd.length != PAYMASTER_DATA_OFFSET + DATA_FIELDS_LEN + SIG_LEN) revert BadPaymasterData();

        (bytes32 orgId, uint48 validUntil, uint48 validAfter, uint256 signedMax) =
            abi.decode(pd[PAYMASTER_DATA_OFFSET:PAYMASTER_DATA_OFFSET + DATA_FIELDS_LEN], (bytes32, uint48, uint48, uint256));
        bytes calldata signature = pd[PAYMASTER_DATA_OFFSET + DATA_FIELDS_LEN:];

        if (orgSuspended[orgId]) revert OrgIsSuspended(orgId);
        if (maxCost > signedMax) revert CostAboveSignedMax(maxCost, signedMax);
        if (maxCost > maxCostPerOp) revert CostAboveCeiling(maxCost, maxCostPerOp);

        bytes32 digest = getHash(userOp, orgId, validUntil, validAfter, signedMax).toEthSignedMessageHash();
        (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, signature);
        bool failed = err != ECDSA.RecoverError.NoError || !isSigner[recovered];

        context = abi.encode(orgId, userOp.sender);
        validationData = _packValidationData(failed, validUntil, validAfter);
    }

    function postOp(PostOpMode mode, bytes calldata context, uint256 actualGasCost, uint256 actualUserOpFeePerGas)
        external
        onlyEntryPoint
    {
        (bytes32 orgId, address sender) = abi.decode(context, (bytes32, address));
        emit GasCharged(orgId, sender, actualGasCost, actualUserOpFeePerGas, mode);
    }

    /// @notice Hash que firma el servicio de políticas (sin la propia firma, que va dentro de paymasterAndData).
    function getHash(
        PackedUserOperation calldata userOp,
        bytes32 orgId,
        uint48 validUntil,
        uint48 validAfter,
        uint256 signedMax
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                userOp.sender,
                userOp.nonce,
                keccak256(userOp.initCode),
                keccak256(userOp.callData),
                userOp.accountGasLimits,
                userOp.preVerificationGas,
                userOp.gasFees,
                // límites de gas del paymaster: forman parte de lo que se patrocina
                keccak256(userOp.paymasterAndData[PAYMASTER_VALIDATION_GAS_OFFSET:PAYMASTER_DATA_OFFSET]),
                block.chainid,
                address(this),
                orgId,
                validUntil,
                validAfter,
                signedMax
            )
        );
    }

    function _packValidationData(bool sigFailed, uint48 validUntil, uint48 validAfter) private pure returns (uint256) {
        return (sigFailed ? SIG_VALIDATION_FAILED : 0) | (uint256(validUntil) << 160) | (uint256(validAfter) << (160 + 48));
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

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PausedSet(value);
    }

    function setMaxCostPerOp(uint256 value) external onlyOwner {
        maxCostPerOp = value;
        emit MaxCostPerOpSet(value);
    }

    // ═══ Depósito y stake en el EntryPoint ════════════════════════════════════════════

    function deposit() external payable {
        entryPoint.depositTo{value: msg.value}(address(this));
    }

    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    function withdrawTo(address payable to, uint256 amount) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
    }

    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    function withdrawStake(address payable to) external onlyOwner {
        entryPoint.withdrawStake(to);
    }
}
