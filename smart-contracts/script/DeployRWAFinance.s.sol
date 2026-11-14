// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RWAPrimarySale} from "../src/finance/RWAPrimarySale.sol";
import {RWARentDistributor} from "../src/finance/RWARentDistributor.sol";

/**
 * @title DeployRWAFinance
 * @notice Despliega la venta primaria de fracciones (RWAPrimarySale) y el reparto de
 *         rentas (RWARentDistributor) para UNA fábrica del RWAFactory. Ambos son sin
 *         custodia: ninguno guarda fondos ni fracciones de nadie salvo el depósito de
 *         cada reparto, y la comisión y la tesorería son inmutables.
 *
 * Variables:
 *   RWA_SALE_FEE_BPS   obligatoria. Comisión de la venta primaria en puntos básicos (máx. 1000).
 *   RWA_RENT_FEE_BPS   obligatoria. Comisión del reparto de rentas en puntos básicos (máx. 1000).
 *   RWA_FACTORY        opc. Fábrica. Por defecto «activos» (0xa7e6…0d9A, la de la web /rwa).
 *                      Para «industrial»: 0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0.
 *   RWA_BEZ            opc. Token de la venta. Por defecto BEZ Polygon.
 *   RWA_TREASURY       opc. Recibe las comisiones. Por defecto Treasury DAO (0x89c2…9b12).
 *   RWA_OWNER          opc. Nuevo owner de RWAPrimarySale (sólo puede pausar compras). Si se
 *                      omite, lo conserva el deployer: conviene pasarlo a la Safe.
 *
 * Simulación:  forge script script/DeployRWAFinance.s.sol --rpc-url $POLYGON_RPC_URL --sender <deployer>
 * Despliegue:  forge script script/DeployRWAFinance.s.sol --rpc-url $POLYGON_RPC_URL --account <keystore> --broadcast --verify
 *
 * Después: anotar las direcciones en deployments/137.json y en CLAUDE.md, y en la API
 *   RWA_PRIMARY_SALE_ADDRESS y RWA_RENT_DISTRIBUTOR_ADDRESS (o las *_INDUSTRIAL_ADDRESS).
 */
contract DeployRWAFinance is Script {
    address constant BEZ_POLYGON = 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8;
    address constant TREASURY_DAO = 0x89c23890c742d710265dD61be789C71dC8999b12;
    address constant HOT_WALLET = 0x52Df82920CBAE522880dD7657e43d1A754eD044E;
    address constant FACTORY_ACTIVOS = 0xa7e6656eFA45EB59ca247aa15F883330692C0d9A;
    address constant FACTORY_INDUSTRIAL = 0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0;

    function run() external returns (RWAPrimarySale sale, RWARentDistributor rent) {
        uint16 saleFee = uint16(vm.envUint("RWA_SALE_FEE_BPS"));
        uint16 rentFee = uint16(vm.envUint("RWA_RENT_FEE_BPS"));
        address factory = vm.envOr("RWA_FACTORY", FACTORY_ACTIVOS);
        address bez = vm.envOr("RWA_BEZ", BEZ_POLYGON);
        address treasury = vm.envOr("RWA_TREASURY", TREASURY_DAO);
        address owner = vm.envOr("RWA_OWNER", address(0));

        require(saleFee <= 1000 && rentFee <= 1000, "comision por encima del tope del contrato (10 %)");
        require(treasury != HOT_WALLET && owner != HOT_WALLET, "la Hot Wallet no puede ser tesoreria ni owner");
        if (block.chainid == 137) {
            require(factory == FACTORY_ACTIVOS || factory == FACTORY_INDUSTRIAL, "fabrica no registrada en CLAUDE.md");
            require(factory.code.length > 0 && bez.code.length > 0, "fabrica o BEZ sin codigo en esta cadena");
        }

        console.log("=== RWA finance ===");
        console.log("chainId:", block.chainid);
        console.log("factory:", factory);
        console.log("bez:", bez);
        console.log("treasury:", treasury);
        console.log("sale fee bps:", saleFee);
        console.log("rent fee bps:", rentFee);

        vm.startBroadcast();
        sale = new RWAPrimarySale(factory, bez, treasury, saleFee);
        rent = new RWARentDistributor(factory, treasury, rentFee);
        if (owner != address(0) && owner != msg.sender) sale.transferOwnership(owner);
        vm.stopBroadcast();

        require(address(sale.factory()) == factory && sale.treasury() == treasury && sale.feeBps() == saleFee, "venta: parametros distintos");
        require(address(rent.factory()) == factory && rent.treasury() == treasury && rent.feeBps() == rentFee, "rentas: parametros distintos");
        console.log("RWAPrimarySale:", address(sale));
        console.log("RWARentDistributor:", address(rent));
    }
}
