// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EnergyOracle.sol";

/**
 * @title BeZhasVPP
 * @dev Virtual Power Plant contract for managing decentralized energy assets.
 * Orchestrates battery charging/discharging based on OMIE pricing from EnergyOracle.
 */
contract BeZhasVPP is AccessControl, ReentrancyGuard {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    EnergyOracle public oracle;

    struct NodeTelemetry {
        uint256 lastUpdate;
        int256 netFlow; // Net kW flow (positive = export, negative = import)
        uint256 batterySOC; // State of Charge (0-100)
        bool isOnline;
    }

    struct MarketBid {
        uint256 timestamp;
        uint256 amountMWh;
        uint256 price;
        bool isBuy; // true = charge batteries, false = discharge/sell
        bool executed;
    }

    mapping(address => NodeTelemetry) public nodes;
    MarketBid[] public bids;
    address[] public registeredNodes;

    event TelemetryUpdated(address indexed node, int256 netFlow, uint256 batterySOC);
    event BidSubmitted(uint256 indexed bidId, uint256 amountMWh, uint256 price, bool isBuy);
    event BidExecuted(uint256 indexed bidId);

    constructor(address _oracleAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(AGENT_ROLE, msg.sender);
        oracle = EnergyOracle(_oracleAddress);
    }

    /**
     * @dev Register a physical edge node (inverter/battery)
     */
    function registerNode() external {
        require(!nodes[msg.sender].isOnline, "Node already registered");
        nodes[msg.sender] = NodeTelemetry(block.timestamp, 0, 0, true);
        registeredNodes.push(msg.sender);
    }

    /**
     * @dev Edge nodes report their status
     */
    function updateTelemetry(int256 _netFlow, uint256 _batterySOC) external {
        require(nodes[msg.sender].isOnline, "Node not registered");
        require(_batterySOC <= 100, "Invalid SOC");
        
        nodes[msg.sender].lastUpdate = block.timestamp;
        nodes[msg.sender].netFlow = _netFlow;
        nodes[msg.sender].batterySOC = _batterySOC;

        emit TelemetryUpdated(msg.sender, _netFlow, _batterySOC);
    }

    /**
     * @dev The AI Agent submits a market bid based on Oracle pricing
     */
    function submitBid(uint256 _amountMWh, uint256 _priceLimit, bool _isBuy) external onlyRole(AGENT_ROLE) {
        bids.push(MarketBid({
            timestamp: block.timestamp,
            amountMWh: _amountMWh,
            price: _priceLimit,
            isBuy: _isBuy,
            executed: false
        }));

        emit BidSubmitted(bids.length - 1, _amountMWh, _priceLimit, _isBuy);
    }

    /**
     * @dev The AI Agent executes the bid if market conditions are met
     */
    function executeBid(uint256 _bidId) external onlyRole(AGENT_ROLE) nonReentrant {
        require(_bidId < bids.length, "Invalid bid ID");
        MarketBid storage bid = bids[_bidId];
        require(!bid.executed, "Bid already executed");

        uint256 currentPrice = oracle.getCurrentPrice();

        if (bid.isBuy) {
            require(currentPrice <= bid.price, "Price too high for buy bid");
        } else {
            require(currentPrice >= bid.price, "Price too low for sell bid");
        }

        bid.executed = true;
        // In a full implementation, this would trigger IoT commands to edge nodes
        // and handle the financial settlement with BEZ tokens.

        emit BidExecuted(_bidId);
    }

    function getRegisteredNodesCount() external view returns (uint256) {
        return registeredNodes.length;
    }
}
