// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/energy/SolarFarmToken.sol";

contract SolarFarmTokenTest is Test {
    SolarFarmToken sft;
    address admin = address(1);
    address operator = address(2);
    address investor1 = address(3);
    address investor2 = address(4);

    function setUp() public {
        vm.startPrank(admin);
        sft = new SolarFarmToken(admin);
        sft.grantRole(sft.OPERATOR_ROLE(), operator);
        vm.stopPrank();

        vm.deal(investor1, 100 ether);
        vm.deal(investor2, 100 ether);
        vm.deal(operator, 100 ether);
    }

    function testRegisterFarm() public {
        vm.startPrank(operator);
        uint256 id = sft.registerFarm("Andalucia Solar", "SOLAR", "Sevilla, ES", 150, 1500000, 1e15);
        vm.stopPrank();

        assertEq(id, 0);
        (string memory name,,,uint256 cap, uint256 supply, uint256 price, uint256 goal, uint256 funded, SolarFarmToken.FarmStatus status) = sft.farms(0);
        assertEq(cap, 150);
        assertEq(supply, 1500000);
        assertEq(price, 1e15);
        assertEq(goal, 1500000 * 1e15);
        assertEq(funded, 0);
        assertEq(uint(status), uint(SolarFarmToken.FarmStatus.FUNDING));
        assertGt(bytes(name).length, 0);
    }

    function testRegisterFarmZeroCapacityReverts() public {
        vm.startPrank(operator);
        vm.expectRevert("Zero capacity");
        sft.registerFarm("X", "SOLAR", "X", 0, 1000, 1e15);
        vm.stopPrank();
    }

    function testInvestInFarm() public {
        vm.startPrank(operator);
        sft.registerFarm("TestFarm", "WIND", "Galicia", 80, 100000, 1e15);
        vm.stopPrank();

        vm.startPrank(investor1);
        sft.investInFarm{value: 100 * 1e15}(0, 100);
        vm.stopPrank();

        assertEq(sft.balanceOf(investor1, 0), 100);
        (,,,,,,, uint256 funded,) = sft.farms(0);
        assertEq(funded, 100 * 1e15);
    }

    function testInvestNotFundingReverts() public {
        vm.startPrank(operator);
        sft.registerFarm("TestFarm", "SOLAR", "Test", 50, 1000, 1e15);
        sft.setFarmStatus(0, SolarFarmToken.FarmStatus.PRODUCING);
        vm.stopPrank();

        vm.startPrank(investor1);
        vm.expectRevert("Not in funding");
        sft.investInFarm{value: 10 * 1e15}(0, 10);
        vm.stopPrank();
    }

    function testSetFarmStatus() public {
        vm.startPrank(operator);
        sft.registerFarm("TestFarm", "HYDRO", "Huesca", 12, 10000, 1e15);
        sft.setFarmStatus(0, SolarFarmToken.FarmStatus.PRODUCING);
        vm.stopPrank();

        (,,,,,,,, SolarFarmToken.FarmStatus status) = sft.farms(0);
        assertEq(uint(status), uint(SolarFarmToken.FarmStatus.PRODUCING));
    }

    function testDistributeDividends() public {
        vm.startPrank(operator);
        sft.registerFarm("DivFarm", "SOLAR", "Badajoz", 100, 1000, 1e15);
        sft.setFarmStatus(0, SolarFarmToken.FarmStatus.PRODUCING);
        sft.distributeDividends{value: 10 ether}(0);
        vm.stopPrank();

        assertEq(sft.getDividendRounds(0), 1);
        assertEq(sft.totalDividendsPaid(), 10 ether);
    }

    function testDistributeDividendsNotProducingReverts() public {
        vm.startPrank(operator);
        sft.registerFarm("X", "WIND", "X", 10, 100, 1e15);
        vm.expectRevert("Not producing");
        sft.distributeDividends{value: 1 ether}(0);
        vm.stopPrank();
    }

    function testClaimDividends() public {
        vm.startPrank(operator);
        sft.registerFarm("ClaimFarm", "SOLAR", "Sevilla", 100, 1000, 1e15);
        vm.stopPrank();

        // Invest
        vm.startPrank(investor1);
        sft.investInFarm{value: 50 * 1e15}(0, 50);
        vm.stopPrank();

        // Start producing and distribute
        vm.startPrank(operator);
        sft.setFarmStatus(0, SolarFarmToken.FarmStatus.PRODUCING);
        sft.distributeDividends{value: 10 ether}(0);
        vm.stopPrank();

        // perToken = 10 ether / 1000 = 0.01 ether
        // investor1 has 50 tokens -> 50 * 0.01 = 0.5 ether
        uint256 balBefore = investor1.balance;
        vm.startPrank(investor1);
        sft.claimDividends(0);
        vm.stopPrank();

        assertEq(investor1.balance, balBefore + 50 * (10 ether / 1000));
    }

    function testClaimNoTokensReverts() public {
        vm.startPrank(operator);
        sft.registerFarm("X", "SOLAR", "X", 10, 100, 1e15);
        sft.setFarmStatus(0, SolarFarmToken.FarmStatus.PRODUCING);
        sft.distributeDividends{value: 1 ether}(0);
        vm.stopPrank();

        vm.startPrank(investor2);
        vm.expectRevert("No tokens held");
        sft.claimDividends(0);
        vm.stopPrank();
    }
}
