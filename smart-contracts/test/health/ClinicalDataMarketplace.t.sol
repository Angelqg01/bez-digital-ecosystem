// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ClinicalDataMarketplace} from "../../src/health/ClinicalDataMarketplace.sol";

contract ClinicalDataMarketplaceTest is Test {
    ClinicalDataMarketplace public marketplace;
    address public admin = address(1);
    address public sponsor = address(2);
    address public researcher = address(3);
    address public patient = address(4);
    address public buyer = address(5);
    address public unauthorized = address(6);

    function setUp() public {
        vm.startPrank(admin);
        marketplace = new ClinicalDataMarketplace();
        marketplace.grantRole(marketplace.SPONSOR_ROLE(), sponsor);
        marketplace.grantRole(marketplace.RESEARCHER_ROLE(), researcher);
        vm.stopPrank();
    }

    function test_RegisterTrial() public {
        vm.prank(sponsor);
        uint256 trialId = marketplace.registerTrial("CT-001", "Phase III mRNA Vaccine", 3, 1200, block.timestamp, block.timestamp + 365 days);

        ClinicalDataMarketplace.ClinicalTrial memory trial = marketplace.getTrial(trialId);
        assertEq(keccak256(bytes(trial.trialId)), keccak256(bytes("CT-001")));
        assertEq(trial.phase, 3);
        assertEq(trial.targetEnrollment, 1200);
        assertEq(marketplace.totalTrials(), 1);
    }

    function test_RegisterTrialRevertsInvalidPhase() public {
        vm.prank(sponsor);
        vm.expectRevert("ClinicalDataMarketplace: invalid phase");
        marketplace.registerTrial("CT-002", "Bad Phase", 5, 100, block.timestamp, block.timestamp + 365 days);
    }

    function test_SignConsent() public {
        vm.prank(sponsor);
        uint256 trialId = marketplace.registerTrial("CT-001", "Trial", 2, 500, block.timestamp, block.timestamp + 365 days);

        vm.prank(patient);
        uint256 consentId = marketplace.signConsent(trialId, keccak256("consent-form"), true);

        ClinicalDataMarketplace.PatientConsent memory consent = marketplace.getConsent(consentId);
        assertEq(consent.patient, patient);
        assertTrue(consent.allowMarketplace);
        assertTrue(consent.active);
        assertEq(marketplace.totalConsents(), 1);

        ClinicalDataMarketplace.ClinicalTrial memory trial = marketplace.getTrial(trialId);
        assertEq(trial.currentEnrollment, 1);
    }

    function test_RevokeConsent() public {
        vm.prank(sponsor);
        uint256 trialId = marketplace.registerTrial("CT-001", "Trial", 2, 500, block.timestamp, block.timestamp + 365 days);

        vm.prank(patient);
        uint256 consentId = marketplace.signConsent(trialId, keccak256("consent"), true);

        vm.prank(patient);
        marketplace.revokeConsent(consentId);

        ClinicalDataMarketplace.PatientConsent memory consent = marketplace.getConsent(consentId);
        assertFalse(consent.active);
    }

    function test_RevokeConsentRevertsNotPatient() public {
        vm.prank(sponsor);
        uint256 trialId = marketplace.registerTrial("CT-001", "Trial", 2, 500, block.timestamp, block.timestamp + 365 days);

        vm.prank(patient);
        uint256 consentId = marketplace.signConsent(trialId, keccak256("consent"), true);

        vm.prank(unauthorized);
        vm.expectRevert("ClinicalDataMarketplace: not patient");
        marketplace.revokeConsent(consentId);
    }

    function test_TokenizeDataset() public {
        vm.prank(sponsor);
        uint256 trialId = marketplace.registerTrial("CT-001", "Trial", 2, 500, block.timestamp, block.timestamp + 365 days);

        vm.prank(researcher);
        uint256 tokenId = marketplace.tokenizeDataset(trialId, "Cognitive Assessment", 2541, keccak256("zk-proof"), keccak256("data"), 8);

        ClinicalDataMarketplace.DataToken memory dt = marketplace.getDataToken(tokenId);
        assertEq(dt.recordCount, 2541);
        assertEq(dt.pricePerRecord, 8);
        assertFalse(dt.zkVerified);
        assertEq(marketplace.totalDataTokens(), 1);
    }

    function test_PurchaseDataAccessRequiresZKVerification() public {
        vm.prank(sponsor);
        uint256 trialId = marketplace.registerTrial("CT-001", "Trial", 2, 500, block.timestamp, block.timestamp + 365 days);

        vm.prank(researcher);
        uint256 tokenId = marketplace.tokenizeDataset(trialId, "Lab Results", 1000, keccak256("zk"), keccak256("data"), 5);

        // Should fail - not ZK verified yet
        vm.prank(buyer);
        vm.expectRevert("ClinicalDataMarketplace: not ZK-verified");
        marketplace.purchaseDataAccess(tokenId);
    }

    function test_PurchaseDataAccessSuccess() public {
        vm.prank(sponsor);
        uint256 trialId = marketplace.registerTrial("CT-001", "Trial", 2, 500, block.timestamp, block.timestamp + 365 days);

        vm.prank(researcher);
        uint256 tokenId = marketplace.tokenizeDataset(trialId, "Lab Results", 1000, keccak256("zk"), keccak256("data"), 5);

        // Admin verifies ZK proof
        vm.prank(admin);
        marketplace.setZKVerified(tokenId, true);

        // Now purchase succeeds
        vm.prank(buyer);
        assertTrue(marketplace.purchaseDataAccess(tokenId));

        assertEq(marketplace.dataTokenPurchases(tokenId), 1);
        assertEq(marketplace.totalMarketplaceRevenue(), 5000); // 1000 * 5
    }
}
