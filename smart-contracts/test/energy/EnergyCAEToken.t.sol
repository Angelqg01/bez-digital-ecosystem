// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/energy/EnergyOracle.sol";
import "../../src/energy/EnergyCAEToken.sol";

contract EnergyCAETokenTest is Test {
    EnergyOracle   oracle;
    EnergyCAEToken cae;
    address admin    = address(1);
    address reporter = address(2);
    address auditor  = address(3);
    address prosumer = address(4);
    address buyer    = address(5);

    bytes32 constant NODE = keccak256("n1");

    function setUp() public {
        vm.startPrank(admin);
        oracle = new EnergyOracle(admin);
        cae = new EnergyCAEToken(admin, address(oracle));
        oracle.grantRole(oracle.REPORTER_ROLE(), reporter);
        oracle.grantRole(oracle.AUDITOR_ROLE(), auditor);
        oracle.grantRole(oracle.CONSUMER_ROLE(), address(cae));
        oracle.registerNode(NODE, prosumer, "SOLAR", "Algeciras");
        vm.stopPrank();

        // Seed 5000 kWh of verified savings for the prosumer in 2025-Q1.
        vm.prank(reporter);
        oracle.submitProof(keccak256("p1"), NODE, prosumer, EnergyOracle.ProofType.SAVING, 5000, "2025-Q1", "ipfs://cid");
        vm.prank(auditor);
        oracle.verifyProof(keccak256("p1"));
    }

    function testMintFromOracleConsumesAndMints() public {
        vm.prank(admin);
        uint256 id = cae.mintFromOracle(prosumer, 3000, "2025-Q1", EnergyCAEToken.Certifier.BEZHAS_ORACLE, NODE, "ipfs://cae1");

        assertEq(id, 0);
        assertEq(cae.balanceOf(prosumer, 0), 3000);
        assertEq(oracle.verifiedKWh(prosumer, "2025-Q1"), 2000);
        assertEq(cae.uri(0), "ipfs://cae1");
    }

    function testMintRevertsWithoutVerifiedSavings() public {
        vm.prank(admin);
        vm.expectRevert("Insufficient verified kWh");
        cae.mintFromOracle(prosumer, 6000, "2025-Q1", EnergyCAEToken.Certifier.BEZHAS_ORACLE, NODE, "");
    }

    function testMintRevertsUnauthorized() public {
        vm.prank(buyer);
        vm.expectRevert();
        cae.mintFromOracle(prosumer, 1000, "2025-Q1", EnergyCAEToken.Certifier.CNMC, NODE, "");
    }

    function testNoDoubleCertification() public {
        // Mint the full 5000; a second mint for the same period must revert.
        vm.startPrank(admin);
        cae.mintFromOracle(prosumer, 5000, "2025-Q1", EnergyCAEToken.Certifier.BEZHAS_ORACLE, NODE, "");
        vm.expectRevert("Insufficient verified kWh");
        cae.mintFromOracle(prosumer, 1, "2025-Q1", EnergyCAEToken.Certifier.BEZHAS_ORACLE, NODE, "");
        vm.stopPrank();
    }

    function testRetireBurnsAndTracks() public {
        vm.prank(admin);
        cae.mintFromOracle(prosumer, 3000, "2025-Q1", EnergyCAEToken.Certifier.BEZHAS_ORACLE, NODE, "");

        vm.prank(prosumer);
        cae.retire(0, 1000);

        assertEq(cae.balanceOf(prosumer, 0), 2000);
        assertEq(cae.totalRetiredKwh(), 1000);
        (,,,,,, uint256 retiredKwh) = cae.certificates(0);
        assertEq(retiredKwh, 1000);
    }

    function testRetireRevertsInsufficient() public {
        vm.prank(admin);
        cae.mintFromOracle(prosumer, 1000, "2025-Q1", EnergyCAEToken.Certifier.IDAE, NODE, "");
        vm.prank(prosumer);
        vm.expectRevert("Insufficient balance");
        cae.retire(0, 5000);
    }

    function testTransferToSecondaryMarket() public {
        vm.prank(admin);
        cae.mintFromOracle(prosumer, 3000, "2025-Q1", EnergyCAEToken.Certifier.IDAE, NODE, "");

        vm.prank(prosumer);
        cae.safeTransferFrom(prosumer, buyer, 0, 1000, "");

        assertEq(cae.balanceOf(buyer, 0), 1000);
        assertEq(cae.balanceOf(prosumer, 0), 2000);
    }
}
