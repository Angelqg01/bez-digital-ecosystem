// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";
import "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title CustomsClearanceOracle - Manages customs declarations, tariffs, and clearance
/// @dev Integrates with AduanaEasy, TradeGo, e-Aduanas and similar platforms
contract CustomsClearanceOracle is AccessControl, ReentrancyGuard {

    bytes32 public constant CUSTOMS_OFFICER_ROLE = keccak256("CUSTOMS_OFFICER_ROLE");
    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    IERC20 public bezCoin;
    address public treasuryMultisig;

    // ── Tariff Data ────────────────────────────────────────────
    struct TariffData {
        bytes32 hsCode;
        string description;
        uint256 tarifRateBps;      // bps (10000 = 100%)
        bool requiresPermit;
        string requiredDocument;
        uint256 lastUpdated;
        bool isActive;
    }

    // ── Customs Platform Registry ──────────────────────────────
    struct CustomsPlatform {
        string name;
        string apiEndpoint;
        address adminAddress;
        uint256 clearancesProcessed;
        uint256 totalRevenueCollected;
        bool isActive;
    }

    // ── Clearance Request ──────────────────────────────────────
    struct ClearanceRecord {
        uint256 shipmentId;
        string platformName;
        bytes32 hsCode;
        uint256 cargoValue;
        uint256 calculatedDutyUSD;
        uint256 integrationFeeBEZ;
        ClearanceStatus status;
        bytes32 duaHash;
        address declarant;
        address aduanaOfficer;
        uint256 requestTimestamp;
        uint256 approvalTimestamp;
        string rejectionReason;
    }

    enum ClearanceStatus {
        PENDING,
        PRE_VALIDATED,
        APPROVED,
        REJECTED,
        IN_CUSTOMS,
        ESCALATED
    }

    mapping(bytes32 => TariffData) public tariffs;
    mapping(string => CustomsPlatform) public customsPlatforms;
    mapping(uint256 => ClearanceRecord) public clearances;
    mapping(string => uint256) public platformRevenue;
    mapping(bytes32 => bool) public usedDuaHashes;

    uint256 public totalClearanceFeesCollected;
    uint256 public totalClearancesProcessed;

    event TariffUpdated(bytes32 indexed hsCode, uint256 newRate, string description);
    event PlatformRegistered(string indexed platformName, string apiEndpoint, address admin);
    event ClearanceRequested(uint256 indexed shipmentId, string platformName, uint256 cargoValue, uint256 integrationFee);
    event ClearanceApproved(uint256 indexed shipmentId, bytes32 indexed hsCode, uint256 duty, address officer);
    event ClearanceRejected(uint256 indexed shipmentId, string reason);
    event PreClearanceValidation(uint256 indexed shipmentId, uint8 riskScore, string recommendation);

    modifier onlyActivePlatform(string calldata _platformName) {
        require(customsPlatforms[_platformName].isActive, "Platform not active");
        _;
    }

    constructor(address _bezCoin, address _treasury) {
        bezCoin = IERC20(_bezCoin);
        treasuryMultisig = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PLATFORM_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    // ── Register customs platform ──────────────────────────────
    function registerCustomsPlatform(
        string calldata _name,
        string calldata _apiEndpoint,
        address _adminAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_adminAddress != address(0), "Invalid admin");
        require(bytes(_name).length > 0, "Name required");

        customsPlatforms[_name] = CustomsPlatform({
            name: _name,
            apiEndpoint: _apiEndpoint,
            adminAddress: _adminAddress,
            clearancesProcessed: 0,
            totalRevenueCollected: 0,
            isActive: true
        });

        emit PlatformRegistered(_name, _apiEndpoint, _adminAddress);
    }

    // ── Update tariff rates ────────────────────────────────────
    function updateTariff(
        bytes32 _hsCode,
        string calldata _description,
        uint256 _tarifRateBps,
        bool _requiresPermit,
        string calldata _requiredDocument
    ) external onlyRole(ORACLE_ROLE) {
        require(_tarifRateBps <= 100000, "Rate too high");

        tariffs[_hsCode] = TariffData({
            hsCode: _hsCode,
            description: _description,
            tarifRateBps: _tarifRateBps,
            requiresPermit: _requiresPermit,
            requiredDocument: _requiredDocument,
            lastUpdated: block.timestamp,
            isActive: true
        });

        emit TariffUpdated(_hsCode, _tarifRateBps, _description);
    }

    // ── Request clearance from customs platform ────────────────
    function requestClearance(
        uint256 _shipmentId,
        bytes32 _hsCode,
        uint256 _cargoValueUSD,
        string calldata _platformName,
        bytes32 _duaHash
    ) external onlyActivePlatform(_platformName) nonReentrant {
        
        require(!usedDuaHashes[_duaHash], "DUA already used");
        require(tariffs[_hsCode].isActive, "HS code not registered");
        require(_cargoValueUSD > 0, "Invalid cargo value");

        TariffData storage tariff = tariffs[_hsCode];

        // Calculate estimated duty (in USD)
        uint256 estimatedDuty = (_cargoValueUSD * tariff.tarifRateBps) / 10000;

        // Integration fee: 0.15% of cargo value (in BEZ, 1 BEZ = $1)
        uint256 integrationFeeBEZ = (_cargoValueUSD * 15) / 10000;

        // Create clearance record
        clearances[_shipmentId] = ClearanceRecord({
            shipmentId: _shipmentId,
            platformName: _platformName,
            hsCode: _hsCode,
            cargoValue: _cargoValueUSD,
            calculatedDutyUSD: estimatedDuty,
            integrationFeeBEZ: integrationFeeBEZ,
            status: ClearanceStatus.PENDING,
            duaHash: _duaHash,
            declarant: msg.sender,
            aduanaOfficer: address(0),
            requestTimestamp: block.timestamp,
            approvalTimestamp: 0,
            rejectionReason: ""
        });

        usedDuaHashes[_duaHash] = true;

        // Collect integration fee (split: 50% BeZhas, 50% Platform)
        require(
            bezCoin.transferFrom(msg.sender, address(this), integrationFeeBEZ),
            "Fee transfer failed"
        );

        // Send 50% to treasury
        uint256 toTreasury = integrationFeeBEZ / 2;
        require(bezCoin.transfer(treasuryMultisig, toTreasury), "Treasury transfer failed");

        // Keep 50% for platform (claimed later)
        platformRevenue[_platformName] += (integrationFeeBEZ - toTreasury);

        totalClearanceFeesCollected += integrationFeeBEZ;
        totalClearancesProcessed++;

        emit ClearanceRequested(_shipmentId, _platformName, _cargoValueUSD, integrationFeeBEZ);
    }

    // ── Pre-clearance validation (AI + document check) ─────────
    function preClearanceValidation(
        uint256 _shipmentId,
        uint8 _riskScore,
        string calldata _recommendation
    ) external onlyRole(ORACLE_ROLE) {
        require(_riskScore <= 100, "Invalid risk score");

        ClearanceRecord storage c = clearances[_shipmentId];
        require(c.status == ClearanceStatus.PENDING, "Invalid clearance status");

        if (_riskScore < 30) {
            c.status = ClearanceStatus.PRE_VALIDATED;
        } else if (_riskScore > 70) {
            c.status = ClearanceStatus.ESCALATED;
        }

        emit PreClearanceValidation(_shipmentId, _riskScore, _recommendation);
    }

    // ── Approve clearance by customs officer ────────────────────
    function approveClearanceByOfficer(
        uint256 _shipmentId,
        bytes32 _signatureHash
    ) external onlyRole(CUSTOMS_OFFICER_ROLE) {
        
        ClearanceRecord storage c = clearances[_shipmentId];
        require(
            c.status == ClearanceStatus.PENDING || 
            c.status == ClearanceStatus.PRE_VALIDATED,
            "Cannot approve from current status"
        );

        c.status = ClearanceStatus.APPROVED;
        c.aduanaOfficer = msg.sender;
        c.approvalTimestamp = block.timestamp;

        emit ClearanceApproved(_shipmentId, c.hsCode, c.calculatedDutyUSD, msg.sender);
    }

    // ── Reject clearance ───────────────────────────────────────
    function rejectClearance(
        uint256 _shipmentId,
        string calldata _reason
    ) external onlyRole(CUSTOMS_OFFICER_ROLE) {
        
        ClearanceRecord storage c = clearances[_shipmentId];
        require(c.status != ClearanceStatus.APPROVED, "Cannot reject approved shipment");

        c.status = ClearanceStatus.REJECTED;
        c.rejectionReason = _reason;

        emit ClearanceRejected(_shipmentId, _reason);
    }

    // ── Check if shipment is cleared ───────────────────────────
    function isClearanceApproved(uint256 _shipmentId) 
        external 
        view 
        returns (bool) 
    {
        return clearances[_shipmentId].status == ClearanceStatus.APPROVED;
    }

    // ── Get clearance details ──────────────────────────────────
    function getClearanceDetails(uint256 _shipmentId) 
        external 
        view 
        returns (ClearanceRecord memory) 
    {
        return clearances[_shipmentId];
    }

    // ── Get tariff information ─────────────────────────────────
    function getTariffInfo(bytes32 _hsCode) 
        external 
        view 
        returns (TariffData memory) 
    {
        return tariffs[_hsCode];
    }

    // ── Calculate duty for shipment ────────────────────────────
    function calculateDuty(bytes32 _hsCode, uint256 _cargoValueUSD) 
        external 
        view 
        returns (uint256 dutyUSD) 
    {
        TariffData storage tariff = tariffs[_hsCode];
        require(tariff.isActive, "HS code not found");
        return (_cargoValueUSD * tariff.tarifRateBps) / 10000;
    }

    // ── Get platform revenue ───────────────────────────────────
    function getPlatformRevenue(string calldata _platformName) 
        external 
        view 
        returns (uint256) 
    {
        return platformRevenue[_platformName];
    }

    // ── Withdraw platform revenue ──────────────────────────────
    function withdrawPlatformRevenue(string calldata _platformName) 
        external 
        nonReentrant 
    {
        require(
            msg.sender == customsPlatforms[_platformName].adminAddress ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );

        uint256 amount = platformRevenue[_platformName];
        require(amount > 0, "No revenue to withdraw");

        platformRevenue[_platformName] = 0;
        require(bezCoin.transfer(msg.sender, amount), "Transfer failed");
    }

    // ── Set platform active/inactive ───────────────────────────
    function setCustomsPlatformActive(
        string calldata _platformName,
        bool _active
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(customsPlatforms[_platformName].name).length > 0, "Platform not found");
        customsPlatforms[_platformName].isActive = _active;
    }
}
