// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {BeZhasVerifyingPaymaster} from "../../src/gas/BeZhasVerifyingPaymaster.sol";
import {GasTankVault} from "../../src/gas/GasTankVault.sol";
import {IEntryPointV8, PackedUserOperation} from "../../src/gas/IEntryPointV8.sol";

contract GoldenBEZ is ERC20 {
    constructor() ERC20("BEZ", "BEZ") {}
}

/// Vectores de oro: los literales los calculó el servicio JS (api/services/gasTank/userOp.js) con ethers.
/// Si el contrato y el servicio dejan de coincidir, el servicio firmaría hashes que el contrato rechaza
/// (o peor: que acepta con otro significado). El test gemelo vive en api/__tests__/services/gasTankUserOp.test.js.
contract GoldenVectorsTest is Test {
    address constant PM = address(0x4444444444444444444444444444444444444444);
    address constant VAULT = address(0x1111111111111111111111111111111111111111);
    bytes32 constant ORG = 0xe29dae06ef4c3e336b7538b6d4f52ca1ecec009b1df6fb501320e11b223aeeaf; // keccak256("acme")

    function test_vaultHashMatchesServiceVector() public {
        vm.chainId(137);
        deployCodeTo("GasTankVault.sol:GasTankVault", abi.encode(address(new GoldenBEZ()), address(0xA), address(0xB), uint256(1)), VAULT);
        bytes32 h = GasTankVault(VAULT).getHash(
            ORG, address(0x2222222222222222222222222222222222222222), address(0x3333333333333333333333333333333333333333),
            bytes4(0x12345678), 100 ether, 1800000600, keccak256("n")
        );
        assertEq(h, 0x951dd9f0b37ea2d3cb163768bc161f3f2eb64f085423954f4cfb9bff480b2ad0);
    }

    function test_paymasterHashMatchesServiceVector() public {
        vm.chainId(137);
        deployCodeTo("BeZhasVerifyingPaymaster.sol:BeZhasVerifyingPaymaster", abi.encode(address(1), address(0xA), address(0xB), uint256(1)), PM);
        PackedUserOperation memory op;
        op.sender = address(0xbEEF);
        op.nonce = 7;
        op.callData = hex"01020304";
        op.accountGasLimits = 0x00000000000000000000000000030d4000000000000000000000000000030d40;
        op.preVerificationGas = 60000;
        op.gasFees = 0x0000000000000000000000000000000100000000000000000000000000000002;
        op.paymasterAndData = abi.encodePacked(
            PM, uint128(150000), uint128(80000), abi.encode(ORG, uint48(1800000600), uint48(0), uint256(0.5 ether)), new bytes(65)
        );
        bytes32 h = BeZhasVerifyingPaymaster(PM).getHash(op, ORG, 1800000600, 0, 0.5 ether);
        assertEq(h, 0x34b1ec86b74072a8416fe1c83f73b1dfb620bd16cd5e92de6e9aa0f64e16d3f1);
    }
}
