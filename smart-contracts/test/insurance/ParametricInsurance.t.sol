// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/insurance/ParametricInsurance.sol";

contract ParametricInsuranceTest is Test {
    ParametricInsurance public param;
    address public admin   = address(this);
    address public oracle  = address(0xD1);
    address public holder  = address(0xD2);
    address public anyone  = address(0xD3);

    function setUp() public {
        param = new ParametricInsurance();
        param.grantRole(param.ORACLE_ROLE(), oracle);
        vm.deal(holder, 100 ether);
        vm.deal(address(param), 200 ether);
    }

    function testCreateParametric() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 1 ether}(
            "Drought Shield", "Sinaloa MX", 8000, 50 ether,
            block.timestamp, block.timestamp + 365 days
        );

        ParametricInsurance.ParametricPolicy memory p = param.getParametricPolicy(id);
        assertEq(p.holder, holder);
        assertEq(p.triggerValue, 8000);
        assertEq(p.payoutAmount, 50 ether);
        assertTrue(p.active);
        assertFalse(p.triggered);
        assertFalse(p.paid);
    }

    function testCreateParametricRevertsNoPremium() public {
        vm.prank(holder);
        vm.expectRevert("Premium required");
        param.createParametric{value: 0}(
            "Test", "Test", 1000, 10 ether,
            block.timestamp, block.timestamp + 365 days
        );
    }

    function testCreateParametricRevertsZeroPayout() public {
        vm.prank(holder);
        vm.expectRevert("Payout must be > 0");
        param.createParametric{value: 1 ether}(
            "Test", "Test", 1000, 0,
            block.timestamp, block.timestamp + 365 days
        );
    }

    function testCreateParametricRevertsBadDates() public {
        vm.prank(holder);
        vm.expectRevert("End > start");
        param.createParametric{value: 1 ether}(
            "Test", "Test", 1000, 10 ether,
            block.timestamp + 100, block.timestamp + 50
        );
    }

    function testSubmitReadingNoTrigger() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 1 ether}(
            "Earthquake Guard", "CDMX", 600, 100 ether,
            block.timestamp, block.timestamp + 365 days
        );

        vm.prank(oracle);
        param.submitReading(id, 210); // 2.10 scaled — below threshold

        ParametricInsurance.ParametricPolicy memory p = param.getParametricPolicy(id);
        assertFalse(p.triggered);
        assertEq(param.getPolicyReadingCount(id), 1);
    }

    function testSubmitReadingTriggers() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 1 ether}(
            "Drought Shield", "Sinaloa", 8000, 50 ether,
            block.timestamp, block.timestamp + 365 days
        );

        vm.prank(oracle);
        param.submitReading(id, 8500); // 85.00 scaled — above 80.00

        ParametricInsurance.ParametricPolicy memory p = param.getParametricPolicy(id);
        assertTrue(p.triggered);
    }

    function testSubmitReadingRevertsInactive() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 1 ether}(
            "Test", "Test", 1000, 10 ether,
            block.timestamp, block.timestamp + 365 days
        );

        // Trigger + claim to deactivate
        vm.prank(oracle);
        param.submitReading(id, 2000);
        vm.prank(holder);
        param.claimPayout(id);

        vm.prank(oracle);
        vm.expectRevert("Policy not active");
        param.submitReading(id, 3000);
    }

    function testClaimPayout() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 2 ether}(
            "Hurricane", "Quintana Roo", 12000, 30 ether,
            block.timestamp, block.timestamp + 365 days
        );

        vm.prank(oracle);
        param.submitReading(id, 15000); // 150 km/h — triggered

        uint256 balBefore = holder.balance;
        vm.prank(holder);
        param.claimPayout(id);

        ParametricInsurance.ParametricPolicy memory p = param.getParametricPolicy(id);
        assertTrue(p.paid);
        assertFalse(p.active);
        assertEq(holder.balance - balBefore, 30 ether);
    }

    function testClaimPayoutRevertsNotTriggered() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 1 ether}(
            "Flood", "Buenos Aires", 450, 20 ether,
            block.timestamp, block.timestamp + 365 days
        );

        vm.prank(holder);
        vm.expectRevert("Not triggered");
        param.claimPayout(id);
    }

    function testClaimPayoutRevertsNotHolder() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 1 ether}(
            "Frost", "Mendoza", 500, 15 ether,
            block.timestamp, block.timestamp + 365 days
        );

        vm.prank(oracle);
        param.submitReading(id, 600);

        vm.prank(anyone);
        vm.expectRevert("Not holder");
        param.claimPayout(id);
    }

    function testExpirePolicy() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 1 ether}(
            "Rainfall", "Veracruz", 30000, 25 ether,
            block.timestamp, block.timestamp + 30 days
        );

        vm.warp(block.timestamp + 31 days);
        vm.prank(oracle);
        param.expirePolicy(id);

        ParametricInsurance.ParametricPolicy memory p = param.getParametricPolicy(id);
        assertFalse(p.active);
    }

    function testExpirePolicyRevertsNotExpired() public {
        vm.prank(holder);
        uint256 id = param.createParametric{value: 1 ether}(
            "Test", "Test", 1000, 10 ether,
            block.timestamp, block.timestamp + 365 days
        );

        vm.prank(oracle);
        vm.expectRevert("Not expired");
        param.expirePolicy(id);
    }
}
