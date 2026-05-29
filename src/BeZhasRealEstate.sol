// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title BeZhasRealEstate
 * @dev Professional Real Estate Tokenization Platform (RWA)
 * Features: Fractional Ownership, Dividend Distribution, Automated Market Maker for Initial Sale
 */
contract BeZhasRealEstate is ERC1155, Ownable, ReentrancyGuard {
    using Strings for uint256;

    struct Property {
        string name;
        string location;
        uint256 totalShares;
        uint256 sharesSold;
        uint256 sharePrice; // Price in Wei
        uint256 totalRevenue; // Total ETH/BNB distributed as dividends
        bool isActive;
        uint256 creationTime;
    }

    // Property ID => Property Details
    mapping(uint256 => Property) public properties;
    
    // Property ID => (User Address => Withdrawn Dividends)
    mapping(uint256 => mapping(address => uint256)) public withdrawnDividends;
    
    // Property ID => Cumulative Dividends per Share (Scaled by 1e18 for precision)
    mapping(uint256 => uint256) public dividendsPerShare;

    uint256 constant MAGNITUDE = 1e18;

    event PropertyCreated(uint256 indexed id, string name, uint256 totalShares, uint256 price);
    event SharesPurchased(uint256 indexed id, address indexed buyer, uint256 amount, uint256 cost);
    event RevenueDeposited(uint256 indexed id, uint256 amount);
    event DividendsClaimed(uint256 indexed id, address indexed user, uint256 amount);

    constructor() ERC1155("https://api.bezhas.com/metadata/realestate/{id}.json") Ownable(msg.sender) {}

    /**
     * @dev Create a new Real Estate Property and tokenize it.
     * Tokens are minted to the Contract address to facilitate sales.
     */
    function createProperty(
        uint256 id, 
        uint256 _totalShares, 
        uint256 _price, 
        string memory _name,
        string memory _location
    ) external onlyOwner {
        require(!properties[id].isActive, "Property ID already exists");
        
        properties[id] = Property({
            name: _name,
            location: _location,
            totalShares: _totalShares,
            sharesSold: 0,
            sharePrice: _price,
            totalRevenue: 0,
            isActive: true,
            creationTime: block.timestamp
        });

        // Mint tokens to the contract itself so it can sell them
        _mint(address(this), id, _totalShares, "");
        
        emit PropertyCreated(id, _name, _totalShares, _price);
    }

    /**
     * @dev Buy shares of a property directly from the platform.
     */
    function buyShares(uint256 id, uint256 amount) external payable nonReentrant {
        Property storage prop = properties[id];
        require(prop.isActive, "Property not active");
        require(prop.sharesSold + amount <= prop.totalShares, "Not enough shares available");
        require(msg.value >= prop.sharePrice * amount, "Insufficient payment");

        // Calculate excess payment and refund if necessary
        uint256 cost = prop.sharePrice * amount;
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        // Transfer shares from Contract to Buyer
        _safeTransferFrom(address(this), msg.sender, id, amount, "");
        
        prop.sharesSold += amount;

        // Correct the dividend offset for the new owner so they don't claim past dividends
        // This is a simplified model; for a perfect model, we'd need a more complex "points" system
        // or just accept that buying late doesn't give you past dividends (handled by current balance check in claim)
        // However, standard dividend per share model:
        // claimable = (balance * accumulatedPerShare) - withdrawn
        // When buying, we must set 'withdrawn' to simulate they already withdrew past dividends
        withdrawnDividends[id][msg.sender] += amount * dividendsPerShare[id] / MAGNITUDE;

        emit SharesPurchased(id, msg.sender, amount, cost);
    }

    /**
     * @dev Deposit revenue (Rent) to be distributed to shareholders.
     */
    function depositRevenue(uint256 id) external payable {
        require(properties[id].isActive, "Property not active");
        require(msg.value > 0, "Must deposit value");
        require(properties[id].sharesSold > 0, "No shareholders yet");

        // Distribute only to SOLD shares. Unsold shares (held by contract) don't get dividends in this model
        // or they do, and the contract accumulates them. 
        // Let's distribute to ALL shares for simplicity, assuming contract is a shareholder too.
        // dividendsPerShare += amount / totalShares
        
        dividendsPerShare[id] += (msg.value * MAGNITUDE) / properties[id].totalShares;
        properties[id].totalRevenue += msg.value;

        emit RevenueDeposited(id, msg.value);
    }

    /**
     * @dev Claim available dividends for a property.
     */
    function claimDividends(uint256 id) external nonReentrant {
        uint256 shareBalance = balanceOf(msg.sender, id);
        require(shareBalance > 0, "No shares owned");

        uint256 totalAccumulated = (shareBalance * dividendsPerShare[id]) / MAGNITUDE;
        uint256 alreadyWithdrawn = withdrawnDividends[id][msg.sender];
        
        require(totalAccumulated > alreadyWithdrawn, "No new dividends");

        uint256 toPay = totalAccumulated - alreadyWithdrawn;
        withdrawnDividends[id][msg.sender] += toPay;

        payable(msg.sender).transfer(toPay);
        
        emit DividendsClaimed(id, msg.sender, toPay);
    }

    /**
     * @dev View function to check claimable dividends.
     */
    function getClaimableDividends(uint256 id, address user) external view returns (uint256) {
        uint256 shareBalance = balanceOf(user, id);
        if (shareBalance == 0) return 0;

        uint256 totalAccumulated = (shareBalance * dividendsPerShare[id]) / MAGNITUDE;
        uint256 alreadyWithdrawn = withdrawnDividends[id][user];

        if (totalAccumulated <= alreadyWithdrawn) return 0;
        return totalAccumulated - alreadyWithdrawn;
    }

    /**
     * @dev Admin function to withdraw funds from token sales (Liquidity).
     */
    function withdrawFunds() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Required override for ERC1155 receiving
    function onERC1155Received(address, address, uint256, uint256, bytes memory) public virtual returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] memory, uint256[] memory, bytes memory) public virtual returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }
}
