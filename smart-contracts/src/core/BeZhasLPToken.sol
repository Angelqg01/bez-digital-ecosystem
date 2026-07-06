// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

/**
 * @title BeZhasLPToken
 * @notice Token ERC-20 que representa una posición de liquidez en un par de `BeZhasDEX`.
 * @dev Se despliega un LP token por par (modelo tipo Uniswap V2). Solo el DEX que lo
 *      crea puede acuñar/quemar; el usuario lo posee y puede transferirlo o stakearlo
 *      en `LiquidityFarming` (que requiere un IERC20). El precio/contabilidad del AMM
 *      sigue viviendo en `BeZhasDEX`; este token solo refleja la propiedad de la LP.
 */
contract BeZhasLPToken is ERC20 {
    address public immutable dex;

    error OnlyDex();

    modifier onlyDex() {
        if (msg.sender != dex) revert OnlyDex();
        _;
    }

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        dex = msg.sender;
    }

    function mint(address to, uint256 amount) external onlyDex {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyDex {
        _burn(from, amount);
    }
}
