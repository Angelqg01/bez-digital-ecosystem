// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/automotive/FleetLeaseEscrow.sol";

contract FleetLeaseEscrowTest is Test {
    FleetLeaseEscrow escrow;
    address admin = address(1);
    address lessee = address(2);

    function setUp() public {
        vm.startPrank(admin);
        escrow = new FleetLeaseEscrow(admin);
        vm.stopPrank();
        vm.deal(admin, 100 ether);
        vm.deal(lessee, 100 ether);
    }

    function testCreateLease() public {
        vm.startPrank(admin);
        uint256 id = escrow.createLease{value: 5 ether}(lessee, "FLT-001", 50, 1 ether, 12);
        vm.stopPrank();

        assertEq(escrow.totalLeases(), 1);
        (address les,, uint256 vehicles,,,,,, ) = escrow.leases(id);
        assertEq(les, lessee);
        assertEq(vehicles, 50);
    }

    function testCreateLeaseZeroVehiclesReverts() public {
        vm.startPrank(admin);
        vm.expectRevert("Must have vehicles");
        escrow.createLease{value: 1 ether}(lessee, "FLT-BAD", 0, 1 ether, 12);
        vm.stopPrank();
    }

    function testMakePayment() public {
        vm.startPrank(admin);
        uint256 id = escrow.createLease{value: 5 ether}(lessee, "FLT-002", 30, 1 ether, 12);
        vm.stopPrank();

        vm.startPrank(lessee);
        escrow.makePayment{value: 1 ether}(id);
        vm.stopPrank();

        (,,,,, uint256 maintenancePool,,,) = escrow.leases(id);
        // 20% of 1 ether = 0.2 ether
        assertEq(maintenancePool, 0.2 ether);
    }

    function testMakePaymentInsufficientReverts() public {
        vm.startPrank(admin);
        uint256 id = escrow.createLease{value: 5 ether}(lessee, "FLT-003", 20, 2 ether, 6);
        vm.stopPrank();

        vm.startPrank(lessee);
        vm.expectRevert("Insufficient payment");
        escrow.makePayment{value: 0.5 ether}(id);
        vm.stopPrank();
    }

    function testClaimMaintenance() public {
        vm.startPrank(admin);
        uint256 leaseId = escrow.createLease{value: 5 ether}(lessee, "FLT-004", 25, 1 ether, 12);
        vm.stopPrank();

        vm.startPrank(lessee);
        escrow.makePayment{value: 1 ether}(leaseId);
        bytes32 evidence = keccak256("brake_repair_photo.jpg");
        uint256 claimId = escrow.claimMaintenance(leaseId, 0.1 ether, "Brake repair", evidence);
        vm.stopPrank();

        (uint256 lid, uint256 amount,,, bool approved, bool paid) = escrow.claims(claimId);
        assertEq(lid, leaseId);
        assertEq(amount, 0.1 ether);
        assertFalse(approved);
        assertFalse(paid);
    }

    function testApproveMaintenance() public {
        vm.startPrank(admin);
        uint256 leaseId = escrow.createLease{value: 5 ether}(lessee, "FLT-005", 40, 1 ether, 12);
        vm.stopPrank();

        vm.startPrank(lessee);
        escrow.makePayment{value: 1 ether}(leaseId);
        uint256 claimId = escrow.claimMaintenance(leaseId, 0.1 ether, "Oil change", keccak256("oil.jpg"));
        vm.stopPrank();

        uint256 balBefore = lessee.balance;

        vm.startPrank(admin);
        escrow.approveMaintenance(claimId);
        vm.stopPrank();

        assertEq(lessee.balance, balBefore + 0.1 ether);
        assertEq(escrow.totalMaintenancePaid(), 0.1 ether);
    }

    function testTerminateLease() public {
        vm.startPrank(admin);
        uint256 id = escrow.createLease{value: 2 ether}(lessee, "FLT-006", 10, 0.5 ether, 6);
        escrow.terminateLease(id);
        vm.stopPrank();

        (,,,,,,,, FleetLeaseEscrow.LeaseStatus status) = escrow.leases(id);
        assertEq(uint256(status), uint256(FleetLeaseEscrow.LeaseStatus.TERMINATED));
    }

    function testTerminateAlreadyTerminatedReverts() public {
        vm.startPrank(admin);
        uint256 id = escrow.createLease{value: 2 ether}(lessee, "FLT-007", 10, 0.5 ether, 6);
        escrow.terminateLease(id);
        vm.expectRevert("Not active");
        escrow.terminateLease(id);
        vm.stopPrank();
    }

    function testLeaseHealth() public {
        vm.startPrank(admin);
        uint256 id = escrow.createLease{value: 10 ether}(lessee, "FLT-008", 60, 1 ether, 12);
        vm.stopPrank();

        vm.startPrank(lessee);
        escrow.makePayment{value: 1 ether}(id);
        vm.stopPrank();

        uint256 health = escrow.getLeaseHealth(id);
        // maintenancePool = 0.2 ether, escrowBalance = 11 ether => ~1%
        assertTrue(health > 0);
    }
}
