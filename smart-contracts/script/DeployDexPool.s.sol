// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {BeZhasDEX} from "../src/core/BeZhasDEX.sol";

/**
 * @title DeployDexPool
 * @notice Crea (y opcionalmente siembra) la pool interna BEZ/USDC en el AMM nativo
 *         `BeZhasDEX`, reemplazando la dependencia de un DEX externo (QuickSwap).
 *
 * @dev Variables de entorno:
 *   - PRIVATE_KEY     (req)  clave del deployer/seeder
 *   - BEZ_TOKEN       (req)  address del token BEZ (Polygon v1: 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8)
 *   - QUOTE_TOKEN     (req)  address del token quote (USDC Polygon: 0x3c499c542cef5E3811e1192cE70d8cc03d5c3359)
 *   - DEX_ADDRESS     (opt)  si se indica, usa ese DEX; si no, despliega uno nuevo
 *   - DEX_FEE_BPS     (opt)  comision (default 30 = 0.3%), solo al desplegar DEX nuevo
 *   - SEED_BEZ        (opt)  cantidad de BEZ a sembrar (en unidades minimas, 18 dec). 0 = no sembrar
 *   - SEED_QUOTE      (opt)  cantidad de quote a sembrar (en unidades minimas, USDC 6 dec)
 *
 * @dev Ejemplos:
 *   # Solo crear la pool (sin liquidez):
 *   PRIVATE_KEY=0x.. BEZ_TOKEN=0xEcBa.. QUOTE_TOKEN=0x3c49.. \
 *     forge script script/DeployDexPool.s.sol --rpc-url $POLYGON_RPC_URL --broadcast
 *
 *   # Crear + sembrar 1,000,000 BEZ y 50,000 USDC (precio ~0.05 USD/BEZ):
 *   SEED_BEZ=1000000000000000000000000 SEED_QUOTE=50000000000 PRIVATE_KEY=0x.. \
 *   BEZ_TOKEN=0xEcBa.. QUOTE_TOKEN=0x3c49.. \
 *     forge script script/DeployDexPool.s.sol --rpc-url $POLYGON_RPC_URL --broadcast
 */
contract DeployDexPool is Script {
    function run() external returns (BeZhasDEX dex, bytes32 pairId) {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address bez = vm.envAddress("BEZ_TOKEN");
        address quote = vm.envAddress("QUOTE_TOKEN");
        address dexAddr = vm.envOr("DEX_ADDRESS", address(0));
        uint16 feeBps = uint16(vm.envOr("DEX_FEE_BPS", uint256(30)));
        uint256 seedBez = vm.envOr("SEED_BEZ", uint256(0));
        uint256 seedQuote = vm.envOr("SEED_QUOTE", uint256(0));

        require(bez != address(0) && quote != address(0), "BEZ_TOKEN/QUOTE_TOKEN required");
        require(bez != quote, "tokens must differ");

        vm.startBroadcast(pk);

        if (dexAddr == address(0)) {
            dex = new BeZhasDEX(deployer, feeBps);
            console2.log("BeZhasDEX deployed at", address(dex));
        } else {
            dex = BeZhasDEX(dexAddr);
            console2.log("Using existing BeZhasDEX at", address(dex));
        }

        pairId = dex.createPool(bez, quote);
        console2.log("Pool BEZ/QUOTE created");
        console2.logBytes32(pairId);

        if (seedBez > 0 && seedQuote > 0) {
            require(IERC20(bez).balanceOf(deployer) >= seedBez, "insufficient BEZ balance");
            require(IERC20(quote).balanceOf(deployer) >= seedQuote, "insufficient QUOTE balance");

            IERC20(bez).approve(address(dex), seedBez);
            IERC20(quote).approve(address(dex), seedQuote);
            uint256 liquidity = dex.addLiquidity(bez, quote, seedBez, seedQuote, 0);

            console2.log("Seeded liquidity. LP minted:", liquidity);
            console2.log("Spot BEZ->QUOTE (raw 1e18):", dex.getSpotPrice(bez, quote));
            console2.log("(consumer must normalize by decimal difference: BEZ 18 / USDC 6 => x1e12)");
        } else {
            console2.log("Pool created without liquidity (set SEED_BEZ + SEED_QUOTE to seed).");
        }

        vm.stopBroadcast();
    }
}
