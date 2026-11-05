// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {MarketplaceSettlement} from "../src/core/MarketplaceSettlement.sol";

interface ISafeLike {
    function getThreshold() external view returns (uint256);
}

/**
 * @title DeployMarketplaceSettlement
 * @notice Liquidación en BEZ del API Marketplace con las wallets registradas de BeZhas (CLAUDE.md):
 *   token     BEZ Polygon     0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8
 *   treasury  Treasury DAO    0x89c23890c742d710265dD61be789C71dC8999b12  (recibe la comisión; immutable)
 *   admin     MKT_ADMIN       multisig de los aprobadores de tesorería (umbral >= 2)
 *   registrar MKT_REGISTRAR   wallet del backend que da de alta listings aprobados (sin acceso a fondos)
 *   pauser    MKT_PAUSER      seguridad: sólo puede pausar pagos
 * La Hot Wallet (0x52Df…044E) NO es ningún rol: es una cuenta operativa y caliente.
 *
 * Variables: MKT_ADMIN, MKT_REGISTRAR, MKT_PAUSER (obligatorias); MKT_TOKEN, MKT_TREASURY (opc., por
 * defecto las de arriba); MKT_MAX_FEE_BPS (opc., 2000) y MKT_FEE_BPS (opc., 1500);
 * MKT_ALLOW_WEAK_ADMIN=true sólo en pruebas.
 *
 * Simulación:  forge script script/DeployMarketplaceSettlement.s.sol --rpc-url $POLYGON_RPC_URL --sender <deployer>
 * Despliegue:  forge script script/DeployMarketplaceSettlement.s.sol --rpc-url $POLYGON_RPC_URL --account <keystore> --broadcast --verify
 * El diseño exige dos auditorías externas antes de desplegar en mainnet.
 */
contract DeployMarketplaceSettlement is Script {
    address constant BEZ_POLYGON = 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8;
    address constant TREASURY_DAO = 0x89c23890c742d710265dD61be789C71dC8999b12;
    address constant HOT_WALLET = 0x52Df82920CBAE522880dD7657e43d1A754eD044E;

    function run() external returns (MarketplaceSettlement s) {
        address admin = vm.envAddress("MKT_ADMIN");
        address registrar = vm.envAddress("MKT_REGISTRAR");
        address pauser = vm.envAddress("MKT_PAUSER");
        address token = vm.envOr("MKT_TOKEN", BEZ_POLYGON);
        address treasury = vm.envOr("MKT_TREASURY", TREASURY_DAO);
        uint16 maxFee = uint16(vm.envOr("MKT_MAX_FEE_BPS", uint256(2_000)));
        uint16 fee = uint16(vm.envOr("MKT_FEE_BPS", uint256(1_500)));
        bool allowWeak = vm.envOr("MKT_ALLOW_WEAK_ADMIN", false);

        require(admin != registrar && admin != pauser, "admin distinto de registrar y pauser");
        require(registrar != HOT_WALLET && pauser != HOT_WALLET && admin != HOT_WALLET && treasury != HOT_WALLET,
            "la Hot Wallet no puede tener roles ni ser la tesoreria");
        if (block.chainid == 137) {
            require(token.code.length > 0, "BEZ sin codigo en esta cadena");
            if (!allowWeak) {
                require(admin.code.length > 0, "en Polygon el admin debe ser un multisig, no una EOA");
                require(ISafeLike(admin).getThreshold() >= 2, "el multisig admin debe exigir al menos 2 firmas");
            }
        }

        console.log("=== MarketplaceSettlement ===");
        console.log("chainId:", block.chainid);
        console.log("token:", token);
        console.log("treasury:", treasury);
        console.log("admin:", admin);
        console.log("registrar:", registrar);
        console.log("pauser:", pauser);

        vm.startBroadcast();
        // El deployer es admin sólo durante el despliegue para repartir roles, y renuncia al final.
        address deployer = msg.sender;
        s = new MarketplaceSettlement(IERC20(token), treasury, deployer, maxFee, fee);
        s.grantRole(s.REGISTRAR_ROLE(), registrar);
        s.grantRole(s.PAUSER_ROLE(), pauser);
        s.grantRole(s.DEFAULT_ADMIN_ROLE(), admin);
        if (deployer != admin) s.renounceRole(s.DEFAULT_ADMIN_ROLE(), deployer);
        vm.stopBroadcast();

        require(s.hasRole(s.DEFAULT_ADMIN_ROLE(), admin), "admin sin rol");
        require(deployer == admin || !s.hasRole(s.DEFAULT_ADMIN_ROLE(), deployer), "el deployer sigue siendo admin");
        require(s.treasury() == treasury && address(s.token()) == token, "parametros distintos");
        console.log("MarketplaceSettlement:", address(s));
    }
}
