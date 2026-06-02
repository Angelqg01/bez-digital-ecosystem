// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title TrackingIntegrationGateway - Manages tokenized cargo tracking via external APIs
/// @dev Integrates FlighRadar24, MarineTraffic, SafeCube with on-chain shipment tracking
contract TrackingIntegrationGateway is AccessControl, ReentrancyGuard {

    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public bezCoin;
    address public treasuryMultisig;

    // ── Provider Registry ──────────────────────────────────────
    struct APIProvider {
        string name;
        bytes32 endpointHash;
        uint256 monthlyBudgetBEZ;
        uint256 budgetUsedThisMonth;
        address webhookAddress;
        bool isActive;
        uint256 callsProcessed;
        uint256 totalFeesCollected;
    }

    // ── Tracking Metadata ──────────────────────────────────────
    struct CargoTracking {
        uint256 shipmentId;
        bytes32 providerID;
        string externalRefID;
        uint256 tokenizationFeeBEZ;
        uint256 checkpointCount;
        uint256 lastCheckpointTime;
        bool isActive;
    }

    // ── Checkpoint Record ──────────────────────────────────────
    struct CheckpointRecord {
        uint256 shipmentId;
        int256 latitude;
        int256 longitude;
        uint256 timestamp;
        uint8 statusCode;
        int256 temperature;
        uint256 speed;
        string locationName;
        address recordedBy;
    }

    mapping(bytes32 => APIProvider) public providers;
    mapping(uint256 => CargoTracking) public cargoTracking;
    mapping(uint256 => CheckpointRecord[]) public shipmentCheckpoints;
    
    uint256 public totalTokenizationFees;
    uint256 public totalCheckpointsRecorded;

    event ProviderRegistered(bytes32 indexed providerId, string name, uint256 monthlyBudget);
    event CargoTokenizedWithTracking(uint256 indexed shipmentId, bytes32 indexed providerId, string externalRefId, uint256 tokenizationFee);
    event CheckpointRecordedViaProvider(uint256 indexed shipmentId, int256 lat, int256 lon, uint256 timestamp);
    event ProviderBudgetUpdated(bytes32 indexed providerId, uint256 newBudgetBEZ);
    event MonthlyBudgetReset(uint256 month);

    modifier onlyActiveProvider(bytes32 _providerId) {
        require(providers[_providerId].isActive, "Provider not active");
        _;
    }

    constructor(address _bezCoin, address _treasury) {
        bezCoin = IERC20(_bezCoin);
        treasuryMultisig = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ── Register a new tracking provider ──────────────────────
    function registerProvider(
        bytes32 _providerId,
        string calldata _name,
        address _webhookAddress,
        uint256 _monthlyBudgetBEZ
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_webhookAddress != address(0), "Invalid webhook");
        require(_monthlyBudgetBEZ > 0, "Budget must > 0");

        providers[_providerId] = APIProvider({
            name: _name,
            endpointHash: keccak256(abi.encodePacked(_name)),
            monthlyBudgetBEZ: _monthlyBudgetBEZ,
            budgetUsedThisMonth: 0,
            webhookAddress: _webhookAddress,
            isActive: true,
            callsProcessed: 0,
            totalFeesCollected: 0
        });

        emit ProviderRegistered(_providerId, _name, _monthlyBudgetBEZ);
    }

    // ── Mint cargo NFT linked to provider tracking ─────────────
    function mintCargoWithTracking(
        uint256 _shipmentId,
        bytes32 _providerId,
        string calldata _externalRefID,
        uint256 _cargoValue
    ) external onlyActiveProvider(_providerId) nonReentrant returns (bool) {
        
        APIProvider storage prov = providers[_providerId];
        
        // Calculate tokenization fee: 0.5% of cargo value (in BEZ equivalent)
        // Assuming 1 BEZ = $1 for simplicity (in production: use oracle)
        uint256 tokenizationFee = (_cargoValue * 5) / 1000;
        
        require(prov.budgetUsedThisMonth + tokenizationFee <= prov.monthlyBudgetBEZ, "Budget exceeded");
        
        // Deduct from provider budget
        prov.budgetUsedThisMonth += tokenizationFee;
        prov.callsProcessed++;
        prov.totalFeesCollected += tokenizationFee;
        
        // Create tracking record
        cargoTracking[_shipmentId] = CargoTracking({
            shipmentId: _shipmentId,
            providerID: _providerId,
            externalRefID: _externalRefID,
            tokenizationFeeBEZ: tokenizationFee,
            checkpointCount: 0,
            lastCheckpointTime: block.timestamp,
            isActive: true
        });
        
        // Transfer fee from provider to treasury
        require(
            bezCoin.transferFrom(prov.webhookAddress, treasuryMultisig, tokenizationFee),
            "Fee transfer failed"
        );
        
        totalTokenizationFees += tokenizationFee;
        
        emit CargoTokenizedWithTracking(_shipmentId, _providerId, _externalRefID, tokenizationFee);
        return true;
    }

    // ── Record checkpoint via provider webhook ──────────────────
    function recordCheckpointViaAPI(
        uint256 _shipmentId,
        int256 _latitude,
        int256 _longitude,
        uint256 _timestamp,
        uint8 _statusCode,
        int256 _temperature,
        uint256 _speed,
        string calldata _locationName
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        
        CargoTracking storage cargo = cargoTracking[_shipmentId];
        require(cargo.isActive, "Cargo not tracked");
        
        APIProvider storage prov = providers[cargo.providerID];
        
        // Each checkpoint costs 0.001 BEZ (provider or client pays)
        uint256 checkpointCost = 1 * 10**15; // 0.001 BEZ in wei
        
        require(prov.budgetUsedThisMonth + checkpointCost <= prov.monthlyBudgetBEZ, "Budget exceeded");
        
        // Deduct checkpoint cost
        prov.budgetUsedThisMonth += checkpointCost;
        
        // Record checkpoint
        CheckpointRecord memory cp = CheckpointRecord({
            shipmentId: _shipmentId,
            latitude: _latitude,
            longitude: _longitude,
            timestamp: _timestamp,
            statusCode: _statusCode,
            temperature: _temperature,
            speed: _speed,
            locationName: _locationName,
            recordedBy: msg.sender
        });
        
        shipmentCheckpoints[_shipmentId].push(cp);
        
        cargo.checkpointCount++;
        cargo.lastCheckpointTime = block.timestamp;
        totalCheckpointsRecorded++;
        
        emit CheckpointRecordedViaProvider(_shipmentId, _latitude, _longitude, _timestamp);
    }

    // ── Get shipment tracking history ──────────────────────────
    function getShipmentCheckpoints(uint256 _shipmentId) 
        external 
        view 
        returns (CheckpointRecord[] memory) 
    {
        return shipmentCheckpoints[_shipmentId];
    }

    // ── Get last checkpoint ────────────────────────────────────
    function getLastCheckpoint(uint256 _shipmentId) 
        external 
        view 
        returns (CheckpointRecord memory) 
    {
        require(shipmentCheckpoints[_shipmentId].length > 0, "No checkpoints");
        return shipmentCheckpoints[_shipmentId][shipmentCheckpoints[_shipmentId].length - 1];
    }

    // ── Update provider budget ─────────────────────────────────
    function updateProviderBudget(
        bytes32 _providerId,
        uint256 _newBudgetBEZ
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(providers[_providerId].webhookAddress != address(0), "Provider not found");
        providers[_providerId].monthlyBudgetBEZ = _newBudgetBEZ;
        providers[_providerId].budgetUsedThisMonth = 0;
        emit ProviderBudgetUpdated(_providerId, _newBudgetBEZ);
    }

    // ── Get provider stats ─────────────────────────────────────
    function getProviderStats(bytes32 _providerId) 
        external 
        view 
        returns (
            string memory name,
            uint256 budgetBEZ,
            uint256 budgetUsed,
            uint256 callsProcessed,
            uint256 totalFeesCollected,
            bool isActive
        ) 
    {
        APIProvider storage prov = providers[_providerId];
        return (
            prov.name,
            prov.monthlyBudgetBEZ,
            prov.budgetUsedThisMonth,
            prov.callsProcessed,
            prov.totalFeesCollected,
            prov.isActive
        );
    }

    // ── Disable/Enable provider ────────────────────────────────
    function setProviderActive(bytes32 _providerId, bool _active) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        providers[_providerId].isActive = _active;
    }
}
