// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/entertainment/StreamingRightsMarket.sol";

contract StreamingRightsMarketTest is Test {
    StreamingRightsMarket public market;
    address public admin       = address(this);
    address public rightHolder = address(0xA1);
    address public licensee    = address(0xB1);
    address public anyone      = address(0xC1);

    function setUp() public {
        market = new StreamingRightsMarket();
        market.grantRole(market.REGISTRAR_ROLE(), admin);
        market.grantRole(market.REGISTRAR_ROLE(), rightHolder);
        vm.deal(rightHolder, 50 ether);
        vm.deal(licensee, 50 ether);
        vm.deal(anyone, 10 ether);
    }

    // ── registerIP ───────────────────────────────────────────────────

    function testRegisterIP() public {
        vm.prank(rightHolder);
        uint256 id = market.registerIP("Neon Nights", StreamingRightsMarket.MediaType.FILM, "ipfs://QmNeon");

        StreamingRightsMarket.IntellectualProperty memory ip = market.getIP(id);
        assertEq(ip.title, "Neon Nights");
        assertEq(ip.rightHolder, rightHolder);
        assertEq(uint(ip.mediaType), uint(StreamingRightsMarket.MediaType.FILM));
        assertEq(ip.metadataURI, "ipfs://QmNeon");
        assertTrue(ip.active);
        assertEq(ip.totalLicenses, 0);
    }

    // ── createLicense ────────────────────────────────────────────────

    function testCreateLicense() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Series X", StreamingRightsMarket.MediaType.SERIES, "ipfs://QmX");

        vm.prank(rightHolder);
        uint256 lid = market.createLicense{value: 5 ether}(
            ipId, licensee, block.timestamp, block.timestamp + 365 days, "LATAM", 1000000
        );

        StreamingRightsMarket.License memory l = market.getLicense(lid);
        assertEq(l.ipId, ipId);
        assertEq(l.licensee, licensee);
        assertEq(l.pricePaid, 5 ether);
        assertEq(l.streamCap, 1000000);
        assertEq(l.streamsUsed, 0);
        assertEq(uint(l.status), uint(StreamingRightsMarket.LicenseStatus.ACTIVE));
        assertEq(market.getIPLicenseCount(ipId), 1);
    }

    function testCreateLicenseRevertInactivIP() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Old Film", StreamingRightsMarket.MediaType.FILM, "ipfs://old");

        vm.prank(rightHolder);
        market.deactivateIP(ipId);

        vm.prank(rightHolder);
        vm.expectRevert("IP not active");
        market.createLicense(ipId, licensee, block.timestamp, block.timestamp + 30 days, "EU", 0);
    }

    function testCreateLicenseRevertInvalidLicensee() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Film", StreamingRightsMarket.MediaType.FILM, "ipfs://f");

        vm.prank(rightHolder);
        vm.expectRevert("Invalid licensee");
        market.createLicense(ipId, address(0), block.timestamp, block.timestamp + 30 days, "GLOBAL", 0);
    }

    function testCreateLicenseRevertBadDates() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Film", StreamingRightsMarket.MediaType.FILM, "ipfs://f");

        vm.prank(rightHolder);
        vm.expectRevert("End must be after start");
        market.createLicense(ipId, licensee, block.timestamp + 100, block.timestamp + 50, "GLOBAL", 0);
    }

    // ── reportStreams ────────────────────────────────────────────────

    function testReportStreams() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Album Y", StreamingRightsMarket.MediaType.MUSIC_ALBUM, "ipfs://Y");

        vm.prank(rightHolder);
        uint256 lid = market.createLicense(ipId, licensee, block.timestamp, block.timestamp + 180 days, "GLOBAL", 500000);

        market.reportStreams(lid, 100000);

        StreamingRightsMarket.License memory l = market.getLicense(lid);
        assertEq(l.streamsUsed, 100000);
        assertEq(market.getLicenseReportCount(lid), 1);
    }

    function testReportStreamsRevertExceedsCap() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Album", StreamingRightsMarket.MediaType.MUSIC_ALBUM, "ipfs://a");

        vm.prank(rightHolder);
        uint256 lid = market.createLicense(ipId, licensee, block.timestamp, block.timestamp + 180 days, "EU", 1000);

        market.reportStreams(lid, 900);

        vm.expectRevert("Exceeds stream cap");
        market.reportStreams(lid, 200);
    }

    function testReportStreamsUnlimited() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Podcast Z", StreamingRightsMarket.MediaType.PODCAST, "ipfs://z");

        vm.prank(rightHolder);
        uint256 lid = market.createLicense(ipId, licensee, block.timestamp, block.timestamp + 365 days, "GLOBAL", 0); // unlimited

        market.reportStreams(lid, 999999999);
        StreamingRightsMarket.License memory l = market.getLicense(lid);
        assertEq(l.streamsUsed, 999999999);
    }

    // ── revokeLicense ────────────────────────────────────────────────

    function testRevokeLicense() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Live Event", StreamingRightsMarket.MediaType.LIVE_EVENT, "ipfs://le");

        vm.prank(rightHolder);
        uint256 lid = market.createLicense(ipId, licensee, block.timestamp, block.timestamp + 30 days, "LATAM", 50000);

        vm.prank(rightHolder);
        market.revokeLicense(lid);

        StreamingRightsMarket.License memory l = market.getLicense(lid);
        assertEq(uint(l.status), uint(StreamingRightsMarket.LicenseStatus.REVOKED));
    }

    function testRevokeLicenseRevertNotActive() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Show", StreamingRightsMarket.MediaType.LIVE_EVENT, "ipfs://s");

        vm.prank(rightHolder);
        uint256 lid = market.createLicense(ipId, licensee, block.timestamp, block.timestamp + 30 days, "EU", 0);

        vm.startPrank(rightHolder);
        market.revokeLicense(lid);
        vm.expectRevert("Not active");
        market.revokeLicense(lid);
        vm.stopPrank();
    }

    // ── withdrawRevenue ──────────────────────────────────────────────

    function testWithdrawRevenue() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Hit Film", StreamingRightsMarket.MediaType.FILM, "ipfs://hit");

        vm.prank(rightHolder);
        market.createLicense{value: 10 ether}(ipId, licensee, block.timestamp, block.timestamp + 365 days, "GLOBAL", 0);

        uint256 balBefore = rightHolder.balance;
        vm.prank(rightHolder);
        market.withdrawRevenue(ipId, 5 ether);

        assertEq(rightHolder.balance, balBefore + 5 ether);
    }

    function testWithdrawRevenueRevertNotHolder() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Film", StreamingRightsMarket.MediaType.FILM, "ipfs://f");

        vm.prank(anyone);
        vm.expectRevert("Not right holder");
        market.withdrawRevenue(ipId, 1 ether);
    }

    // ── deactivateIP ─────────────────────────────────────────────────

    function testDeactivateIP() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Old IP", StreamingRightsMarket.MediaType.PODCAST, "ipfs://old");

        vm.prank(rightHolder);
        market.deactivateIP(ipId);

        StreamingRightsMarket.IntellectualProperty memory ip = market.getIP(ipId);
        assertFalse(ip.active);
    }

    function testDeactivateRevertNotAuthorized() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("IP", StreamingRightsMarket.MediaType.FILM, "ipfs://ip");

        vm.prank(anyone);
        vm.expectRevert("Not authorized");
        market.deactivateIP(ipId);
    }

    function testMultipleLicensesAccumulateRevenue() public {
        vm.prank(rightHolder);
        uint256 ipId = market.registerIP("Popular Film", StreamingRightsMarket.MediaType.FILM, "ipfs://pf");

        vm.prank(rightHolder);
        market.createLicense{value: 5 ether}(ipId, licensee, block.timestamp, block.timestamp + 180 days, "LATAM", 0);

        vm.prank(rightHolder);
        market.createLicense{value: 3 ether}(ipId, anyone, block.timestamp, block.timestamp + 180 days, "EU", 0);

        StreamingRightsMarket.IntellectualProperty memory ip = market.getIP(ipId);
        assertEq(ip.totalLicenses, 2);
        assertEq(ip.totalRevenue, 8 ether);
    }
}
