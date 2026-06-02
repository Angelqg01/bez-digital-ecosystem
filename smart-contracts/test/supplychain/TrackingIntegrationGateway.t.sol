// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/TrackingIntegrationGateway.sol";
import "../../src/tokens/BEZCoinV2.sol";

contract TrackingIntegrationGatewayTest is Test {

    TrackingIntegrationGateway public tracker;
    BEZCoinV2 public bezCoin;
    
    address admin = address(0x1);
    address treasury = address(0x2);
    address provider1 = address(0x3);
    address provider2 = address(0x4);
    address shipper = address(0x5);

    bytes32 FR24_PROVIDER = keccak256("provider:flightradar24");
    bytes32 MARINE_PROVIDER = keccak256("provider:marinetraffic");

    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy BEZ coin
        bezCoin = new BEZCoinV2(admin);
        
        // Deploy tracker
        tracker = new TrackingIntegrationGateway(address(bezCoin), treasury);
        
        // Mint BEZ to providers
        bezCoin.mint(provider1, 1000 ether);
        bezCoin.mint(provider2, 1000 ether);
        bezCoin.mint(shipper, 500 ether);
        
        vm.stopPrank();
    }

    // ──── PROVIDER REGISTRATION TESTS ─────────────────────────

    function test_registerProvider() public {
        vm.prank(admin);
        tracker.registerProvider(
            FR24_PROVIDER,
            "FlightRadar24",
            provider1,
            100 ether
        );

        (string memory name, uint256 budget, , , , bool isActive) = 
            tracker.getProviderStats(FR24_PROVIDER);
        
        assertEq(name, "FlightRadar24");
        assertEq(budget, 100 ether);
        assertTrue(isActive);
    }

    function test_registerMultipleProviders() public {
        vm.startPrank(admin);
        
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);
        tracker.registerProvider(MARINE_PROVIDER, "MarineTraffic", provider2, 50 ether);
        
        vm.stopPrank();

        (, uint256 budget1, , , , bool active1) = tracker.getProviderStats(FR24_PROVIDER);
        (, uint256 budget2, , , , bool active2) = tracker.getProviderStats(MARINE_PROVIDER);
        
        assertEq(budget1, 100 ether);
        assertEq(budget2, 50 ether);
        assertTrue(active1);
        assertTrue(active2);
    }

    function test_revertsOnInvalidWebhook() public {
        vm.prank(admin);
        vm.expectRevert("Invalid webhook");
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", address(0), 100 ether);
    }

    function test_revertsOnZeroBudget() public {
        vm.prank(admin);
        vm.expectRevert("Budget must > 0");
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 0);
    }

    // ──── CARGO TOKENIZATION TESTS ────────────────────────────

    function test_mintCargoWithTracking() public {
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);

        uint256 cargoValue = 100000; // $100k
        
        vm.startPrank(provider1);
        bezCoin.approve(address(tracker), 100 ether);
        
        bool success = tracker.mintCargoWithTracking(
            1,
            FR24_PROVIDER,
            "FR24-FLIGHT-ABC123",
            cargoValue
        );
        
        vm.stopPrank();

        assertTrue(success);
        
        (uint256 shipmentId, , , uint256 tokenFee, , , bool isActive) = 
            tracker.cargoTracking(1);
        
        assertEq(shipmentId, 1);
        assertEq(tokenFee, 500); // 0.5% of 100000
        assertTrue(isActive);
    }

    function test_tokenizationFeeCalculation() public {
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);

        vm.startPrank(provider1);
        bezCoin.approve(address(tracker), 100 ether);
        
        uint256 cargoValue = 1000000; // $1M
        tracker.mintCargoWithTracking(
            2,
            FR24_PROVIDER,
            "FR24-CARGO-002",
            cargoValue
        );
        
        vm.stopPrank();

        (, , , uint256 tokenFee, , , ) = tracker.cargoTracking(2);
        
        // 0.5% of 1M = 5000 BEZ
        assertEq(tokenFee, 5000);
    }

    function test_revertsWhenBudgetExceeded() public {
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100_000);

        vm.startPrank(provider1);
        bezCoin.approve(address(tracker), 100 ether);
        
        // Try to tokenize cargo worth $25M (would cost 125,000 BEZ > 100,000 budget)
        uint256 highCargoValue = 25000000;
        
        vm.expectRevert("Budget exceeded");
        tracker.mintCargoWithTracking(
            3,
            FR24_PROVIDER,
            "FR24-CARGO-003",
            highCargoValue
        );
        
        vm.stopPrank();
    }

    // ──── CHECKPOINT RECORDING TESTS ──────────────────────────

    function test_recordCheckpoint() public {
        // Setup
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);
        
        vm.startPrank(provider1);
        bezCoin.approve(address(tracker), 100 ether);
        tracker.mintCargoWithTracking(4, FR24_PROVIDER, "FR24-004", 50000);
        vm.stopPrank();

        // Record checkpoint
        vm.prank(admin);
        tracker.recordCheckpointViaAPI(
            4,
            36140000,  // lat: 36.14 degrees * 1e6
            -5350000,  // lon: -5.35 degrees * 1e6
            block.timestamp,
            1,         // statusCode: IN_TRANSIT
            15000,     // temp: 15°C * 1000
            184,       // speed: 18.4 knots * 10
            "Port of Barcelona"
        );

        TrackingIntegrationGateway.CheckpointRecord[] memory checkpoints = 
            tracker.getShipmentCheckpoints(4);
        
        assertEq(checkpoints.length, 1);
        assertEq(checkpoints[0].latitude, 36140000);
        assertEq(checkpoints[0].longitude, -5350000);
        assertEq(checkpoints[0].statusCode, 1);
    }

    function test_multipleCheckpoints() public {
        // Setup
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);
        
        vm.startPrank(provider1);
        bezCoin.approve(address(tracker), 100 ether);
        tracker.mintCargoWithTracking(5, FR24_PROVIDER, "FR24-005", 50000);
        vm.stopPrank();

        // Record 3 checkpoints
        for (uint i = 0; i < 3; i++) {
            vm.prank(admin);
            tracker.recordCheckpointViaAPI(
                5,
                36140000 + int256(i * 100000),
                -5350000,
                block.timestamp + (i * 3600),
                1,
                15000,
                180 + i * 2,
                string(abi.encodePacked("Checkpoint_", bytes1(uint8(i + 48))))
            );
        }

        TrackingIntegrationGateway.CheckpointRecord[] memory checkpoints = 
            tracker.getShipmentCheckpoints(5);
        
        assertEq(checkpoints.length, 3);
    }

    function test_getLastCheckpoint() public {
        // Setup
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);
        
        vm.startPrank(provider1);
        bezCoin.approve(address(tracker), 100 ether);
        tracker.mintCargoWithTracking(6, FR24_PROVIDER, "FR24-006", 50000);
        vm.stopPrank();

        vm.prank(admin);
        tracker.recordCheckpointViaAPI(6, 36140000, -5350000, block.timestamp, 1, 15000, 184, "Barcelona");
        
        TrackingIntegrationGateway.CheckpointRecord memory lastCp = 
            tracker.getLastCheckpoint(6);
        
        assertEq(lastCp.latitude, 36140000);
        assertEq(lastCp.locationName, "Barcelona");
    }

    // ──── PROVIDER STATS TESTS ────────────────────────────────

    function test_providerStatsUpdated() public {
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);
        
        vm.startPrank(provider1);
        bezCoin.approve(address(tracker), 100 ether);
        tracker.mintCargoWithTracking(7, FR24_PROVIDER, "FR24-007", 100000);
        vm.stopPrank();

        (, uint256 budget, uint256 used, uint256 calls, , ) = 
            tracker.getProviderStats(FR24_PROVIDER);
        
        assertEq(budget, 100 ether);
        assertEq(used, 500); // 0.5% of 100k
        assertEq(calls, 1);
    }

    function test_updateProviderBudget() public {
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);
        
        vm.prank(admin);
        tracker.updateProviderBudget(FR24_PROVIDER, 200 ether);

        (, uint256 budget, , , , ) = tracker.getProviderStats(FR24_PROVIDER);
        assertEq(budget, 200 ether);
    }

    // ──── PROVIDER ACTIVATION TESTS ───────────────────────────

    function test_disableProvider() public {
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);
        
        vm.prank(admin);
        tracker.setProviderActive(FR24_PROVIDER, false);

        (, , , , , bool isActive) = tracker.getProviderStats(FR24_PROVIDER);
        assertFalse(isActive);
    }

    function test_revertsOnDisabledProvider() public {
        vm.prank(admin);
        tracker.registerProvider(FR24_PROVIDER, "FlightRadar24", provider1, 100 ether);
        
        vm.prank(admin);
        tracker.setProviderActive(FR24_PROVIDER, false);

        vm.startPrank(provider1);
        bezCoin.approve(address(tracker), 100 ether);
        
        vm.expectRevert("Provider not active");
        tracker.mintCargoWithTracking(8, FR24_PROVIDER, "FR24-008", 50000);
        
        vm.stopPrank();
    }
}
