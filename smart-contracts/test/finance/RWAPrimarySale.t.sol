// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../../src/finance/BeZhasRWAFactory.sol";
import "../../src/finance/RWAPrimarySale.sol";

/// ERC-20 de prueba. El factory tiene BEZ fijado en el constructor, así que se
/// planta en esa dirección con vm.etch.
contract MockBEZ is ERC20 {
    constructor() ERC20("BEZ", "BEZ") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// Comprador contrato que intenta reentrar en buy() al recibir las fracciones.
contract Reentrante is IERC1155Receiver {
    RWAPrimarySale public sale;
    uint256 public listingId;
    bool public reentro;

    constructor(RWAPrimarySale _sale) { sale = _sale; }
    function preparar(IERC20 bez, uint256 _listingId) external {
        listingId = _listingId;
        bez.approve(address(sale), type(uint256).max);
    }
    function comprar(uint256 amount) external { sale.buy(listingId, amount, type(uint256).max); }
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        try sale.buy(listingId, 1, type(uint256).max) { reentro = true; } catch {}
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4) { return this.onERC1155BatchReceived.selector; }
    function supportsInterface(bytes4 id) external pure returns (bool) { return id == type(IERC1155Receiver).interfaceId; }
}

contract RWAPrimarySaleTest is Test {
    address constant BEZ_ADDR = 0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8;

    BeZhasRWAFactory factory;
    RWAPrimarySale sale;
    MockBEZ bez;

    address owner = makeAddr("owner");
    address treasury = makeAddr("treasury");
    address creator = makeAddr("creator");
    address buyer = makeAddr("buyer");

    uint16 constant FEE_BPS = 250; // 2,5 %
    uint256 constant PRICE = 10e18; // 10 BEZ por fracción

    function setUp() public {
        MockBEZ impl = new MockBEZ();
        vm.etch(BEZ_ADDR, address(impl).code);
        bez = MockBEZ(BEZ_ADDR);

        vm.prank(owner);
        factory = new BeZhasRWAFactory();
        vm.prank(owner);
        sale = new RWAPrimarySale(address(factory), BEZ_ADDR, treasury, FEE_BPS);

        bez.mint(creator, 1_000e18);
        bez.mint(buyer, 100_000e18);
    }

    function _tokenizar(uint8 categoria) internal returns (uint256 id) {
        vm.startPrank(creator);
        bez.approve(address(factory), type(uint256).max);
        id = factory.tokenizeAsset("Nave", BeZhasRWAFactory.AssetCategory(categoria), "QmLegal", "QmImg",
            1000, 1_000_000, PRICE, 850, "Algeciras");
        factory.setApprovalForAll(address(sale), true);
        vm.stopPrank();
    }

    function _listar(uint256 id, uint256 amount) internal returns (uint256) {
        vm.prank(creator);
        return sale.list(id, amount, PRICE);
    }

    function test_compraReparteBezSinCustodiaYEntregaFracciones() public {
        uint256 id = _tokenizar(7); // OBJETO: sin KYC obligatorio
        uint256 lid = _listar(id, 500);

        vm.startPrank(buyer);
        bez.approve(address(sale), type(uint256).max);
        sale.buy(lid, 20, PRICE);
        vm.stopPrank();

        uint256 total = 20 * PRICE;
        uint256 fee = total * FEE_BPS / 10_000;
        assertEq(factory.balanceOf(buyer, id), 20);
        assertEq(factory.balanceOf(creator, id), 980);
        assertEq(bez.balanceOf(treasury), fee);
        assertEq(bez.balanceOf(creator), 1_000e18 - 100e18 + total - fee); // menos la comisión de tokenización
        assertEq(bez.balanceOf(address(sale)), 0, "el contrato nunca guarda BEZ");
        assertEq(factory.balanceOf(address(sale), id), 0, "ni fracciones");
        (,,, uint256 remaining, bool active) = sale.listings(lid);
        assertEq(remaining, 480);
        assertTrue(active);
    }

    function test_soloElCreadorPuedeListar() public {
        uint256 id = _tokenizar(7);
        vm.prank(buyer);
        vm.expectRevert(RWAPrimarySale.NotCreator.selector);
        sale.list(id, 10, PRICE);
    }

    function test_listarExigeAprobacionPrevia() public {
        uint256 id = _tokenizar(7);
        vm.prank(creator);
        factory.setApprovalForAll(address(sale), false);
        vm.prank(creator);
        vm.expectRevert(RWAPrimarySale.NotApproved.selector);
        sale.list(id, 10, PRICE);
    }

    function test_altoValorExigeKycAunqueSeaPocaCantidad() public {
        uint256 id = _tokenizar(0); // INMUEBLE
        uint256 lid = _listar(id, 500);
        vm.startPrank(buyer);
        bez.approve(address(sale), type(uint256).max);
        vm.expectRevert(RWAPrimarySale.KycRequired.selector);
        sale.buy(lid, 1, PRICE); // el factory lo dejaría pasar (<10 %); la venta no
        vm.stopPrank();

        vm.prank(owner);
        factory.verifyInvestor(id, buyer);
        vm.prank(buyer);
        sale.buy(lid, 150, PRICE);
        assertEq(factory.balanceOf(buyer, id), 150);
    }

    function test_protegeAlCompradorDelPrecio() public {
        uint256 id = _tokenizar(7);
        uint256 lid = _listar(id, 10);
        vm.startPrank(buyer);
        bez.approve(address(sale), type(uint256).max);
        vm.expectRevert(RWAPrimarySale.PriceAboveMax.selector);
        sale.buy(lid, 1, PRICE - 1);
        vm.stopPrank();
    }

    function test_noVendeMasDeLoListadoYSeCierraAlAgotarse() public {
        uint256 id = _tokenizar(7);
        uint256 lid = _listar(id, 5);
        vm.startPrank(buyer);
        bez.approve(address(sale), type(uint256).max);
        vm.expectRevert(RWAPrimarySale.ListingClosed.selector);
        sale.buy(lid, 6, PRICE);
        sale.buy(lid, 5, PRICE);
        vm.expectRevert(RWAPrimarySale.ListingClosed.selector);
        sale.buy(lid, 1, PRICE);
        vm.stopPrank();
    }

    function test_cancelarSoloElVendedor() public {
        uint256 id = _tokenizar(7);
        uint256 lid = _listar(id, 5);
        vm.prank(buyer);
        vm.expectRevert(RWAPrimarySale.NotSeller.selector);
        sale.cancel(lid);
        vm.prank(creator);
        sale.cancel(lid);
        vm.startPrank(buyer);
        bez.approve(address(sale), type(uint256).max);
        vm.expectRevert(RWAPrimarySale.ListingClosed.selector);
        sale.buy(lid, 1, PRICE);
        vm.stopPrank();
    }

    function test_activoDesactivadoNoSeVende() public {
        uint256 id = _tokenizar(7);
        uint256 lid = _listar(id, 5);
        vm.prank(owner);
        factory.deactivateAsset(id);
        vm.startPrank(buyer);
        bez.approve(address(sale), type(uint256).max);
        vm.expectRevert(RWAPrimarySale.AssetInactive.selector);
        sale.buy(lid, 1, PRICE);
        vm.stopPrank();
    }

    function test_pausaSoloBloqueaCompras() public {
        uint256 id = _tokenizar(7);
        uint256 lid = _listar(id, 5);
        vm.prank(buyer);
        vm.expectRevert();
        sale.pause(); // sólo el owner
        vm.prank(owner);
        sale.pause();
        vm.startPrank(buyer);
        bez.approve(address(sale), type(uint256).max);
        vm.expectRevert();
        sale.buy(lid, 1, PRICE);
        vm.stopPrank();
        vm.prank(creator);
        sale.cancel(lid); // el emisor sigue pudiendo retirar su oferta
    }

    function test_comisionPorEncimaDelTopeNoDespliega() public {
        vm.expectRevert(RWAPrimarySale.FeeTooHigh.selector);
        new RWAPrimarySale(address(factory), BEZ_ADDR, treasury, 1001);
    }

    function test_noHayReentradaDesdeElReceptor() public {
        uint256 id = _tokenizar(7);
        uint256 lid = _listar(id, 10);
        Reentrante r = new Reentrante(sale);
        bez.mint(address(r), 1_000e18);
        r.preparar(bez, lid);
        r.comprar(2);
        assertFalse(r.reentro());
        assertEq(factory.balanceOf(address(r), id), 2);
    }

    function testFuzz_repartoCuadra(uint16 amount) public {
        vm.assume(amount > 0 && amount <= 1000);
        uint256 id = _tokenizar(7);
        uint256 lid = _listar(id, 1000);
        uint256 antesCreador = bez.balanceOf(creator);
        vm.startPrank(buyer);
        bez.approve(address(sale), type(uint256).max);
        sale.buy(lid, amount, PRICE);
        vm.stopPrank();
        uint256 total = uint256(amount) * PRICE;
        assertEq(bez.balanceOf(creator) - antesCreador + bez.balanceOf(treasury), total);
    }
}
