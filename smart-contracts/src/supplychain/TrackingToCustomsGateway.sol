// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";
import "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "./TrackingIntegrationGateway.sol";
import "./CustomsClearanceOracle.sol";

/// @title TrackingToCustomsGateway - Links tokenized tracking to customs clearance
/// @dev Bridges supply tracking with customs compliance workflows
contract TrackingToCustomsGateway is AccessControl, ReentrancyGuard {

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    TrackingIntegrationGateway public trackingGateway;
    CustomsClearanceOracle public customsOracle;

    event CustomsFeeAllowanceSet(uint256 amount);

    // ── Integrated Shipment ────────────────────────────────────
    struct IntegratedShipment {
        uint256 shipmentId;
        bytes32 trackingProviderId;
        string customsPlatform;
        bytes32 hsCode;
        uint256 cargoValue;
        bool trackingActive;
        bool clearanceApproved;
        uint256 createdAt;
    }

    // ── Multi-Country Clearance ────────────────────────────────
    struct MultiCountryClearance {
        uint256 shipmentId;
        string[] countries;
        mapping(string => bool) countryClearanceStatus;
        uint256 totalCheckpointsCrossed;
        bool allCountriesCleared;
    }

    mapping(uint256 => IntegratedShipment) public integratedShipments;
    mapping(uint256 => MultiCountryClearance) public multiCountryClearances;

    uint256 public totalIntegratedShipments;

    event IntegratedShipmentCreated(
        uint256 indexed shipmentId,
        bytes32 indexed providerId,
        string customsPlatform,
        bytes32 hsCode
    );
    event TrackingAndClearanceLinked(uint256 indexed shipmentId, bool trackingActive, bool clearanceRequested);
    event MultiCountryClearanceStarted(uint256 indexed shipmentId, string[] countries);
    event CountryClearanceCompleted(uint256 indexed shipmentId, string country);
    event EndToEndComplianceCompleted(uint256 indexed shipmentId);

    constructor(
        address _trackingGateway,
        address _customsOracle
    ) {
        trackingGateway = TrackingIntegrationGateway(_trackingGateway);
        customsOracle = CustomsClearanceOracle(_customsOracle);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    // ── Initialize integrated shipment with tracking + customs ──
    function createIntegratedShipment(
        uint256 _shipmentId,
        bytes32 _trackingProviderId,
        string calldata _trackingRefId,
        string calldata _customsPlatform,
        bytes32 _hsCode,
        uint256 _cargoValue,
        bytes32 _duaHash
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {

        IntegratedShipment storage ship = integratedShipments[_shipmentId];
        require(ship.shipmentId == 0, "Shipment already integrated");

        // Start tracking
        bool trackingStarted = trackingGateway.mintCargoWithTracking(
            _shipmentId,
            _trackingProviderId,
            _trackingRefId,
            _cargoValue
        );
        require(trackingStarted, "Tracking initialization failed");

        // Request customs clearance
        customsOracle.requestClearance(
            _shipmentId,
            _hsCode,
            _cargoValue,
            _customsPlatform,
            _duaHash
        );

        // Store integrated record
        integratedShipments[_shipmentId] = IntegratedShipment({
            shipmentId: _shipmentId,
            trackingProviderId: _trackingProviderId,
            customsPlatform: _customsPlatform,
            hsCode: _hsCode,
            cargoValue: _cargoValue,
            trackingActive: true,
            clearanceApproved: false,
            createdAt: block.timestamp
        });

        totalIntegratedShipments++;

        emit IntegratedShipmentCreated(
            _shipmentId,
            _trackingProviderId,
            _customsPlatform,
            _hsCode
        );
    }

    // ── Add checkpoint while tracking ──────────────────────────
    function addCheckpointWithTracking(
        uint256 _shipmentId,
        int256 _latitude,
        int256 _longitude,
        uint256 _timestamp,
        uint8 _statusCode,
        int256 _temperature,
        uint256 _speed,
        string calldata _locationName
    ) external onlyRole(OPERATOR_ROLE) {

        IntegratedShipment storage ship = integratedShipments[_shipmentId];
        require(ship.trackingActive, "Shipment not being tracked");

        trackingGateway.recordCheckpointViaAPI(
            _shipmentId,
            _latitude,
            _longitude,
            _timestamp,
            _statusCode,
            _temperature,
            _speed,
            _locationName
        );

        emit TrackingAndClearanceLinked(_shipmentId, true, false);
    }

    // ── Approve clearance (customs officer) ─────────────────────
    function approveClearanceAndRelease(
        uint256 _shipmentId,
        bytes32 _signatureHash
    ) external {

        IntegratedShipment storage ship = integratedShipments[_shipmentId];
        require(ship.trackingActive, "Shipment not tracked");

        // Approve in customs oracle
        customsOracle.approveClearanceByOfficer(_shipmentId, _signatureHash);

        // Mark as cleared
        ship.clearanceApproved = true;

        emit TrackingAndClearanceLinked(_shipmentId, true, true);
    }

    // ── Setup multi-country clearance (EU example: ES→FR→DE) ────
    function setupMultiCountryClearance(
        uint256 _shipmentId,
        string[] calldata _countries
    ) external onlyRole(OPERATOR_ROLE) {

        require(_countries.length > 1, "Need at least 2 countries");

        MultiCountryClearance storage mcc = multiCountryClearances[_shipmentId];
        mcc.shipmentId = _shipmentId;
        mcc.countries = _countries;
        mcc.totalCheckpointsCrossed = 0;
        mcc.allCountriesCleared = false;

        emit MultiCountryClearanceStarted(_shipmentId, _countries);
    }

    // ── Mark country as cleared ────────────────────────────────
    function completeCountryClearance(
        uint256 _shipmentId,
        string calldata _country
    ) external {

        MultiCountryClearance storage mcc = multiCountryClearances[_shipmentId];
        require(mcc.shipmentId == _shipmentId, "Multi-country clearance not found");

        mcc.countryClearanceStatus[_country] = true;

        // Check if all countries cleared
        bool allCleared = true;
        for (uint256 i = 0; i < mcc.countries.length; i++) {
            if (!mcc.countryClearanceStatus[mcc.countries[i]]) {
                allCleared = false;
                break;
            }
        }

        mcc.allCountriesCleared = allCleared;

        emit CountryClearanceCompleted(_shipmentId, _country);

        if (allCleared) {
            emit EndToEndComplianceCompleted(_shipmentId);
        }
    }

    // ── Permitir a la aduana cobrar su tasa ────────────────────
    //
    // `CustomsClearanceOracle.requestClearance` cobra la tasa de integración
    // con `transferFrom(msg.sender, ...)`, y cuando la llamada viene por aquí
    // ese `msg.sender` es ESTE contrato. Sin una forma de fijar la allowance,
    // `createIntegratedShipment` revierte siempre con
    // `ERC20InsufficientAllowance`, y el contrato no puede funcionar en una
    // cadena real por mucho que se le transfieran BEZ.
    //
    // Las pruebas no lo detectaban porque resuelven la allowance con
    // `vm.prank(address(gateway))` — suplantar a un contrato es algo que sólo
    // existe dentro de Foundry. Verde en el test, imposible en producción.
    function approveCustomsFees(uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20 bez = customsOracle.bezCoin();
        // A cero primero: hay ERC-20 que rechazan cambiar una allowance no nula.
        bez.approve(address(customsOracle), 0);
        bez.approve(address(customsOracle), _amount);
        emit CustomsFeeAllowanceSet(_amount);
    }

    // ── Get integrated shipment status ─────────────────────────
    function getShipmentStatus(uint256 _shipmentId) 
        external 
        view 
        returns (
            bool isIntegrated,
            bool trackingActive,
            bool clearanceApproved,
            string memory platform
        ) 
    {
        IntegratedShipment storage ship = integratedShipments[_shipmentId];
        return (
            ship.shipmentId == _shipmentId,
            ship.trackingActive,
            ship.clearanceApproved,
            ship.customsPlatform
        );
    }

    // ── Get current tracking location ──────────────────────────
    function getCurrentLocation(uint256 _shipmentId) 
        external 
        view 
        returns (
            int256 latitude,
            int256 longitude,
            string memory location,
            uint256 timestamp
        ) 
    {
        TrackingIntegrationGateway.CheckpointRecord memory lastCp = 
            trackingGateway.getLastCheckpoint(_shipmentId);
        
        return (
            lastCp.latitude,
            lastCp.longitude,
            lastCp.locationName,
            lastCp.timestamp
        );
    }

    // ── Get all checkpoints for shipment ───────────────────────
    function getCompleteShipmentHistory(uint256 _shipmentId) 
        external 
        view 
        returns (TrackingIntegrationGateway.CheckpointRecord[] memory) 
    {
        return trackingGateway.getShipmentCheckpoints(_shipmentId);
    }

    // ── Check customs clearance status ──────────────────────────
    function isClearedAndReadyForRelease(uint256 _shipmentId) 
        external 
        view 
        returns (bool) 
    {
        IntegratedShipment storage ship = integratedShipments[_shipmentId];
        bool customsCleared = customsOracle.isClearanceApproved(_shipmentId);
        return ship.trackingActive && customsCleared;
    }

    // ── Get multi-country status ───────────────────────────────
    function getMultiCountryStatus(uint256 _shipmentId) 
        external 
        view 
        returns (
            string[] memory countries,
            bool allCleared,
            uint256 checkpointsRecorded
        ) 
    {
        MultiCountryClearance storage mcc = multiCountryClearances[_shipmentId];
        return (
            mcc.countries,
            mcc.allCountriesCleared,
            mcc.totalCheckpointsCrossed
        );
    }
}
