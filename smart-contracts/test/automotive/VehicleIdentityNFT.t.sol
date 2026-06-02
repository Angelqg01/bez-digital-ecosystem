// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/automotive/VehicleIdentityNFT.sol";

contract VehicleIdentityNFTTest is Test {
    VehicleIdentityNFT nft;
    address admin = address(1);
    address owner1 = address(2);
    address owner2 = address(3);
    address oracle = address(4);

    function setUp() public {
        vm.startPrank(admin);
        nft = new VehicleIdentityNFT(admin);
        nft.grantRole(nft.ORACLE_ROLE(), oracle);
        vm.stopPrank();
    }

    function testMintVehicle() public {
        vm.startPrank(admin);
        uint256 id = nft.mintVehicle(owner1, "1HGCM82633A004352", "Toyota", "Camry");
        vm.stopPrank();

        assertEq(nft.ownerOf(id), owner1);
        assertEq(nft.totalVehicles(), 1);
        (string memory vin,,,,,, ) = nft.vehicles(id);
        assertEq(keccak256(bytes(vin)), keccak256("1HGCM82633A004352"));
    }

    function testMintEmptyVinReverts() public {
        vm.startPrank(admin);
        vm.expectRevert("VIN required");
        nft.mintVehicle(owner1, "", "Toyota", "Camry");
        vm.stopPrank();
    }

    function testUpdateMileage() public {
        vm.startPrank(admin);
        uint256 id = nft.mintVehicle(owner1, "VIN001", "BMW", "530e");
        vm.stopPrank();

        vm.startPrank(oracle);
        nft.updateMileage(id, 10000);
        vm.stopPrank();

        (,,,uint256 mileage,,,) = nft.vehicles(id);
        assertEq(mileage, 10000);
    }

    function testUpdateMileageMustIncrease() public {
        vm.startPrank(admin);
        uint256 id = nft.mintVehicle(owner1, "VIN002", "Tesla", "M3");
        vm.stopPrank();

        vm.startPrank(oracle);
        nft.updateMileage(id, 5000);
        vm.expectRevert("Mileage must increase");
        nft.updateMileage(id, 3000);
        vm.stopPrank();
    }

    function testTransferVehicle() public {
        vm.startPrank(admin);
        uint256 id = nft.mintVehicle(owner1, "VIN003", "Ford", "F150");
        vm.stopPrank();

        vm.startPrank(owner1);
        nft.transferVehicle(id, owner2);
        vm.stopPrank();

        assertEq(nft.ownerOf(id), owner2);
        assertEq(nft.getHistoryLength(id), 1);
    }

    function testTransferStolenReverts() public {
        vm.startPrank(admin);
        uint256 id = nft.mintVehicle(owner1, "VIN004", "Nissan", "Leaf");
        nft.reportStolen(id);
        vm.stopPrank();

        vm.startPrank(owner1);
        vm.expectRevert("Vehicle reported stolen");
        nft.transferVehicle(id, owner2);
        vm.stopPrank();
    }

    function testReportStolen() public {
        vm.startPrank(admin);
        uint256 id = nft.mintVehicle(owner1, "VIN005", "VW", "ID4");
        nft.reportStolen(id);
        vm.stopPrank();

        (,,,,,, bool stolen) = nft.vehicles(id);
        assertTrue(stolen);
    }

    function testClearStolen() public {
        vm.startPrank(admin);
        uint256 id = nft.mintVehicle(owner1, "VIN006", "Hyundai", "Ioniq");
        nft.reportStolen(id);
        nft.clearStolen(id);
        vm.stopPrank();

        (,,,,,, bool stolen) = nft.vehicles(id);
        assertFalse(stolen);
    }

    function testNonOwnerCannotTransfer() public {
        vm.startPrank(admin);
        uint256 id = nft.mintVehicle(owner1, "VIN007", "Audi", "Q4");
        vm.stopPrank();

        vm.startPrank(owner2);
        vm.expectRevert("Not vehicle owner");
        nft.transferVehicle(id, owner2);
        vm.stopPrank();
    }
}
