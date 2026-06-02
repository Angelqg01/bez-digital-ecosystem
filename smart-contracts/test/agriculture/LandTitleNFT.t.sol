// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/agriculture/LandTitleNFT.sol";

contract LandTitleNFTTest is Test {
    LandTitleNFT public land;
    address public admin     = address(this);
    address public registrar = address(0xC1);
    address public surveyor  = address(0xC2);
    address public buyer     = address(0xC3);

    function setUp() public {
        land = new LandTitleNFT();
        land.grantRole(land.REGISTRAR_ROLE(), registrar);
        land.grantRole(land.SURVEYOR_ROLE(), surveyor);
    }

    function testMintTitle() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Rancho San Felipe", "Jalisco MX", 2450000, "Vertisol", keccak256("20.66N,103.35W"));

        (string memory title, string memory location, uint256 area, string memory soil,,,bool active, uint256 fractions) = land.getParcel(id);
        assertEq(title, "Rancho San Felipe");
        assertEq(location, "Jalisco MX");
        assertEq(area, 2450000);
        assertEq(soil, "Vertisol");
        assertTrue(active);
        assertEq(fractions, 0);
        assertEq(land.ownerOf(id), registrar);
    }

    function testMintTitleRevertsZeroArea() public {
        vm.prank(registrar);
        vm.expectRevert("Area must be > 0");
        land.mintTitle("Bad Parcel", "Nowhere", 0, "Unknown", keccak256("0,0"));
    }

    function testMintTitleRevertsEmptyTitle() public {
        vm.prank(registrar);
        vm.expectRevert("Empty title");
        land.mintTitle("", "Somewhere", 1000, "Sand", keccak256("1,1"));
    }

    function testUpdateSoilData() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Finca La Esperanza", "Chiapas MX", 800000, "Andosol", keccak256("15.50N,92.64W"));

        vm.prank(surveyor);
        land.updateSoilData(id, 48, 22, 165, 600, 38); // N=48, P=22, K=165, OM=6.00%, moisture=38%

        assertEq(land.parcelSoilLogCount(id), 1);
        assertEq(land.totalSoilLogs(), 1);

        (uint256 pId, uint256 n, uint256 p, uint256 k, uint256 om, uint256 m,) = land.soilLogs(0);
        assertEq(pId, id);
        assertEq(n, 48);
        assertEq(p, 22);
        assertEq(k, 165);
        assertEq(om, 600);
        assertEq(m, 38);
    }

    function testUpdateSoilDataRevertsMoistureOver100() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Test Parcel", "Test", 1000, "Clay", keccak256("0,0"));

        vm.prank(surveyor);
        vm.expectRevert("Moisture max 100%");
        land.updateSoilData(id, 50, 20, 150, 400, 101);
    }

    function testTransferTitle() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Parcela Rio Dulce", "Cordoba AR", 3200000, "Molisol", keccak256("31.42S,64.18W"));

        vm.prank(registrar);
        land.transferTitle(id, buyer);

        assertEq(land.ownerOf(id), buyer);
    }

    function testTransferTitleRevertsNotOwner() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Niigata Rice", "Niigata JP", 550000, "Fluvisol", keccak256("37.90N,139.02E"));

        vm.prank(buyer);
        vm.expectRevert("Not the owner");
        land.transferTitle(id, buyer);
    }

    function testFractionalizeTitle() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Vinedo Valle Guadalupe", "Baja California MX", 420000, "Aridisol", keccak256("32.08N,116.62W"));

        vm.prank(registrar);
        land.fractionalizeTitle(id, 10);

        (,,,,,,, uint256 fractions) = land.getParcel(id);
        assertEq(fractions, 10);
    }

    function testFractionalizeTitleRevertsAlready() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Double Frac", "Test", 1000, "Sand", keccak256("0,0"));

        vm.startPrank(registrar);
        land.fractionalizeTitle(id, 5);
        vm.expectRevert("Already fractionalized");
        land.fractionalizeTitle(id, 10);
        vm.stopPrank();
    }

    function testFractionalizeTitleRevertsMinTwo() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Min Frac", "Test", 1000, "Sand", keccak256("0,0"));

        vm.prank(registrar);
        vm.expectRevert("Min 2 fractions");
        land.fractionalizeTitle(id, 1);
    }

    function testFullRegistryFlow() public {
        vm.prank(registrar);
        uint256 id = land.mintTitle("Rancho Completo", "Jalisco MX", 5000000, "Vertisol", keccak256("20.66N,103.35W"));

        vm.startPrank(surveyor);
        land.updateSoilData(id, 42, 18, 155, 380, 28);
        land.updateSoilData(id, 45, 20, 160, 400, 30);
        vm.stopPrank();

        vm.startPrank(registrar);
        land.fractionalizeTitle(id, 4);
        land.transferTitle(id, buyer);
        vm.stopPrank();

        assertEq(land.ownerOf(id), buyer);
        assertEq(land.parcelSoilLogCount(id), 2);
        (,,,,,,, uint256 fractions) = land.getParcel(id);
        assertEq(fractions, 4);
    }
}
