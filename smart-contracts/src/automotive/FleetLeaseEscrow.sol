// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title FleetLeaseEscrow — Fleet leasing with maintenance triggers on BeZhas Chain
/// @notice Escrow-based fleet leasing with usage-based maintenance fund
contract FleetLeaseEscrow is AccessControl {

    bytes32 public constant LESSOR_ROLE = keccak256("LESSOR_ROLE");

    enum LeaseStatus { ACTIVE, TERMINATED, DEFAULTED }

    struct FleetLease {
        address lessee;
        string  fleetId;
        uint256 vehicleCount;
        uint256 monthlyPayment;
        uint256 escrowBalance;
        uint256 maintenancePool;
        uint256 startDate;
        uint256 endDate;
        LeaseStatus status;
    }

    struct MaintenanceClaim {
        uint256 leaseId;
        uint256 amount;
        string  description;
        bytes32 evidenceHash;
        bool    approved;
        bool    paid;
    }

    uint256 public nextLeaseId;
    uint256 public nextClaimId;
    mapping(uint256 => FleetLease) public leases;
    mapping(uint256 => MaintenanceClaim) public claims;
    mapping(address => uint256) public lessorEarnings;
    uint256 public totalLeases;
    uint256 public totalMaintenancePaid;

    event LeaseCreated(uint256 indexed leaseId, string fleetId, address lessee, uint256 vehicleCount);
    event PaymentMade(uint256 indexed leaseId, uint256 amount);
    event MaintenanceClaimed(uint256 indexed claimId, uint256 leaseId, uint256 amount);
    event MaintenanceApproved(uint256 indexed claimId);
    event LeaseTerminated(uint256 indexed leaseId);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(LESSOR_ROLE, admin);
    }

    function createLease(
        address lessee,
        string calldata fleetId,
        uint256 vehicleCount,
        uint256 monthly,
        uint256 durationMonths
    ) external payable onlyRole(LESSOR_ROLE) returns (uint256) {
        require(vehicleCount > 0, "Must have vehicles");
        require(monthly > 0, "Monthly payment required");
        require(durationMonths > 0, "Duration required");

        uint256 leaseId = nextLeaseId++;
        leases[leaseId] = FleetLease({
            lessee: lessee,
            fleetId: fleetId,
            vehicleCount: vehicleCount,
            monthlyPayment: monthly,
            escrowBalance: msg.value,
            maintenancePool: 0,
            startDate: block.timestamp,
            endDate: block.timestamp + (durationMonths * 30 days),
            status: LeaseStatus.ACTIVE
        });

        totalLeases++;
        emit LeaseCreated(leaseId, fleetId, lessee, vehicleCount);
        return leaseId;
    }

    function makePayment(uint256 leaseId) external payable {
        FleetLease storage lease = leases[leaseId];
        require(lease.status == LeaseStatus.ACTIVE, "Lease not active");
        require(msg.sender == lease.lessee, "Not lessee");
        require(msg.value >= lease.monthlyPayment, "Insufficient payment");

        // 80% to lessor, 20% to maintenance pool
        uint256 maintenanceShare = (msg.value * 20) / 100;
        uint256 lessorShare = msg.value - maintenanceShare;

        lease.maintenancePool += maintenanceShare;
        lease.escrowBalance += msg.value;
        lessorEarnings[msg.sender] += lessorShare;

        // Refund excess
        if (msg.value > lease.monthlyPayment) {
            uint256 excess = msg.value - lease.monthlyPayment;
            lease.escrowBalance -= excess;
            (bool ok,) = msg.sender.call{value: excess}("");
            require(ok, "Refund failed");
        }

        emit PaymentMade(leaseId, msg.value);
    }

    function claimMaintenance(
        uint256 leaseId,
        uint256 amount,
        string calldata description,
        bytes32 evidenceHash
    ) external returns (uint256) {
        FleetLease storage lease = leases[leaseId];
        require(lease.status == LeaseStatus.ACTIVE, "Lease not active");
        require(msg.sender == lease.lessee, "Not lessee");
        require(amount <= lease.maintenancePool, "Exceeds maintenance pool");
        require(amount > 0, "Amount must be > 0");

        uint256 claimId = nextClaimId++;
        claims[claimId] = MaintenanceClaim({
            leaseId: leaseId,
            amount: amount,
            description: description,
            evidenceHash: evidenceHash,
            approved: false,
            paid: false
        });

        emit MaintenanceClaimed(claimId, leaseId, amount);
        return claimId;
    }

    function approveMaintenance(uint256 claimId) external onlyRole(LESSOR_ROLE) {
        MaintenanceClaim storage claim = claims[claimId];
        require(!claim.approved, "Already approved");
        require(!claim.paid, "Already paid");

        FleetLease storage lease = leases[claim.leaseId];
        require(claim.amount <= lease.maintenancePool, "Exceeds pool");

        claim.approved = true;
        claim.paid = true;
        lease.maintenancePool -= claim.amount;
        totalMaintenancePaid += claim.amount;

        (bool ok,) = lease.lessee.call{value: claim.amount}("");
        require(ok, "Payout failed");

        emit MaintenanceApproved(claimId);
    }

    function terminateLease(uint256 leaseId) external onlyRole(LESSOR_ROLE) {
        FleetLease storage lease = leases[leaseId];
        require(lease.status == LeaseStatus.ACTIVE, "Not active");
        lease.status = LeaseStatus.TERMINATED;

        emit LeaseTerminated(leaseId);
    }

    function getLeaseHealth(uint256 leaseId) external view returns (uint256) {
        FleetLease storage lease = leases[leaseId];
        if (lease.status != LeaseStatus.ACTIVE) return 0;
        if (lease.escrowBalance == 0) return 0;
        // Health score: ratio of maintenance pool vs escrow (higher = healthier)
        return (lease.maintenancePool * 100) / lease.escrowBalance;
    }

    receive() external payable {}
}
