// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {BeZhasDEX} from "../src/core/BeZhasDEX.sol";

contract DeployDEX is Script {
    function run() external returns (BeZhasDEX dex) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(privateKey);
        uint16 feeBps = uint16(vm.envOr("DEX_FEE_BPS", uint256(30)));

        vm.startBroadcast(privateKey);
        dex = new BeZhasDEX(owner, feeBps);
        vm.stopBroadcast();
    }
}
