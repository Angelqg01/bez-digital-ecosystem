// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {SimpleAccountFactory} from "account-abstraction/accounts/SimpleAccountFactory.sol";
import {GasTankVault} from "../src/gas/GasTankVault.sol";

/// Imita RWAFactory.tokenizeAsset: cobra 100 BEZ con transferFrom(msg.sender, owner, fee). SOLO PARA AMOY.
contract AmoyTokenizer {
    ERC20 public immutable bez;
    address public immutable owner;
    uint256 public assets;
    event Tokenized(address indexed by, uint256 indexed id, string name);

    constructor(ERC20 b, address o) { bez = b; owner = o; }

    function tokenizeAsset(string calldata name) external returns (uint256 id) {
        require(bez.transferFrom(msg.sender, owner, 100 ether), "fee");
        id = ++assets;
        emit Tokenized(msg.sender, id, name);
    }
}

/**
 * Prepara Amoy para la prueba de extremo a extremo del Gas Tank (la firma el admin del paymaster y la bóveda):
 *   1. AmoyTokenizer (comisión de 100 TestBEZ, como tokenizeAsset)
 *   2. SimpleAccountFactory (ERC-4337 v0.8) para crear la smart account de prueba
 *   3. regla de comisión en la bóveda: (AmoyTokenizer, tokenizeAsset) hasta 100 BEZ
 *
 *   GAS_TANK_VAULT=0x… GAS_TANK_ADMIN=0x… FOUNDRY_PROFILE=aa forge script test-aa/AmoyE2E.s.sol --tc DeployAmoyE2E \
 *     --rpc-url $AMOY_RPC --account <keystore> --broadcast
 */
contract DeployAmoyE2E is Script {
    address constant ENTRYPOINT_V08 = 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108;

    function run() external {
        require(block.chainid == 80002, "solo Amoy");
        GasTankVault vault = GasTankVault(vm.envAddress("GAS_TANK_VAULT"));
        address admin = vm.envAddress("GAS_TANK_ADMIN");
        require(vault.owner() == admin, "el admin no es el owner de la boveda");

        vm.startBroadcast();
        AmoyTokenizer tokenizer = new AmoyTokenizer(ERC20(address(vault.bez())), admin);
        SimpleAccountFactory factory = new SimpleAccountFactory(IEntryPoint(ENTRYPOINT_V08));
        vault.setFeeRule(address(tokenizer), AmoyTokenizer.tokenizeAsset.selector, 100 ether);
        vm.stopBroadcast();

        require(vault.feeCap(address(tokenizer), AmoyTokenizer.tokenizeAsset.selector) == 100 ether, "regla no aplicada");
        console.log("AmoyTokenizer:", address(tokenizer));
        console.log("SimpleAccountFactory:", address(factory));
        console.log("selector tokenizeAsset(string):");
        console.logBytes4(AmoyTokenizer.tokenizeAsset.selector);
    }
}

/// Envía a mano el handleOps que prepara scripts/dev/gas-tank-amoy-e2e.cjs (hace de «bundler» desde el admin, sin bundler externo).
/// Ejecutar con `--gas-estimate-multiplier 400`: la estimación de forge se queda corta y el EntryPoint revierte con AA95 (out of gas).
contract SubmitHandleOps is Script {
    function run() external {
        address ep = vm.envOr("GAS_TANK_ENTRYPOINT", ENTRY());
        bytes memory data = vm.envBytes("USEROP_CALLDATA");
        vm.startBroadcast();
        (bool ok, bytes memory ret) = ep.call(data);
        vm.stopBroadcast();
        if (!ok) { console.logBytes(ret); revert("handleOps revirtio"); }
        console.log("handleOps enviado a", ep);
    }

    function ENTRY() internal pure returns (address) { return 0x4337084D9E255Ff0702461CF8895CE9E3b5Ff108; }
}
