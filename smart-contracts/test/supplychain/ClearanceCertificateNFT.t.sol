// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/ClearanceCertificateNFT.sol";

contract ClearanceCertificateNFTTest is Test {

    ClearanceCertificateNFT public cert;
    
    address admin = address(0x1);
    address minter = address(0x2);
    address owner = address(0x3);
    address transferee = address(0x4);

    bytes32 HS_ELECTRONICS = keccak256("8471.30.00");

    function setUp() public {
        vm.startPrank(admin);
        cert = new ClearanceCertificateNFT();
        cert.grantRole(cert.MINTER_ROLE(), minter);
        vm.stopPrank();
    }

    // ──── CERTIFICATE ISSUANCE TESTS ───────────────────────────

    function test_issueClearanceCertificate() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            1,
            HS_ELECTRONICS,
            "Laptop Computers & Accessories",
            100000,
            0,
            "CN",
            "ES",
            "AduanaEasy",
            owner,
            90,
            "ipfs://QmCertificateMetadata"
        );

        assertEq(tokenId, 0); // First token ID
        assertEq(cert.ownerOf(tokenId), owner);
    }

    function test_certificateMetadataStorage() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            2,
            HS_ELECTRONICS,
            "Laptop Computers",
            150000,
            0,
            "US",
            "DE",
            "TradeGo",
            owner,
            60,
            "ipfs://QmMetadata"
        );

        ClearanceCertificateNFT.CertificateMetadata memory metadata = 
            cert.getCertificateDetails(tokenId);
        
        assertEq(metadata.shipmentId, 2);
        assertEq(metadata.cargoValue, 150000);
        assertEq(metadata.declaredDuty, 0);
        assertEq(metadata.originCountry, "US");
        assertEq(metadata.destinationCountry, "DE");
        assertTrue(metadata.isActive);
    }

    function test_multipleCertificatesIssuance() public {
        vm.startPrank(minter);
        
        uint256 tokenId1 = cert.issueClearanceCertificate(
            1, HS_ELECTRONICS, "Cargo 1", 100000, 0, "CN", "ES", "AduanaEasy",
            owner, 90, "ipfs://Metadata1"
        );
        
        uint256 tokenId2 = cert.issueClearanceCertificate(
            2, HS_ELECTRONICS, "Cargo 2", 200000, 0, "US", "FR", "TradeGo",
            owner, 60, "ipfs://Metadata2"
        );
        
        vm.stopPrank();

        assertEq(tokenId1, 0);
        assertEq(tokenId2, 1);
        assertEq(cert.totalCertificatesIssued(), 2);
    }

    // ──── CERTIFICATE VALIDITY TESTS ────────────────────────

    function test_isCertificateValid() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            3, HS_ELECTRONICS, "Valid Certificate", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://Valid"
        );

        assertTrue(cert.isCertificateValid(tokenId));
    }

    function test_certificateExpiration() public {
        // Create certificate valid for 1 day only
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            4, HS_ELECTRONICS, "Short Live", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 1, "ipfs://ShortLive"
        );

        assertTrue(cert.isCertificateValid(tokenId));

        // Fast forward time beyond expiration
        vm.warp(block.timestamp + 2 days);

        assertFalse(cert.isCertificateValid(tokenId));
    }

    function test_getDaysUntilExpiration() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            5, HS_ELECTRONICS, "Expiring", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 30, "ipfs://Expiring"
        );

        int256 daysRemaining = cert.getDaysUntilExpiration(tokenId);
        assertGt(daysRemaining, 29);
        assertLe(daysRemaining, 30);
    }

    function test_daysUntilExpirationNegativeWhenExpired() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            6, HS_ELECTRONICS, "Already Expired", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 1, "ipfs://Expired"
        );

        // Fast forward to expiration
        vm.warp(block.timestamp + 2 days);

        int256 daysRemaining = cert.getDaysUntilExpiration(tokenId);
        assertEq(daysRemaining, -1); // -1 indicates expired
    }

    // ──── CERTIFICATE REVOCATION TESTS ──────────────────────

    function test_revokeCertificate() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            7, HS_ELECTRONICS, "To Revoke", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://Revoke"
        );

        assertTrue(cert.isCertificateValid(tokenId));

        vm.prank(minter);
        cert.revokeCertificate(tokenId, "Customs fraud detected");

        assertFalse(cert.isCertificateValid(tokenId));
    }

    // ──── SHIPMENT TO CERTIFICATE MAPPING TESTS ────────────

    function test_getCertificateByShipment() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            8, HS_ELECTRONICS, "Shipment Linked", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://Linked"
        );

        (uint256 retrievedTokenId, ClearanceCertificateNFT.CertificateMetadata memory metadata) = 
            cert.getCertificateByShipment(8);
        
        assertEq(retrievedTokenId, tokenId);
        assertEq(metadata.shipmentId, 8);
    }

    function test_isShipmentCleared() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            9, HS_ELECTRONICS, "Cleared Shipment", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://Cleared"
        );

        assertTrue(cert.isShipmentCleared(9));

        // Revoke the certificate
        vm.prank(minter);
        cert.revokeCertificate(tokenId, "Revoked");

        assertFalse(cert.isShipmentCleared(9));
    }

    // ──── USER CERTIFICATES TESTS ──────────────────────────

    function test_getUserCertificates() public {
        vm.startPrank(minter);
        
        uint256 id1 = cert.issueClearanceCertificate(
            10, HS_ELECTRONICS, "User Cert 1", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://1"
        );
        
        uint256 id2 = cert.issueClearanceCertificate(
            11, HS_ELECTRONICS, "User Cert 2", 200000, 0,
            "US", "FR", "TradeGo", owner, 60, "ipfs://2"
        );
        
        vm.stopPrank();

        uint256[] memory userCerts = cert.getUserCertificates(owner);
        
        assertEq(userCerts.length, 2);
        assertEq(userCerts[0], id1);
        assertEq(userCerts[1], id2);
    }

    // ──── TOKEN URI TESTS ────────────────────────────────────

    function test_tokenURI() public {
        string memory metadataUri = "ipfs://QmTokenMetadata";
        
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            12, HS_ELECTRONICS, "URI Test", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, metadataUri
        );

        string memory uri = cert.tokenURI(tokenId);
        assertEq(uri, metadataUri);
    }

    // ──── TRANSFER TESTS ────────────────────────────────────

    function test_transferCertificate() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            13, HS_ELECTRONICS, "Transferable", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://Transfer"
        );

        vm.prank(owner);
        cert.transferFrom(owner, transferee, tokenId);

        assertEq(cert.ownerOf(tokenId), transferee);
    }

    function test_userCertificatesUpdatedOnTransfer() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            14, HS_ELECTRONICS, "Transfer Update", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://Update"
        );

        uint256[] memory ownerCerts = cert.getUserCertificates(owner);
        assertEq(ownerCerts.length, 1);

        vm.prank(owner);
        cert.transferFrom(owner, transferee, tokenId);

        uint256[] memory transfereeCerts = cert.getUserCertificates(transferee);
        assertEq(transfereeCerts.length, 1);
        assertEq(transfereeCerts[0], tokenId);
    }

    // ──── DUTY AND CARGO VALUE TRACKING TESTS ───────────────

    function test_dutyAndCargoTracking() public {
        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            15, HS_ELECTRONICS, "Duty Test", 500000, 12500,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://Duty"
        );

        ClearanceCertificateNFT.CertificateMetadata memory metadata = 
            cert.getCertificateDetails(tokenId);
        
        assertEq(metadata.cargoValue, 500000);
        assertEq(metadata.declaredDuty, 12500);
    }

    // ──── ORIGIN AND DESTINATION TRACKING TESTS ─────────────

    function test_tradeRouteTracking() public {
        string memory origin = "CN-SHANGHAI";
        string memory destination = "ES-BARCELONA";

        vm.prank(minter);
        uint256 tokenId = cert.issueClearanceCertificate(
            16, HS_ELECTRONICS, "Route", 100000, 0,
            origin, destination, "AduanaEasy", owner, 90, "ipfs://Route"
        );

        ClearanceCertificateNFT.CertificateMetadata memory metadata = 
            cert.getCertificateDetails(tokenId);
        
        assertEq(metadata.originCountry, origin);
        assertEq(metadata.destinationCountry, destination);
    }

    // ──── PLATFORM TRACKING TESTS ────────────────────────────

    function test_platformAssociation() public {
        vm.startPrank(minter);
        
        uint256 id1 = cert.issueClearanceCertificate(
            17, HS_ELECTRONICS, "Aduanas", 100000, 0,
            "CN", "ES", "AduanaEasy", owner, 90, "ipfs://1"
        );
        
        uint256 id2 = cert.issueClearanceCertificate(
            18, HS_ELECTRONICS, "TradeGo", 100000, 0,
            "US", "DE", "TradeGo", owner, 60, "ipfs://2"
        );
        
        vm.stopPrank();

        ClearanceCertificateNFT.CertificateMetadata memory meta1 = 
            cert.getCertificateDetails(id1);
        ClearanceCertificateNFT.CertificateMetadata memory meta2 = 
            cert.getCertificateDetails(id2);
        
        assertEq(meta1.customsPlatform, "AduanaEasy");
        assertEq(meta2.customsPlatform, "TradeGo");
    }
}
