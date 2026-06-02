// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/education/ScholarshipPool.sol";

contract ScholarshipPoolTest is Test {
    ScholarshipPool sp;
    address admin   = address(this);
    address sponsor = address(0xC1);
    address student1 = address(0xD1);
    address student2 = address(0xD2);

    function setUp() public {
        sp = new ScholarshipPool();
        sp.grantRole(sp.SPONSOR_ROLE(), sponsor);
        vm.deal(sponsor, 100 ether);
        vm.deal(student1, 1 ether);
        vm.deal(student2, 1 ether);
    }

    function testCreatePool() public {
        vm.startPrank(sponsor);
        uint256 id = sp.createPool{value: 10 ether}("STEM Fund", 70);
        vm.stopPrank();

        ScholarshipPool.Pool memory p = sp.getPool(id);
        assertEq(p.name, "STEM Fund");
        assertEq(p.sponsor, sponsor);
        assertEq(p.totalFund, 10 ether);
        assertEq(p.minScore, 70);
        assertTrue(p.active);
    }

    function testCreatePoolRevertNoFund() public {
        vm.startPrank(sponsor);
        vm.expectRevert("Must fund pool");
        sp.createPool{value: 0}("Empty", 50);
        vm.stopPrank();
    }

    function testApplyForScholarship() public {
        vm.startPrank(sponsor);
        uint256 pid = sp.createPool{value: 5 ether}("Web3", 60);
        vm.stopPrank();

        vm.startPrank(student1);
        uint256 sid = sp.applyForScholarship(pid, 85);
        vm.stopPrank();

        ScholarshipPool.Scholar memory s = sp.getScholar(sid);
        assertEq(s.poolId, pid);
        assertEq(s.student, student1);
        assertEq(s.gpaScore, 85);
        assertFalse(s.approved);
    }

    function testApplyRevertLowGPA() public {
        vm.startPrank(sponsor);
        uint256 pid = sp.createPool{value: 5 ether}("High Bar", 90);
        vm.stopPrank();

        vm.startPrank(student1);
        vm.expectRevert("GPA below minimum");
        sp.applyForScholarship(pid, 70);
        vm.stopPrank();
    }

    function testApproveScholar() public {
        vm.startPrank(sponsor);
        uint256 pid = sp.createPool{value: 5 ether}("Pool", 50);
        vm.stopPrank();

        vm.startPrank(student1);
        uint256 sid = sp.applyForScholarship(pid, 80);
        vm.stopPrank();

        vm.startPrank(sponsor);
        sp.approveScholar(sid);
        vm.stopPrank();

        ScholarshipPool.Scholar memory s = sp.getScholar(sid);
        assertTrue(s.approved);
        assertEq(sp.getPool(pid).scholarCount, 1);
    }

    function testDistributeAward() public {
        vm.startPrank(sponsor);
        uint256 pid = sp.createPool{value: 10 ether}("Award Pool", 50);
        vm.stopPrank();

        vm.startPrank(student1);
        uint256 sid = sp.applyForScholarship(pid, 90);
        vm.stopPrank();

        uint256 balBefore = student1.balance;

        vm.startPrank(sponsor);
        sp.approveScholar(sid);
        sp.distributeAward(sid, 2 ether);
        vm.stopPrank();

        assertEq(student1.balance, balBefore + 2 ether);
        assertEq(sp.getScholar(sid).awarded, 2 ether);
        assertEq(sp.getPool(pid).distributed, 2 ether);
    }

    function testDistributeRevertNotApproved() public {
        vm.startPrank(sponsor);
        uint256 pid = sp.createPool{value: 5 ether}("Pool", 50);
        vm.stopPrank();

        vm.startPrank(student1);
        uint256 sid = sp.applyForScholarship(pid, 80);
        vm.stopPrank();

        vm.startPrank(sponsor);
        vm.expectRevert("Not approved");
        sp.distributeAward(sid, 1 ether);
        vm.stopPrank();
    }

    function testDistributeRevertExceedsFund() public {
        vm.startPrank(sponsor);
        uint256 pid = sp.createPool{value: 1 ether}("Small", 50);
        vm.stopPrank();

        vm.startPrank(student1);
        uint256 sid = sp.applyForScholarship(pid, 80);
        vm.stopPrank();

        vm.startPrank(sponsor);
        sp.approveScholar(sid);
        vm.expectRevert("Exceeds fund");
        sp.distributeAward(sid, 2 ether);
        vm.stopPrank();
    }

    function testClosePool() public {
        vm.startPrank(sponsor);
        uint256 pid = sp.createPool{value: 5 ether}("Closing", 50);
        sp.closePool(pid);
        vm.stopPrank();

        assertFalse(sp.getPool(pid).active);
    }

    function testApplyRevertClosedPool() public {
        vm.startPrank(sponsor);
        uint256 pid = sp.createPool{value: 5 ether}("Closed", 50);
        sp.closePool(pid);
        vm.stopPrank();

        vm.startPrank(student1);
        vm.expectRevert("Pool not active");
        sp.applyForScholarship(pid, 80);
        vm.stopPrank();
    }
}
