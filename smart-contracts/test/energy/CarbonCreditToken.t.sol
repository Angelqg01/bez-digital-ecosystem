// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/energy/CarbonCreditToken.sol";

contract CarbonCreditTokenTest is Test {
    CarbonCreditToken cc;
    address admin = address(1);
    address verifier = address(2);
    address oracle = address(3);
    address trader = address(4);

    function setUp() public {
        vm.startPrank(admin);
        cc = new CarbonCreditToken(admin);
        cc.grantRole(cc.VERIFIER_ROLE(), verifier);
        cc.grantRole(cc.ORACLE_ROLE(), oracle);
        vm.stopPrank();
    }

    function testMintCreditBatch() public {
        vm.startPrank(verifier);
        uint256 id = cc.mintCreditBatch("VCS-2024-0142", "Verra", "Amazon Reforestation", 125000, 1850, "2024");
        vm.stopPrank();

        assertEq(id, 0);
        assertEq(cc.balanceOf(verifier, 0), 125000);
        (string memory regId,,,uint256 tonnes,,,,) = cc.batches(0);
        assertEq(tonnes, 125000);
        assertGt(bytes(regId).length, 0);
    }

    function testMintRevertsUnauthorized() public {
        vm.startPrank(trader);
        vm.expectRevert();
        cc.mintCreditBatch("VCS-001", "Verra", "Test", 1000, 100, "2024");
        vm.stopPrank();
    }

    function testVerifyBatch() public {
        vm.startPrank(verifier);
        cc.mintCreditBatch("GS-001", "Gold Standard", "Kenya Cookstoves", 45000, 2480, "2024");
        vm.stopPrank();

        vm.startPrank(oracle);
        cc.verifyBatch(0);
        vm.stopPrank();

        (,,,,,,,bool verified) = cc.batches(0);
        assertTrue(verified);
    }

    function testRetireCredits() public {
        vm.startPrank(verifier);
        cc.mintCreditBatch("VCS-002", "Verra", "Forest", 10000, 1500, "2024");
        cc.retireCredits(0, 3000);
        vm.stopPrank();

        assertEq(cc.balanceOf(verifier, 0), 7000);
        assertEq(cc.totalRetiredGlobal(), 3000);
        assertEq(cc.getRetirementCertificate(0, verifier), 3000);
    }

    function testRetireRevertsInsufficientBalance() public {
        vm.startPrank(verifier);
        cc.mintCreditBatch("VCS-003", "Verra", "Forest", 1000, 100, "2024");
        vm.expectRevert("Insufficient balance");
        cc.retireCredits(0, 5000);
        vm.stopPrank();
    }

    function testTradeCredits() public {
        vm.startPrank(verifier);
        cc.mintCreditBatch("ACR-001", "ACR", "Grassland", 50000, 1490, "2023");
        cc.setApprovalForAll(address(cc), true);
        cc.tradeCredits(0, trader, 10000);
        vm.stopPrank();

        assertEq(cc.balanceOf(trader, 0), 10000);
        assertEq(cc.balanceOf(verifier, 0), 40000);
    }

    function testMintZeroTonnesReverts() public {
        vm.startPrank(verifier);
        vm.expectRevert("Zero tonnes");
        cc.mintCreditBatch("X", "X", "X", 0, 100, "2024");
        vm.stopPrank();
    }

    function testMultipleRetirements() public {
        vm.startPrank(verifier);
        cc.mintCreditBatch("CDM-001", "CDM", "India Solar", 20000, 1120, "2024");
        cc.retireCredits(0, 5000);
        cc.retireCredits(0, 3000);
        vm.stopPrank();

        assertEq(cc.totalRetiredGlobal(), 8000);
        assertEq(cc.getRetirementCertificate(0, verifier), 8000);
        (,,,, uint256 retiredTonnes,,,) = cc.batches(0);
        assertEq(retiredTonnes, 8000);
    }
}
