// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {BeZhasDEX} from "../../src/core/BeZhasDEX.sol";
import {DeployDexPool} from "../../script/DeployDexPool.s.sol";

/**
 * Simulación en fork de Polygon del piloto del DEX. NO transmite nada: todo ocurre
 * en una copia local de la cadena, con saldos fabricados por cheatcodes.
 *
 *   POLYGON_FORK_URL=https://polygon-bor-rpc.publicnode.com \
 *     forge test --match-contract DexPilotPolygonFork -vv
 *
 * Decisiones acordadas: precio 0,0075 USD/BEZ, piloto 50 USDC + 6.667 BEZ,
 * comisión 0,30 %, owner = Safe de tesorería.
 */
contract DexPilotPolygonFork is Test {
    address constant BEZ = 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8;
    address constant USDC = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
    address constant SAFE = 0x89c23890c742d710265dD61be789C71dC8999b12;

    uint256 constant SEED_BEZ = 6_667 ether;
    uint256 constant SEED_USDC = 50e6;

    uint256 internal pk = 0xA11CE;
    address internal deployer;
    bool internal forkOk;

    function setUp() public {
        string memory url = vm.envOr("POLYGON_FORK_URL", string("https://polygon-bor-rpc.publicnode.com"));
        try vm.createSelectFork(url) returns (uint256) {
            forkOk = true;
        } catch {
            forkOk = false;
            return;
        }
        deployer = vm.addr(pk);
        vm.deal(deployer, 1 ether); // POL para gas, sólo en el fork
        deal(BEZ, deployer, SEED_BEZ);
        deal(USDC, deployer, SEED_USDC);
    }

    function test_Fork_ContratosReales() public view {
        if (!forkOk) return;
        assertGt(BEZ.code.length, 0, "BEZ sin codigo en el fork");
        assertGt(USDC.code.length, 0, "USDC sin codigo en el fork");
        assertEq(block.chainid, 137);
    }

    function test_Fork_PilotoDeBezUsdc() public {
        if (!forkOk) return;

        vm.setEnv("PRIVATE_KEY", vm.toString(bytes32(pk)));
        vm.setEnv("BEZ_TOKEN", vm.toString(BEZ));
        vm.setEnv("QUOTE_TOKEN", vm.toString(USDC));
        vm.setEnv("DEX_OWNER", vm.toString(SAFE));
        vm.setEnv("DEX_FEE_BPS", "30");
        vm.setEnv("SEED_BEZ", vm.toString(SEED_BEZ));
        vm.setEnv("SEED_QUOTE", vm.toString(SEED_USDC));

        (BeZhasDEX dex, bytes32 id) = new DeployDexPool().run();

        assertEq(dex.owner(), SAFE, "el owner debe ser la Safe, no el deployer");
        assertEq(dex.feeBps(), 30);

        BeZhasDEX.Pool memory pool = dex.getPool(BEZ, USDC);
        assertTrue(pool.exists);
        assertEq(id, dex.pairId(BEZ, USDC));
        // Precio implícito: USDC (6 dec) por BEZ (18 dec) = 50 / 6667 ≈ 0,0075
        uint256 precioMicro = (SEED_USDC * 1e18) / SEED_BEZ; // micro-USDC por BEZ
        console2.log("precio inicial (micro-USDC por BEZ):", precioMicro);
        assertApproxEqRel(precioMicro, 7_500, 0.001e18);

        // Un cliente compra con 5 USDC: lo cotizado coincide con lo recibido y respeta la comisión.
        address cliente = makeAddr("cliente");
        deal(USDC, cliente, 5e6);
        uint256 esperado = dex.quoteSwap(USDC, BEZ, 5e6);
        vm.startPrank(cliente);
        IERC20(USDC).approve(address(dex), 5e6);
        uint256 recibido = dex.swap(USDC, BEZ, 5e6, (esperado * 995) / 1000); // 0,5 % de tolerancia
        vm.stopPrank();
        assertEq(recibido, esperado);
        console2.log("5 USDC compran BEZ (wei):", recibido);

        // Deslizamiento con la pool piloto: 5 USDC sobre 50 USDC de profundidad ≈ 9 %.
        uint256 spotBez = (uint256(5e6) * 1e18) / 7_500; // BEZ que daría el precio inicial sin deslizamiento
        uint256 deslizamientoBps = ((spotBez - recibido) * 10_000) / spotBez;
        console2.log("deslizamiento (bps) con 5 USDC:", deslizamientoBps);
        assertLt(deslizamientoBps, 1_200);

        // El owner (Safe) puede subir la comisión; el deployer ya no.
        vm.prank(deployer);
        vm.expectRevert();
        dex.setFeeBps(50);
        vm.prank(SAFE);
        dex.setFeeBps(50);
        assertEq(dex.feeBps(), 50);
    }
}
