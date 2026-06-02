// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/CustomsClearanceOracle.sol";
import "../../src/tokens/BEZCoinV2.sol";

contract CustomsClearanceOracleTest is Test {

    CustomsClearanceOracle public customs;
    BEZCoinV2 public bezCoin;
    
    address admin = address(0x1);
    address treasury = address(0x2);
    address officer = address(0x3);
    address declarant = address(0x4);
    address platform_admin = address(0x5);

    bytes32 HS_ELECTRONICS = keccak256("8471.30.00");
    bytes32 HS_PHARMA = keccak256("3004.90.19");
    bytes32 HS_TEXTILES = keccak256("6204.62.00");

    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy BEZ coin
        bezCoin = new BEZCoinV2(admin);
        
        // Deploy customs oracle
        customs = new CustomsClearanceOracle(address(bezCoin), treasury);
        
        // Grant roles
        customs.grantRole(customs.CUSTOMS_OFFICER_ROLE(), officer);
        customs.grantRole(customs.ORACLE_ROLE(), admin);
        
        // Mint BEZ to declarants
        bezCoin.mint(declarant, 1000 ether);
        
        // Register platforms
        customs.registerCustomsPlatform(
            "AduanaEasy",
            "https://api.aduanaeasy.com/v1",
            platform_admin
        );
        
        customs.registerCustomsPlatform(
            "TradeGo",
            "https://api.tradego.eu/v2",
            platform_admin
        );
        
        // Setup tariffs
        customs.updateTariff(
            HS_ELECTRONICS,
            "Laptop Computers & Accessories",
            0,  // 0% tariff for IT goods
            false,
            ""
        );
        
        customs.updateTariff(
            HS_PHARMA,
            "Pharmaceutical Products - Controlled",
            0,
            true,  // Requires permit
            "AEMPS_PERMIT"
        );
        
        customs.updateTariff(
            HS_TEXTILES,
            "Women's Trousers, Synthetic Fiber",
            1200,  // 12% tariff
            false,
            ""
        );
        
        vm.stopPrank();
    }

    // ──── TARIFF MANAGEMENT TESTS ─────────────────────────────

    function test_updateTariff() public {
        vm.prank(admin);
        customs.updateTariff(
            HS_ELECTRONICS,
            "Test Commodity",
            500,
            false,
            ""
        );

        CustomsClearanceOracle.TariffData memory tariff = customs.getTariffInfo(HS_ELECTRONICS);
        
        assertEq(tariff.tarifRateBps, 500);
        assertEq(tariff.description, "Test Commodity");
        assertFalse(tariff.requiresPermit);
    }

    function test_multiTariffs() public {
        (, , uint256 rate1, , , , ) = customs.tariffs(HS_ELECTRONICS);
        (, , uint256 rate2, bool permit2, , , ) = customs.tariffs(HS_PHARMA);
        
        assertEq(rate1, 0);
        assertEq(rate2, 0);
        assertTrue(permit2);
    }

    function test_revertsOnInvalidRate() public {
        vm.prank(admin);
        vm.expectRevert("Rate too high");
        customs.updateTariff(HS_ELECTRONICS, "Test", 100001, false, "");
    }

    // ──── PLATFORM REGISTRATION TESTS ────────────────────────

    function test_registerPlatform() public {
        vm.prank(admin);
        customs.registerCustomsPlatform(
            "e-Aduanas",
            "https://api.e-aduanas.gob.mx/v3",
            platform_admin
        );

        (string memory name, , address admin_addr, , , bool isActive) = 
            customs.customsPlatforms("e-Aduanas");
        
        assertEq(name, "e-Aduanas");
        assertEq(admin_addr, platform_admin);
        assertTrue(isActive);
    }

    function test_revertsOnInvalidPlatformAdmin() public {
        vm.prank(admin);
        vm.expectRevert("Invalid admin");
        customs.registerCustomsPlatform(
            "Invalid",
            "https://test.com",
            address(0)
        );
    }

    // ──── CLEARANCE REQUEST TESTS ────────────────────────────

    function test_requestClearance() public {
        uint256 cargoValue = 100000; // $100k
        bytes32 duaHash = keccak256("DUA-ES2024-00441829");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        
        customs.requestClearance(
            1,
            HS_ELECTRONICS,
            cargoValue,
            "AduanaEasy",
            duaHash
        );
        
        vm.stopPrank();

        CustomsClearanceOracle.ClearanceRecord memory clearance = customs.getClearanceDetails(1);
        
        assertEq(clearance.shipmentId, 1);
        assertEq(clearance.cargoValue, cargoValue);
        assertEq(clearance.calculatedDutyUSD, 0); // 0% tariff
        assertEq(uint256(clearance.status), uint256(CustomsClearanceOracle.ClearanceStatus.PENDING));
    }

    function test_clearanceFeeCalculation() public {
        uint256 cargoValue = 500000; // $500k
        bytes32 duaHash = keccak256("DUA-002");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        
        customs.requestClearance(
            2,
            HS_ELECTRONICS,
            cargoValue,
            "AduanaEasy",
            duaHash
        );
        
        vm.stopPrank();

        CustomsClearanceOracle.ClearanceRecord memory clearance = customs.getClearanceDetails(2);
        
        // Integration fee: 0.15% of 500k = 750 BEZ
        assertEq(clearance.integrationFeeBEZ, 750);
    }

    function test_dutyCalculation() public {
        uint256 cargoValue = 100000;

        uint256 duty = customs.calculateDuty(HS_TEXTILES, cargoValue);
        
        // 12% of 100k = 12000
        assertEq(duty, 12000);
    }

    function test_revertsOnDuplicateDua() public {
        bytes32 duaHash = keccak256("DUA-DUPLICATE");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        
        customs.requestClearance(3, HS_ELECTRONICS, 100000, "AduanaEasy", duaHash);
        
        vm.expectRevert("DUA already used");
        customs.requestClearance(4, HS_ELECTRONICS, 50000, "AduanaEasy", duaHash);
        
        vm.stopPrank();
    }

    function test_revertsOnInactivePlatform() public {
        vm.prank(admin);
        customs.setCustomsPlatformActive("AduanaEasy", false);

        bytes32 duaHash = keccak256("DUA-003");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        
        vm.expectRevert("Platform not active");
        customs.requestClearance(5, HS_ELECTRONICS, 100000, "AduanaEasy", duaHash);
        
        vm.stopPrank();
    }

    // ──── PRE-CLEARANCE VALIDATION TESTS ──────────────────────

    function test_preClearanceValidation() public {
        bytes32 duaHash = keccak256("DUA-004");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        customs.requestClearance(6, HS_ELECTRONICS, 100000, "AduanaEasy", duaHash);
        vm.stopPrank();

        vm.prank(admin);
        customs.preClearanceValidation(6, 25, "FAST_TRACK");

        CustomsClearanceOracle.ClearanceRecord memory clearance = customs.getClearanceDetails(6);
        assertEq(uint256(clearance.status), uint256(CustomsClearanceOracle.ClearanceStatus.PRE_VALIDATED));
    }

    // ──── OFFICER APPROVAL TESTS ──────────────────────────────

    function test_officerApproveClearance() public {
        bytes32 duaHash = keccak256("DUA-005");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        customs.requestClearance(7, HS_ELECTRONICS, 100000, "AduanaEasy", duaHash);
        vm.stopPrank();

        bytes32 sigHash = keccak256("signature");

        vm.prank(officer);
        customs.approveClearanceByOfficer(7, sigHash);

        CustomsClearanceOracle.ClearanceRecord memory clearance = customs.getClearanceDetails(7);
        assertEq(uint256(clearance.status), uint256(CustomsClearanceOracle.ClearanceStatus.APPROVED));
        assertEq(clearance.aduanaOfficer, officer);
    }

    function test_isClearanceApproved() public {
        bytes32 duaHash = keccak256("DUA-006");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        customs.requestClearance(8, HS_ELECTRONICS, 100000, "AduanaEasy", duaHash);
        vm.stopPrank();

        assertFalse(customs.isClearanceApproved(8));

        vm.prank(officer);
        customs.approveClearanceByOfficer(8, keccak256("sig"));

        assertTrue(customs.isClearanceApproved(8));
    }

    // ──── REJECTION TESTS ────────────────────────────────────

    function test_rejectClearance() public {
        bytes32 duaHash = keccak256("DUA-007");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        customs.requestClearance(9, HS_PHARMA, 100000, "AduanaEasy", duaHash);
        vm.stopPrank();

        vm.prank(officer);
        customs.rejectClearance(9, "Missing AEMPS permit");

        CustomsClearanceOracle.ClearanceRecord memory clearance = customs.getClearanceDetails(9);
        assertEq(uint256(clearance.status), uint256(CustomsClearanceOracle.ClearanceStatus.REJECTED));
        assertEq(clearance.rejectionReason, "Missing AEMPS permit");
    }

    // ──── PLATFORM REVENUE TESTS ──────────────────────────────

    function test_platformRevenueCollection() public {
        bytes32 duaHash = keccak256("DUA-008");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        customs.requestClearance(10, HS_ELECTRONICS, 100000, "AduanaEasy", duaHash);
        vm.stopPrank();

        uint256 platformRev = customs.getPlatformRevenue("AduanaEasy");
        
        // 50% of 150 BEZ fee = 75 BEZ
        assertEq(platformRev, 75);
    }

    function test_withdrawPlatformRevenue() public {
        bytes32 duaHash = keccak256("DUA-009");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        customs.requestClearance(11, HS_ELECTRONICS, 100000, "AduanaEasy", duaHash);
        vm.stopPrank();

        uint256 balanceBefore = bezCoin.balanceOf(platform_admin);

        vm.prank(platform_admin);
        customs.withdrawPlatformRevenue("AduanaEasy");

        uint256 balanceAfter = bezCoin.balanceOf(platform_admin);
        assertEq(balanceAfter - balanceBefore, 75);
    }

    // ──── PLATFORM ACTIVATION TESTS ──────────────────────────

    function test_deactivatePlatform() public {
        vm.prank(admin);
        customs.setCustomsPlatformActive("AduanaEasy", false);

        (, , , , , bool isActive) = customs.customsPlatforms("AduanaEasy");
        assertFalse(isActive);
    }

    // ──── INTEGRATION TESTS ───────────────────────────────────

    function test_multipleShipmentsMultiplePlatforms() public {
        bytes32 dua1 = keccak256("DUA-010");
        bytes32 dua2 = keccak256("DUA-011");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        
        customs.requestClearance(12, HS_ELECTRONICS, 100000, "AduanaEasy", dua1);
        customs.requestClearance(13, HS_TEXTILES, 50000, "TradeGo", dua2);
        
        vm.stopPrank();

        CustomsClearanceOracle.ClearanceRecord memory c1 = customs.getClearanceDetails(12);
        CustomsClearanceOracle.ClearanceRecord memory c2 = customs.getClearanceDetails(13);

        assertEq(c1.cargoValue, 100000);
        assertEq(c2.cargoValue, 50000);
        assertEq(c1.calculatedDutyUSD, 0);
        assertEq(c2.calculatedDutyUSD, 6000); // 12% of 50k
    }

    function test_totalFeesTracking() public {
        bytes32 dua1 = keccak256("DUA-012");
        bytes32 dua2 = keccak256("DUA-013");

        vm.startPrank(declarant);
        bezCoin.approve(address(customs), 1000 ether);
        
        customs.requestClearance(14, HS_ELECTRONICS, 100000, "AduanaEasy", dua1);
        customs.requestClearance(15, HS_ELECTRONICS, 200000, "TradeGo", dua2);
        
        vm.stopPrank();

        uint256 totalFees = customs.totalClearanceFeesCollected();
        
        // (100k * 0.15%) + (200k * 0.15%) = 150 + 300 = 450 BEZ
        assertEq(totalFees, 450);
    }
}
