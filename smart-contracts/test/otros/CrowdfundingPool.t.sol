// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/otros/CrowdfundingPool.sol";

contract CrowdfundingPoolTest is Test {
    CrowdfundingPool pool;
    address admin = address(this);
    address creator = address(0xA1);
    address backer1 = address(0xB1);
    address backer2 = address(0xB2);

    function setUp() public {
        pool = new CrowdfundingPool();
        pool.grantRole(pool.CAMPAIGN_ROLE(), creator);
        vm.deal(backer1, 100 ether);
        vm.deal(backer2, 100 ether);
        vm.deal(creator, 10 ether);
    }

    // ── createCampaign ──────────────────
    function testCreateCampaign() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Save the forest"));
        (uint256 rid, address c, uint256 goal, uint256 raised, , , CrowdfundingPool.CampaignStatus st, ) = pool.campaigns(cid);
        assertEq(c, creator);
        assertEq(goal, 10 ether);
        assertEq(raised, 0);
        assertEq(uint8(st), uint8(CrowdfundingPool.CampaignStatus.ACTIVE));
    }

    function testCreateCampaignRevertZeroGoal() public {
        vm.prank(creator);
        vm.expectRevert("Goal required");
        pool.createCampaign(0, 30 days, keccak256("x"));
    }

    function testCreateCampaignRevertZeroDuration() public {
        vm.prank(creator);
        vm.expectRevert("Duration required");
        pool.createCampaign(10 ether, 0, keccak256("x"));
    }

    // ── pledge ──────────────────
    function testPledge() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));

        vm.prank(backer1);
        uint256 pid = pool.pledge{value: 3 ether}(cid);
        (, uint256 pcid, address b, uint256 amt, bool ref) = pool.pledges(pid);
        assertEq(pcid, cid);
        assertEq(b, backer1);
        assertEq(amt, 3 ether);
        assertFalse(ref);

        (, , , uint256 raised, , , , uint256 bc) = pool.campaigns(cid);
        assertEq(raised, 3 ether);
        assertEq(bc, 1);
    }

    function testPledgeRevertNotActive() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        vm.prank(creator);
        pool.cancelCampaign(cid);

        vm.prank(backer1);
        vm.expectRevert("Not active");
        pool.pledge{value: 1 ether}(cid);
    }

    function testPledgeRevertEnded() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        vm.warp(block.timestamp + 31 days);

        vm.prank(backer1);
        vm.expectRevert("Campaign ended");
        pool.pledge{value: 1 ether}(cid);
    }

    function testPledgeRevertZeroAmount() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));

        vm.prank(backer1);
        vm.expectRevert("Amount required");
        pool.pledge(cid);
    }

    // ── finalizeCampaign ──────────────────
    function testFinalizeCampaignFunded() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(5 ether, 30 days, keccak256("Forest"));

        vm.prank(backer1);
        pool.pledge{value: 5 ether}(cid);

        vm.warp(block.timestamp + 31 days);
        pool.grantRole(pool.CAMPAIGN_ROLE(), admin);
        pool.finalizeCampaign(cid);

        (, , , , , , CrowdfundingPool.CampaignStatus st, ) = pool.campaigns(cid);
        assertEq(uint8(st), uint8(CrowdfundingPool.CampaignStatus.FUNDED));
    }

    function testFinalizeCampaignFailed() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));

        vm.prank(backer1);
        pool.pledge{value: 3 ether}(cid);

        vm.warp(block.timestamp + 31 days);
        pool.grantRole(pool.CAMPAIGN_ROLE(), admin);
        pool.finalizeCampaign(cid);

        (, , , , , , CrowdfundingPool.CampaignStatus st, ) = pool.campaigns(cid);
        assertEq(uint8(st), uint8(CrowdfundingPool.CampaignStatus.FAILED));
    }

    function testFinalizeRevertNotEnded() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));

        pool.grantRole(pool.CAMPAIGN_ROLE(), admin);
        vm.expectRevert("Not ended yet");
        pool.finalizeCampaign(cid);
    }

    // ── withdrawFunds ──────────────────
    function testWithdrawFunds() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(5 ether, 30 days, keccak256("Forest"));
        vm.prank(backer1);
        pool.pledge{value: 5 ether}(cid);
        vm.warp(block.timestamp + 31 days);
        pool.grantRole(pool.CAMPAIGN_ROLE(), admin);
        pool.finalizeCampaign(cid);

        uint256 balBefore = creator.balance;
        vm.prank(creator);
        pool.withdrawFunds(cid);
        assertEq(creator.balance, balBefore + 5 ether);
    }

    function testWithdrawFundsRevertNotFunded() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(5 ether, 30 days, keccak256("Forest"));

        vm.prank(creator);
        vm.expectRevert("Not funded");
        pool.withdrawFunds(cid);
    }

    // ── refund ──────────────────
    function testRefund() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        vm.prank(backer1);
        uint256 pid = pool.pledge{value: 3 ether}(cid);
        vm.warp(block.timestamp + 31 days);
        pool.grantRole(pool.CAMPAIGN_ROLE(), admin);
        pool.finalizeCampaign(cid);

        uint256 balBefore = backer1.balance;
        vm.prank(backer1);
        pool.refund(pid);
        assertEq(backer1.balance, balBefore + 3 ether);
    }

    function testRefundRevertNotBacker() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        vm.prank(backer1);
        uint256 pid = pool.pledge{value: 3 ether}(cid);
        vm.warp(block.timestamp + 31 days);
        pool.grantRole(pool.CAMPAIGN_ROLE(), admin);
        pool.finalizeCampaign(cid);

        vm.prank(backer2);
        vm.expectRevert("Not backer");
        pool.refund(pid);
    }

    function testRefundRevertAlready() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        vm.prank(backer1);
        uint256 pid = pool.pledge{value: 3 ether}(cid);
        vm.warp(block.timestamp + 31 days);
        pool.grantRole(pool.CAMPAIGN_ROLE(), admin);
        pool.finalizeCampaign(cid);

        vm.startPrank(backer1);
        pool.refund(pid);
        vm.expectRevert("Already refunded");
        pool.refund(pid);
        vm.stopPrank();
    }

    // ── cancelCampaign ──────────────────
    function testCancelCampaign() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        vm.prank(creator);
        pool.cancelCampaign(cid);
        (, , , , , , CrowdfundingPool.CampaignStatus st, ) = pool.campaigns(cid);
        assertEq(uint8(st), uint8(CrowdfundingPool.CampaignStatus.CANCELLED));
    }

    function testCancelCampaignRevertNotCreator() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        vm.prank(backer1);
        vm.expectRevert("Not creator");
        pool.cancelCampaign(cid);
    }

    // ── View helpers ──────────────────
    function testGetCampaignPledges() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        vm.prank(backer1);
        pool.pledge{value: 1 ether}(cid);
        vm.prank(backer2);
        pool.pledge{value: 2 ether}(cid);
        uint256[] memory ids = pool.getCampaignPledges(cid);
        assertEq(ids.length, 2);
    }

    function testGetCreatorCampaigns() public {
        vm.startPrank(creator);
        pool.createCampaign(5 ether, 30 days, keccak256("A"));
        pool.createCampaign(8 ether, 60 days, keccak256("B"));
        vm.stopPrank();
        uint256[] memory ids = pool.getCreatorCampaigns(creator);
        assertEq(ids.length, 2);
    }

    function testIsCampaignActive() public {
        vm.prank(creator);
        uint256 cid = pool.createCampaign(10 ether, 30 days, keccak256("Forest"));
        assertTrue(pool.isCampaignActive(cid));

        vm.warp(block.timestamp + 31 days);
        assertFalse(pool.isCampaignActive(cid));
    }
}
