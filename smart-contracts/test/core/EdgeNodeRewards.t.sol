// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {BEZCoinV2} from "../../src/tokens/BEZCoinV2.sol";
import {ValidatorRegistry} from "../../src/core/ValidatorRegistry.sol";
import {EdgeNodeRewards} from "../../src/core/EdgeNodeRewards.sol";

contract EdgeNodeRewardsTest is Test {
    BEZCoinV2 public bez;
    ValidatorRegistry public registry;
    EdgeNodeRewards public rewards;

    address public admin = address(1);
    address public oracle = address(2);
    address public company1 = address(10);
    address public company2 = address(11);

    uint256 public constant GOLD_AMOUNT = 250_000 * 1e18;
    uint256 public constant PLATINUM_AMOUNT = 1_000_000 * 1e18;

    function setUp() public {
        vm.startPrank(admin);
        bez = new BEZCoinV2(admin);
        registry = new ValidatorRegistry(address(bez), admin);
        rewards = new EdgeNodeRewards(address(bez), address(registry), admin);

        // Grant roles
        registry.grantRole(registry.ORACLE_ROLE(), address(rewards));
        registry.grantRole(registry.ORACLE_ROLE(), oracle);
        rewards.grantRole(rewards.ORACLE_ROLE(), oracle);

        // Fund companies and reward pool
        bez.transfer(company1, PLATINUM_AMOUNT * 2);
        bez.transfer(company2, GOLD_AMOUNT * 2);
        bez.transfer(address(rewards), 10_000_000 * 1e18); // Reward pool
        vm.stopPrank();

        // Register validators
        _registerValidator(company1, PLATINUM_AMOUNT, "Platinum Node");
        _registerValidator(company2, GOLD_AMOUNT, "Gold Node");
    }

    function test_RegisterEdgeNode() public {
        vm.prank(company1);
        rewards.registerNode();

        (, , , , , bool isActive) = rewards.getNodeInfo(company1);
        assertTrue(isActive);
    }

    function test_RevertRegisterNonValidator() public {
        address nonValidator = address(99);
        vm.prank(nonValidator);
        vm.expectRevert("ENR: must be active validator");
        rewards.registerNode();
    }

    function test_RecordValidation() public {
        _registerNode(company1);

        vm.prank(oracle);
        rewards.recordValidation(company1, 10, "IoT Traceability");

        (uint256 validations, uint256 points, , , , ) = rewards.getNodeInfo(company1);
        assertEq(validations, 1);
        assertEq(points, 10);
    }

    function test_ClaimWithPlatinumBoost() public {
        _registerNode(company1);

        vm.prank(oracle);
        rewards.recordValidation(company1, 100, "AI Verification");

        // Platinum boost = 20000 bps (2x)
        // Expected: 100 points * 1e18 per point * 20000/10000 = 200 BEZ
        uint256 balBefore = bez.balanceOf(company1);
        vm.prank(company1);
        rewards.claimRewards();
        uint256 balAfter = bez.balanceOf(company1);

        uint256 expected = 100 * 1e18 * 20000 / 10000; // 200 BEZ
        assertEq(balAfter - balBefore, expected);
    }

    function test_ClaimWithGoldBoost() public {
        _registerNode(company2);

        vm.prank(oracle);
        rewards.recordValidation(company2, 100, "Supply Chain");

        // Gold boost = 15000 bps (1.5x)
        uint256 balBefore = bez.balanceOf(company2);
        vm.prank(company2);
        rewards.claimRewards();
        uint256 balAfter = bez.balanceOf(company2);

        uint256 expected = 100 * 1e18 * 15000 / 10000; // 150 BEZ
        assertEq(balAfter - balBefore, expected);
    }

    function test_BatchRecordValidations() public {
        _registerNode(company1);
        _registerNode(company2);

        address[] memory nodes = new address[](2);
        nodes[0] = company1;
        nodes[1] = company2;
        uint256[] memory points = new uint256[](2);
        points[0] = 50;
        points[1] = 30;

        vm.prank(oracle);
        rewards.batchRecordValidations(nodes, points, "Batch IoT");

        (, uint256 pts1, , , , ) = rewards.getNodeInfo(company1);
        (, uint256 pts2, , , , ) = rewards.getNodeInfo(company2);
        assertEq(pts1, 50);
        assertEq(pts2, 30);
    }

    function test_ContributionPointsSyncedToRegistry() public {
        _registerNode(company1);

        vm.prank(oracle);
        rewards.recordValidation(company1, 42, "Smart Contract Deploy");

        // Check that contribution points were also recorded in ValidatorRegistry
        (, , uint256 contribPoints, , , , ) = registry.getValidatorInfo(company1);
        assertEq(contribPoints, 42);
    }

    function test_RevertClaimNoRewards() public {
        _registerNode(company1);

        vm.prank(company1);
        vm.expectRevert("ENR: no rewards");
        rewards.claimRewards();
    }

    function test_DeactivateNode() public {
        _registerNode(company1);

        vm.prank(admin);
        rewards.deactivateNode(company1);

        (, , , , , bool isActive) = rewards.getNodeInfo(company1);
        assertFalse(isActive);
    }

    function test_ActiveNodeCount() public {
        _registerNode(company1);
        _registerNode(company2);

        assertEq(rewards.getActiveNodeCount(), 2);

        vm.prank(admin);
        rewards.deactivateNode(company1);

        assertEq(rewards.getActiveNodeCount(), 1);
    }

    function test_UpdateRewardRate() public {
        uint256 newRate = 2 * 1e18;
        vm.prank(admin);
        rewards.updateRewardPerPoint(newRate);

        assertEq(rewards.rewardPerPoint(), newRate);
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    function _registerValidator(address who, uint256 amount, string memory name) internal {
        vm.startPrank(who);
        bez.approve(address(registry), amount);
        registry.registerValidator(name, amount);
        vm.stopPrank();
    }

    function _registerNode(address who) internal {
        vm.prank(who);
        rewards.registerNode();
    }
}
