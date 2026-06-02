// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EnergyOracle
 * @dev Centralized Oracle for feeding OMIE (Mercado Mayorista) prices into the BeZhas ecosystem.
 * Prices are updated by a designated Oracle Node.
 */
contract EnergyOracle is AccessControl {
    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");

    struct PriceData {
        uint256 price; // Price in BZHS per MWh (or micro-cents)
        uint256 timestamp;
        bool isNegative; // Important: electricity pool prices can go negative
    }

    PriceData public currentPriceData;
    
    event PriceUpdated(uint256 price, uint256 timestamp, bool isNegative);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_UPDATER_ROLE, msg.sender);
    }

    /**
     * @dev Update the current electricity pool price
     */
    function updatePrice(uint256 _price, bool _isNegative) external onlyRole(ORACLE_UPDATER_ROLE) {
        currentPriceData = PriceData({
            price: _price,
            timestamp: block.timestamp,
            isNegative: _isNegative
        });

        emit PriceUpdated(_price, block.timestamp, _isNegative);
    }

    /**
     * @dev Get the latest valid price
     */
    function getCurrentPrice() external view returns (uint256) {
        require(block.timestamp - currentPriceData.timestamp < 1 hours, "Price is stale");
        return currentPriceData.price;
    }
    
    function isPriceNegative() external view returns (bool) {
        require(block.timestamp - currentPriceData.timestamp < 1 hours, "Price is stale");
        return currentPriceData.isNegative;
    }
}
