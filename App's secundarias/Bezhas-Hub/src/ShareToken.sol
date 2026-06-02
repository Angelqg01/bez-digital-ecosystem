// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ShareToken
 * @dev Simple ERC20 token for representing fractional shares of tokenized properties
 * This contract is deployed by PropertyFractionalizer when an NFT is fractionalized
 */
contract ShareToken is ERC20 {
    /**
     * @dev Constructor that creates the token and mints initial supply
     * @param name_ The name of the token (e.g., "Property Share #123")
     * @param symbol_ The symbol of the token (e.g., "PROP123")
     * @param initialSupply The total number of shares to create
     * @param mintTo The address that will receive all initial shares (typically the PropertyFractionalizer contract)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        address mintTo
    ) ERC20(name_, symbol_) {
        require(mintTo != address(0), "Cannot mint to zero address");
        require(initialSupply > 0, "Initial supply must be greater than zero");
        
        // Mint all shares to the specified address
        _mint(mintTo, initialSupply);
    }
}
