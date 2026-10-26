// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SmartWalletFactory} from "../src/wallet/SmartWalletFactory.sol";
import {Paymaster} from "../src/wallet/Paymaster.sol";
import {WalletGuardian} from "../src/wallet/WalletGuardian.sol";
import {SecurityModule} from "../src/wallet/SecurityModule.sol";
import {MultiSigWallet} from "../src/wallet/MultiSigWallet.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";

/**
 * @title DeployWallet
 * @notice Despliega SOLO el sistema de wallets (no está en DeployAll): SmartWalletFactory, Paymaster,
 *         WalletGuardian, SecurityModule, MultiSigWallet e IdentityRegistry. El API los busca en
 *         deployments/<chainId>.json (sección "wallet") y sin ellos /api/wallet/* responde 503.
 *
 * SIMULACIÓN (no envía nada; sirve para estimar el coste con un fork de Polygon):
 *   DEPLOYER_PRIVATE_KEY=<clave de prueba> WALLET_ADMIN=0x... GUARDIANS=0xA,0xB,0xC MULTISIG_SIGNERS=0xA,0xB,0xC \
 *   forge script script/DeployWallet.s.sol --fork-url https://polygon-bor-rpc.publicnode.com
 *
 * DESPLIEGUE REAL: añadir --broadcast. En mainnet exige la confirmación explícita del responsable:
 * los contratos quedan en la cadena, y CLAUDE.md prohíbe sobrescribir direcciones sin confirmación.
 * Probar antes en Amoy (80002). Después copiar las direcciones a deployments/<chainId>.json.
 *
 * Variables:
 *   DEPLOYER_PRIVATE_KEY  (obligatoria salvo en Anvil)
 *   WALLET_ADMIN          dueño de Factory/Paymaster/Guardian/Security/Identity (por defecto, el deployer)
 *   BEZ_TOKEN             token del Paymaster (por defecto, BEZ en Polygon)
 *   GUARDIANS             lista separada por comas (por defecto, solo el admin; en mainnet usar 3 o más)
 *   GUARDIAN_THRESHOLD    por defecto 1 con un guardián, si no 2
 *   TIMELOCK_DELAY        segundos, entre 1 día y 30 días (por defecto 2 días)
 *   MULTISIG_SIGNERS      mínimo 2 firmantes (por defecto, admin y EDGE_NODE_ADDRESS: solo para pruebas)
 *   MULTISIG_REQUIRED     por defecto 2
 *   DEFAULT_DAILY_LIMIT   límite diario por defecto de cada SmartWallet, en wei de BEZ (por defecto 1000 BEZ)
 */
contract DeployWallet is Script {
    address constant BEZ_POLYGON = 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8;

    function run() external {
        uint256 deployerKey = block.chainid == 31337
            ? vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80))
            : vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("WALLET_ADMIN", deployer);
        address bez = vm.envOr("BEZ_TOKEN", BEZ_POLYGON);

        address[] memory guardians = _list("GUARDIANS", admin);
        uint256 threshold = vm.envOr("GUARDIAN_THRESHOLD", guardians.length == 1 ? uint256(1) : uint256(2));
        uint256 delay = vm.envOr("TIMELOCK_DELAY", uint256(2 days));
        address[] memory signers = _list("MULTISIG_SIGNERS", admin);
        if (signers.length < 2) {
            // Solo para simulaciones: un multisig real necesita 2 o más firmantes distintos.
            address[] memory two = new address[](2);
            two[0] = admin;
            two[1] = vm.envOr("EDGE_NODE_ADDRESS", address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8));
            signers = two;
        }
        uint256 required = vm.envOr("MULTISIG_REQUIRED", uint256(2));
        uint256 dailyLimit = vm.envOr("DEFAULT_DAILY_LIMIT", uint256(1000 ether));

        vm.startBroadcast(deployerKey);
        SmartWalletFactory factory = new SmartWalletFactory(admin, dailyLimit);
        Paymaster paymaster = new Paymaster(bez, admin);
        WalletGuardian guardian = new WalletGuardian(admin);
        SecurityModule security = new SecurityModule(admin, delay, guardians, threshold);
        MultiSigWallet multisig = new MultiSigWallet(signers, required, dailyLimit, dailyLimit * 10);
        IdentityRegistry identity = new IdentityRegistry(admin);
        vm.stopBroadcast();

        console.log("chainId            :", block.chainid);
        console.log("deployer           :", deployer);
        console.log("admin              :", admin);
        console.log("SmartWalletFactory :", address(factory));
        console.log("Paymaster          :", address(paymaster));
        console.log("WalletGuardian     :", address(guardian));
        console.log("SecurityModule     :", address(security));
        console.log("MultiSigWallet     :", address(multisig));
        console.log("IdentityRegistry   :", address(identity));
    }

    /// Lista de direcciones separada por comas; si no está definida, [fallback].
    function _list(string memory name, address fallback_) internal view returns (address[] memory out) {
        try vm.envAddress(name, ",") returns (address[] memory a) {
            return a;
        } catch {
            out = new address[](1);
            out[0] = fallback_;
        }
    }
}
