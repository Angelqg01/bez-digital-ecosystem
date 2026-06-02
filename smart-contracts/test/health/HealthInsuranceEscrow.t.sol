// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {HealthInsuranceEscrow} from "../../src/health/HealthInsuranceEscrow.sol";

contract HealthInsuranceEscrowTest is Test {
    HealthInsuranceEscrow public escrow;
    address public admin = address(1);
    address public hospital = address(2);
    address public aiEngine = address(3);
    address public adjuster = address(4);
    address public insurer = address(5);
    address public unauthorized = address(6);

    function setUp() public {
        vm.startPrank(admin);
        escrow = new HealthInsuranceEscrow();
        escrow.grantRole(escrow.HOSPITAL_ROLE(), hospital);
        escrow.grantRole(escrow.AI_ENGINE_ROLE(), aiEngine);
        escrow.grantRole(escrow.ADJUSTER_ROLE(), adjuster);
        vm.stopPrank();
    }

    function test_SubmitClaim() public {
        vm.prank(hospital);
        uint256 escrowId = escrow.submitClaim("CLM-001", insurer, keccak256("diag"), keccak256("proc"), 1000);

        HealthInsuranceEscrow.Claim memory cl = escrow.getClaim(escrowId);
        assertEq(keccak256(bytes(cl.claimId)), keccak256(bytes("CLM-001")));
        assertEq(cl.amount, 1000);
        assertEq(uint(cl.status), uint(HealthInsuranceEscrow.ClaimStatus.SUBMITTED));
        assertEq(escrow.totalClaimsCount(), 1);
    }

    function test_SubmitClaimRevertsUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        escrow.submitClaim("CLM-002", insurer, keccak256("diag"), keccak256("proc"), 500);
    }

    function test_AIAutoApproveHighConfidence() public {
        vm.prank(hospital);
        uint256 escrowId = escrow.submitClaim("CLM-001", insurer, keccak256("diag"), keccak256("proc"), 1000);

        vm.prank(aiEngine);
        escrow.setAIVerification(escrowId, 90); // >= 85 threshold

        HealthInsuranceEscrow.Claim memory cl = escrow.getClaim(escrowId);
        assertEq(uint(cl.status), uint(HealthInsuranceEscrow.ClaimStatus.AI_APPROVED));
        assertEq(cl.aiConfidence, 90);
    }

    function test_AIFlagsFraudLowConfidence() public {
        vm.prank(hospital);
        uint256 escrowId = escrow.submitClaim("CLM-001", insurer, keccak256("diag"), keccak256("proc"), 1000);

        vm.prank(aiEngine);
        escrow.setAIVerification(escrowId, 30); // < 50 threshold

        HealthInsuranceEscrow.Claim memory cl = escrow.getClaim(escrowId);
        assertEq(uint(cl.status), uint(HealthInsuranceEscrow.ClaimStatus.FRAUD_FLAG));
    }

    function test_AIRoutsToHumanReviewMidConfidence() public {
        vm.prank(hospital);
        uint256 escrowId = escrow.submitClaim("CLM-001", insurer, keccak256("diag"), keccak256("proc"), 1000);

        vm.prank(aiEngine);
        escrow.setAIVerification(escrowId, 70); // Between 50 and 85

        HealthInsuranceEscrow.Claim memory cl = escrow.getClaim(escrowId);
        assertEq(uint(cl.status), uint(HealthInsuranceEscrow.ClaimStatus.HUMAN_REVIEW));
    }

    function test_ManualReviewApprove() public {
        vm.prank(hospital);
        uint256 escrowId = escrow.submitClaim("CLM-001", insurer, keccak256("diag"), keccak256("proc"), 1000);

        vm.prank(aiEngine);
        escrow.setAIVerification(escrowId, 70);

        vm.prank(adjuster);
        escrow.manualReview(escrowId, true);

        HealthInsuranceEscrow.Claim memory cl = escrow.getClaim(escrowId);
        assertEq(uint(cl.status), uint(HealthInsuranceEscrow.ClaimStatus.AI_APPROVED));
    }

    function test_ManualReviewDeny() public {
        vm.prank(hospital);
        uint256 escrowId = escrow.submitClaim("CLM-001", insurer, keccak256("diag"), keccak256("proc"), 1000);

        vm.prank(aiEngine);
        escrow.setAIVerification(escrowId, 70);

        vm.prank(adjuster);
        escrow.manualReview(escrowId, false);

        HealthInsuranceEscrow.Claim memory cl = escrow.getClaim(escrowId);
        assertEq(uint(cl.status), uint(HealthInsuranceEscrow.ClaimStatus.DENIED));
    }

    function test_ReleasePayout() public {
        vm.prank(hospital);
        uint256 escrowId = escrow.submitClaim("CLM-001", insurer, keccak256("diag"), keccak256("proc"), 5000);

        vm.prank(aiEngine);
        escrow.setAIVerification(escrowId, 95);

        vm.prank(adjuster);
        escrow.releasePayout(escrowId);

        HealthInsuranceEscrow.Claim memory cl = escrow.getClaim(escrowId);
        assertEq(uint(cl.status), uint(HealthInsuranceEscrow.ClaimStatus.PAID));
        assertEq(escrow.totalPaidOut(), 5000);
    }

    function test_ReleasePayoutRevertsIfNotApproved() public {
        vm.prank(hospital);
        uint256 escrowId = escrow.submitClaim("CLM-001", insurer, keccak256("diag"), keccak256("proc"), 1000);

        vm.prank(adjuster);
        vm.expectRevert("HealthInsuranceEscrow: not approved");
        escrow.releasePayout(escrowId);
    }
}
