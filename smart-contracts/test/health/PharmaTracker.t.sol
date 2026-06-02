// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {PharmaTracker} from "../../src/health/PharmaTracker.sol";

contract PharmaTrackerTest is Test {
    PharmaTracker public tracker;
    address public admin = address(1);
    address public manufacturer = address(2);
    address public logistics = address(3);
    address public hospital = address(4);
    address public unauthorized = address(5);

    function setUp() public {
        vm.startPrank(admin);
        tracker = new PharmaTracker();
        tracker.grantRole(tracker.MANUFACTURER_ROLE(), manufacturer);
        tracker.grantRole(tracker.LOGISTICS_ROLE(), logistics);
        vm.stopPrank();
    }

    function test_RegisterBatch() public {
        vm.prank(manufacturer);
        uint256 batchId = tracker.registerBatch("LOT-001", "00069-1530-01", keccak256("cert"), 10000, 15, 25, block.timestamp + 365 days);

        PharmaTracker.PharmaBatch memory batch = tracker.getBatch(batchId);
        assertEq(keccak256(bytes(batch.lotId)), keccak256(bytes("LOT-001")));
        assertEq(batch.quantity, 10000);
        assertEq(batch.manufacturer, manufacturer);
    }

    function test_RegisterBatchRevertsUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        tracker.registerBatch("LOT-002", "NDC", keccak256("cert"), 1000, 2, 8, block.timestamp + 365 days);
    }

    function test_LogTemperatureNominal() public {
        vm.prank(manufacturer);
        uint256 batchId = tracker.registerBatch("LOT-001", "NDC", keccak256("cert"), 10000, 15, 25, block.timestamp + 365 days);

        vm.prank(logistics);
        tracker.logTemperature(batchId, 20, 45, keccak256("rfid-sig"));

        assertEq(tracker.getTempLogCount(batchId), 1);
        // Status should still be IN_TRANSIT (nominal temp)
        PharmaTracker.PharmaBatch memory batch = tracker.getBatch(batchId);
        assertEq(uint(batch.status), uint(PharmaTracker.BatchStatus.IN_TRANSIT));
    }

    function test_LogTemperatureTriggersAlert() public {
        vm.prank(manufacturer);
        uint256 batchId = tracker.registerBatch("LOT-001", "NDC", keccak256("cert"), 10000, 15, 25, block.timestamp + 365 days);

        // Log temperature above max (30 > 25)
        vm.prank(logistics);
        tracker.logTemperature(batchId, 30, 60, keccak256("rfid-sig"));

        PharmaTracker.PharmaBatch memory batch = tracker.getBatch(batchId);
        assertEq(uint(batch.status), uint(PharmaTracker.BatchStatus.ALERT));
    }

    function test_TransferCustody() public {
        vm.prank(manufacturer);
        uint256 batchId = tracker.registerBatch("LOT-001", "NDC", keccak256("cert"), 10000, 15, 25, block.timestamp + 365 days);

        vm.prank(manufacturer);
        tracker.transferCustody(batchId, logistics);

        PharmaTracker.PharmaBatch memory batch = tracker.getBatch(batchId);
        assertEq(batch.currentCustodian, logistics);

        address[] memory chain = tracker.getCustodyChain(batchId);
        assertEq(chain.length, 2);
        assertEq(chain[0], manufacturer);
        assertEq(chain[1], logistics);
    }

    function test_TransferCustodyRevertsNotCustodian() public {
        vm.prank(manufacturer);
        uint256 batchId = tracker.registerBatch("LOT-001", "NDC", keccak256("cert"), 10000, 15, 25, block.timestamp + 365 days);

        vm.prank(unauthorized);
        vm.expectRevert("PharmaTracker: not custodian");
        tracker.transferCustody(batchId, hospital);
    }

    function test_MarkDelivered() public {
        vm.prank(manufacturer);
        uint256 batchId = tracker.registerBatch("LOT-001", "NDC", keccak256("cert"), 10000, 15, 25, block.timestamp + 365 days);

        vm.prank(manufacturer);
        tracker.markDelivered(batchId);

        PharmaTracker.PharmaBatch memory batch = tracker.getBatch(batchId);
        assertEq(uint(batch.status), uint(PharmaTracker.BatchStatus.DELIVERED));
    }

    function test_VerifyCertificate() public {
        bytes32 cert = keccak256("manufacturer-cert-hash");
        vm.prank(manufacturer);
        uint256 batchId = tracker.registerBatch("LOT-001", "NDC", cert, 10000, 15, 25, block.timestamp + 365 days);

        assertTrue(tracker.verifyCertificate(batchId, cert));
        assertFalse(tracker.verifyCertificate(batchId, keccak256("wrong")));
    }
}
