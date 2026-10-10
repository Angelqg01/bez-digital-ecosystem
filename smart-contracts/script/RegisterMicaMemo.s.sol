// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IPRegistryNFT} from "../src/legal/IPRegistryNFT.sol";

/**
 * @title RegisterMicaMemo
 * @notice Registra MEMO_ESTRUCTURA_MICA_EXENTA.md como IPAsset (IPType.CONTRACT) en
 *         IPRegistryNFT y lo mintea a nombre del deployer. Un wallet con REGISTRAR_ROLE
 *         debe llamar después a `approveRegistration(ipId)` para marcarlo REGISTERED
 *         ("validado").
 *
 * proofHash = keccak256(contenido de MEMO_ESTRUCTURA_MICA_EXENTA.md al 2026-09-05)
 * Si el memo cambia, recalcula el hash con:
 *   cast keccak "$(cat ../MEMO_ESTRUCTURA_MICA_EXENTA.md)"
 *
 * Requisitos previos:
 *   - IPRegistryNFT ya desplegado en la red destino (ver DeployDocumentSystem.s.sol).
 *     Hoy NO existe en Polygon (137) ni BSC (56) — solo en Anvil local (31337).
 *   - REGISTRY_ADDRESS apuntando a esa dirección.
 *   - DEPLOYER_PRIVATE_KEY con fondos para el registrationFee (0.01 nativo: POL o BNB) + gas.
 *
 * Uso:
 *   forge script script/RegisterMicaMemo.s.sol \
 *     --rpc-url polygon \
 *     --broadcast --verify
 */
contract RegisterMicaMemo is Script {
    bytes32 constant MEMO_PROOF_HASH =
        0xb171afe691fead01c785b51a022ea61d192c6857e2fc48c9f3d4a08dba646631;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address registryAddr = vm.envAddress("REGISTRY_ADDRESS");

        console.log("=== Registro del memo MiCA en IPRegistryNFT ===");
        console.log("Deployer:", deployer);
        console.log("Registry:", registryAddr);
        console.logBytes32(MEMO_PROOF_HASH);

        IPRegistryNFT registry = IPRegistryNFT(registryAddr);

        IPRegistryNFT.Permissions memory perms = IPRegistryNFT.Permissions({
            visibility: IPRegistryNFT.Visibility.PRIVATE,
            listable: false,
            saleEnabled: false,
            rentEnabled: false,
            price: 0
        });

        vm.startBroadcast(deployerKey);

        uint256 ipId = registry.registerIP{value: 0.01 ether}(
            IPRegistryNFT.IPType.CONTRACT,
            "BeZhas - Memo estructura MiCA-exenta (BEZ-Coin, sep-2026)",
            MEMO_PROOF_HASH,
            3650 days, // 10 anios
            perms
        );

        vm.stopBroadcast();

        console.log("IP registrado. ipId =", ipId);
        console.log("Estado: PENDING. Un wallet con REGISTRAR_ROLE debe llamar");
        console.log("approveRegistration(ipId) para dejarlo REGISTERED (validado).");
    }
}
