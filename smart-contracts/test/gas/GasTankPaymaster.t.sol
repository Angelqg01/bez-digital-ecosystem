// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {BeZhasVerifyingPaymaster} from "../../src/gas/BeZhasVerifyingPaymaster.sol";
import {GasTankVault} from "../../src/gas/GasTankVault.sol";
import {PackedUserOperation, PostOpMode} from "../../src/gas/IEntryPointV8.sol";

contract MockBEZ is ERC20 {
    constructor() ERC20("BeZhas Coin", "BEZ") { _mint(msg.sender, 1_000_000 ether); }
}

/// @dev EntryPoint mínimo: lleva el depósito y reproduce la secuencia validate → postOp con msg.sender = EntryPoint.
contract MockEntryPoint {
    mapping(address => uint256) public balanceOf;
    uint256 public staked;
    function depositTo(address a) external payable { balanceOf[a] += msg.value; }
    function withdrawTo(address payable to, uint256 amt) external { balanceOf[msg.sender] -= amt; to.transfer(amt); }
    function addStake(uint32) external payable { staked += msg.value; }
    function unlockStake() external {}
    function withdrawStake(address payable to) external { uint256 s = staked; staked = 0; to.transfer(s); }

    function validate(BeZhasVerifyingPaymaster pm, PackedUserOperation calldata op, uint256 maxCost)
        external returns (bytes memory ctx, uint256 vd)
    { return pm.validatePaymasterUserOp(op, bytes32(0), maxCost); }
    function post(BeZhasVerifyingPaymaster pm, PostOpMode m, bytes calldata ctx, uint256 cost, uint256 fee) external {
        pm.postOp(m, ctx, cost, fee);
    }
}

