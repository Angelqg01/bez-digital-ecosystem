// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {EnergyOracle} from "../src/energy/EnergyOracle.sol";
import {EnergyCAEToken} from "../src/energy/EnergyCAEToken.sol";
import {BeZhasVPP} from "../src/energy/BeZhasVPP.sol";

/**
 * @title DeployEnergyVPP
 * @notice Deploys the BeZhas VPP energy stack and wires cross-contract roles:
 *           EnergyOracle   ── verified savings registry (dMRV)
 *           EnergyCAEToken ── CAE certificates (ERC-1155), consumes oracle savings
 *           BeZhasVPP      ── flexibility registry + immutable SCADA command audit
 *
 * Usage (Polygon Amoy testnet):
 *   DEPLOYER_PRIVATE_KEY=0x... forge script script/DeployEnergyVPP.s.sol \
 *     --rpc-url https://rpc-amoy.polygon.technology --broadcast
 *
 * Optional: ENERGY_ADMIN=0x... to set a separate admin (defaults to deployer).
 */
contract DeployEnergyVPP is Script {
    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("ENERGY_ADMIN", deployer);

        console.log("=== BeZhas Energy VPP Deployment ===");
        console.log("ChainId:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Admin:", admin);

        vm.startBroadcast(deployerKey);

        EnergyOracle oracle = new EnergyOracle(admin);
        console.log("EnergyOracle:", address(oracle));

        EnergyCAEToken cae = new EnergyCAEToken(admin, address(oracle));
        console.log("EnergyCAEToken:", address(cae));

        BeZhasVPP vpp = new BeZhasVPP(admin);
        console.log("BeZhasVPP:", address(vpp));

        // Wire roles: the CAE token must be able to consume verified savings from
        // the oracle. grantRole requires DEFAULT_ADMIN_ROLE (granted to `admin`
        // in the oracle constructor), so this only works when admin == deployer.
        if (admin == deployer) {
            oracle.grantRole(oracle.CONSUMER_ROLE(), address(cae));
            console.log("Granted oracle CONSUMER_ROLE to EnergyCAEToken");
        } else {
            console.log("NOTE: admin != deployer -> grant CONSUMER_ROLE to CAE token manually as admin");
        }

        vm.stopBroadcast();

        console.log("=== Energy VPP Deployment Complete ===");
    }
}
