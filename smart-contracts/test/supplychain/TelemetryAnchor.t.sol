// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/supplychain/TelemetryAnchor.sol";

contract TelemetryAnchorTest is Test {
    TelemetryAnchor anchor;
    address operator = address(0xA1);
    address stranger = address(0xB1);

    string constant BUID = "BZ-LOG-AAA111";

    function setUp() public {
        anchor = new TelemetryAnchor();
        anchor.grantRole(anchor.OPERATOR_ROLE(), operator);
    }

    // ── sorted-pair sha256 helpers (mirror of cargoTelemetryAnchor.js) ────
    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a <= b ? sha256(abi.encodePacked(a, b)) : sha256(abi.encodePacked(b, a));
    }

    // ── anchorBatch ────────────────────────────────────────────────────────
    function testAnchorBatchStoresAnchor() public {
        vm.prank(operator);
        uint256 index = anchor.anchorBatch(BUID, keccak256("root"), 100, 200, 12);
        assertEq(index, 0);
        assertEq(anchor.anchorCount(BUID), 1);

        TelemetryAnchor.Anchor memory a = anchor.getAnchor(BUID, 0);
        assertEq(a.merkleRoot, keccak256("root"));
        assertEq(a.fromTs, 100);
        assertEq(a.toTs, 200);
        assertEq(a.leafCount, 12);
        assertEq(a.operator, operator);
    }

    function testAnchorBatchAppendsSequentially() public {
        vm.startPrank(operator);
        assertEq(anchor.anchorBatch(BUID, keccak256("r0"), 1, 2, 1), 0);
        assertEq(anchor.anchorBatch(BUID, keccak256("r1"), 3, 4, 2), 1);
        vm.stopPrank();
        assertEq(anchor.anchorCount(BUID), 2);
        assertEq(anchor.getAnchor(BUID, 1).merkleRoot, keccak256("r1"));
    }

    function testAnchorBatchRejectsNonOperator() public {
        vm.prank(stranger);
        vm.expectRevert();
        anchor.anchorBatch(BUID, keccak256("root"), 1, 2, 1);
    }

    function testAnchorBatchValidatesInputs() public {
        vm.startPrank(operator);
        vm.expectRevert(bytes("Empty bUid"));
        anchor.anchorBatch("", keccak256("r"), 1, 2, 1);
        vm.expectRevert(bytes("Empty root"));
        anchor.anchorBatch(BUID, bytes32(0), 1, 2, 1);
        vm.expectRevert(bytes("Empty batch"));
        anchor.anchorBatch(BUID, keccak256("r"), 1, 2, 0);
        vm.expectRevert(bytes("Bad time range"));
        anchor.anchorBatch(BUID, keccak256("r"), 5, 2, 1);
        vm.stopPrank();
    }

    function testGetAnchorRevertsOutOfRange() public {
        vm.expectRevert(bytes("Anchor not found"));
        anchor.getAnchor(BUID, 0);
    }

    // ── verify (inclusion proofs) ─────────────────────────────────────────
    function testVerifyFourLeafTree() public {
        bytes32 l0 = sha256("reading-0");
        bytes32 l1 = sha256("reading-1");
        bytes32 l2 = sha256("reading-2");
        bytes32 l3 = sha256("reading-3");

        bytes32 n01 = _pair(l0, l1);
        bytes32 n23 = _pair(l2, l3);
        bytes32 root = _pair(n01, n23);

        vm.prank(operator);
        anchor.anchorBatch(BUID, root, 100, 400, 4);

        // proof for l2: sibling l3, then n01
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = l3;
        proof[1] = n01;
        assertTrue(anchor.verify(BUID, 0, l2, proof));

        // a forged leaf fails
        assertFalse(anchor.verify(BUID, 0, sha256("forged"), proof));
    }

    function testVerifyOddTreeDuplicatesLastLeaf() public {
        bytes32 l0 = sha256("a");
        bytes32 l1 = sha256("b");
        bytes32 l2 = sha256("c");

        bytes32 n01 = _pair(l0, l1);
        bytes32 n22 = _pair(l2, l2); // odd level duplicates the last node
        bytes32 root = _pair(n01, n22);

        vm.prank(operator);
        anchor.anchorBatch(BUID, root, 1, 3, 3);

        bytes32[] memory proof = new bytes32[](2);
        proof[0] = l2; // sibling of l2 is itself
        proof[1] = n01;
        assertTrue(anchor.verify(BUID, 0, l2, proof));
    }

    function testVerifySingleLeafRoot() public {
        bytes32 leaf = sha256("only");
        vm.prank(operator);
        anchor.anchorBatch(BUID, leaf, 1, 1, 1);

        bytes32[] memory proof = new bytes32[](0);
        assertTrue(anchor.verify(BUID, 0, leaf, proof));
        assertFalse(anchor.verify(BUID, 0, sha256("other"), proof));
    }
}
