// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Nonces} from "openzeppelin-contracts/contracts/utils/Nonces.sol";

/**
 * @title BEZCoinV2
 * @dev Token nativo para la L2 de BeZhas con capacidades de gobernanza (ERC20Votes).
 * Permite delegación de votos para la DAO y sistema de validación corporativo.
 * Las empresas usan ERC20Permit para gas-less approvals vía Paymaster.
 */
contract BEZCoinV2 is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    /// @notice Hard cap: 10 billion BEZ — cannot be changed or overridden
    uint256 public constant MAX_SUPPLY = 10_000_000_000 * 1e18;

    address public treasuryWallet;

    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TreasuryWalletUpdated(address indexed oldWallet, address indexed newWallet);

    constructor(address defaultAdmin) 
        ERC20("BeZhas Coin", "BEZ") 
        ERC20Permit("BeZhas Coin")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, defaultAdmin);
        
        treasuryWallet = defaultAdmin; // Por defecto la tesorería es el admin

        // 3B pre-minted para Tesoro y Liquidez inicial
        _mint(defaultAdmin, 3_000_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "BEZ: supply cap exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount, "L2 Operations / DePIN");
    }

    /**
     * @notice "Quema" para el bridge: NO reduce totalSupply, transfiere a `treasuryWallet`.
     * @dev Semántica deliberada: los tokens "quemados" se recolectan en tesorería en lugar de
     *      destruirse, para conservar el supply circulante bajo control del DAO. El balance del
     *      bridge/escrow en la otra cadena debe casar con lo recolectado aquí, no con el supply.
     */
    function bridgeBurn(address from, uint256 amount) public onlyRole(BRIDGE_ROLE) {
        _transfer(from, treasuryWallet, amount);
    }

    /**
     * @notice ATENCIÓN: override de ERC20Burnable. NO destruye tokens ni reduce totalSupply;
     *         redirige el importe a `treasuryWallet`. El nombre se mantiene por compatibilidad
     *         de interfaz ERC20Burnable, pero el efecto es una transferencia a tesorería.
     */
    function burn(uint256 value) public override {
        _transfer(_msgSender(), treasuryWallet, value);
    }

    /// @notice Igual que `burn`: NO reduce supply, transfiere a tesorería (consume allowance).
    function burnFrom(address account, uint256 value) public override {
        _spendAllowance(account, _msgSender(), value);
        _transfer(account, treasuryWallet, value);
    }

    function setTreasuryWallet(address newTreasury) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newTreasury != address(0), "BEZ: invalid treasury address");
        emit TreasuryWalletUpdated(treasuryWallet, newTreasury);
        treasuryWallet = newTreasury;
    }

    // ─── Overrides requeridos por la herencia diamante ERC20Votes + ERC20Permit ───

    function _update(address from, address to, uint256 value) 
        internal override(ERC20, ERC20Votes) 
    {
        super._update(from, to, value);
    }

    function nonces(address owner) 
        public view override(ERC20Permit, Nonces) returns (uint256) 
    {
        return super.nonces(owner);
    }

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }
}
