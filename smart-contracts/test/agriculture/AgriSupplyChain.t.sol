// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/agriculture/AgriSupplyChain.sol";

contract AgriSupplyChainTest is Test {
    AgriSupplyChain public chain;
    address public admin       = address(this);
    address public farmer      = address(0xA1);
    address public distributor = address(0xA2);
    address public certifier   = address(0xA3);

    function setUp() public {
        chain = new AgriSupplyChain();
        chain.grantRole(chain.FARMER_ROLE(), farmer);
        chain.grantRole(chain.DISTRIBUTOR_ROLE(), distributor);
        chain.grantRole(chain.CERTIFIER_ROLE(), certifier);
    }

    function testRegisterProduct() public {
        vm.prank(farmer);
        uint256 id = chain.registerProduct("Aguacate Hass", "Michoacan MX", "BATCH-001", 12000000, block.timestamp);

        (string memory name, string memory origin, string memory batch, address f, uint256 w,, bool delivered) = chain.getProduct(id);
        assertEq(name, "Aguacate Hass");
        assertEq(origin, "Michoacan MX");
        assertEq(batch, "BATCH-001");
        assertEq(f, farmer);
        assertEq(w, 12000000);
        assertFalse(delivered);
    }

    function testRegisterProductRevertsEmptyBatch() public {
        vm.prank(farmer);
        vm.expectRevert("Empty batchId");
        chain.registerProduct("Cafe", "Chiapas MX", "", 3200000, block.timestamp);
    }

    function testAddCheckpoint() public {
        vm.prank(farmer);
        uint256 id = chain.registerProduct("Mango Ataulfo", "Nayarit MX", "BATCH-002", 8500000, block.timestamp);

        vm.prank(distributor);
        chain.addCheckpoint(id, "Puerto Manzanillo MX", 420, keccak256("19.05N,104.31W"));

        assertEq(chain.productCheckpointCount(id), 1);
        assertEq(chain.totalCheckpoints(), 1);
    }

    function testAddCheckpointRevertsDelivered() public {
        vm.prank(farmer);
        uint256 id = chain.registerProduct("Quinoa Real", "Oruro BO", "BATCH-003", 5000000, block.timestamp);

        vm.startPrank(distributor);
        chain.markDelivered(id);
        vm.expectRevert("Already delivered");
        chain.addCheckpoint(id, "Berlin DE", 200, keccak256("52.52N,13.40E"));
        vm.stopPrank();
    }

    function testAddCertification() public {
        vm.prank(farmer);
        uint256 id = chain.registerProduct("Pistacho Kerman", "Kerman CA", "BATCH-004", 2200000, block.timestamp);

        vm.prank(certifier);
        chain.addCertification(id, "USDA Organic");

        assertEq(chain.productCertCount(id), 1);
        assertEq(chain.totalCertifications(), 1);

        (uint256 pId, string memory certName, address c,, bool valid) = chain.certifications(0);
        assertEq(pId, id);
        assertEq(certName, "USDA Organic");
        assertEq(c, certifier);
        assertTrue(valid);
    }

    function testMarkDelivered() public {
        vm.prank(farmer);
        uint256 id = chain.registerProduct("Vainilla Bourbon", "Veracruz MX", "BATCH-005", 180000, block.timestamp);

        vm.prank(distributor);
        chain.markDelivered(id);

        (,,,,, , bool delivered) = chain.getProduct(id);
        assertTrue(delivered);
    }

    function testMarkDeliveredRevertsDuplicate() public {
        vm.prank(farmer);
        uint256 id = chain.registerProduct("Cafe Arabica", "Chiapas MX", "BATCH-006", 3200000, block.timestamp);

        vm.startPrank(distributor);
        chain.markDelivered(id);
        vm.expectRevert("Already delivered");
        chain.markDelivered(id);
        vm.stopPrank();
    }

    function testMultipleCheckpointsOnProduct() public {
        vm.prank(farmer);
        uint256 id = chain.registerProduct("Aguacate Hass", "Michoacan MX", "BATCH-007", 12000000, block.timestamp);

        vm.startPrank(distributor);
        chain.addCheckpoint(id, "Uruapan MX", 500, keccak256("19.41N,102.05W"));
        chain.addCheckpoint(id, "Manzanillo MX", 420, keccak256("19.05N,104.31W"));
        chain.addCheckpoint(id, "Long Beach CA", 380, keccak256("33.77N,118.19W"));
        vm.stopPrank();

        assertEq(chain.productCheckpointCount(id), 3);
        assertEq(chain.totalCheckpoints(), 3);
    }

    function testFullSupplyChainFlow() public {
        vm.prank(farmer);
        uint256 id = chain.registerProduct("Mango Ataulfo", "Nayarit MX", "BATCH-008", 8500000, block.timestamp);

        vm.prank(certifier);
        chain.addCertification(id, "GlobalGAP");

        vm.startPrank(distributor);
        chain.addCheckpoint(id, "Tepic MX", 500, keccak256("21.50N,104.89W"));
        chain.addCheckpoint(id, "Narita JP", 410, keccak256("35.77N,140.38E"));
        chain.markDelivered(id);
        vm.stopPrank();

        (,,,,,, bool delivered) = chain.getProduct(id);
        assertTrue(delivered);
        assertEq(chain.productCheckpointCount(id), 2);
        assertEq(chain.productCertCount(id), 1);
    }
}