contract BeZhasVerifyingPaymasterTest is Test {
    MockEntryPoint ep;
    BeZhasVerifyingPaymaster pm;
    address admin = makeAddr("admin");
    uint256 signerPk = 0xA11CE;
    address signer;
    bytes32 constant ORG = keccak256("acme");

    function setUp() public {
        vm.warp(1_800_000_000);
        signer = vm.addr(signerPk);
        ep = new MockEntryPoint();
        pm = new BeZhasVerifyingPaymaster(IEntryPointV8Alias(address(ep)), admin, signer, 0.05 ether);
    }

    function _op(bytes memory callData) internal view returns (PackedUserOperation memory op) {
        op.sender = address(0xBEEF);
        op.nonce = 7;
        op.callData = callData;
        op.accountGasLimits = bytes32(uint256(1));
        op.preVerificationGas = 50_000;
        op.gasFees = bytes32(uint256(2));
        op.paymasterAndData = abi.encodePacked(address(pm), uint128(100_000), uint128(50_000));
    }

    /// Construye paymasterAndData firmado con la clave `pk` sobre la UserOp `op`.
    function _sign(PackedUserOperation memory op, uint256 pk, bytes32 org, uint48 until, uint48 after_, uint256 signedMax)
        internal view returns (PackedUserOperation memory)
    {
        bytes memory head = abi.encodePacked(address(pm), uint128(100_000), uint128(50_000));
        op.paymasterAndData = abi.encodePacked(head, abi.encode(org, until, after_, signedMax), new bytes(65));
        bytes32 h = pm.getHash(op, org, until, after_, signedMax);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h)));
        op.paymasterAndData = abi.encodePacked(head, abi.encode(org, until, after_, signedMax), r, s, v);
        return op;
    }

    function _validate(PackedUserOperation memory op, uint256 maxCost) internal returns (bytes memory ctx, uint256 vd) {
        return ep.validate(pm, op, maxCost);
    }

    function test_validSignatureAccepted_andWindowPacked() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 100, 0.02 ether);
        (bytes memory ctx, uint256 vd) = _validate(op, 0.01 ether);
        assertEq(vd & 1, 0, "sigFailed");
        assertEq(uint48(vd >> 160), uint48(block.timestamp + 600));
        assertEq(uint48(vd >> 208), 100);
        (bytes32 org, address sender) = abi.decode(ctx, (bytes32, address));
        assertEq(org, ORG);
        assertEq(sender, address(0xBEEF));
    }

    function test_unknownSigner_returnsSigFailed_notRevert() public {
        PackedUserOperation memory op = _sign(_op("call"), 0xBAD, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        (, uint256 vd) = _validate(op, 0.01 ether);
        assertEq(vd & 1, 1);
    }

    function test_tamperedCallData_failsSignature() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        op.callData = "otra";
        (, uint256 vd) = _validate(op, 0.01 ether);
        assertEq(vd & 1, 1);
    }

    function test_tamperedOrgOrNonce_failsSignature() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        op.nonce = 8;
        (, uint256 vd) = _validate(op, 0.01 ether);
        assertEq(vd & 1, 1);
    }

    function test_signatureBoundToChainId() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        vm.chainId(999);
        (, uint256 vd) = _validate(op, 0.01 ether);
        assertEq(vd & 1, 1);
    }

    function test_garbageSignature_doesNotRevert() public {
        PackedUserOperation memory op = _op("call");
        op.paymasterAndData = abi.encodePacked(
            address(pm), uint128(100_000), uint128(50_000),
            abi.encode(ORG, uint48(block.timestamp + 600), uint48(0), uint256(0.02 ether)), new bytes(65)
        );
        (, uint256 vd) = _validate(op, 0.01 ether);
        assertEq(vd & 1, 1);
    }

    function test_revertsWhenMaxCostAboveSignedMax() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        vm.expectRevert(abi.encodeWithSelector(BeZhasVerifyingPaymaster.CostAboveSignedMax.selector, 0.03 ether, 0.02 ether));
        _validate(op, 0.03 ether);
    }

    function test_revertsWhenAboveHardCeiling_evenIfSignedHigher() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 0, 10 ether);
        vm.expectRevert(abi.encodeWithSelector(BeZhasVerifyingPaymaster.CostAboveCeiling.selector, 0.06 ether, 0.05 ether));
        _validate(op, 0.06 ether);
    }

    function test_suspendedOrg_andPause_revert() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        vm.prank(admin); pm.suspendOrg(ORG, true);
        vm.expectRevert(abi.encodeWithSelector(BeZhasVerifyingPaymaster.OrgIsSuspended.selector, ORG));
        _validate(op, 0.01 ether);
        vm.prank(admin); pm.suspendOrg(ORG, false);
        vm.prank(admin); pm.setPaused(true);
        vm.expectRevert(BeZhasVerifyingPaymaster.PausedError.selector);
        _validate(op, 0.01 ether);
    }

    function test_badPaymasterDataLength_reverts() public {
        PackedUserOperation memory op = _op("call");
        op.paymasterAndData = abi.encodePacked(address(pm), uint128(1), uint128(1), hex"1234");
        vm.expectRevert(BeZhasVerifyingPaymaster.BadPaymasterData.selector);
        _validate(op, 1);
    }

    function test_onlyEntryPoint() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        vm.expectRevert(BeZhasVerifyingPaymaster.NotEntryPoint.selector);
        pm.validatePaymasterUserOp(op, bytes32(0), 1);
        vm.expectRevert(BeZhasVerifyingPaymaster.NotEntryPoint.selector);
        pm.postOp(PostOpMode.opSucceeded, abi.encode(ORG, address(1)), 1, 1);
    }

    function test_postOpEmitsGasCharged() public {
        bytes memory ctx = abi.encode(ORG, address(0xBEEF));
        vm.expectEmit(true, true, false, true, address(pm));
        emit BeZhasVerifyingPaymaster.GasCharged(ORG, address(0xBEEF), 123, 456, PostOpMode.opReverted);
        ep.post(pm, PostOpMode.opReverted, ctx, 123, 456);
    }

    function test_signerRotation() public {
        PackedUserOperation memory op = _sign(_op("call"), signerPk, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        vm.prank(admin); pm.setSigner(signer, false);
        (, uint256 vd) = _validate(op, 0.01 ether);
        assertEq(vd & 1, 1);
    }

    function test_adminOnly() public {
        vm.expectRevert();
        pm.setSigner(address(1), true);
        vm.expectRevert();
        pm.suspendOrg(ORG, true);
        vm.expectRevert();
        pm.setPaused(true);
        vm.expectRevert();
        pm.withdrawTo(payable(address(this)), 1);
        vm.expectRevert();
        pm.addStake{value: 1}(1);
    }

    function test_depositAndWithdraw() public {
        vm.deal(address(this), 3 ether);
        pm.deposit{value: 2 ether}();
        assertEq(pm.getDeposit(), 2 ether);
        address payable to = payable(makeAddr("to"));
        vm.prank(admin); pm.withdrawTo(to, 0.5 ether);
        assertEq(to.balance, 0.5 ether);
        assertEq(pm.getDeposit(), 1.5 ether);
        vm.deal(admin, 1 ether);
        vm.prank(admin); pm.addStake{value: 1 ether}(86400);
        assertEq(ep.staked(), 1 ether);
    }

    function testFuzz_onlyConfiguredSignerValidates(uint256 pk) public {
        pk = bound(pk, 1, type(uint128).max);
        vm.assume(pk != signerPk);
        PackedUserOperation memory op = _sign(_op("call"), pk, ORG, uint48(block.timestamp + 600), 0, 0.02 ether);
        (, uint256 vd) = _validate(op, 0.01 ether);
        assertEq(vd & 1, 1);
    }

    receive() external payable {}
}

