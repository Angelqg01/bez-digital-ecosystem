// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/TrackingToCustomsGateway.sol";
import "../../src/supplychain/TrackingIntegrationGateway.sol";
import "../../src/supplychain/CustomsClearanceOracle.sol";
import "../../src/tokens/BEZCoinV2.sol";

contract TrackingToCustomsGatewayTest is Test {

    TrackingToCustomsGateway public gateway;
    TrackingIntegrationGateway public tracker;
    CustomsClearanceOracle public customs;
    BEZCoinV2 public bezCoin;
    
    address admin = address(0x1);
    address treasury = address(0x2);
    address provider = address(0x3);
    address officer = address(0x4);
    address shipper = address(0x5);

    bytes32 FR24_PROVIDER = keccak256("provider:flightradar24");
    bytes32 HS_ELECTRONICS = keccak256("8471.30.00");

    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy tokens and contracts
        bezCoin = new BEZCoinV2(admin);
        tracker = new TrackingIntegrationGateway(address(bezCoin), treasury);
        customs = new CustomsClearanceOracle(address(bezCoin), treasury);
        gateway = new TrackingToCustomsGateway(address(tracker), address(customs));
        
        // Grant roles
        tracker.grantRole(tracker.OPERATOR_ROLE(), admin);
        tracker.grantRole(tracker.PROVIDER_ROLE(), provider);
        customs.grantRole(customs.CUSTOMS_OFFICER_ROLE(), officer);
        customs.grantRole(customs.ORACLE_ROLE(), admin);
        gateway.grantRole(gateway.OPERATOR_ROLE(), admin);
        
        // Mint BEZ
        bezCoin.mint(provider, 1000 ether);
        bezCoin.mint(shipper, 500 ether);
        
        // Register tracking provider
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider, 100 ether);
        
        // Register customs platform
        customs.registerCustomsPlatform(
            "AduanaEasy",
            "https://api.aduanaeasy.com/v1",
            address(0x10)
        );
        
        // Setup tariff
        customs.updateTariff(
            HS_ELECTRONICS,
            "Laptop Computers",
            0,
            false,
            ""
        );
        
        // Fund gateway for customs fee payments
        bezCoin.mint(address(gateway), 1000 ether);
        
        // Grant roles to gateway for cross-contract calls
        tracker.grantRole(tracker.OPERATOR_ROLE(), address(gateway));
        customs.grantRole(customs.CUSTOMS_OFFICER_ROLE(), address(gateway));
        
        vm.stopPrank();
        
        // Gateway approves customs for fee transfers
        vm.prank(address(gateway));
        bezCoin.approve(address(customs), 1000 ether);
    }

    // ──── INTEGRATED SHIPMENT CREATION TESTS ──────────────────

    function test_createIntegratedShipment() public {
        bytes32 duaHash = keccak256("DUA-001");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            1,
            FR24_PROVIDER,
            "FR24-FLIGHT-001",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        (bool isIntegrated, bool trackingActive, bool clearanceApproved, ) = 
            gateway.getShipmentStatus(1);
        
        assertTrue(isIntegrated);
        assertTrue(trackingActive);
        assertFalse(clearanceApproved);
    }

    function test_addCheckpointWithTracking() public {
        bytes32 duaHash = keccak256("DUA-002");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            2,
            FR24_PROVIDER,
            "FR24-FLIGHT-002",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        vm.prank(admin);
        gateway.addCheckpointWithTracking(
            2,
            36140000,
            -5350000,
            block.timestamp,
            1,
            15000,
            184,
            "Barcelona"
        );

        TrackingIntegrationGateway.CheckpointRecord[] memory checkpoints = 
            tracker.getShipmentCheckpoints(2);
        
        assertEq(checkpoints.length, 1);
        assertEq(checkpoints[0].locationName, "Barcelona");
    }

    // ──── CLEARANCE APPROVAL TESTS ─────────────────────────────

    function test_approveClearanceAndRelease() public {
        bytes32 duaHash = keccak256("DUA-003");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            3,
            FR24_PROVIDER,
            "FR24-FLIGHT-003",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        bytes32 sigHash = keccak256("signature");

        vm.prank(officer);
        gateway.approveClearanceAndRelease(3, sigHash);

        (bool isIntegrated, bool trackingActive, bool clearanceApproved, ) = 
            gateway.getShipmentStatus(3);
        
        assertTrue(clearanceApproved);
    }

    // ──── LOCATION TRACKING TESTS ────────────────────────────

    function test_getCurrentLocation() public {
        bytes32 duaHash = keccak256("DUA-004");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            4,
            FR24_PROVIDER,
            "FR24-FLIGHT-004",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        vm.prank(admin);
        gateway.addCheckpointWithTracking(
            4,
            38920000,
            1450000,
            block.timestamp,
            1,
            18000,
            211,
            "Madrid"
        );

        (int256 lat, int256 lon, string memory location, uint256 timestamp) = 
            gateway.getCurrentLocation(4);
        
        assertEq(lat, 38920000);
        assertEq(lon, 1450000);
        assertEq(location, "Madrid");
        assertEq(timestamp, block.timestamp);
    }

    // ──── MULTI-COUNTRY CLEARANCE TESTS ──────────────────────

    function test_setupMultiCountryClearance() public {
        bytes32 duaHash = keccak256("DUA-005");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            5,
            FR24_PROVIDER,
            "FR24-FLIGHT-005",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        string[] memory countries = new string[](3);
        countries[0] = "ES";
        countries[1] = "FR";
        countries[2] = "DE";

        vm.prank(admin);
        gateway.setupMultiCountryClearance(5, countries);

        (string[] memory retrievedCountries, bool allCleared, ) = 
            gateway.getMultiCountryStatus(5);
        
        assertEq(retrievedCountries.length, 3);
        assertFalse(allCleared);
    }

    function test_completeCountryClearance() public {
        bytes32 duaHash = keccak256("DUA-006");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            6,
            FR24_PROVIDER,
            "FR24-FLIGHT-006",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        string[] memory countries = new string[](2);
        countries[0] = "ES";
        countries[1] = "FR";

        vm.prank(admin);
        gateway.setupMultiCountryClearance(6, countries);

        vm.prank(admin);
        gateway.completeCountryClearance(6, "ES");

        (string[] memory retrievedCountries, bool allCleared, ) = 
            gateway.getMultiCountryStatus(6);
        
        assertFalse(allCleared); // Still need FR clearance

        vm.prank(admin);
        gateway.completeCountryClearance(6, "FR");

        (, bool allClearedFinal, ) = gateway.getMultiCountryStatus(6);
        assertTrue(allClearedFinal); // Now all countries cleared
    }

    // ──── FULL SHIPMENT HISTORY TESTS ────────────────────────

    function test_getCompleteShipmentHistory() public {
        bytes32 duaHash = keccak256("DUA-007");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            7,
            FR24_PROVIDER,
            "FR24-FLIGHT-007",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        // Add multiple checkpoints
        for (uint i = 0; i < 3; i++) {
            vm.prank(admin);
            gateway.addCheckpointWithTracking(
                7,
                36140000 + int256(i * 100000),
                -5350000,
                block.timestamp + (i * 3600),
                1,
                15000,
                180,
                string(abi.encodePacked("Location_", bytes1(uint8(i + 48))))
            );
        }

        TrackingIntegrationGateway.CheckpointRecord[] memory history = 
            gateway.getCompleteShipmentHistory(7);
        
        assertEq(history.length, 3);
    }

    // ──── CLEARANCE READINESS TESTS ─────────────────────────

    function test_isClearedAndReadyForRelease() public {
        bytes32 duaHash = keccak256("DUA-008");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            8,
            FR24_PROVIDER,
            "FR24-FLIGHT-008",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        assertFalse(gateway.isClearedAndReadyForRelease(8));

        vm.prank(officer);
        gateway.approveClearanceAndRelease(8, keccak256("sig"));

        assertTrue(gateway.isClearedAndReadyForRelease(8));
    }

    // ──── STATUS TRACKING TESTS ──────────────────────────────

    function test_getShipmentStatus() public {
        bytes32 duaHash = keccak256("DUA-009");

        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            9,
            FR24_PROVIDER,
            "FR24-FLIGHT-009",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        (bool isIntegrated, bool trackingActive, bool clearanceApproved, string memory platform) = 
            gateway.getShipmentStatus(9);
        
        assertTrue(isIntegrated);
        assertTrue(trackingActive);
        assertFalse(clearanceApproved);
        assertEq(platform, "AduanaEasy");
    }

    // ──── END-TO-END INTEGRATION TESTS ───────────────────────

    function test_endToEndShipmentJourney() public {
        bytes32 duaHash = keccak256("DUA-010");

        // Step 1: Create integrated shipment
        vm.prank(provider);
        bezCoin.approve(address(tracker), 100 ether);

        vm.prank(shipper);
        bezCoin.approve(address(customs), 500 ether);

        vm.prank(admin);
        gateway.createIntegratedShipment(
            10,
            FR24_PROVIDER,
            "FR24-FLIGHT-010",
            "AduanaEasy",
            HS_ELECTRONICS,
            100000,
            duaHash
        );

        // Step 2: Add tracking checkpoints
        vm.prank(admin);
        gateway.addCheckpointWithTracking(
            10, 36140000, -5350000, block.timestamp, 1, 15000, 184, "Barcelona"
        );

        vm.prank(admin);
        gateway.addCheckpointWithTracking(
            10, 48850000, 2350000, block.timestamp + 7200, 1, 14000, 176, "Paris"
        );

        // Step 3: Approve customs clearance
        vm.prank(officer);
        gateway.approveClearanceAndRelease(10, keccak256("sig"));

        // Step 4: Verify status
        bool readyForRelease = gateway.isClearedAndReadyForRelease(10);
        assertTrue(readyForRelease);

        TrackingIntegrationGateway.CheckpointRecord[] memory history = 
            gateway.getCompleteShipmentHistory(10);
        assertEq(history.length, 2);
    }

    // ──── TASAS: el gateway tiene que poder pagarlas ──────────
    //
    // `CustomsClearanceOracle.requestClearance` cobra con
    // `transferFrom(msg.sender, ...)`, y por esta vía `msg.sender` es el
    // gateway. El resto de pruebas de este fichero resuelven la allowance con
    // `vm.prank(address(gateway))`, que suplanta al contrato — algo que sólo
    // existe dentro de Foundry.
    //
    // Resultado: diez pruebas en verde sobre un contrato que en una cadena real
    // revertía SIEMPRE, porque no tenía ninguna forma de conceder esa
    // allowance. Estas dos pruebas cubren el hueco sin usar el atajo.

    function test_approveCustomsFees_setsAllowanceWithoutImpersonation() public {
        vm.prank(admin);
        gateway.approveCustomsFees(500 ether);
        assertEq(bezCoin.allowance(address(gateway), address(customs)), 500 ether);
    }

    function test_approveCustomsFees_onlyAdmin() public {
        vm.prank(provider);
        vm.expectRevert();
        gateway.approveCustomsFees(500 ether);
    }

    /// Reasignar sobre una allowance no nula debe funcionar: hay ERC-20 que
    /// rechazan pasar de X a Y sin bajar antes a cero.
    function test_approveCustomsFees_canBeRaisedAndLowered() public {
        vm.startPrank(admin);
        gateway.approveCustomsFees(500 ether);
        gateway.approveCustomsFees(900 ether);
        assertEq(bezCoin.allowance(address(gateway), address(customs)), 900 ether);
        gateway.approveCustomsFees(0);
        assertEq(bezCoin.allowance(address(gateway), address(customs)), 0);
        vm.stopPrank();
    }
}
