// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

// Interfaces requeridas para interactuar con BEZCoinV2
interface IBEZCoinV2 {
    function mint(address to, uint256 amount) external;
    function bridgeBurn(address from, uint256 amount) external;
}

/**
 * @title BeZhasBridgeL2
 * @dev Contrato Puente en la Capa 2 de BeZhas.
 * Responsable de coordinar el "Mint" cuando entran depósitos desde L1 (o puentes Omnichain)
 * y el "Burn" cuando se inician los retiros hacia L1.
 */
contract BeZhasBridgeL2 is AccessControl, ReentrancyGuard {
    bytes32 public constant BRIDGE_RELAYER_ROLE = keccak256("BRIDGE_RELAYER_ROLE");

    IBEZCoinV2 public bezToken;

    /// @notice Tracks finalized L1 deposits to prevent replay
    mapping(bytes32 => bool) public finalizedDeposits;

    event RoleGrantedCustom(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevokedCustom(bytes32 indexed role, address indexed account, address indexed sender);

    event DepositFinalized(address indexed to, uint256 amount, bytes32 srcTxHash);
    event WithdrawalInitiated(address indexed from, address indexed to, uint256 amount);

    /**
     * @dev Configura el contrato con la dirección del token y el administrador inicial.
     * @param _bezToken Dirección del contrato BEZCoinV2.
     */
    constructor(address _bezToken, address multisig) {
        require(_bezToken != address(0), "Invalid Token Address");
        require(multisig != address(0), "Multisig required");
        bezToken = IBEZCoinV2(_bezToken);
        _grantRole(DEFAULT_ADMIN_ROLE, multisig);
    }

    function grantRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        super.grantRole(role, account);
        emit RoleGrantedCustom(role, account, msg.sender);
    }

    function revokeRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        super.revokeRole(role, account);
        emit RoleRevokedCustom(role, account, msg.sender);
    }

    /**
     * @dev Finaliza un depósito proveniente de L1 o de otro puente Omnichain.
     * Acuña la cantidad equivalente de tokens al usuario.
     * Solo las entidades con RING_RELAYER_ROLE (Nodos validadores o LayerZero Endpoint) pueden llamar.
     *
     * @param to Dirección de destino en BeZhas L2.
     * @param amount Cantidad a acuñar.
     * @param srcTxHash Hash de la transacción original en L1 (para trazabilidad).
     */
    function finalizeDeposit(address to, uint256 amount, bytes32 srcTxHash) 
        external 
        onlyRole(BRIDGE_RELAYER_ROLE) 
        nonReentrant
    {
        require(to != address(0), "Invalid Recipient Address");
        require(amount > 0, "Amount must be greater than 0");
        require(!finalizedDeposits[srcTxHash], "Bridge: deposit already finalized");

        finalizedDeposits[srcTxHash] = true;

        // Realizamos el MINT en L2
        bezToken.mint(to, amount);

        emit DepositFinalized(to, amount, srcTxHash);
    }

    /**
     * @dev Inicia un retiro desde BeZhas L2 hacia otra cadena.
     * Quema los tokens en la L2. El Sequencer luego reportará este evento a L1 para desbloquear fondos.
     *
     * @param to Dirección de destino en la cadena receptora.
     * @param amount Cantidad a enviar.
     */
    function initiateWithdrawal(address to, uint256 amount) external {
        require(to != address(0), "Invalid Target Address");
        require(amount > 0, "Amount must be greater than 0");

        // Quemamos los tokens del emisor en la L2
        bezToken.bridgeBurn(msg.sender, amount);

        emit WithdrawalInitiated(msg.sender, to, amount);
    }
}