import {IEntryPointV8 as IEntryPointV8Alias} from "../../src/gas/IEntryPointV8.sol";

contract GasTankVaultTest is Test {
    MockBEZ bez;
    GasTankVault vault;
    address admin = makeAddr("admin");
    uint256 signerPk = 0xA11CE;
    address signer;
    address account = makeAddr("smartAccount");
    address factory = makeAddr("rwaFactory");
    bytes4 constant SEL = bytes4(keccak256("tokenizeAsset(string,uint8,string,string,uint256,uint256,uint256,uint256,string)"));
    bytes32 constant ORG = keccak256("acme");

    function setUp() public {
        vm.warp(1_800_000_000);
        signer = vm.addr(signerPk);
        bez = new MockBEZ();
        vault = new GasTankVault(bez, admin, signer, 500 ether);
        bez.transfer(address(vault), 10_000 ether);
        vm.prank(admin); vault.setFeeRule(factory, SEL, 100 ether);
    }

    function _sig(address to, address target, bytes4 sel, uint256 amount, uint48 until, bytes32 nonce, uint256 pk)
        internal view returns (bytes memory)
    {
        bytes32 h = vault.getHash(ORG, to, target, sel, amount, until, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h)));
        return abi.encodePacked(r, s, v);
    }

    function _pull(uint256 amount, bytes32 nonce) internal {
        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes memory sig = _sig(account, factory, SEL, amount, until, nonce, signerPk);
        vm.prank(account);
        vault.pullProtocolFee(ORG, factory, SEL, amount, until, nonce, sig);
    }

    function test_validPull_sendsBezToCaller() public {
        _pull(100 ether, bytes32("n1"));
        assertEq(bez.balanceOf(account), 100 ether);
        assertEq(vault.spentToday(), 100 ether);
        assertTrue(vault.usedNonce(bytes32("n1")));
    }

    function test_nonceCannotBeReplayed() public {
        _pull(100 ether, bytes32("n1"));
        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes memory sig = _sig(account, factory, SEL, 100 ether, until, bytes32("n1"), signerPk);
        vm.prank(account);
        vm.expectRevert(GasTankVault.NonceUsed.selector);
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("n1"), sig);
    }

    function test_signatureBoundToCaller_stolenSigIsUseless() public {
        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes memory sig = _sig(account, factory, SEL, 100 ether, until, bytes32("n1"), signerPk);
        vm.prank(makeAddr("thief"));
        vm.expectRevert(GasTankVault.BadSignature.selector);
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("n1"), sig);
    }

    function test_wrongSignerOrGarbage_reverts() public {
        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes memory bad = _sig(account, factory, SEL, 100 ether, until, bytes32("n1"), 0xBAD);
        vm.startPrank(account);
        vm.expectRevert(GasTankVault.BadSignature.selector);
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("n1"), bad);
        vm.expectRevert(GasTankVault.BadSignature.selector);
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("n1"), hex"1234");
        vm.stopPrank();
    }

    function test_expired_reverts() public {
        uint48 until = uint48(block.timestamp + 10);
        bytes memory sig = _sig(account, factory, SEL, 100 ether, until, bytes32("n1"), signerPk);
        vm.warp(block.timestamp + 11);
        vm.prank(account);
        vm.expectRevert(GasTankVault.Expired.selector);
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("n1"), sig);
    }

    function test_ruleEnforced_targetSelectorAndCap() public {
        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes memory sig = _sig(account, makeAddr("other"), SEL, 100 ether, until, bytes32("n1"), signerPk);
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(GasTankVault.RuleNotAllowed.selector, makeAddr("other"), SEL));
        vault.pullProtocolFee(ORG, makeAddr("other"), SEL, 100 ether, until, bytes32("n1"), sig);

        sig = _sig(account, factory, SEL, 101 ether, until, bytes32("n2"), signerPk);
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(GasTankVault.AmountAboveRule.selector, 101 ether, 100 ether));
        vault.pullProtocolFee(ORG, factory, SEL, 101 ether, until, bytes32("n2"), sig);

        sig = _sig(account, factory, SEL, 0, until, bytes32("n3"), signerPk);
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(GasTankVault.AmountAboveRule.selector, 0, 100 ether));
        vault.pullProtocolFee(ORG, factory, SEL, 0, until, bytes32("n3"), sig);
    }

    function test_dailyCap_andResetNextDay() public {
        for (uint256 i = 0; i < 5; i++) _pull(100 ether, bytes32(i + 1));
        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes memory sig = _sig(account, factory, SEL, 100 ether, until, bytes32("x"), signerPk);
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(GasTankVault.DailyCapExceeded.selector, 600 ether, 500 ether));
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("x"), sig);

        vm.warp(vm.getBlockTimestamp() + 1 days); // getBlockTimestamp: con via-IR block.timestamp puede quedar en caché
        _pull(100 ether, bytes32("y"));
        assertEq(vault.spentToday(), 100 ether);
    }

    function test_suspendedOrgAndPause() public {
        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes memory sig = _sig(account, factory, SEL, 100 ether, until, bytes32("n1"), signerPk);
        vm.prank(admin); vault.suspendOrg(ORG, true);
        vm.prank(account);
        vm.expectRevert(abi.encodeWithSelector(GasTankVault.OrgIsSuspended.selector, ORG));
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("n1"), sig);
        vm.prank(admin); vault.suspendOrg(ORG, false);
        vm.prank(admin); vault.setPaused(true);
        vm.prank(account);
        vm.expectRevert(GasTankVault.PausedError.selector);
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("n1"), sig);
    }

    function test_onlyOwnerAdmin_andRescue() public {
        vm.expectRevert(); vault.setFeeRule(factory, SEL, 1);
        vm.expectRevert(); vault.setSigner(address(1), true);
        vm.expectRevert(); vault.rescue(address(this), 1);
        vm.prank(admin); vault.rescue(makeAddr("treasury"), 1000 ether);
        assertEq(bez.balanceOf(makeAddr("treasury")), 1000 ether);
    }

    function test_failedPullDoesNotBurnNonceOrMoveFunds() public {
        uint48 until = uint48(vm.getBlockTimestamp() + 600);
        bytes memory sig = _sig(account, factory, SEL, 100 ether, until, bytes32("n1"), 0xBAD);
        vm.prank(account);
        vm.expectRevert();
        vault.pullProtocolFee(ORG, factory, SEL, 100 ether, until, bytes32("n1"), sig);
        assertFalse(vault.usedNonce(bytes32("n1")));
        assertEq(bez.balanceOf(address(vault)), 10_000 ether);
    }

    function testFuzz_vaultNeverPaysMoreThanDailyCap(uint8 n, uint96 amt) public {
        uint256 count = bound(n, 1, 12);
        uint256 amount = bound(amt, 1, 100 ether);
        uint256 paid;
        for (uint256 i = 0; i < count; i++) {
            bytes32 nonce = bytes32(i + 1000);
            uint48 until = uint48(vm.getBlockTimestamp() + 600);
            bytes memory sig = _sig(account, factory, SEL, amount, until, nonce, signerPk);
            vm.prank(account);
            try vault.pullProtocolFee(ORG, factory, SEL, amount, until, nonce, sig) { paid += amount; } catch {}
        }
        assertLe(paid, 500 ether);
        assertEq(bez.balanceOf(account), paid);
    }
}
