// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/insurance/PolicyNFT.sol";

contract PolicyNFTTest is Test {
    PolicyNFT public policy;
    address public admin       = address(this);
    address public underwriter = address(0xA1);
    address public holder      = address(0xA2);
    address public anyone      = address(0xA3);

    function setUp() public {
        policy = new PolicyNFT();
        policy.grantRole(policy.UNDERWRITER_ROLE(), underwriter);
    }

    function testMintPolicy() public {
        vm.prank(underwriter);
        uint256 id = policy.mintPolicy("Cargo Marine", holder, 1 ether, 100 ether, block.timestamp, block.timestamp + 365 days, PolicyNFT.RiskTier.MEDIUM);

        PolicyNFT.Policy memory p = policy.getPolicy(id);
        assertEq(p.holder, holder);
        assertEq(p.coverageAmount, 100 ether);
        assertTrue(p.active);
        assertFalse(p.cancelled);
        assertEq(p.totalClaims, 0);
    }

    function testMintPolicyRevertsInvalidHolder() public {
        vm.prank(underwriter);
        vm.expectRevert("Invalid holder");
        policy.mintPolicy("Cargo", address(0), 1 ether, 100 ether, block.timestamp, block.timestamp + 365 days, PolicyNFT.RiskTier.LOW);
    }

    function testMintPolicyRevertsZeroCoverage() public {
        vm.prank(underwriter);
        vm.expectRevert("Coverage must be > 0");
        policy.mintPolicy("Cargo", holder, 1 ether, 0, block.timestamp, block.timestamp + 365 days, PolicyNFT.RiskTier.LOW);
    }

    function testMintPolicyRevertsBadDates() public {
        vm.prank(underwriter);
        vm.expectRevert("End must be after start");
        policy.mintPolicy("Cargo", holder, 1 ether, 100 ether, block.timestamp + 100, block.timestamp + 50, PolicyNFT.RiskTier.LOW);
    }

    function testPayPremium() public {
        vm.prank(underwriter);
        uint256 id = policy.mintPolicy("Fleet", holder, 2 ether, 200 ether, block.timestamp, block.timestamp + 365 days, PolicyNFT.RiskTier.HIGH);

        vm.deal(holder, 10 ether);
        vm.prank(holder);
        policy.payPremium{value: 2 ether}(id);

        assertEq(policy.getPolicyPaymentCount(id), 1);
    }

    function testPayPremiumRevertsInsufficient() public {
        vm.prank(underwriter);
        uint256 id = policy.mintPolicy("Fleet", holder, 5 ether, 200 ether, block.timestamp, block.timestamp + 365 days, PolicyNFT.RiskTier.HIGH);

        vm.deal(holder, 10 ether);
        vm.prank(holder);
        vm.expectRevert("Insufficient premium");
        policy.payPremium{value: 1 ether}(id);
    }

    function testCancelPolicy() public {
        vm.prank(underwriter);
        uint256 id = policy.mintPolicy("Crop", holder, 1 ether, 50 ether, block.timestamp, block.timestamp + 180 days, PolicyNFT.RiskTier.MEDIUM);

        vm.prank(underwriter);
        policy.cancelPolicy(id);

        PolicyNFT.Policy memory p = policy.getPolicy(id);
        assertFalse(p.active);
        assertTrue(p.cancelled);
    }

    function testCancelPolicyRevertsAlreadyInactive() public {
        vm.prank(underwriter);
        uint256 id = policy.mintPolicy("Crop", holder, 1 ether, 50 ether, block.timestamp, block.timestamp + 180 days, PolicyNFT.RiskTier.LOW);

        vm.startPrank(underwriter);
        policy.cancelPolicy(id);
        vm.expectRevert("Already inactive");
        policy.cancelPolicy(id);
        vm.stopPrank();
    }

    function testRenewPolicy() public {
        vm.prank(underwriter);
        uint256 id = policy.mintPolicy("Equipment", holder, 1 ether, 80 ether, block.timestamp, block.timestamp + 180 days, PolicyNFT.RiskTier.LOW);

        uint256 newEnd = block.timestamp + 365 days;
        vm.prank(underwriter);
        policy.renewPolicy(id, newEnd);

        PolicyNFT.Policy memory p = policy.getPolicy(id);
        assertEq(p.endDate, newEnd);
    }

    function testFileClaim() public {
        vm.prank(underwriter);
        uint256 id = policy.mintPolicy("Parametric", holder, 1 ether, 60 ether, block.timestamp, block.timestamp + 365 days, PolicyNFT.RiskTier.HIGH);

        vm.prank(holder);
        policy.fileClaim(id);

        PolicyNFT.Policy memory p = policy.getPolicy(id);
        assertEq(p.totalClaims, 1);
    }

    function testFileClaimRevertsNotHolder() public {
        vm.prank(underwriter);
        uint256 id = policy.mintPolicy("Parametric", holder, 1 ether, 60 ether, block.timestamp, block.timestamp + 365 days, PolicyNFT.RiskTier.HIGH);

        vm.prank(anyone);
        vm.expectRevert("Not holder");
        policy.fileClaim(id);
    }
}
