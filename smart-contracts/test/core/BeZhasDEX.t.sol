// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {BeZhasDEX} from "../../src/core/BeZhasDEX.sol";

/// @dev Mock ERC20 con decimales configurables (BEZ=18, USDC=6).
contract MockToken is ERC20 {
    uint8 private immutable _dec;

    constructor(string memory name_, string memory symbol_, uint8 dec_, uint256 supply) ERC20(name_, symbol_) {
        _dec = dec_;
        _mint(msg.sender, supply);
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mintTo(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title BeZhasDEXTest
 * @notice Cobertura del AMM nativo (pool interna del ecosistema), incluido el escenario
 *         realista BEZ(18 dec)/USDC(6 dec) y la vista getSpotPrice que alimenta el oraculo.
 * @dev forge test --match-contract BeZhasDEXTest -vvv
 */
contract BeZhasDEXTest is Test {
    BeZhasDEX public dex;
    MockToken public bez;   // 18 decimales (token nativo)
    MockToken public usdc;  // 6 decimales (como USDC real)

    address public owner = makeAddr("owner");
    address public lp     = makeAddr("lp");
    address public trader = makeAddr("trader");

    uint16 constant FEE_BPS = 30; // 0.3%

    // Sembrado realista: 1,000,000 BEZ + 50,000 USDC -> precio ~0.05 USDC/BEZ
    uint256 constant SEED_BEZ  = 1_000_000e18;
    uint256 constant SEED_USDC = 50_000e6;

    function setUp() public {
        vm.prank(owner);
        dex = new BeZhasDEX(owner, FEE_BPS);

        bez = new MockToken("BeZhas Coin", "BEZ", 18, 10_000_000e18);
        usdc = new MockToken("USD Coin", "USDC", 6, 10_000_000e6);

        bez.transfer(lp, 5_000_000e18);
        usdc.transfer(lp, 5_000_000e6);
        bez.mintTo(trader, 100_000e18);
        usdc.mintTo(trader, 100_000e6);
    }

    function _createAndSeed() internal returns (bytes32 id) {
        dex.createPool(address(bez), address(usdc));
        id = dex.pairId(address(bez), address(usdc));

        vm.startPrank(lp);
        bez.approve(address(dex), SEED_BEZ);
        usdc.approve(address(dex), SEED_USDC);
        dex.addLiquidity(address(bez), address(usdc), SEED_BEZ, SEED_USDC, 0);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- creación

    function test_CreatePool() public {
        dex.createPool(address(bez), address(usdc));
        BeZhasDEX.Pool memory p = dex.getPool(address(bez), address(usdc));
        assertTrue(p.exists);
        assertEq(p.totalLiquidity, 0);
        (address t0,) = dex.sortTokens(address(bez), address(usdc));
        assertEq(p.token0, t0);
    }

    function test_CreatePool_RevertDuplicate() public {
        dex.createPool(address(bez), address(usdc));
        vm.expectRevert(BeZhasDEX.PoolExists.selector);
        dex.createPool(address(usdc), address(bez)); // mismo par, orden invertido
    }

    function test_CreatePool_RevertIdentical() public {
        vm.expectRevert(BeZhasDEX.IdenticalTokens.selector);
        dex.createPool(address(bez), address(bez));
    }

    function test_CreatePool_RevertZeroAddress() public {
        vm.expectRevert(BeZhasDEX.ZeroAddress.selector);
        dex.createPool(address(bez), address(0));
    }

    function test_GetPool_RevertNotFound() public {
        vm.expectRevert(BeZhasDEX.PoolNotFound.selector);
        dex.getPool(address(bez), address(usdc));
    }

    // ------------------------------------------------------------- liquidez

    function test_AddLiquidity_InitialMintsSqrt() public {
        bytes32 id = _createAndSeed();
        BeZhasDEX.Pool memory p = dex.getPool(address(bez), address(usdc));
        assertEq(uint256(p.reserve0) + uint256(p.reserve1), SEED_BEZ + SEED_USDC);
        uint256 expected = _sqrt(SEED_BEZ * SEED_USDC);
        assertEq(p.totalLiquidity, expected);
        assertEq(dex.liquidityOf(id, lp), expected);
    }

    function test_AddLiquidity_SecondProviderProportional() public {
        _createAndSeed();
        // Segundo LP aporta en la misma proporcion (1,000,000 : 50,000)
        bez.mintTo(trader, 1_000_000e18);
        vm.startPrank(trader);
        bez.approve(address(dex), 200_000e18);
        usdc.approve(address(dex), 10_000e6);
        uint256 liq = dex.addLiquidity(address(bez), address(usdc), 200_000e18, 10_000e6, 0);
        vm.stopPrank();
        assertGt(liq, 0);
        bytes32 id = dex.pairId(address(bez), address(usdc));
        assertEq(dex.liquidityOf(id, trader), liq);
    }

    function test_AddLiquidity_RevertNoPool() public {
        vm.startPrank(lp);
        bez.approve(address(dex), SEED_BEZ);
        usdc.approve(address(dex), SEED_USDC);
        vm.expectRevert(BeZhasDEX.PoolNotFound.selector);
        dex.addLiquidity(address(bez), address(usdc), SEED_BEZ, SEED_USDC, 0);
        vm.stopPrank();
    }

    function test_AddLiquidity_RevertZeroAmount() public {
        dex.createPool(address(bez), address(usdc));
        vm.prank(lp);
        vm.expectRevert(BeZhasDEX.InsufficientAmount.selector);
        dex.addLiquidity(address(bez), address(usdc), 0, SEED_USDC, 0);
    }

    function test_AddLiquidity_RevertSlippage() public {
        _createAndSeed();
        vm.startPrank(lp);
        bez.approve(address(dex), 1_000e18);
        usdc.approve(address(dex), 50e6);
        vm.expectRevert(BeZhasDEX.SlippageExceeded.selector);
        dex.addLiquidity(address(bez), address(usdc), 1_000e18, 50e6, type(uint256).max);
        vm.stopPrank();
    }

    function test_RemoveLiquidity_ReturnsProportional() public {
        bytes32 id = _createAndSeed();
        uint256 liq = dex.liquidityOf(id, lp);

        uint256 bezBefore = bez.balanceOf(lp);
        uint256 usdcBefore = usdc.balanceOf(lp);

        vm.prank(lp);
        (uint256 outA, uint256 outB) = dex.removeLiquidity(address(bez), address(usdc), liq, 0, 0);

        assertApproxEqAbs(outA, SEED_BEZ, 1e12);
        assertApproxEqAbs(outB, SEED_USDC, 1);
        assertEq(bez.balanceOf(lp), bezBefore + outA);
        assertEq(usdc.balanceOf(lp), usdcBefore + outB);
        assertEq(dex.liquidityOf(id, lp), 0);
    }

    function test_RemoveLiquidity_RevertInsufficient() public {
        bytes32 id = _createAndSeed();
        uint256 liq = dex.liquidityOf(id, lp);
        vm.prank(lp);
        vm.expectRevert(BeZhasDEX.InsufficientLiquidity.selector);
        dex.removeLiquidity(address(bez), address(usdc), liq + 1, 0, 0);
    }

    // ----------------------------------------------------------------- swaps

    function test_Swap_RespectsFeeAndMovesReserves() public {
        _createAndSeed();
        uint256 amountIn = 1_000e6; // 1000 USDC -> BEZ
        uint256 expectedOut = dex.quoteSwap(address(usdc), address(bez), amountIn);
        assertGt(expectedOut, 0);

        uint256 bezBefore = bez.balanceOf(trader);
        vm.startPrank(trader);
        usdc.approve(address(dex), amountIn);
        uint256 out = dex.swap(address(usdc), address(bez), amountIn, expectedOut);
        vm.stopPrank();

        assertEq(out, expectedOut);
        assertEq(bez.balanceOf(trader), bezBefore + out);

        // k no decrece (la comision lo incrementa)
        BeZhasDEX.Pool memory p = dex.getPool(address(bez), address(usdc));
        assertGe(uint256(p.reserve0) * uint256(p.reserve1), SEED_BEZ * SEED_USDC);
    }

    function test_Swap_RevertSlippage() public {
        _createAndSeed();
        uint256 amountIn = 1_000e6;
        uint256 expectedOut = dex.quoteSwap(address(usdc), address(bez), amountIn);
        vm.startPrank(trader);
        usdc.approve(address(dex), amountIn);
        vm.expectRevert(BeZhasDEX.SlippageExceeded.selector);
        dex.swap(address(usdc), address(bez), amountIn, expectedOut + 1);
        vm.stopPrank();
    }

    function test_QuoteSwap_RevertNoPool() public {
        vm.expectRevert(BeZhasDEX.PoolNotFound.selector);
        dex.quoteSwap(address(bez), address(usdc), 1e18);
    }

    // ------------------------------------------------------------ getSpotPrice

    function test_GetSpotPrice_ReflectsReserves() public {
        _createAndSeed();
        uint256 priceUsdcInBez = dex.getSpotPrice(address(usdc), address(bez));
        assertEq(priceUsdcInBez, (SEED_BEZ * 1e18) / SEED_USDC);

        uint256 priceBezInUsdc = dex.getSpotPrice(address(bez), address(usdc));
        assertEq(priceBezInUsdc, (SEED_USDC * 1e18) / SEED_BEZ);
    }

    function test_GetSpotPrice_DecimalNormalizationByConsumer() public {
        _createAndSeed();
        // El consumidor normaliza decimales: BEZ(18)/USDC(6) => factor 1e12.
        // 50,000 USDC / 1,000,000 BEZ = 0.05 USD/BEZ
        uint256 raw = dex.getSpotPrice(address(bez), address(usdc));
        uint256 bezUsdScaled1e18 = raw * 1e12; // ajuste por (18-6) decimales
        assertEq(bezUsdScaled1e18, 0.05e18);
    }

    function test_GetSpotPrice_RevertNoPool() public {
        vm.expectRevert(BeZhasDEX.PoolNotFound.selector);
        dex.getSpotPrice(address(bez), address(usdc));
    }

    function test_GetSpotPrice_RevertNoLiquidity() public {
        dex.createPool(address(bez), address(usdc));
        vm.expectRevert(BeZhasDEX.InsufficientLiquidity.selector);
        dex.getSpotPrice(address(bez), address(usdc));
    }

    // -------------------------------------------------------------------- fee

    function test_SetFeeBps_OnlyOwner() public {
        vm.prank(owner);
        dex.setFeeBps(50);
        assertEq(dex.feeBps(), 50);
    }

    function test_SetFeeBps_RevertNotOwner() public {
        vm.prank(trader);
        vm.expectRevert();
        dex.setFeeBps(50);
    }

    function test_SetFeeBps_RevertInvalid() public {
        uint16 tooHigh = dex.MAX_FEE_BPS() + 1; // fuera del expectRevert (es una llamada externa)
        vm.prank(owner);
        vm.expectRevert(BeZhasDEX.InvalidFee.selector);
        dex.setFeeBps(tooHigh);
    }

    // ----------------------------------------------------------------- helper

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    // ===================================================================
    //  TWAP (SEC-06): getSpotPrice se manipula con un préstamo flash; el TWAP no
    // ===================================================================

    function _baselinePrice() internal view returns (uint256) {
        return (SEED_USDC * 1e18) / SEED_BEZ; // precio spot inicial de BEZ en USDC (sin normalizar decimales)
    }

    function _whaleSwapUsdcForBez(uint256 usdcIn) internal {
        address whale = makeAddr("whale");
        usdc.mintTo(whale, usdcIn);
        vm.startPrank(whale);
        usdc.approve(address(dex), usdcIn);
        dex.swap(address(usdc), address(bez), usdcIn, 0);
        vm.stopPrank();
    }

    function test_TWAP_NoObservationReverts() public {
        _createAndSeed();
        vm.expectRevert(BeZhasDEX.NoObservation.selector);
        dex.consultTwap(address(bez), address(usdc));
    }

    function test_TWAP_WindowTooShortReverts() public {
        _createAndSeed();
        dex.updateObservation(address(bez), address(usdc));
        vm.warp(block.timestamp + 5 minutes);
        vm.expectRevert(BeZhasDEX.TwapWindowTooShort.selector);
        dex.consultTwap(address(bez), address(usdc));
    }

    function test_TWAP_EqualsTheSpotPriceWhenNothingMoves() public {
        _createAndSeed();
        dex.updateObservation(address(bez), address(usdc));
        vm.warp(block.timestamp + 1 hours);
        assertEq(dex.consultTwap(address(bez), address(usdc)), _baselinePrice());
        // y en sentido inverso
        assertEq(dex.consultTwap(address(usdc), address(bez)), dex.getSpotPrice(address(usdc), address(bez)));
    }

    function test_TWAP_ResistsAFlashManipulationInsideOneBlock() public {
        _createAndSeed();
        dex.updateObservation(address(bez), address(usdc));
        vm.warp(block.timestamp + 1 hours);

        uint256 spotBefore = dex.getSpotPrice(address(bez), address(usdc));
        _whaleSwapUsdcForBez(500_000e6); // 10x las reservas en USDC: el precio spot se dispara

        uint256 spotAfter = dex.getSpotPrice(address(bez), address(usdc));
        assertGt(spotAfter, spotBefore * 50, "la manipulacion deberia mover mucho el precio spot");

        // En el MISMO bloque, el TWAP no se entera: el precio manipulado ha durado 0 segundos.
        assertEq(dex.consultTwap(address(bez), address(usdc)), spotBefore, "el TWAP se dejo manipular");
    }

    function test_TWAP_AManipulationHeldBrieflyMovesItOnlyInProportion() public {
        _createAndSeed();
        dex.updateObservation(address(bez), address(usdc));
        vm.warp(block.timestamp + 59 minutes);
        _whaleSwapUsdcForBez(500_000e6);
        vm.warp(block.timestamp + 1 minutes); // el precio manipulado dura 1 minuto de 60

        uint256 twap = dex.consultTwap(address(bez), address(usdc));
        uint256 spotNow = dex.getSpotPrice(address(bez), address(usdc));
        uint256 base = _baselinePrice();
        // media = (59·base + 1·spotNow) / 60
        assertApproxEqRel(twap, (59 * base + spotNow) / 60, 1e15);
        assertLt(twap, base * 3, "un minuto de manipulacion movio el TWAP como si fuera la hora entera");
        assertGt(spotNow, base * 50);
    }

    function test_TWAP_AccumulatesAcrossLiquidityChanges() public {
        _createAndSeed();
        dex.updateObservation(address(bez), address(usdc));
        vm.warp(block.timestamp + 30 minutes);

        // Un LP añade liquidez en proporción: el precio no cambia, y el acumulador sigue creciendo.
        vm.startPrank(lp);
        bez.approve(address(dex), 100_000e18);
        usdc.approve(address(dex), 5_000e6);
        dex.addLiquidity(address(bez), address(usdc), 100_000e18, 5_000e6, 0);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 minutes);
        assertEq(dex.consultTwap(address(bez), address(usdc)), _baselinePrice());
    }

    function test_TWAP_ObservationCannotBeResetBeforeThePeriod() public {
        _createAndSeed();
        dex.updateObservation(address(bez), address(usdc));
        vm.warp(block.timestamp + 29 minutes);
        // Si se pudiera reiniciar, un atacante forzaría una ventana corta justo tras manipular.
        vm.expectRevert(BeZhasDEX.ObservationTooRecent.selector);
        dex.updateObservation(address(bez), address(usdc));

        vm.warp(block.timestamp + 1 minutes);
        dex.updateObservation(address(bez), address(usdc)); // ya se puede
    }

    function test_TWAP_RevertsOnAnUnknownPool() public {
        vm.expectRevert(BeZhasDEX.PoolNotFound.selector);
        dex.updateObservation(address(bez), address(usdc));
        vm.expectRevert(BeZhasDEX.PoolNotFound.selector);
        dex.consultTwap(address(bez), address(usdc));
    }

    function test_TWAP_NeedsLiquidityToObserve() public {
        dex.createPool(address(bez), address(usdc));
        vm.expectRevert(BeZhasDEX.InsufficientLiquidity.selector);
        dex.updateObservation(address(bez), address(usdc));
    }
}
