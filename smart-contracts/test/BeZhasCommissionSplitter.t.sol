// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/BeZhasCommissionSplitter.sol";
import "../src/tokens/BEZCoinV2.sol";

/**
 * @title BeZhasCommissionSplitterTest
 * @notice Test completo del contrato BeZhasCommissionSplitter
 * @dev Ejecutar con: forge test --match-contract BeZhasCommissionSplitterTest -v
 */
contract BeZhasCommissionSplitterTest is Test {
    BeZhasCommissionSplitter public splitter;
    BEZCoinV2 public bezToken;

    address public admin     = makeAddr("admin");
    address public treasury  = makeAddr("treasury");
    address public settler   = makeAddr("settler");
    address public payer     = makeAddr("payer");   // organización subordinada
    address public recipient = makeAddr("recipient"); // beneficiario final del pago
    address public parentOrg = makeAddr("parentOrg");   // nivel 1
    address public grandparentOrg = makeAddr("grandparentOrg"); // nivel 2

    uint16  constant FEE_BPS = 10; // 0.1% plataforma
    uint256 constant INITIAL_SUPPLY = 1_000_000e18;
    uint256 constant PAYMENT_AMOUNT = 1_000e18;

    event PaymentSplit(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        uint256 platformFee,
        uint256 totalCommission,
        uint256 timestamp
    );

    event CommissionPaid(bytes32 indexed orderId, address indexed beneficiary, uint8 level, uint256 amount);

    function setUp() public {
        vm.startPrank(admin);

        bezToken = new BEZCoinV2(admin);
        bezToken.mint(payer, INITIAL_SUPPLY);

        splitter = new BeZhasCommissionSplitter(address(bezToken), treasury, FEE_BPS, admin);
        splitter.grantRole(splitter.SETTLER_ROLE(), settler);

        vm.stopPrank();

        vm.prank(payer);
        bezToken.approve(address(splitter), type(uint256).max);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Constructor
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Constructor() public view {
        assertEq(address(splitter.bezToken()), address(bezToken));
        assertEq(splitter.treasury(), treasury);
        assertEq(splitter.platformFeeBps(), FEE_BPS);
        assertTrue(splitter.hasRole(splitter.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(splitter.hasRole(splitter.SETTLER_ROLE(), settler));
    }

    function test_Constructor_ZeroToken_Reverts() public {
        vm.expectRevert(BeZhasCommissionSplitter.ZeroAddress.selector);
        new BeZhasCommissionSplitter(address(0), treasury, FEE_BPS, admin);
    }

    function test_Constructor_FeeTooHigh_Reverts() public {
        vm.expectRevert(BeZhasCommissionSplitter.InvalidFee.selector);
        new BeZhasCommissionSplitter(address(bezToken), treasury, 1001, admin);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // settlePaymentWithCommissions — camino feliz
    // ═══════════════════════════════════════════════════════════════════════════
    function test_SettlePayment_CascadeTwoLevels() public {
        // Réplica del caso de commissionEngine.test.js: 10% nivel 1, 5% nivel 2 (decae x0.5)
        address[] memory beneficiaries = new address[](2);
        beneficiaries[0] = parentOrg;
        beneficiaries[1] = grandparentOrg;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 1000; // 10%
        bps[1] = 500;  // 5%

        bytes32 orderId = keccak256("tx-1");

        uint256 platformFee = (PAYMENT_AMOUNT * FEE_BPS) / 10_000;
        uint256 totalCommission = (PAYMENT_AMOUNT * 1500) / 10_000;
        uint256 netToRecipient = PAYMENT_AMOUNT - platformFee - totalCommission;

        vm.expectEmit(true, true, true, true);
        emit PaymentSplit(orderId, payer, recipient, PAYMENT_AMOUNT, platformFee, totalCommission, block.timestamp);

        vm.prank(settler);
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, orderId, beneficiaries, bps);

        assertEq(bezToken.balanceOf(recipient), netToRecipient);
        assertEq(bezToken.balanceOf(parentOrg), (PAYMENT_AMOUNT * 1000) / 10_000);
        assertEq(bezToken.balanceOf(grandparentOrg), (PAYMENT_AMOUNT * 500) / 10_000);
        assertEq(splitter.accruedFees(), platformFee);
        assertTrue(splitter.isOrderProcessed(orderId));
    }

    function test_SettlePayment_NoBeneficiaries_ActsLikePlainPayment() public {
        bytes32 orderId = keccak256("tx-no-hierarchy");
        address[] memory beneficiaries = new address[](0);
        uint16[] memory bps = new uint16[](0);

        vm.prank(settler);
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, orderId, beneficiaries, bps);

        uint256 platformFee = (PAYMENT_AMOUNT * FEE_BPS) / 10_000;
        assertEq(bezToken.balanceOf(recipient), PAYMENT_AMOUNT - platformFee);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // settlePaymentWithCommissions — guardas
    // ═══════════════════════════════════════════════════════════════════════════
    function test_SettlePayment_OnlySettlerRole() public {
        address[] memory beneficiaries = new address[](0);
        uint16[] memory bps = new uint16[](0);
        vm.prank(payer); // payer NO tiene SETTLER_ROLE
        vm.expectRevert();
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, keccak256("x"), beneficiaries, bps);
    }

    function test_SettlePayment_DuplicateOrder_Reverts() public {
        address[] memory beneficiaries = new address[](0);
        uint16[] memory bps = new uint16[](0);
        bytes32 orderId = keccak256("dup");

        vm.startPrank(settler);
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, orderId, beneficiaries, bps);

        vm.expectRevert(abi.encodeWithSelector(BeZhasCommissionSplitter.OrderAlreadyProcessed.selector, orderId));
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, orderId, beneficiaries, bps);
        vm.stopPrank();
    }

    function test_SettlePayment_LengthMismatch_Reverts() public {
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = parentOrg;
        uint16[] memory bps = new uint16[](2);
        bps[0] = 100; bps[1] = 200;

        vm.prank(settler);
        vm.expectRevert(BeZhasCommissionSplitter.LengthMismatch.selector);
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, keccak256("x"), beneficiaries, bps);
    }

    function test_SettlePayment_TooManyBeneficiaries_Reverts() public {
        address[] memory beneficiaries = new address[](6); // > MAX_BENEFICIARIES (5)
        uint16[] memory bps = new uint16[](6);
        for (uint256 i = 0; i < 6; i++) {
            beneficiaries[i] = makeAddr(string(abi.encodePacked("b", i)));
            bps[i] = 1;
        }

        vm.prank(settler);
        vm.expectRevert(BeZhasCommissionSplitter.TooManyBeneficiaries.selector);
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, keccak256("x"), beneficiaries, bps);
    }

    function test_SettlePayment_CommissionTooHigh_Reverts() public {
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = parentOrg;
        uint16[] memory bps = new uint16[](1);
        bps[0] = 3001; // > MAX_TOTAL_COMMISSION_BPS (3000 = 30%)

        vm.prank(settler);
        vm.expectRevert(BeZhasCommissionSplitter.CommissionTooHigh.selector);
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, keccak256("x"), beneficiaries, bps);
    }

    function test_SettlePayment_ZeroBeneficiaryAddress_Reverts() public {
        address[] memory beneficiaries = new address[](1);
        beneficiaries[0] = address(0);
        uint16[] memory bps = new uint16[](1);
        bps[0] = 100;

        vm.prank(settler);
        vm.expectRevert(BeZhasCommissionSplitter.ZeroAddress.selector);
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, keccak256("x"), beneficiaries, bps);
    }

    function test_SettlePayment_WhenPaused_Reverts() public {
        vm.prank(admin);
        splitter.pause();

        address[] memory beneficiaries = new address[](0);
        uint16[] memory bps = new uint16[](0);
        vm.prank(settler);
        vm.expectRevert();
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, keccak256("x"), beneficiaries, bps);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Administración
    // ═══════════════════════════════════════════════════════════════════════════
    function test_WithdrawFees() public {
        address[] memory beneficiaries = new address[](0);
        uint16[] memory bps = new uint16[](0);
        vm.prank(settler);
        splitter.settlePaymentWithCommissions(payer, recipient, PAYMENT_AMOUNT, keccak256("x"), beneficiaries, bps);

        uint256 fees = splitter.accruedFees();
        vm.prank(treasury);
        splitter.withdrawFees();

        assertEq(bezToken.balanceOf(treasury), fees);
        assertEq(splitter.accruedFees(), 0);
    }

    function test_SetTreasury_OnlyAdmin() public {
        vm.prank(payer);
        vm.expectRevert();
        splitter.setTreasury(payer);

        vm.prank(admin);
        splitter.setTreasury(payer);
        assertEq(splitter.treasury(), payer);
    }
}
