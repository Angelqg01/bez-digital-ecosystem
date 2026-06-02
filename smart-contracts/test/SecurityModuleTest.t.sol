// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SecurityModule} from "../src/wallet/SecurityModule.sol";

contract SecurityModuleTest is Test {
    SecurityModule public sec;
    
    address public admin;
    address public guardian1;
    address public guardian2;
    address public guardian3;
    address public attacker;
    address public targetContract;

    function setUp() public {
        admin = makeAddr("admin");
        guardian1 = makeAddr("guardian1");
        guardian2 = makeAddr("guardian2");
        guardian3 = makeAddr("guardian3");
        attacker = makeAddr("attacker");
        targetContract = makeAddr("targetContract");

        address[] memory guardians = new address[](3);
        guardians[0] = guardian1;
        guardians[1] = guardian2;
        guardians[2] = guardian3;

        sec = new SecurityModule(admin, 24 hours, guardians, 2);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════════

    function test_InitialState() public view {
        assertEq(sec.timelockDelay(), 24 hours);
        assertEq(sec.guardianThreshold(), 2);
        assertTrue(sec.isGuardian(guardian1));
        assertTrue(sec.isGuardian(guardian2));
        assertTrue(sec.isGuardian(guardian3));
        assertFalse(sec.globalPause());
    }

    function test_InvalidDelayReverts() public {
        address[] memory g = new address[](1);
        g[0] = guardian1;
        vm.expectRevert("SEC: invalid delay");
        new SecurityModule(admin, 1 hours, g, 1); // < MIN_DELAY
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Global Pause
    // ═══════════════════════════════════════════════════════════════════

    function test_GuardianCanPause() public {
        vm.prank(guardian1);
        sec.activateGlobalPause();
        assertTrue(sec.globalPause());
    }

    function test_OnlyOwnerCanUnpause() public {
        vm.prank(guardian1);
        sec.activateGlobalPause();
        
        vm.prank(guardian1);
        vm.expectRevert();
        sec.deactivateGlobalPause();
        
        vm.prank(admin);
        sec.deactivateGlobalPause();
        assertFalse(sec.globalPause());
    }

    function test_NonGuardianCannotPause() public {
        vm.prank(attacker);
        vm.expectRevert("SEC: not guardian");
        sec.activateGlobalPause();
    }

    function test_ContractPauseToggle() public {
        vm.prank(guardian1);
        sec.toggleContractPause(targetContract);
        assertTrue(sec.contractPaused(targetContract));
        
        vm.prank(guardian1);
        sec.toggleContractPause(targetContract);
        assertFalse(sec.contractPaused(targetContract));
    }

    function test_IsContractOperational() public {
        assertTrue(sec.isContractOperational(targetContract));
        
        vm.prank(guardian1);
        sec.toggleContractPause(targetContract);
        assertFalse(sec.isContractOperational(targetContract));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Timelock Operations
    // ═══════════════════════════════════════════════════════════════════

    function test_ScheduleOperation() public {
        vm.prank(admin);
        bytes32 opHash = sec.scheduleOperation(targetContract, 0, "", "Upgrade contract");
        
        (,,,,,uint256 executeAfter,,,,) = sec.timelockOps(opHash);
        assertGt(executeAfter, block.timestamp);
    }

    function test_ExecuteAfterDelay() public {
        vm.deal(address(sec), 10 ether);
        address payTarget = makeAddr("payTarget");
        
        vm.prank(admin);
        bytes32 opHash = sec.scheduleOperation(payTarget, 1 ether, "", "Pay");
        
        vm.warp(block.timestamp + 24 hours + 1);
        
        vm.prank(admin);
        sec.executeOperation(opHash);
        assertEq(payTarget.balance, 1 ether);
    }

    function test_ExecuteBeforeDelayReverts() public {
        vm.prank(admin);
        bytes32 opHash = sec.scheduleOperation(targetContract, 0, "", "Op");
        
        vm.prank(admin);
        vm.expectRevert("SEC: too early");
        sec.executeOperation(opHash);
    }

    function test_CancelOperation() public {
        vm.prank(admin);
        bytes32 opHash = sec.scheduleOperation(targetContract, 0, "", "Op");
        
        vm.prank(admin);
        sec.cancelOperation(opHash);
        
        vm.warp(block.timestamp + 24 hours + 1);
        
        vm.prank(admin);
        vm.expectRevert("SEC: cancelled");
        sec.executeOperation(opHash);
    }

    function test_OperationExpiry() public {
        vm.prank(admin);
        bytes32 opHash = sec.scheduleOperation(targetContract, 0, "", "Op");
        
        // Past grace period
        vm.warp(block.timestamp + 24 hours + 14 days + 1);
        
        vm.prank(admin);
        vm.expectRevert("SEC: expired");
        sec.executeOperation(opHash);
    }

    function test_GlobalPauseBlocksExecution() public {
        vm.prank(admin);
        bytes32 opHash = sec.scheduleOperation(targetContract, 0, "", "Op");
        
        vm.prank(guardian1);
        sec.activateGlobalPause();
        
        vm.warp(block.timestamp + 24 hours + 1);
        
        vm.prank(admin);
        vm.expectRevert("SEC: globally paused");
        sec.executeOperation(opHash);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Circuit Breaker
    // ═══════════════════════════════════════════════════════════════════

    function test_SetCircuitBreaker() public {
        vm.prank(admin);
        sec.setCircuitBreaker(targetContract, 100 ether, 1 hours);
        
        (uint256 threshold, uint256 window,,,) = sec.circuitBreakers(targetContract);
        assertEq(threshold, 100 ether);
        assertEq(window, 1 hours);
    }

    function test_CircuitBreakerTrips() public {
        vm.prank(admin);
        sec.setCircuitBreaker(targetContract, 100 ether, 1 hours);
        
        bool allowed = sec.checkCircuitBreaker(targetContract, 50 ether);
        assertTrue(allowed);
        
        allowed = sec.checkCircuitBreaker(targetContract, 60 ether);
        assertFalse(allowed); // 50 + 60 = 110 > 100
    }

    function test_CircuitBreakerReset() public {
        vm.prank(admin);
        sec.setCircuitBreaker(targetContract, 100 ether, 1 hours);
        
        sec.checkCircuitBreaker(targetContract, 110 ether); // trips
        
        (,,,,bool tripped) = sec.circuitBreakers(targetContract);
        assertTrue(tripped);
        
        vm.prank(admin);
        sec.resetCircuitBreaker(targetContract);
        
        (,,,,bool trippedAfter) = sec.circuitBreakers(targetContract);
        assertFalse(trippedAfter);
    }

    function test_CircuitBreakerWindowReset() public {
        vm.prank(admin);
        sec.setCircuitBreaker(targetContract, 100 ether, 1 hours);
        
        sec.checkCircuitBreaker(targetContract, 90 ether);
        
        vm.warp(block.timestamp + 2 hours);
        
        bool allowed = sec.checkCircuitBreaker(targetContract, 90 ether);
        assertTrue(allowed); // window reset
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Guardian Management
    // ═══════════════════════════════════════════════════════════════════

    function test_AddGuardian() public {
        address newG = makeAddr("newG");
        vm.prank(admin);
        sec.addGuardian(newG);
        assertTrue(sec.isGuardian(newG));
    }

    function test_RemoveGuardian() public {
        vm.prank(admin);
        sec.removeGuardian(guardian3);
        assertFalse(sec.isGuardian(guardian3));
    }

    function test_CannotRemoveBelowThreshold() public {
        vm.startPrank(admin);
        sec.removeGuardian(guardian3);
        
        vm.expectRevert("SEC: would break threshold");
        sec.removeGuardian(guardian2);
        vm.stopPrank();
    }

    function test_SetGuardianThreshold() public {
        vm.prank(admin);
        sec.setGuardianThreshold(3);
        assertEq(sec.guardianThreshold(), 3);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Audit Log
    // ═══════════════════════════════════════════════════════════════════

    function test_AuditLogOnPause() public {
        vm.prank(guardian1);
        sec.activateGlobalPause();
        
        assertEq(sec.getAuditLogLength(), 1);
        
        (uint256 ts, address actor, string memory action,) = sec.getAuditEntry(0);
        assertEq(actor, guardian1);
        assertEq(action, "GLOBAL_PAUSE_ON");
        assertGt(ts, 0);
    }

    function test_ExternalAudit() public {
        vm.prank(guardian1);
        sec.logExternalAudit("MANUAL_CHECK", bytes32(uint256(42)));
        
        (,, string memory action, bytes32 dh) = sec.getAuditEntry(0);
        assertEq(action, "MANUAL_CHECK");
        assertEq(dh, bytes32(uint256(42)));
    }

    function test_GetRecentAudits() public {
        vm.startPrank(guardian1);
        sec.activateGlobalPause();
        vm.stopPrank();
        
        vm.prank(admin);
        sec.deactivateGlobalPause();
        
        SecurityModule.AuditEntry[] memory entries = sec.getRecentAudits(5);
        assertEq(entries.length, 2);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Views
    // ═══════════════════════════════════════════════════════════════════

    function test_GetGuardians() public view {
        address[] memory g = sec.getGuardians();
        assertEq(g.length, 3);
    }

    function test_GetPendingOperations() public {
        vm.startPrank(admin);
        sec.scheduleOperation(targetContract, 0, "", "Op1");
        sec.scheduleOperation(targetContract, 1, "", "Op2");
        vm.stopPrank();
        
        bytes32[] memory pending = sec.getPendingOperations();
        assertEq(pending.length, 2);
    }

    function test_SetTimelockDelay() public {
        vm.prank(admin);
        sec.setTimelockDelay(48 hours);
        assertEq(sec.timelockDelay(), 48 hours);
    }
}
