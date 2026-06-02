// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/agriculture/AquaFarmMonitor.sol";

contract AquaFarmMonitorTest is Test {
    AquaFarmMonitor public aqua;
    address public admin    = address(this);
    address public operator = address(0xB1);
    address public oracle   = address(0xB2);

    function setUp() public {
        aqua = new AquaFarmMonitor();
        aqua.grantRole(aqua.OPERATOR_ROLE(), operator);
        aqua.grantRole(aqua.ORACLE_ROLE(), oracle);
    }

    function testRegisterTank() public {
        vm.prank(operator);
        uint256 id = aqua.registerTank("Estanque Alpha", "Tilapia Nilotica", 15000);

        (string memory name, string memory species, uint256 cap, uint256 stock, address op, bool active) = aqua.getTank(id);
        assertEq(name, "Estanque Alpha");
        assertEq(species, "Tilapia Nilotica");
        assertEq(cap, 15000);
        assertEq(stock, 0);
        assertEq(op, operator);
        assertTrue(active);
    }

    function testRegisterTankRevertsZeroCapacity() public {
        vm.prank(operator);
        vm.expectRevert("Capacity must be > 0");
        aqua.registerTank("Bad Tank", "None", 0);
    }

    function testStockTank() public {
        vm.startPrank(operator);
        uint256 id = aqua.registerTank("Estanque Bravo", "Camaron Blanco", 8000);
        aqua.stockTank(id, 5000);
        vm.stopPrank();

        (,,, uint256 stock,,) = aqua.getTank(id);
        assertEq(stock, 5000);
    }

    function testStockTankRevertsExceedsCapacity() public {
        vm.startPrank(operator);
        uint256 id = aqua.registerTank("Small Tank", "Trucha", 100);
        vm.expectRevert("Exceeds capacity");
        aqua.stockTank(id, 200);
        vm.stopPrank();
    }

    function testLogReading() public {
        vm.prank(operator);
        uint256 id = aqua.registerTank("Hydro Bay 1", "Salmon Atlantico", 20000);

        vm.prank(oracle);
        aqua.logReading(id, 690, 810, 1250, 100); // pH 6.90, O2 8.10, Temp 12.50°C, NH3 0.0100

        assertEq(aqua.tankReadingCount(id), 1);
        assertEq(aqua.totalReadings(), 1);

        (uint256 tId, uint256 ph, uint256 o2, uint256 temp, uint256 amm,) = aqua.readings(0);
        assertEq(tId, id);
        assertEq(ph, 690);
        assertEq(o2, 810);
        assertEq(temp, 1250);
        assertEq(amm, 100);
    }

    function testSetThresholds() public {
        vm.prank(operator);
        uint256 id = aqua.registerTank("Estanque Delta", "Trucha Arcoiris", 10000);

        vm.prank(operator);
        aqua.setThresholds(id, 1800, 500, 600, 650, 800); // maxTemp 18°C, minO2 5.00, maxNH3 0.0600, pH 6.50-8.00

        (uint256 maxT, uint256 minO2, uint256 maxAmm, uint256 minPh, uint256 maxPh) = aqua.thresholds(id);
        assertEq(maxT, 1800);
        assertEq(minO2, 500);
        assertEq(maxAmm, 600);
        assertEq(minPh, 650);
        assertEq(maxPh, 800);
    }

    function testHarvestTank() public {
        vm.startPrank(operator);
        uint256 id = aqua.registerTank("Shrimp Pod 3", "Langostino Azul", 6000);
        aqua.stockTank(id, 4000);
        aqua.harvestTank(id, 2500);
        vm.stopPrank();

        (,,, uint256 stock,,) = aqua.getTank(id);
        assertEq(stock, 1500);
        assertEq(aqua.totalHarvested(), 2500);
    }

    function testHarvestTankRevertsNotEnoughStock() public {
        vm.startPrank(operator);
        uint256 id = aqua.registerTank("Mini Tank", "Pez Payaso", 500);
        aqua.stockTank(id, 100);
        vm.expectRevert("Not enough stock");
        aqua.harvestTank(id, 200);
        vm.stopPrank();
    }

    function testMultipleReadingsWithAlert() public {
        vm.prank(operator);
        uint256 id = aqua.registerTank("Alert Tank", "Tilapia", 10000);

        vm.prank(operator);
        aqua.setThresholds(id, 3000, 500, 600, 650, 800); // maxTemp 30°C

        vm.startPrank(oracle);
        aqua.logReading(id, 720, 680, 2830, 200); // normal
        aqua.logReading(id, 720, 680, 2830, 200); // normal
        aqua.logReading(id, 810, 420, 2570, 900); // alert: O2 low, ammonia high
        vm.stopPrank();

        assertEq(aqua.tankReadingCount(id), 3);
        assertEq(aqua.totalReadings(), 3);
    }

    function testFullCycle() public {
        vm.startPrank(operator);
        uint256 id = aqua.registerTank("Full Cycle Tank", "Camaron Blanco", 8000);
        aqua.stockTank(id, 6900);
        aqua.setThresholds(id, 3200, 400, 800, 700, 850);
        vm.stopPrank();

        vm.startPrank(oracle);
        aqua.logReading(id, 780, 590, 2610, 500);
        aqua.logReading(id, 790, 580, 2620, 510);
        vm.stopPrank();

        vm.prank(operator);
        aqua.harvestTank(id, 3000);

        (,,, uint256 stock,,) = aqua.getTank(id);
        assertEq(stock, 3900);
        assertEq(aqua.totalHarvested(), 3000);
        assertEq(aqua.tankReadingCount(id), 2);
    }
}
