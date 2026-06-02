// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/services/SLAMonitor.sol";

contract SLAMonitorTest is Test {
    SLAMonitor sla;
    address admin = address(this);
    address providerAddr = address(0xA1);
    address consumer = address(0xB1);
    address monitor = address(0xC1);
    address outsider = address(0xD1);

    function setUp() public {
        sla = new SLAMonitor();
        sla.grantRole(sla.MONITOR_ROLE(), monitor);
        vm.deal(providerAddr, 100 ether);
        vm.deal(consumer, 10 ether);
    }

    // ── createAgreement ──────────────────
    function testCreateAgreement() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        (uint256 rid, address p, address c, uint256 uptime, uint256 penalty, uint256 dep, uint256 bc, SLAMonitor.AgreementStatus st, uint256 exp) = sla.agreements(aid);
        assertEq(p, providerAddr);
        assertEq(c, consumer);
        assertEq(uptime, 9950);
        assertEq(penalty, 0.5 ether);
        assertEq(dep, 5 ether);
        assertEq(uint8(st), uint8(SLAMonitor.AgreementStatus.ACTIVE));
        assertEq(exp, block.timestamp + 90 days);
    }

    function testCreateAgreementRevertNoDeposit() public {
        vm.prank(providerAddr);
        vm.expectRevert("Deposit required");
        sla.createAgreement(consumer, 9950, 0.5 ether, 90 days);
    }

    function testCreateAgreementRevertZeroPenalty() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0, 90 days);
        // Zero penalty is allowed — no revert. Verify agreement created.
        (, address p, , , uint256 penalty, , , ,) = sla.agreements(aid);
        assertEq(p, providerAddr);
        assertEq(penalty, 0);
    }

    // ── reportIncident ──────────────────
    function testReportIncident() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);

        vm.prank(monitor);
        uint256 iid = sla.reportIncident(aid, SLAMonitor.IncidentSeverity.HIGH, keccak256("outage"), 3600);
        (uint256 rid, uint256 iaid, SLAMonitor.IncidentSeverity sev, bytes32 dh, uint256 ds, uint256 ra, bool res) = sla.incidents(iid);
        assertEq(iaid, aid);
        assertEq(uint8(sev), uint8(SLAMonitor.IncidentSeverity.HIGH));
        assertEq(ds, 3600);
        assertFalse(res);
    }

    function testReportIncidentRevertNotActive() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        vm.startPrank(monitor);
        // fill up deposit by breaching (5e / 0.5e = 10 times)
        for (uint i = 0; i < 10; i++) {
            sla.reportIncident(aid, SLAMonitor.IncidentSeverity.CRITICAL, keccak256("x"), 100);
            sla.recordBreach(aid);
        }
        // now BREACHED
        vm.expectRevert("Not active");
        sla.reportIncident(aid, SLAMonitor.IncidentSeverity.LOW, keccak256("y"), 10);
        vm.stopPrank();
    }

    // ── resolveIncident ──────────────────
    function testResolveIncident() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        vm.startPrank(monitor);
        uint256 iid = sla.reportIncident(aid, SLAMonitor.IncidentSeverity.MEDIUM, keccak256("x"), 1800);
        sla.resolveIncident(iid);
        vm.stopPrank();
        (, , , , , , bool res) = sla.incidents(iid);
        assertTrue(res);
    }

    function testResolveIncidentRevertAlreadyResolved() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        vm.startPrank(monitor);
        uint256 iid = sla.reportIncident(aid, SLAMonitor.IncidentSeverity.LOW, keccak256("x"), 300);
        sla.resolveIncident(iid);
        vm.expectRevert("Already resolved");
        sla.resolveIncident(iid);
        vm.stopPrank();
    }

    // ── recordBreach ──────────────────
    function testRecordBreach() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);

        uint256 consBalBefore = consumer.balance;
        vm.startPrank(monitor);
        sla.reportIncident(aid, SLAMonitor.IncidentSeverity.HIGH, keccak256("x"), 3600);
        sla.recordBreach(aid);
        vm.stopPrank();

        (, , , , , uint256 dep, uint256 bc, ,) = sla.agreements(aid);
        assertEq(dep, 4.5 ether);
        assertEq(bc, 1);
        assertEq(consumer.balance, consBalBefore + 0.5 ether);
    }

    function testRecordBreachAutoBreached() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);

        vm.startPrank(monitor);
        for (uint i = 0; i < 10; i++) {
            sla.reportIncident(aid, SLAMonitor.IncidentSeverity.CRITICAL, keccak256("x"), 100);
            sla.recordBreach(aid);
        }
        vm.stopPrank();

        (, , , , , uint256 dep, , SLAMonitor.AgreementStatus st, ) = sla.agreements(aid);
        assertEq(dep, 0);
        assertEq(uint8(st), uint8(SLAMonitor.AgreementStatus.BREACHED));
    }

    // ── terminateAgreement ──────────────────
    function testTerminateAgreement() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);

        uint256 provBal = providerAddr.balance;
        vm.prank(providerAddr);
        sla.terminateAgreement(aid);

        (, , , , , uint256 dep, , SLAMonitor.AgreementStatus st, ) = sla.agreements(aid);
        assertEq(uint8(st), uint8(SLAMonitor.AgreementStatus.TERMINATED));
        assertEq(providerAddr.balance, provBal + 5 ether);
    }

    function testTerminateAgreementByConsumer() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        vm.prank(consumer);
        sla.terminateAgreement(aid);
        (, , , , , , , SLAMonitor.AgreementStatus st, ) = sla.agreements(aid);
        assertEq(uint8(st), uint8(SLAMonitor.AgreementStatus.TERMINATED));
    }

    function testTerminateRevertNotParty() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        vm.prank(outsider);
        vm.expectRevert("Not party");
        sla.terminateAgreement(aid);
    }

    // ── markExpired ──────────────────
    function testMarkExpired() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        vm.warp(block.timestamp + 91 days);

        uint256 provBal = providerAddr.balance;
        vm.prank(monitor);
        sla.markExpired(aid);
        (, , , , , uint256 dep, , SLAMonitor.AgreementStatus st, ) = sla.agreements(aid);
        assertEq(uint8(st), uint8(SLAMonitor.AgreementStatus.EXPIRED));
        assertEq(providerAddr.balance, provBal + 5 ether);
    }

    function testMarkExpiredRevertNotExpiredYet() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        vm.prank(monitor);
        vm.expectRevert("Not expired");
        sla.markExpired(aid);
    }

    // ── View helpers ──────────────────
    function testGetAgreementIncidents() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        vm.startPrank(monitor);
        sla.reportIncident(aid, SLAMonitor.IncidentSeverity.LOW, keccak256("a"), 100);
        sla.reportIncident(aid, SLAMonitor.IncidentSeverity.MEDIUM, keccak256("b"), 200);
        vm.stopPrank();
        uint256[] memory ids = sla.getAgreementIncidents(aid);
        assertEq(ids.length, 2);
    }

    function testGetProviderAgreements() public {
        vm.startPrank(providerAddr);
        sla.createAgreement{value: 2 ether}(consumer, 9950, 0.1 ether, 30 days);
        sla.createAgreement{value: 3 ether}(consumer, 9900, 0.2 ether, 60 days);
        vm.stopPrank();
        uint256[] memory ids = sla.getProviderAgreements(providerAddr);
        assertEq(ids.length, 2);
    }

    function testIsAgreementActive() public {
        vm.prank(providerAddr);
        uint256 aid = sla.createAgreement{value: 5 ether}(consumer, 9950, 0.5 ether, 90 days);
        assertTrue(sla.isAgreementActive(aid));

        vm.prank(providerAddr);
        sla.terminateAgreement(aid);
        assertFalse(sla.isAgreementActive(aid));
    }
}
