// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BEZCoinV2
 * @dev Token nativo para la L2 de BeZhas. Incluye control de roles para puentes (Bridges).
 * Las transacciones de las empresas pagan su propio gas (sin Permit/Gasless).
 */
contract BEZCoinV2 is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // Evento para rastrear emisiones institucionales
    event TokensMinted(address indexed to, uint256 amount, string reason);

    event RoleGrantedCustom(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevokedCustom(bytes32 indexed role, address indexed account, address indexed sender);

    constructor(address defaultAdmin) 
        ERC20("BeZhas Coin", "BEZ") 
    {
        require(defaultAdmin != address(0), "Admin required");
        // El administrador central (Tu DAO / Multisig)
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        _grantRole(BRIDGE_ROLE, defaultAdmin);
        // Acuñación inicial para el Tesoro y Liquidez
        _mint(defaultAdmin, 100_000_000 * 10 ** decimals());
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
     * @dev Función exclusiva para que el Puente (Bridge) o el sistema de recompensas emita tokens.
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, amount, "L2 Operations");
    }

    /**
     * @dev Permite a los contratos del Puente quemar tokens al moverlos entre redes.
     */
    function bridgeBurn(address from, uint256 amount) public onlyRole(BRIDGE_ROLE) {
        _burn(from, amount);
    }
}