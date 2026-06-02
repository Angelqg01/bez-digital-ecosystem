// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title WrappedBEZ (wBEZ)
 * @dev Representación 1:1 de BEZCoinV2 en cadenas externas (Polygon, Ethereum, etc.).
 * Solo el bridge puede mint/burn. Los usuarios reciben wBEZ al bridgear BEZ desde L2.
 * 
 * Flujo:
 *   L2 → Polygon: User locks BEZ on L2 → relayer calls mint() here → user gets wBEZ on Polygon
 *   Polygon → L2: User calls burn() here → relayer unlocks BEZ on L2 → user gets BEZ
 */
contract WrappedBEZ is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    event BridgeMint(address indexed to, uint256 amount, bytes32 indexed srcTxHash);
    event BridgeBurn(address indexed from, uint256 amount, uint256 indexed targetChainId);

    constructor(address admin)
        ERC20("Wrapped BeZhas Coin", "wBEZ")
        ERC20Permit("Wrapped BeZhas Coin")
    {
        require(admin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @dev Mints wBEZ when BEZ is locked on L2.
     * @param to Recipient on this chain.
     * @param amount Amount to mint (1:1 with locked BEZ).
     * @param srcTxHash Transaction hash from L2 for traceability.
     */
    function bridgeMint(address to, uint256 amount, bytes32 srcTxHash)
        external
        onlyRole(BRIDGE_ROLE)
    {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        _mint(to, amount);
        emit BridgeMint(to, amount, srcTxHash);
    }

    /**
     * @dev Burns wBEZ to initiate unlock of BEZ on L2.
     * @param from Token holder burning wBEZ.
     * @param amount Amount to burn.
     * @param targetChainId Chain ID where BEZ will be unlocked.
     */
    function bridgeBurn(address from, uint256 amount, uint256 targetChainId)
        external
        onlyRole(BRIDGE_ROLE)
    {
        require(from != address(0), "Invalid sender");
        require(amount > 0, "Amount must be > 0");
        _burn(from, amount);
        emit BridgeBurn(from, amount, targetChainId);
    }

    /**
     * @dev Users can burn their own wBEZ to initiate a bridge back to L2.
     * Emits BridgeBurn so the relayer picks it up.
     * @param amount Amount to burn.
     * @param targetChainId Destination chain ID (BeZhas L2).
     */
    function burnForBridge(uint256 amount, uint256 targetChainId) external {
        require(amount > 0, "Amount must be > 0");
        _burn(msg.sender, amount);
        emit BridgeBurn(msg.sender, amount, targetChainId);
    }
}
