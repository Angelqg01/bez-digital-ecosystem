// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/Hashes.sol";
import "../../src/finance/BeZhasRWAFactory.sol";
import "../../src/finance/RWARentDistributor.sol";

contract MockToken is ERC20 {
    constructor(string memory s) ERC20(s, s) {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// Token que se queda un 1 % en cada transferencia.
contract TokenConComision is ERC20 {
    constructor() ERC20("FOT", "FOT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 quema = value / 100;
            super._update(from, address(0), quema);
            value -= quema;
        }
        super._update(from, to, value);
    }
}

contract RWARentDistributorTest is Test {
    address constant BEZ_ADDR = 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8;
    uint8 constant INMUEBLE = 0;
    uint8 constant OBJETO = 7;

    BeZhasRWAFactory factory;
    RWARentDistributor dist;
    MockToken bez;
    MockToken usdc;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address issuer = makeAddr("issuer");
    address ana = makeAddr("ana");
    address luis = makeAddr("luis");
    address eva = makeAddr("eva");
    address intruso = makeAddr("intruso");

    uint16 constant FEE_BPS = 100; // 1 %

    // Reparto de 1.000: ana 500, luis 300, eva 200.
    uint256 constant TOTAL = 1_000e18;
    uint256 constant A_ANA = 500e18;
    uint256 constant A_LUIS = 300e18;
    uint256 constant A_EVA = 200e18;

    function setUp() public {
        MockToken impl = new MockToken("BEZ");
        vm.etch(BEZ_ADDR, address(impl).code);
        bez = MockToken(BEZ_ADDR);
        usdc = new MockToken("USDC");

        vm.prank(owner);
        factory = new BeZhasRWAFactory();
        dist = new RWARentDistributor(address(factory), treasury, FEE_BPS);

        bez.mint(issuer, 1_000e18);
        usdc.mint(issuer, 100_000e18);
        vm.prank(issuer);
        usdc.approve(address(dist), type(uint256).max);

        vm.roll(100);
        vm.warp(1_800_000_000);
    }

    // ── utilidades ───────────────────────────────────────────────────────────

    function _tokenizar(uint8 categoria) internal returns (uint256 id) {
        vm.startPrank(issuer);
        bez.approve(address(factory), type(uint256).max);
        id = factory.tokenizeAsset("Nave", BeZhasRWAFactory.AssetCategory(categoria), "QmLegal", "QmImg",
            1000, 1_000_000, 10e18, 850, "Algeciras");
        vm.stopPrank();
    }

    function _hoja(address cuenta, uint256 importe) internal pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(cuenta, importe))));
    }

    function _par(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return Hashes.commutativeKeccak256(a, b);
    }

    /// Árbol de tres hojas: raíz = H(H(ana, luis), eva).
    function _raiz() internal view returns (bytes32) {
        return _par(_par(_hoja(ana, A_ANA), _hoja(luis, A_LUIS)), _hoja(eva, A_EVA));
    }

    function _pruebaAna() internal view returns (bytes32[] memory p) {
        p = new bytes32[](2);
        p[0] = _hoja(luis, A_LUIS);
        p[1] = _hoja(eva, A_EVA);
    }

    function _pruebaLuis() internal view returns (bytes32[] memory p) {
        p = new bytes32[](2);
        p[0] = _hoja(ana, A_ANA);
        p[1] = _hoja(eva, A_EVA);
    }

    function _pruebaEva() internal view returns (bytes32[] memory p) {
        p = new bytes32[](1);
        p[0] = _par(_hoja(ana, A_ANA), _hoja(luis, A_LUIS));
    }

    function _plazo() internal view returns (uint64) {
        return uint64(block.timestamp + 30 days);
    }

    function _crear(uint256 assetId, bytes32 raiz, uint256 importe) internal returns (uint256) {
        vm.prank(issuer);
        return dist.createDistribution(assetId, usdc, importe, raiz, uint64(block.number - 1), _plazo(), "QmReparto");
    }

    // ── despliegue ───────────────────────────────────────────────────────────

    function test_constructor_rechazaDireccionesVaciasYComisionExcesiva() public {
        vm.expectRevert(RWARentDistributor.ZeroAddress.selector);
        new RWARentDistributor(address(0), treasury, FEE_BPS);
        vm.expectRevert(RWARentDistributor.ZeroAddress.selector);
        new RWARentDistributor(address(factory), address(0), FEE_BPS);
        vm.expectRevert(RWARentDistributor.FeeTooHigh.selector);
        new RWARentDistributor(address(factory), treasury, 1001);
    }

    // ── crear ────────────────────────────────────────────────────────────────

    function test_crear_depositaElImporteYCobraLaComisionAparte() public {
        uint256 id = _tokenizar(OBJETO);
        uint256 antes = usdc.balanceOf(issuer);

        uint256 d = _crear(id, _raiz(), TOTAL);

        assertEq(d, 1);
        assertEq(usdc.balanceOf(address(dist)), TOTAL);
        assertEq(usdc.balanceOf(treasury), TOTAL / 100);
        assertEq(antes - usdc.balanceOf(issuer), TOTAL + TOTAL / 100);
        (uint256 assetId, address em,, uint256 amount, uint256 remaining, bytes32 root,,,) = dist.distributions(d);
        assertEq(assetId, id);
        assertEq(em, issuer);
        assertEq(amount, TOTAL);
        assertEq(remaining, TOTAL);
        assertEq(root, _raiz());
    }

    function test_crear_soloElCreadorDelActivo() public {
        uint256 id = _tokenizar(OBJETO);
        vm.prank(intruso);
        vm.expectRevert(RWARentDistributor.NotCreator.selector);
        dist.createDistribution(id, usdc, TOTAL, _raiz(), uint64(block.number - 1), _plazo(), "");
    }

    function test_crear_rechazaActivoDesactivado() public {
        uint256 id = _tokenizar(OBJETO);
        vm.prank(owner);
        factory.deactivateAsset(id);
        vm.prank(issuer);
        vm.expectRevert(RWARentDistributor.AssetInactive.selector);
        dist.createDistribution(id, usdc, TOTAL, _raiz(), uint64(block.number - 1), _plazo(), "");
    }

    function test_crear_validaParametros() public {
        uint256 id = _tokenizar(OBJETO);
        uint64 corte = uint64(block.number - 1);
        vm.startPrank(issuer);

        vm.expectRevert(RWARentDistributor.ZeroAddress.selector);
        dist.createDistribution(id, IERC20(address(0)), TOTAL, _raiz(), corte, _plazo(), "");

        vm.expectRevert(RWARentDistributor.ZeroAmount.selector);
        dist.createDistribution(id, usdc, 0, _raiz(), corte, _plazo(), "");

        vm.expectRevert(RWARentDistributor.EmptyRoot.selector);
        dist.createDistribution(id, usdc, TOTAL, bytes32(0), corte, _plazo(), "");

        vm.expectRevert(RWARentDistributor.SnapshotNotInPast.selector);
        dist.createDistribution(id, usdc, TOTAL, _raiz(), uint64(block.number), _plazo(), "");

        vm.expectRevert(RWARentDistributor.DeadlineTooSoon.selector);
        dist.createDistribution(id, usdc, TOTAL, _raiz(), corte, _plazo() - 1, "");

        vm.stopPrank();
    }

    function test_crear_rechazaTokenConComisionEnLaTransferencia() public {
        uint256 id = _tokenizar(OBJETO);
        TokenConComision fot = new TokenConComision();
        fot.mint(issuer, 10_000e18);
        vm.startPrank(issuer);
        fot.approve(address(dist), type(uint256).max);
        vm.expectRevert(RWARentDistributor.UnexpectedAmountReceived.selector);
        dist.createDistribution(id, fot, TOTAL, _raiz(), uint64(block.number - 1), _plazo(), "");
        vm.stopPrank();
    }

    // ── reclamar ─────────────────────────────────────────────────────────────

    function test_reclamar_cadaTitularCobraLoSuyo() public {
        uint256 d = _crear(_tokenizar(OBJETO), _raiz(), TOTAL);

        vm.prank(ana);
        dist.claim(d, ana, A_ANA, _pruebaAna());
        // Lo puede lanzar un tercero; el dinero va al titular.
        vm.prank(intruso);
        dist.claim(d, luis, A_LUIS, _pruebaLuis());
        dist.claim(d, eva, A_EVA, _pruebaEva());

        assertEq(usdc.balanceOf(ana), A_ANA);
        assertEq(usdc.balanceOf(luis), A_LUIS);
        assertEq(usdc.balanceOf(eva), A_EVA);
        assertEq(usdc.balanceOf(intruso), 0);
        assertEq(usdc.balanceOf(address(dist)), 0);
        (,,,, uint256 remaining,,,,) = dist.distributions(d);
        assertEq(remaining, 0);
    }

    function test_reclamar_noSePuedeDosVeces() public {
        uint256 d = _crear(_tokenizar(OBJETO), _raiz(), TOTAL);
        dist.claim(d, ana, A_ANA, _pruebaAna());
        vm.expectRevert(RWARentDistributor.AlreadyClaimed.selector);
        dist.claim(d, ana, A_ANA, _pruebaAna());
    }

    function test_reclamar_rechazaImporteOCuentaOPruebaFalsos() public {
        uint256 d = _crear(_tokenizar(OBJETO), _raiz(), TOTAL);

        vm.expectRevert(RWARentDistributor.InvalidProof.selector);
        dist.claim(d, ana, A_ANA + 1, _pruebaAna());

        vm.expectRevert(RWARentDistributor.InvalidProof.selector);
        dist.claim(d, intruso, A_ANA, _pruebaAna());

        vm.expectRevert(RWARentDistributor.InvalidProof.selector);
        dist.claim(d, ana, A_ANA, _pruebaLuis());
    }

    function test_reclamar_rechazaRepartoInexistente() public {
        vm.expectRevert(RWARentDistributor.UnknownDistribution.selector);
        dist.claim(99, ana, A_ANA, _pruebaAna());
    }

    function test_reclamar_unaPruebaNoSirveEnOtroReparto() public {
        uint256 id = _tokenizar(OBJETO);
        _crear(id, _raiz(), TOTAL);
        // Segundo reparto con otra lista (sólo eva y luis).
        bytes32 otra = _par(_hoja(eva, 1e18), _hoja(luis, 2e18));
        uint256 d2 = _crear(id, otra, 3e18);

        vm.expectRevert(RWARentDistributor.InvalidProof.selector);
        dist.claim(d2, ana, A_ANA, _pruebaAna());
    }

    function test_reclamar_unaRaizInfladaNoTocaElDineroDeOtroReparto() public {
        uint256 id = _tokenizar(OBJETO);
        uint256 bueno = _crear(id, _raiz(), TOTAL);
        // El emisor deposita 100 pero publica la raíz que promete 1.000.
        uint256 inflado = _crear(id, _raiz(), 100e18);

        vm.expectRevert(RWARentDistributor.ExceedsDistribution.selector);
        dist.claim(inflado, ana, A_ANA, _pruebaAna());

        // El reparto correcto sigue íntegro y cobrable.
        dist.claim(bueno, ana, A_ANA, _pruebaAna());
        dist.claim(bueno, luis, A_LUIS, _pruebaLuis());
        dist.claim(bueno, eva, A_EVA, _pruebaEva());
        assertEq(usdc.balanceOf(address(dist)), 100e18);
    }

    function test_reclamar_altoValorExigeKyc() public {
        uint256 id = _tokenizar(INMUEBLE);
        uint256 d = _crear(id, _raiz(), TOTAL);

        vm.expectRevert(RWARentDistributor.KycRequired.selector);
        dist.claim(d, ana, A_ANA, _pruebaAna());

        vm.prank(owner);
        factory.verifyInvestor(id, ana);
        dist.claim(d, ana, A_ANA, _pruebaAna());
        assertEq(usdc.balanceOf(ana), A_ANA);
    }

    function test_reclamar_cierraAlPasarElPlazo() public {
        uint256 d = _crear(_tokenizar(OBJETO), _raiz(), TOTAL);
        uint64 plazo = _plazo();

        vm.warp(plazo);
        dist.claim(d, ana, A_ANA, _pruebaAna()); // el último segundo aún vale

        vm.warp(plazo + 1);
        vm.expectRevert(RWARentDistributor.ClaimWindowClosed.selector);
        dist.claim(d, luis, A_LUIS, _pruebaLuis());
    }

    // ── recuperar ────────────────────────────────────────────────────────────

    function test_recuperar_soloElEmisorYSoloPasadoElPlazo() public {
        uint256 d = _crear(_tokenizar(OBJETO), _raiz(), TOTAL);
        uint64 plazo = _plazo();
        dist.claim(d, ana, A_ANA, _pruebaAna());

        vm.prank(issuer);
        vm.expectRevert(RWARentDistributor.ClaimWindowOpen.selector);
        dist.reclaim(d);

        vm.warp(plazo + 1);
        vm.prank(intruso);
        vm.expectRevert(RWARentDistributor.NotIssuer.selector);
        dist.reclaim(d);

        uint256 antes = usdc.balanceOf(issuer);
        vm.prank(issuer);
        dist.reclaim(d);
        assertEq(usdc.balanceOf(issuer) - antes, TOTAL - A_ANA);

        vm.prank(issuer);
        vm.expectRevert(RWARentDistributor.NothingToReclaim.selector);
        dist.reclaim(d);
    }

    function test_recuperar_noSeLlevaLoDeOtroReparto() public {
        uint256 id = _tokenizar(OBJETO);
        uint256 d1 = _crear(id, _raiz(), TOTAL);
        vm.warp(block.timestamp + 10 days);
        uint256 d2 = _crear(id, _raiz(), TOTAL); // plazo 10 días posterior

        (,,,,,,, uint64 plazo1,) = dist.distributions(d1);
        vm.warp(plazo1 + 1);
        vm.prank(issuer);
        dist.reclaim(d1);

        assertEq(usdc.balanceOf(address(dist)), TOTAL);
        dist.claim(d2, ana, A_ANA, _pruebaAna());
        assertEq(usdc.balanceOf(ana), A_ANA);
    }

    // ── compatibilidad con la API ────────────────────────────────────────────

    /// Raíz y pruebas generadas por api/services/rwaRentTree.js (construirArbol)
    /// para 0xA001…0xA005 con 100, 200, 300, 400 y 500 tokens. Si cambia el
    /// formato de la hoja o del árbol en un lado y no en el otro, esto falla.
    function test_api_lasPruebasDeRwaRentTreeLasAceptaElContrato() public {
        bytes32 raiz = 0x6b27eff555a1468650e1c49152218cc2ca31c98be9184e21544cb51fd3c7be07;
        uint256 d = _crear(_tokenizar(OBJETO), raiz, 1_500e18);

        bytes32[] memory p3 = new bytes32[](3);
        p3[0] = 0x660cf2cd781e2b4cc0c3fe519d8be4b0047666238930df41187a1115ac508811;
        p3[1] = 0x484258aba33d5cf4e6c358a0023bae6368c053fc7c57257cc6684d7e4682e7a0;
        p3[2] = 0xdcc498b545dea4f440238e700ebede5b2fbd37b1c0d5489c22dd37369672c26a;
        dist.claim(d, address(0xA003), 300e18, p3);
        assertEq(usdc.balanceOf(address(0xA003)), 300e18);

        // La hoja que sube sin pareja: prueba de un solo elemento.
        bytes32[] memory p1 = new bytes32[](1);
        p1[0] = 0xcc5745786fae7c1dcf2dac7beb888b34936cf10f685f5eef7bf2542956f92e39;
        dist.claim(d, address(0xA001), 100e18, p1);
        assertEq(usdc.balanceOf(address(0xA001)), 100e18);
    }

    // ── fuzz ─────────────────────────────────────────────────────────────────

    /// Pase lo que pase, de un reparto nunca sale más de lo depositado.
    function testFuzz_nuncaSaleMasDeLoDepositado(uint256 depositado, uint256 a, uint256 b) public {
        depositado = bound(depositado, 1, 10_000e18);
        a = bound(a, 1, 10_000e18);
        b = bound(b, 1, 10_000e18);
        uint256 id = _tokenizar(OBJETO);
        bytes32 raiz = _par(_hoja(ana, a), _hoja(luis, b));
        uint256 d = _crear(id, raiz, depositado);

        bytes32[] memory pa = new bytes32[](1);
        pa[0] = _hoja(luis, b);
        bytes32[] memory pb = new bytes32[](1);
        pb[0] = _hoja(ana, a);

        try dist.claim(d, ana, a, pa) {} catch {}
        try dist.claim(d, luis, b, pb) {} catch {}

        uint256 pagado = usdc.balanceOf(ana) + usdc.balanceOf(luis);
        (,,,, uint256 remaining,,,,) = dist.distributions(d);
        assertLe(pagado, depositado);
        assertEq(pagado + remaining, depositado);
        assertEq(usdc.balanceOf(address(dist)), remaining);
    }
}
