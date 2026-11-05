// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TelemetryAnchor} from "../src/supplychain/TelemetryAnchor.sol";

interface ISafeLike {
    function getThreshold() external view returns (uint256);
}

/**
 * @title DeployTelemetryAnchor
 * @notice Despliega TelemetryAnchor sola, para anclar recibos del API Marketplace (`mkt:<listingId>`)
 *         y, si se quiere, auditoría de OPERANT (`operant:<tenant>`) en Polygon mientras la L2 no tenga nodo.
 *         El contrato no custodia nada: sólo guarda raíces merkle.
 *
 * Roles al terminar:
 *   OPERATOR_ROLE       sólo ANCHOR_OPERATOR, la hot wallet de anclaje (sólo POL para gas).
 *   DEFAULT_ADMIN_ROLE  sólo ANCHOR_ADMIN (multisig): puede dar o quitar operadores, nada más.
 *   El deployer renuncia a los dos.
 *
 * La clave de despliegue NO va en el entorno: `--account <keystore>` o `--ledger`.
 *
 * Variables:
 *   ANCHOR_ADMIN               multisig; en Polygon (137) se exige contrato con umbral >= 2
 *   ANCHOR_OPERATOR            dirección de MARKETPLACE_ANCHOR_KEY
 *   ANCHOR_ALLOW_WEAK_ADMIN    (opc.) "true" para admin EOA o umbral 1 (SOLO pruebas)
 *
 * Simulación (sin enviar nada):
 *   forge script script/DeployTelemetryAnchor.s.sol --rpc-url $POLYGON_RPC_URL --sender <deployer>
 * Despliegue real:
 *   forge script script/DeployTelemetryAnchor.s.sol --rpc-url $POLYGON_RPC_URL --account <keystore> --broadcast --verify
 * Después: añadir la dirección a deployments/137.json en `supplychain.TelemetryAnchor` (o
 * MARKETPLACE_ANCHOR_POLYGON_ADDRESS en Secret Manager) y a la tabla de contratos de CLAUDE.md.
 */
contract DeployTelemetryAnchor is Script {
    function run() external returns (TelemetryAnchor anchor) {
        address admin = vm.envAddress("ANCHOR_ADMIN");
        address operator = vm.envAddress("ANCHOR_OPERATOR");
        bool allowWeak = vm.envOr("ANCHOR_ALLOW_WEAK_ADMIN", false);

        require(admin != address(0) && operator != address(0), "admin y operator obligatorios");
        require(admin != operator, "el admin y el operador deben ser distintos");
        if (block.chainid == 137 && !allowWeak) {
            require(admin.code.length > 0, "en Polygon el admin debe ser un contrato multisig, no una EOA");
            require(ISafeLike(admin).getThreshold() >= 2, "el multisig admin debe exigir al menos 2 firmas");
        }

        console.log("=== TelemetryAnchor: despliegue ===");
        console.log("chainId:", block.chainid);
        console.log("admin:", admin);
        console.log("operator:", operator);

        vm.startBroadcast();
        anchor = new TelemetryAnchor();
        address deployer = msg.sender;
        anchor.grantRole(anchor.OPERATOR_ROLE(), operator);
        anchor.grantRole(anchor.DEFAULT_ADMIN_ROLE(), admin);
        if (deployer != operator) anchor.renounceRole(anchor.OPERATOR_ROLE(), deployer);
        if (deployer != admin) anchor.renounceRole(anchor.DEFAULT_ADMIN_ROLE(), deployer);
        vm.stopBroadcast();

        require(anchor.hasRole(anchor.OPERATOR_ROLE(), operator), "operador sin rol");
        require(anchor.hasRole(anchor.DEFAULT_ADMIN_ROLE(), admin), "admin sin rol");
        require(deployer == admin || !anchor.hasRole(anchor.DEFAULT_ADMIN_ROLE(), deployer), "el deployer sigue siendo admin");
        require(deployer == operator || !anchor.hasRole(anchor.OPERATOR_ROLE(), deployer), "el deployer sigue siendo operador");

        console.log("TelemetryAnchor:", address(anchor));
    }
}
