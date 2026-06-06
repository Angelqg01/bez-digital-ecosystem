// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/energy/EnergyOracle.sol";

contract EnergyOracleTest is Test {
    EnergyOracle oracle;
    address admin    = address(1);
    address reporter = address(2);
    address auditor  = address(3);
    address prosumer = address(4);
    address consumer = address(5);

    bytes32 constant NODE = keccak256("n1");

    function setUp() public {
        vm.startPrank(admin);
        oracle = new EnergyOracle(admin);
        oracle.grantRole(oracle.REPORTER_ROLE(), reporter);
        oracle.grantRole(oracle.AUDITOR_ROLE(), auditor);
        oracle.grantRole(oracle.CONSUMER_ROLE(), consumer);
        oracle.registerNode(NODE, prosumer, "SOLAR", "Algeciras");
        vm.stopPrank();
    }

    function _submit(bytes32 id, uint256 kWh, string memory period) internal {
        vm.prank(reporter);
        oracle.submitProof(id, NODE, prosumer, EnergyOracle.ProofType.SAVING, kWh, period, "ipfs://cid");
    }

    function testRegisterNode() public {
        (address owner,,, bool active,) = oracle.nodes(NODE);
        assertEq(owner, prosumer);
        assertTrue(active);
    }

    function testRegisterDuplicateReverts() public {
        vm.prank(admin);
        vm.expectRevert("Node exists");
        oracle.registerNode(NODE, prosumer, "SOLAR", "Algeciras");
    }

    function testSubmitAndVerifyAccumulates() public {
        _submit(keccak256("p1"), 5000, "2025-Q1");
        vm.prank(auditor);
        oracle.verifyProof(keccak256("p1"));
        assertEq(oracle.verifiedKWh(prosumer, "2025-Q1"), 5000);
    }

    function testSubmitRevertsUnauthorized() public {
        vm.prank(prosumer);
        vm.expectRevert();
        oracle.submitProof(keccak256("x"), NODE, prosumer, EnergyOracle.ProofType.SAVING, 100, "2025-Q1", "");
    }

    function testSubmitRevertsInactiveNode() public {
        vm.prank(admin);
        oracle.setNodeActive(NODE, false);
        vm.prank(reporter);
        vm.expectRevert("Node inactive");
        oracle.submitProof(keccak256("x"), NODE, prosumer, EnergyOracle.ProofType.SAVING, 100, "2025-Q1", "");
    }

    function testSubmitZeroKwhReverts() public {
        vm.prank(reporter);
        vm.expectRevert("Zero kWh");
        oracle.submitProof(keccak256("x"), NODE, prosumer, EnergyOracle.ProofType.SAVING, 0, "2025-Q1", "");
    }

    function testDuplicateProofReverts() public {
        _submit(keccak256("p1"), 100, "2025-Q1");
        vm.prank(reporter);
        vm.expectRevert("Proof exists");
        oracle.submitProof(keccak256("p1"), NODE, prosumer, EnergyOracle.ProofType.SAVING, 200, "2025-Q1", "");
    }

    function testDoubleVerifyReverts() public {
        _submit(keccak256("p1"), 100, "2025-Q1");
        vm.startPrank(auditor);
        oracle.verifyProof(keccak256("p1"));
        vm.expectRevert("Already verified");
        oracle.verifyProof(keccak256("p1"));
        vm.stopPrank();
    }

    function testVerifyUnknownReverts() public {
        vm.prank(auditor);
        vm.expectRevert("Unknown proof");
        oracle.verifyProof(keccak256("nope"));
    }

    function testConsumeReducesBalance() public {
        _submit(keccak256("p1"), 5000, "2025-Q1");
        vm.prank(auditor);
        oracle.verifyProof(keccak256("p1"));
        vm.prank(consumer);
        oracle.consumeVerifiedSavings(prosumer, "2025-Q1", 2000);
        assertEq(oracle.verifiedKWh(prosumer, "2025-Q1"), 3000);
    }

    function testConsumeRevertsInsufficient() public {
        _submit(keccak256("p1"), 1000, "2025-Q1");
        vm.prank(auditor);
        oracle.verifyProof(keccak256("p1"));
        vm.prank(consumer);
        vm.expectRevert("Insufficient verified kWh");
        oracle.consumeVerifiedSavings(prosumer, "2025-Q1", 2000);
    }

    function testConsumeRevertsUnauthorized() public {
        vm.prank(prosumer);
        vm.expectRevert();
        oracle.consumeVerifiedSavings(prosumer, "2025-Q1", 1);
    }

    function testFreshness() public {
        _submit(keccak256("p1"), 100, "2025-Q1");
        assertTrue(oracle.isFresh(NODE, 60));
        vm.warp(block.timestamp + 120);
        assertFalse(oracle.isFresh(NODE, 60));
    }

    function testPeriodsAreIsolated() public {
        _submit(keccak256("p1"), 1000, "2025-Q1");
        _submit(keccak256("p2"), 2000, "2025-Q2");
        vm.startPrank(auditor);
        oracle.verifyProof(keccak256("p1"));
        oracle.verifyProof(keccak256("p2"));
        vm.stopPrank();
        assertEq(oracle.verifiedKWh(prosumer, "2025-Q1"), 1000);
        assertEq(oracle.verifiedKWh(prosumer, "2025-Q2"), 2000);
    }
}
