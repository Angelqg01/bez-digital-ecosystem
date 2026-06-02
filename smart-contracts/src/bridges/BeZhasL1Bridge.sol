// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from
    "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from
    "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from
    "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BeZhasL1Bridge
 * @dev Contrato Puente Principal en Ethereum L1.
 * Las empresas bloquean aquí sus tokens (USDT, USDC, BEZ-ERC20, etc.) o ETH
 * nativo, lo que emite un evento que el Secuenciador lee para acuñar (mint)
 * el equivalente en la L2 de BeZhas.
 */
contract BeZhasL1Bridge is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TOKEN_MANAGER_ROLE = keccak256("TOKEN_MANAGER_ROLE");
    bytes32 public constant MULTISIG_ROLE = keccak256("MULTISIG_ROLE");

    // Estado del puente
    bool public isPaused;

    // Registro de tokens permitidos (WhiteList) para evitar spam de shitcoins
    mapping(address => bool) public supportedTokens;
    address[] private tokenList;

    // Proteccion anti-replay para retiros provenientes de L2
    mapping(bytes32 => bool) public processedWithdrawals;

    // Eventos que el Secuenciador (op-node) escucha para actuar en L2
    event TokenLocked(
        address indexed sender,
        address indexed tokenAddress,
        uint256 amount,
        string destinationAddressOnL2
    );
    event NativeEthLocked(
        address indexed sender, uint256 amount, string destinationAddressOnL2
    );
    event TokensUnlocked(
        address indexed recipient, address indexed tokenAddress, uint256 amount
    );
    event WithdrawalProcessed(
        bytes32 indexed withdrawalId,
        bytes32 indexed withdrawalProofHash,
        address indexed operator
    );
    event TokenSupportChanged(
        address indexed token, bool isSupported, address indexed operator
    );
    event Paused(bool isPaused, address indexed operator);

    modifier whenNotPaused() {
        require(!isPaused, "El Puente esta en mantenimiento");
        _;
    }

    constructor(address multisig) {
        require(multisig != address(0), "Multisig required");
        _grantRole(DEFAULT_ADMIN_ROLE, multisig);
        _grantRole(MULTISIG_ROLE, multisig);
        _grantRole(PAUSER_ROLE, multisig);
        _grantRole(TOKEN_MANAGER_ROLE, multisig);
    }

    /**
     * @dev Activar o desactivar un token soportado por el puente (ej. USDT)
     */
    function setTokenSupport(address token, bool isSupported)
        external
        onlyRole(TOKEN_MANAGER_ROLE)
    {
        require(token != address(0), "Token address required");
        supportedTokens[token] = isSupported;
        if (isSupported) {
            bool exists = false;
            for (uint256 i = 0; i < tokenList.length; i++) {
                if (tokenList[i] == token) {
                    exists = true;
                    break;
                }
            }
            if (!exists) tokenList.push(token);
        }
        emit TokenSupportChanged(token, isSupported, msg.sender);
    }

    /**
     * @dev Listar todos los tokens soportados actualmente
     */
    function getSupportedTokens() external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (supportedTokens[tokenList[i]]) count++;
        }
        address[] memory result = new address[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < tokenList.length; i++) {
            if (supportedTokens[tokenList[i]]) {
                result[j] = tokenList[i];
                j++;
            }
        }
        return result;
    }

    /**
     * @dev Pausar depósitos en caso de emergencia.
     */
    function setPause(bool _paused) external onlyRole(PAUSER_ROLE) {
        isPaused = _paused;
        emit Paused(_paused, msg.sender);
    }

    /**
     * @dev Bloquea tokens ERC-20 corporativos para enviarlos a la L2
     */
    function lockTokens(
        address token,
        uint256 amount,
        string calldata destAddressL2
    ) external whenNotPaused nonReentrant {
        require(supportedTokens[token], "Token no soportado por BeZhas");
        require(amount > 0, "Cantidad debe ser mayor a 0");
        require(bytes(destAddressL2).length > 0, "Destino L2 requerido");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit TokenLocked(msg.sender, token, amount, destAddressL2);
    }

    /**
     * @dev Bloquea ETH nativo para enviarlo a la L2
     */
    function lockNativeEth(string calldata destAddressL2)
        external
        payable
        whenNotPaused
        nonReentrant
    {
        require(msg.value > 0, "Debe enviar ETH");
        require(bytes(destAddressL2).length > 0, "Destino L2 requerido");

        emit NativeEthLocked(msg.sender, msg.value, destAddressL2);
    }

    /**
     * @dev Libera fondos bloqueados tras validar un identificador/proofHash unico.
     *      La validez criptografica del proofHash se verifica off-chain por el relayer.
     */
    function unlockTokens(
        address recipient,
        address token,
        uint256 amount,
        bytes32 withdrawalId,
        bytes32 withdrawalProofHash
    ) external onlyRole(MULTISIG_ROLE) nonReentrant {
        require(recipient != address(0), "Recipient requerido");
        require(amount > 0, "Cantidad debe ser mayor a 0");
        require(withdrawalId != bytes32(0), "WithdrawalId requerido");
        require(
            withdrawalProofHash != bytes32(0), "WithdrawalProofHash requerido"
        );
        require(!processedWithdrawals[withdrawalId], "Retiro ya procesado");

        processedWithdrawals[withdrawalId] = true;

        if (token == address(0)) {
            (bool success,) = recipient.call{value: amount}("");
            require(success, "Fallo el envio de ETH");
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit WithdrawalProcessed(withdrawalId, withdrawalProofHash, msg.sender);
        emit TokensUnlocked(recipient, token, amount);
    }
}
