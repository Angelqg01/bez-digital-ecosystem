// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {MarketplaceSettlement} from "../../src/core/MarketplaceSettlement.sol";

contract MockBEZ is ERC20 {
    constructor() ERC20("BEZ", "BEZ") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

/// Cobra un 1 % en cada transferencia: el contrato debe rechazarlo.
contract FeeToken is ERC20 {
    constructor() ERC20("FEE", "FEE") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function _update(address from, address to, uint256 v) internal override {
        if (from != address(0) && to != address(0)) {
            super._update(from, address(0xdead), v / 100);
            v -= v / 100;
        }
        super._update(from, to, v);
    }
}

contract MarketplaceSettlementTest is Test {
    MockBEZ bez;
    MarketplaceSettlement s;

    address admin = makeAddr("multisig");
    address treasury = makeAddr("treasury");
    address registrar = makeAddr("registrar");
    address pauser = makeAddr("pauser");
    address provider = makeAddr("provider");
    address consumer = makeAddr("consumer");
    address attacker = makeAddr("attacker");
    bytes32 constant LISTING = keccak256("tarifas-aduana");

    function setUp() public {
        bez = new MockBEZ();
        s = new MarketplaceSettlement(IERC20(address(bez)), treasury, admin, 2_000, 1_500);
        vm.startPrank(admin);
        s.grantRole(s.REGISTRAR_ROLE(), registrar);
        s.grantRole(s.PAUSER_ROLE(), pauser);
        vm.stopPrank();
        vm.prank(registrar);
        s.registerListing(LISTING, provider, 100 ether);
        bez.mint(consumer, 1_000 ether);
        vm.prank(consumer);
        bez.approve(address(s), type(uint256).max);
    }

    function test_pay_reparte_en_la_misma_tx() public {
        vm.prank(consumer);
        s.pay(LISTING, 100 ether);
        assertEq(s.balanceOf(provider), 85 ether);
        assertEq(s.balanceOf(treasury), 15 ether);
        assertEq(bez.balanceOf(address(s)), 100 ether);
        assertEq(s.totalOwed(), 100 ether);
    }

    function test_purchaseId_unico_por_pago() public {
        vm.startPrank(consumer);
        bytes32 a = s.pay(LISTING, 100 ether);
        bytes32 b = s.pay(LISTING, 100 ether);
        vm.stopPrank();
        assertTrue(a != b);
    }

    function test_maxPrice_protege_de_subida() public {
        vm.prank(provider);
        s.setPrice(LISTING, 200 ether);
        vm.prank(consumer);
        vm.expectRevert(abi.encodeWithSelector(MarketplaceSettlement.PriceAboveMax.selector, 200 ether, 100 ether));
        s.pay(LISTING, 100 ether);
    }

    function test_cada_uno_retira_lo_suyo() public {
        vm.prank(consumer);
        s.pay(LISTING, 100 ether);
        vm.prank(provider);
        s.withdraw();
        vm.prank(treasury);
        s.withdraw();
        assertEq(bez.balanceOf(provider), 85 ether);
        assertEq(bez.balanceOf(treasury), 15 ether);
        assertEq(bez.balanceOf(address(s)), 0);
        vm.prank(attacker);
        vm.expectRevert(MarketplaceSettlement.NothingToWithdraw.selector);
        s.withdraw();
    }

    function test_pausa_bloquea_pagos_pero_no_retiradas() public {
        vm.prank(consumer);
        s.pay(LISTING, 100 ether);
        vm.prank(pauser);
        s.pause();
        vm.prank(consumer);
        vm.expectRevert();
        s.pay(LISTING, 100 ether);
        vm.prank(provider);
        s.withdraw();
        assertEq(bez.balanceOf(provider), 85 ether);
    }

    function test_el_admin_no_puede_redirigir_un_listing() public {
        vm.prank(admin);
        vm.expectRevert(MarketplaceSettlement.NotProvider.selector);
        s.setProvider(LISTING, attacker);
        vm.prank(registrar);
        vm.expectRevert(MarketplaceSettlement.ListingExists.selector);
        s.registerListing(LISTING, attacker, 1);
    }

    function test_el_proveedor_mueve_solo_ventas_futuras() public {
        vm.prank(consumer);
        s.pay(LISTING, 100 ether);
        address nueva = makeAddr("nueva");
        vm.prank(provider);
        s.setProvider(LISTING, nueva);
        vm.prank(consumer);
        s.pay(LISTING, 100 ether);
        assertEq(s.balanceOf(provider), 85 ether);
        assertEq(s.balanceOf(nueva), 85 ether);
    }

    function test_comision_solo_baja_y_tiene_techo() public {
        vm.startPrank(admin);
        vm.expectRevert(MarketplaceSettlement.FeeCanOnlyDecrease.selector);
        s.lowerFee(1_600);
        s.lowerFee(1_000);
        vm.stopPrank();
        assertEq(s.feeBps(), 1_000);
        vm.expectRevert(MarketplaceSettlement.FeeTooHigh.selector);
        new MarketplaceSettlement(IERC20(address(bez)), treasury, admin, 2_001, 1_000);
        vm.prank(attacker);
        vm.expectRevert();
        s.lowerFee(0);
    }

    function test_listing_inactivo_no_cobra() public {
        vm.prank(registrar);
        s.setListingActive(LISTING, false);
        vm.prank(consumer);
        vm.expectRevert(MarketplaceSettlement.ListingInactive.selector);
        s.pay(LISTING, 100 ether);
    }

    function test_rechaza_token_con_comision_por_transferencia() public {
        FeeToken ft = new FeeToken();
        MarketplaceSettlement s2 = new MarketplaceSettlement(IERC20(address(ft)), treasury, admin, 2_000, 1_000);
        vm.startPrank(admin);
        s2.grantRole(s2.REGISTRAR_ROLE(), registrar);
        vm.stopPrank();
        vm.prank(registrar);
        s2.registerListing(LISTING, provider, 100 ether);
        ft.mint(consumer, 200 ether);
        vm.startPrank(consumer);
        ft.approve(address(s2), type(uint256).max);
        vm.expectRevert(MarketplaceSettlement.UnexpectedTransferAmount.selector);
        s2.pay(LISTING, 100 ether);
        vm.stopPrank();
    }

    /// Invariante: lo que el contrato debe nunca supera lo que tiene, y el reparto cuadra al céntimo.
    function testFuzz_reparto_y_solvencia(uint128 price, uint16 fee, uint8 pagos) public {
        price = uint128(bound(price, 1, 1e30));
        fee = uint16(bound(fee, 0, 2_000));
        pagos = uint8(bound(pagos, 1, 10));
        MarketplaceSettlement s3 = new MarketplaceSettlement(IERC20(address(bez)), treasury, admin, 2_000, fee);
        vm.startPrank(admin);
        s3.grantRole(s3.REGISTRAR_ROLE(), registrar);
        vm.stopPrank();
        vm.prank(registrar);
        s3.registerListing(LISTING, provider, price);
        bez.mint(consumer, uint256(price) * pagos);
        vm.startPrank(consumer);
        bez.approve(address(s3), type(uint256).max);
        for (uint256 i; i < pagos; i++) s3.pay(LISTING, price);
        vm.stopPrank();
        assertEq(s3.balanceOf(provider) + s3.balanceOf(treasury), uint256(price) * pagos);
        assertEq(s3.totalOwed(), bez.balanceOf(address(s3)));
    }
}
