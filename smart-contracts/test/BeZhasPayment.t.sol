// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/core/BeZhasPayment.sol";
import "../src/tokens/BEZCoinV2.sol";

/**
 * @title BeZhasPaymentTest
 * @notice Test completo del contrato BeZhasPayment
 * @dev Ejecutar con: forge test --match-contract BeZhasPaymentTest -v
 */
contract BeZhasPaymentTest is Test {
    BeZhasPayment public payment;
    BEZCoinV2     public bezToken;

    address public admin    = makeAddr("admin");
    address public treasury = makeAddr("treasury");
    address public payer    = makeAddr("payer");
    address public recipient = makeAddr("recipient");
    address public operator  = makeAddr("operator");

    uint16  constant FEE_BPS    = 10;     // 0.1%
    uint256 constant INITIAL_SUPPLY = 1_000_000e18;
    uint256 constant PAYMENT_AMOUNT  = 1000e18;

    event PaymentProcessed(
        bytes32 indexed orderId,
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        uint256 fee,
        uint256 timestamp
    );

    event PaymentRefunded(
        bytes32 indexed orderId,
        address indexed payer,
        uint256 amount,
        uint256 timestamp
    );

    // ═══════════════════════════════════════════════════════════════════════════
    // SETUP
    // ═══════════════════════════════════════════════════════════════════════════
    function setUp() public {
        vm.startPrank(admin);

        // Deploy BEZCoinV2
        bezToken = new BEZCoinV2(admin);

        // Mint tokens al payer
        bezToken.mint(payer, INITIAL_SUPPLY);

        // Deploy BeZhasPayment
        payment = new BeZhasPayment(
            address(bezToken),
            treasury,
            FEE_BPS,
            admin
        );

        // Dar rol OPERATOR al operator
        payment.grantRole(payment.OPERATOR_ROLE(), operator);

        vm.stopPrank();

        // Payer aprueba el contrato de pago
        vm.prank(payer);
        bezToken.approve(address(payment), type(uint256).max);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: Constructor
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Constructor() public view {
        assertEq(address(payment.bezToken()), address(bezToken));
        assertEq(payment.treasury(), treasury);
        assertEq(payment.platformFeeBps(), FEE_BPS);
        assertTrue(payment.hasRole(payment.DEFAULT_ADMIN_ROLE(), admin));
    }

    function test_Constructor_ZeroToken_Reverts() public {
        vm.expectRevert(BeZhasPayment.ZeroAddress.selector);
        new BeZhasPayment(address(0), treasury, FEE_BPS, admin);
    }

    function test_Constructor_ZeroTreasury_Reverts() public {
        vm.expectRevert(BeZhasPayment.ZeroAddress.selector);
        new BeZhasPayment(address(bezToken), address(0), FEE_BPS, admin);
    }

    function test_Constructor_FeeTooHigh_Reverts() public {
        vm.expectRevert(BeZhasPayment.InvalidFee.selector);
        new BeZhasPayment(address(bezToken), treasury, 1001, admin); // >10%
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: processPayment
    // ═══════════════════════════════════════════════════════════════════════════
    function test_ProcessPayment_Success() public {
        bytes32 orderId = keccak256("order-001");
        uint256 fee     = (PAYMENT_AMOUNT * FEE_BPS) / 10_000;
        uint256 netAmt  = PAYMENT_AMOUNT - fee;

        uint256 payerBalBefore     = bezToken.balanceOf(payer);
        uint256 recipientBalBefore = bezToken.balanceOf(recipient);

        vm.expectEmit(true, true, true, true);
        emit PaymentProcessed(orderId, payer, recipient, netAmt, fee, block.timestamp);

        vm.prank(payer);
        payment.processPayment(recipient, PAYMENT_AMOUNT, orderId, "Test payment");

        // Verificar balances
        assertEq(bezToken.balanceOf(payer),               payerBalBefore - PAYMENT_AMOUNT);
        assertEq(bezToken.balanceOf(recipient),           recipientBalBefore + netAmt);
        assertEq(bezToken.balanceOf(address(payment)),    fee);
        assertEq(payment.accruedFees(),                   fee);

        // Verificar registro
        BeZhasPayment.PaymentRecord memory record = payment.getPayment(orderId);
        assertEq(record.payer,     payer);
        assertEq(record.recipient, recipient);
        assertEq(record.amount,    netAmt);
        assertEq(record.fee,       fee);
        assertEq(record.memo,      "Test payment");
        assertTrue(uint8(record.status) == uint8(BeZhasPayment.Status.COMPLETED));
    }

    function test_ProcessPayment_ZeroRecipient_Reverts() public {
        vm.prank(payer);
        vm.expectRevert(BeZhasPayment.ZeroAddress.selector);
        payment.processPayment(address(0), PAYMENT_AMOUNT, keccak256("o1"), "");
    }

    function test_ProcessPayment_ZeroAmount_Reverts() public {
        vm.prank(payer);
        vm.expectRevert(BeZhasPayment.InsufficientAmount.selector);
        payment.processPayment(recipient, 0, keccak256("o1"), "");
    }

    function test_ProcessPayment_DuplicateOrder_Reverts() public {
        bytes32 orderId = keccak256("order-dup");

        vm.startPrank(payer);
        payment.processPayment(recipient, PAYMENT_AMOUNT, orderId, "first");

        vm.expectRevert(abi.encodeWithSelector(BeZhasPayment.OrderAlreadyProcessed.selector, orderId));
        payment.processPayment(recipient, PAYMENT_AMOUNT, orderId, "duplicate");
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: batchPayment
    // ═══════════════════════════════════════════════════════════════════════════
    function test_BatchPayment_Success() public {
        address[] memory recipients = new address[](3);
        uint256[] memory amounts    = new uint256[](3);
        bytes32[] memory orderIds   = new bytes32[](3);
        string[]  memory memos      = new string[](3);

        for (uint i = 0; i < 3; i++) {
            recipients[i] = makeAddr(string(abi.encodePacked("recv", i)));
            amounts[i]    = 100e18;
            orderIds[i]   = keccak256(abi.encodePacked("batch-order", i));
            memos[i]      = "batch";
        }

        uint256 payerBalBefore = bezToken.balanceOf(payer);

        vm.prank(payer);
        payment.batchPayment(recipients, amounts, orderIds, memos);

        // Verificar que los 3 pagos fueron procesados
        for (uint i = 0; i < 3; i++) {
            assertTrue(payment.isOrderProcessed(orderIds[i]));
        }

        // Total deducido del payer
        uint256 totalAmount = 300e18;
        assertEq(bezToken.balanceOf(payer), payerBalBefore - totalAmount);
    }

    function test_BatchPayment_LengthMismatch_Reverts() public {
        address[] memory recipients = new address[](2);
        uint256[] memory amounts    = new uint256[](3); // Diferente longitud
        bytes32[] memory orderIds   = new bytes32[](2);
        string[]  memory memos      = new string[](2);

        vm.prank(payer);
        vm.expectRevert(BeZhasPayment.BatchLengthMismatch.selector);
        payment.batchPayment(recipients, amounts, orderIds, memos);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: refundPayment
    // ═══════════════════════════════════════════════════════════════════════════
    function test_RefundPayment_Success() public {
        bytes32 orderId = keccak256("order-refund");
        uint256 fee     = (PAYMENT_AMOUNT * FEE_BPS) / 10_000;
        uint256 netAmt  = PAYMENT_AMOUNT - fee;

        // Primero procesar el pago
        vm.prank(payer);
        payment.processPayment(recipient, PAYMENT_AMOUNT, orderId, "refundable");

        // Recipient devuelve netAmt al contrato para que el refund tenga fondos
        vm.prank(recipient);
        bezToken.transfer(address(payment), netAmt);

        uint256 payerBalBefore = bezToken.balanceOf(payer);

        vm.expectEmit(true, true, false, true);
        emit PaymentRefunded(orderId, payer, netAmt + fee, block.timestamp);

        // Reembolsar
        vm.prank(operator);
        payment.refundPayment(orderId);

        // Payer debería recuperar netAmt + fee
        assertEq(bezToken.balanceOf(payer), payerBalBefore + netAmt + fee);
        assertEq(payment.accruedFees(), 0);

        // Estado = REFUNDED
        BeZhasPayment.PaymentRecord memory record = payment.getPayment(orderId);
        assertTrue(uint8(record.status) == uint8(BeZhasPayment.Status.REFUNDED));
    }

    function test_RefundPayment_NotOperator_Reverts() public {
        bytes32 orderId = keccak256("order-001");
        vm.prank(payer);
        payment.processPayment(recipient, PAYMENT_AMOUNT, orderId, "");

        vm.prank(payer); // payer no es operator
        vm.expectRevert();
        payment.refundPayment(orderId);
    }

    function test_RefundPayment_AlreadyRefunded_Reverts() public {
        bytes32 orderId = keccak256("order-001");
        uint256 fee     = (PAYMENT_AMOUNT * FEE_BPS) / 10_000;
        uint256 netAmt  = PAYMENT_AMOUNT - fee;

        vm.prank(payer);
        payment.processPayment(recipient, PAYMENT_AMOUNT, orderId, "");

        // Recipient devuelve tokens para que el refund pueda ejecutarse
        vm.prank(recipient);
        bezToken.transfer(address(payment), netAmt);

        vm.startPrank(operator);
        payment.refundPayment(orderId);

        vm.expectRevert(); // PaymentNotRefundable
        payment.refundPayment(orderId);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: withdrawFees
    // ═══════════════════════════════════════════════════════════════════════════
    function test_WithdrawFees_Success() public {
        bytes32 orderId = keccak256("order-fees");
        uint256 fee     = (PAYMENT_AMOUNT * FEE_BPS) / 10_000;

        vm.prank(payer);
        payment.processPayment(recipient, PAYMENT_AMOUNT, orderId, "");

        uint256 treasuryBalBefore = bezToken.balanceOf(treasury);

        vm.prank(treasury);
        payment.withdrawFees();

        assertEq(bezToken.balanceOf(treasury), treasuryBalBefore + fee);
        assertEq(payment.accruedFees(), 0);
    }

    function test_WithdrawFees_NoFees_Reverts() public {
        vm.prank(treasury);
        vm.expectRevert(BeZhasPayment.NoFeesToWithdraw.selector);
        payment.withdrawFees();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: Pausa
    // ═══════════════════════════════════════════════════════════════════════════
    function test_Pause_BlocksPayments() public {
        vm.prank(operator);
        payment.pause();

        vm.prank(payer);
        vm.expectRevert(); // Pausable: paused
        payment.processPayment(recipient, PAYMENT_AMOUNT, keccak256("o1"), "");
    }

    function test_Unpause_AllowsPayments() public {
        vm.prank(operator);
        payment.pause();

        vm.prank(operator);
        payment.unpause();

        vm.prank(payer);
        payment.processPayment(recipient, PAYMENT_AMOUNT, keccak256("o1"), "");
        assertTrue(payment.isOrderProcessed(keccak256("o1")));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TEST: calculateFee
    // ═══════════════════════════════════════════════════════════════════════════
    function test_CalculateFee() public view {
        (uint256 fee, uint256 netAmount) = payment.calculateFee(1000e18);
        assertEq(fee,       1e18);      // 0.1% de 1000
        assertEq(netAmount, 999e18);    // 1000 - 1
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FUZZ TEST: processPayment con montos aleatorios
    // ═══════════════════════════════════════════════════════════════════════════
    function testFuzz_ProcessPayment_AnyAmount(uint256 amount) public {
        amount = bound(amount, 1e18, INITIAL_SUPPLY);
        bytes32 orderId = keccak256(abi.encodePacked(amount, block.timestamp));

        uint256 fee    = (amount * FEE_BPS) / 10_000;
        uint256 netAmt = amount - fee;

        vm.prank(payer);
        payment.processPayment(recipient, amount, orderId, "fuzz");

        assertEq(bezToken.balanceOf(recipient), netAmt);
        assertEq(payment.accruedFees(), fee);
    }
}
