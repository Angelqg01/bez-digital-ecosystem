// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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


    // Eventos que el Secuenciador (op-node) escucha para actuar en L2
    event TokenLocked(address indexed sender, address indexed tokenAddress, uint256 amount, string destinationAddressOnL2);
    event NativeEthLocked(address indexed sender, uint256 amount, string destinationAddressOnL2);
    event TokensUnlocked(address indexed recipient, address indexed tokenAddress, uint256 amount);
    event TokenSupportChanged(address indexed token, bool isSupported, address indexed operator);
    event Paused(bool isPaused, address indexed operator);
    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);


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
     * Solo el rol TOKEN_MANAGER_ROLE puede modificar la whitelist. Protegido por MULTISIG_ROLE.
     */
    function setTokenSupport(address token, bool isSupported) external onlyRole(TOKEN_MANAGER_ROLE) {
        require(token != address(0), "Token address required");
        supportedTokens[token] = isSupported;
        if (isSupported) {
            bool exists = false;
            for (uint i = 0; i < tokenList.length; i++) {
                if (tokenList[i] == token) { exists = true; break; }
            }
            if (!exists) tokenList.push(token);
        }
        emit TokenSupportChanged(token, isSupported, msg.sender);
    }

    /**
     * @dev Listar todos los tokens soportados actualmente
     */
    function getSupportedTokens() external view returns (address[] memory) {
        uint count = 0;
        for (uint i = 0; i < tokenList.length; i++) {
            if (supportedTokens[tokenList[i]]) count++;
        }
        address[] memory result = new address[](count);
        uint j = 0;
        for (uint i = 0; i < tokenList.length; i++) {
            if (supportedTokens[tokenList[i]]) {
                result[j] = tokenList[i];
                j++;
            }
        }
        return result;
    }


    /**
     * @dev Pausar depósitos en caso de emergencia. Solo PAUSER_ROLE (multisig recomendado).
     */
    function setPause(bool _paused) external onlyRole(PAUSER_ROLE) {
        isPaused = _paused;
        emit Paused(_paused, msg.sender);
    }

    /**
     * @dev Bloquea tokens ERC-20 corporativos para enviarlos a la L2
     * @param token Dirección del token en L1 (ej. USDT Contract en Ethereum)
     * @param amount Cantidad a enviar
     * @param destAddressL2 Dirección de la empresa en la L2 que recibirá los fondos
     */
    function lockTokens(
        address token,
        uint256 amount,
        string calldata destAddressL2
    ) external whenNotPaused nonReentrant {
        require(supportedTokens[token], "Token no soportado por BeZhas");
        require(amount > 0, "Cantidad debe ser mayor a 0");

        // El usuario debe haber aprobado el gasto (approve) previamente
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Emitir evento para el backend/secuenciador de la L2
        emit TokenLocked(msg.sender, token, amount, destAddressL2);
    }

    /**
     * @dev Bloquea ETH nativo para enviarlo a la L2 (se convierte en WETH o Ether en L2)
     * @param destAddressL2 Dirección en la L2
     */
    function lockNativeEth(string calldata destAddressL2) external payable whenNotPaused nonReentrant {
        require(msg.value > 0, "Debe enviar ETH");

        // Emitir evento
        emit NativeEthLocked(msg.sender, msg.value, destAddressL2);
    }

    /**
     * @dev Libera tokens bloqueados a un usuario. SOLO llamado por el Owner/Secuenciador
     * cuando un usuario pide un retiro (Withdrawal) desde la L2 hacia la L1.
     * @param recipient Dirección que retira en la L1
     * @param token Token a retirar (0x0 si es ETH nativo)
     * @param amount Cantidad a desbloquear
     */
    function unlockTokens(
        address recipient,
        address token,
        uint256 amount
    ) external onlyOwner nonReentrant {
        if (token == address(0)) {
            // Desbloquear ETH nativo
            (bool success, ) = recipient.call{value: amount}("");
            require(success, "Fallo el envio de ETH");
        } else {
            // Desbloquear ERC-20 (USDT, USDC, etc.)
            IERC20(token).safeTransfer(recipient, amount);
        }

        emit TokensUnlocked(recipient, token, amount);
    }
}
