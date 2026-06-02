// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/automotive/EVChargeToken.sol";

contract EVChargeTokenTest is Test {
    EVChargeToken charger;
    address admin = address(1);
    address driver1 = address(2);
    address driver2 = address(3);

    function setUp() public {
        vm.startPrank(admin);
        charger = new EVChargeToken(admin);
        vm.stopPrank();
        vm.deal(driver1, 100 ether);
        vm.deal(driver2, 100 ether);
    }

    function testRegisterStation() public {
        vm.startPrank(admin);
        uint256 id = charger.registerStation("STN-EU-001", "Barcelona Hub", 350, 1e15);
        vm.stopPrank();

        assertEq(charger.totalStations(), 1);
        (address op,,,,,) = charger.stations(id);
        assertEq(op, admin);
    }

    function testRegisterStationZeroPowerReverts() public {
        vm.startPrank(admin);
        vm.expectRevert("Power must be > 0");
        charger.registerStation("STN-BAD", "Bad Station", 0, 1e15);
        vm.stopPrank();
    }

    function testStartSession() public {
        vm.startPrank(admin);
        uint256 stnId = charger.registerStation("STN-US-001", "Austin Plaza", 350, 1e15);
        uint256 sessId = charger.startSession(stnId, driver1);
        vm.stopPrank();

        assertEq(charger.totalSessions(), 1);
        (, address drv,,,,,,) = charger.sessions(sessId);
        assertEq(drv, driver1);
    }

    function testStartSessionInactiveStationReverts() public {
        vm.startPrank(admin);
        uint256 stnId = charger.registerStation("STN-DE-001", "Munich Park", 250, 1e15);
        charger.setStationStatus(stnId, false);
        vm.expectRevert("Station not active");
        charger.startSession(stnId, driver1);
        vm.stopPrank();
    }

    function testEndSession() public {
        vm.startPrank(admin);
        uint256 stnId = charger.registerStation("STN-JP-001", "Tokyo Odaiba", 400, 1e15); // 1e15 wei per kWh
        uint256 sessId = charger.startSession(stnId, driver1);
        charger.endSession(sessId, 50000, keccak256("meter-reading-50kwh")); // 50000 millikWh = 50 kWh
        vm.stopPrank();

        (,, uint256 kwh, uint256 cost,,,,) = charger.sessions(sessId);
        assertEq(kwh, 50000);
        // cost = (50000 * 1e15) / 1e3 = 50e15 = 0.05 ether
        assertEq(cost, 50e15);
    }

    function testEndSessionZeroKwhReverts() public {
        vm.startPrank(admin);
        uint256 stnId = charger.registerStation("STN-MX-001", "CDMX Hub", 150, 1e15);
        uint256 sessId = charger.startSession(stnId, driver1);
        vm.expectRevert("Must deliver energy");
        charger.endSession(sessId, 0, bytes32(0));
        vm.stopPrank();
    }

    function testSettleSession() public {
        vm.startPrank(admin);
        uint256 stnId = charger.registerStation("STN-SETTLE", "Test Station", 200, 1e15);
        uint256 sessId = charger.startSession(stnId, driver1);
        charger.endSession(sessId, 30000, keccak256("meter-30kwh")); // 30 kWh => cost = 30e15
        vm.stopPrank();

        vm.startPrank(driver1);
        charger.settleSession{value: 30e15}(sessId);
        vm.stopPrank();

        (,,,,,,, EVChargeToken.SessionStatus status) = charger.sessions(sessId);
        assertEq(uint256(status), uint256(EVChargeToken.SessionStatus.SETTLED));
    }

    function testSettleInsufficientPaymentReverts() public {
        vm.startPrank(admin);
        uint256 stnId = charger.registerStation("STN-FAIL", "Fail Station", 200, 1e15);
        uint256 sessId = charger.startSession(stnId, driver1);
        charger.endSession(sessId, 40000, keccak256("meter-40kwh")); // cost = 40e15
        vm.stopPrank();

        vm.startPrank(driver1);
        vm.expectRevert("Insufficient payment");
        charger.settleSession{value: 10e15}(sessId); // Not enough
        vm.stopPrank();
    }

    function testWithdrawRevenue() public {
        vm.startPrank(admin);
        uint256 stnId = charger.registerStation("STN-WITHDRAW", "W Station", 150, 1e15);
        uint256 sessId = charger.startSession(stnId, driver1);
        charger.endSession(sessId, 20000, keccak256("meter-20kwh")); // cost = 20e15
        vm.stopPrank();

        vm.startPrank(driver1);
        charger.settleSession{value: 20e15}(sessId);
        vm.stopPrank();

        uint256 balBefore = admin.balance;
        vm.startPrank(admin);
        charger.withdrawRevenue();
        vm.stopPrank();

        assertEq(admin.balance, balBefore + 20e15);
    }

    function testSetStationStatus() public {
        vm.startPrank(admin);
        uint256 stnId = charger.registerStation("STN-STATUS", "Status Station", 100, 1e15);
        charger.setStationStatus(stnId, false);
        vm.stopPrank();

        (,,,,, bool active) = charger.stations(stnId);
        assertFalse(active);
    }
}
