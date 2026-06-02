// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/agriculture/CropTokenFutures.sol";

contract CropTokenFuturesTest is Test {
    CropTokenFutures public crop;
    address public admin   = address(this);
    address public farmer  = address(0xF1);
    address public oracle  = address(0xF2);
    address public buyer   = address(0xF3);

    function setUp() public {
        crop = new CropTokenFutures();
        crop.grantRole(crop.FARMER_ROLE(), farmer);
        crop.grantRole(crop.ORACLE_ROLE(), oracle);
    }

    function testCreateFuture() public {
        vm.startPrank(farmer);
        uint256 id = crop.createFuture("Maiz", "Blanco", 100, 50000, 1 ether, block.timestamp + 180 days);
        vm.stopPrank();

        (string memory name,, address f, uint256 hec, uint256 estYield,,, bool cert, bool settled,) = crop.getFuture(id);
        assertEq(name, "Maiz");
        assertEq(f, farmer);
        assertEq(hec, 100);
        assertEq(estYield, 50000);
        assertFalse(cert);
        assertFalse(settled);
    }

    function testCreateFutureRevertsZeroHectares() public {
        vm.startPrank(farmer);
        vm.expectRevert("Hectares must be > 0");
        crop.createFuture("Maiz", "Blanco", 0, 50000, 1 ether, block.timestamp + 180 days);
        vm.stopPrank();
    }

    function testCreateFutureRevertsPastHarvest() public {
        vm.startPrank(farmer);
        vm.expectRevert("Harvest must be future");
        crop.createFuture("Maiz", "Blanco", 100, 50000, 1 ether, block.timestamp - 1);
        vm.stopPrank();
    }

    function testBuyFuture() public {
        vm.prank(farmer);
        uint256 id = crop.createFuture("Trigo", "Cristalino", 50, 25000, 2 ether, block.timestamp + 90 days);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        crop.buyFuture{value: 2 ether}(id);

        (,,,,,,,,, address b) = crop.getFuture(id);
        assertEq(b, buyer);
    }

    function testBuyFutureRevertsInsufficientPayment() public {
        vm.prank(farmer);
        uint256 id = crop.createFuture("Soja", "RR", 200, 100000, 5 ether, block.timestamp + 120 days);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert("Insufficient payment");
        crop.buyFuture{value: 1 ether}(id);
    }

    function testCertifyHarvest() public {
        vm.prank(farmer);
        uint256 id = crop.createFuture("Cafe", "Arabica", 80, 4000, 3 ether, block.timestamp + 60 days);

        vm.prank(oracle);
        crop.certifyHarvest(id, 3800, 92);

        (,,,,,,, bool cert,,) = crop.getFuture(id);
        assertTrue(cert);

        uint256 certId = crop.futureToCert(id);
        (uint256 fId, uint256 actual, uint256 quality,,) = crop.harvestCerts(certId);
        assertEq(fId, id);
        assertEq(actual, 3800);
        assertEq(quality, 92);
    }

    function testCertifyHarvestRevertsDuplicate() public {
        vm.prank(farmer);
        uint256 id = crop.createFuture("Arroz", "Koshihikari", 55, 30000, 1 ether, block.timestamp + 90 days);

        vm.startPrank(oracle);
        crop.certifyHarvest(id, 28000, 88);
        vm.expectRevert("Already certified");
        crop.certifyHarvest(id, 28000, 88);
        vm.stopPrank();
    }

    function testSettleFuture() public {
        vm.prank(farmer);
        uint256 id = crop.createFuture("Aguacate", "Hass", 245, 120000, 2 ether, block.timestamp + 150 days);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        crop.buyFuture{value: 2 ether}(id);

        vm.prank(oracle);
        crop.certifyHarvest(id, 115000, 95);

        uint256 balBefore = farmer.balance;
        vm.prank(farmer);
        crop.settleFuture(id);

        (,,,,,,,, bool settled,) = crop.getFuture(id);
        assertTrue(settled);
        assertEq(farmer.balance, balBefore + 2 ether);
    }

    function testSettleFutureRevertsNotCertified() public {
        vm.prank(farmer);
        uint256 id = crop.createFuture("Vainilla", "Bourbon", 10, 500, 1 ether, block.timestamp + 200 days);

        vm.prank(farmer);
        vm.expectRevert("Not certified yet");
        crop.settleFuture(id);
    }

    function testMultipleFutures() public {
        vm.startPrank(farmer);
        crop.createFuture("Maiz", "Blanco", 100, 50000, 1 ether, block.timestamp + 180 days);
        crop.createFuture("Trigo", "Cristalino", 50, 25000, 2 ether, block.timestamp + 90 days);
        crop.createFuture("Soja", "RR", 200, 100000, 5 ether, block.timestamp + 120 days);
        vm.stopPrank();

        assertEq(crop.nextFutureId(), 3);
    }
}
