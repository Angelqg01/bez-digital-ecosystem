// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {DeliveryEscrow} from "../../src/core/DeliveryEscrow.sol";

contract MockBEZ is ERC20 {
    constructor() ERC20("Mock BEZ", "BEZ") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DeliveryEscrowTest is Test {
    MockBEZ internal bez;
    DeliveryEscrow internal escrow;

    address internal admin = address(0xA11CE);
    address internal treasury = address(0x7A);
    address internal buyer = address(0xB0B);
    address internal seller = address(0x5E11);
    address internal oracle = address(0x0A);
    address internal edgeNode = address(0xE9);

    bytes32 internal constant ORDER_ID = keccak256("ORDER-1");
    uint256 internal constant AMOUNT = 1_000 ether;

    function setUp() public {
        bez = new MockBEZ();
        escrow = new DeliveryEscrow(address(bez), treasury, 250, admin);

        // Cache role ids BEFORE pranking: an external view call (ORACLE_ROLE()) evaluated as
        // an argument would otherwise consume vm.prank, making grantRole run as a non-admin.
        bytes32 oracleRole = escrow.ORACLE_ROLE();
        bytes32 edgeNodeRole = escrow.EDGE_NODE_ROLE();
        vm.startPrank(admin);
        escrow.grantRole(oracleRole, oracle);
        escrow.grantRole(edgeNodeRole, edgeNode);
        vm.stopPrank();

        bez.mint(buyer, AMOUNT);
        vm.prank(buyer);
        bez.approve(address(escrow), AMOUNT);
    }

    function testCreateEscrowLocksFunds() public {
        vm.prank(buyer);
        escrow.createEscrow(ORDER_ID, seller, AMOUNT, "delivery-1");

        assertEq(bez.balanceOf(address(escrow)), AMOUNT);
        assertEq(escrow.totalEscrowed(), AMOUNT);
        assertEq(escrow.activeEscrows(), 1);
    }

    function testValidateAndReleasePaysSellerAndAccruesFee() public {
        vm.prank(buyer);
        escrow.createEscrow(ORDER_ID, seller, AMOUNT, "delivery-1");

        vm.prank(oracle);
        escrow.validateAndRelease(ORDER_ID, keccak256("ok"));

        assertEq(bez.balanceOf(seller), 975 ether);
        assertEq(escrow.accruedFees(), 25 ether);
        assertEq(escrow.totalEscrowed(), 0);
        assertEq(escrow.activeEscrows(), 0);
    }

    function testRefundReturnsFullAmountToBuyer() public {
        vm.prank(buyer);
        escrow.createEscrow(ORDER_ID, seller, AMOUNT, "delivery-1");

        vm.prank(oracle);
        escrow.refund(ORDER_ID, keccak256("failed"));

        assertEq(bez.balanceOf(buyer), AMOUNT);
        assertEq(bez.balanceOf(seller), 0);
        assertEq(escrow.accruedFees(), 0);
    }

    function testOnlyOracleCanRelease() public {
        vm.prank(buyer);
        escrow.createEscrow(ORDER_ID, seller, AMOUNT, "delivery-1");

        vm.prank(seller);
        vm.expectRevert();
        escrow.validateAndRelease(ORDER_ID, keccak256("ok"));
    }

    function testEdgeNodeCanValidateAndRelease() public {
        vm.prank(buyer);
        escrow.createEscrow(ORDER_ID, seller, AMOUNT, "delivery-1");

        vm.prank(edgeNode);
        escrow.validateAndRelease(ORDER_ID, keccak256("edge-ok"));

        assertEq(bez.balanceOf(seller), 975 ether);
    }

    function testDisputeCanResolveToRefund() public {
        vm.prank(buyer);
        escrow.createEscrow(ORDER_ID, seller, AMOUNT, "delivery-1");

        vm.prank(buyer);
        escrow.openDispute(ORDER_ID, keccak256("damaged"));

        vm.prank(oracle);
        escrow.resolveDispute(ORDER_ID, false, keccak256("refund"));

        assertEq(bez.balanceOf(buyer), AMOUNT);
        assertEq(escrow.activeEscrows(), 0);
    }

    function testTreasuryWithdrawsFees() public {
        vm.prank(buyer);
        escrow.createEscrow(ORDER_ID, seller, AMOUNT, "delivery-1");

        vm.prank(oracle);
        escrow.validateAndRelease(ORDER_ID, keccak256("ok"));

        vm.prank(treasury);
        escrow.withdrawFees();

        assertEq(bez.balanceOf(treasury), 25 ether);
        assertEq(escrow.accruedFees(), 0);
    }
}
