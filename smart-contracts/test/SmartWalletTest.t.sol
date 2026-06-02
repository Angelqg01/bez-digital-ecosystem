// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SmartWallet} from "../src/wallet/SmartWallet.sol";
import {SmartWalletFactory} from "../src/wallet/SmartWalletFactory.sol";

contract SmartWalletTest is Test {
    SmartWallet public wallet;
    SmartWalletFactory public factory;
    
    address public owner;
    uint256 public ownerKey;
    address public guardian;
    address public attacker;
    address public sessionUser;
    address public target;
    
    uint256 constant DAILY_LIMIT = 100 ether;

    function setUp() public {
        (owner, ownerKey) = makeAddrAndKey("owner");
        guardian = makeAddr("guardian");
        attacker = makeAddr("attacker");
        sessionUser = makeAddr("sessionUser");
        target = makeAddr("target");

        factory = new SmartWalletFactory(address(this), 50 ether);
        
        vm.prank(owner);
        address walletAddr = factory.createWallet(guardian, DAILY_LIMIT, bytes32("salt1"));
        wallet = SmartWallet(payable(walletAddr));

        // Fund wallet
        vm.deal(address(wallet), 1000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Factory Tests
    // ═══════════════════════════════════════════════════════════════════

    function test_FactoryCreatesWallet() public view {
        assertEq(wallet.owner(), owner);
        assertEq(wallet.guardian(), guardian);
        assertEq(wallet.dailyLimit(), DAILY_LIMIT);
        assertTrue(factory.isBeZhasWallet(address(wallet)));
        assertEq(factory.totalWallets(), 1);
    }

    function test_FactoryTracksWallets() public view {
        address[] memory wallets = factory.getWalletsByOwner(owner);
        assertEq(wallets.length, 1);
        assertEq(wallets[0], address(wallet));
    }

    function test_FactoryCreateSimple() public {
        vm.prank(owner);
        address w = factory.createWalletSimple(guardian);
        SmartWallet sw = SmartWallet(payable(w));
        assertEq(sw.dailyLimit(), 50 ether); // default
    }

    function test_FactoryDeterministicAddress() public view {
        address computed = factory.computeWalletAddress(owner, guardian, DAILY_LIMIT, bytes32("salt1"));
        assertEq(computed, address(wallet));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Direct Execution
    // ═══════════════════════════════════════════════════════════════════

    function test_OwnerCanExecute() public {
        vm.prank(owner);
        wallet.execute(target, 1 ether, "");
        assertEq(target.balance, 1 ether);
    }

    function test_NonOwnerCannotExecute() public {
        vm.prank(attacker);
        vm.expectRevert("SW: not owner");
        wallet.execute(target, 1 ether, "");
    }

    function test_ExecuteBatch() public {
        address[] memory targets = new address[](2);
        targets[0] = target;
        targets[1] = makeAddr("target2");
        
        uint256[] memory values = new uint256[](2);
        values[0] = 1 ether;
        values[1] = 2 ether;
        
        bytes[] memory datas = new bytes[](2);
        datas[0] = "";
        datas[1] = "";

        vm.prank(owner);
        wallet.executeBatch(targets, values, datas);
        assertEq(target.balance, 1 ether);
        assertEq(targets[1].balance, 2 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Signature Execution (Meta-TX)
    // ═══════════════════════════════════════════════════════════════════

    function test_ExecuteBySignature() public {
        uint256 currentNonce = wallet.nonce();
        
        bytes32 hash = keccak256(abi.encodePacked(
            address(wallet), target, uint256(1 ether), bytes(""), currentNonce, block.chainid
        ));
        bytes32 ethHash = _toEthSignedMessageHash(hash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, ethHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        wallet.executeBySignature(target, 1 ether, "", currentNonce, signature);
        assertEq(target.balance, 1 ether);
        assertEq(wallet.nonce(), currentNonce + 1);
    }

    function test_InvalidSignatureReverts() public {
        uint256 currentNonce = wallet.nonce();
        bytes memory badSig = new bytes(65);
        
        vm.expectRevert();
        wallet.executeBySignature(target, 1 ether, "", currentNonce, badSig);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Daily Limit
    // ═══════════════════════════════════════════════════════════════════

    function test_DailyLimitEnforced() public {
        vm.startPrank(owner);
        wallet.execute(target, 50 ether, "");
        wallet.execute(target, 50 ether, "");
        
        vm.expectRevert("SW: daily limit exceeded");
        wallet.execute(target, 1 ether, "");
        vm.stopPrank();
    }

    function test_DailyLimitResetsAfterDay() public {
        vm.startPrank(owner);
        wallet.execute(target, 100 ether, "");
        
        vm.warp(block.timestamp + 1 days + 1);
        wallet.execute(target, 50 ether, "");
        vm.stopPrank();
        assertEq(target.balance, 150 ether);
    }

    function test_GetRemainingDailyLimit() public {
        assertEq(wallet.getRemainingDailyLimit(), DAILY_LIMIT);
        
        vm.prank(owner);
        wallet.execute(target, 30 ether, "");
        assertEq(wallet.getRemainingDailyLimit(), 70 ether);
    }

    function test_SetDailyLimit() public {
        vm.prank(owner);
        wallet.setDailyLimit(200 ether);
        assertEq(wallet.dailyLimit(), 200 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Lock / Unlock
    // ═══════════════════════════════════════════════════════════════════

    function test_OwnerCanLock() public {
        vm.prank(owner);
        wallet.lockWallet();
        assertTrue(wallet.isLocked());
    }

    function test_GuardianCanLock() public {
        vm.prank(guardian);
        wallet.lockWallet();
        assertTrue(wallet.isLocked());
    }

    function test_LockedWalletCannotExecute() public {
        vm.prank(owner);
        wallet.lockWallet();
        
        vm.prank(owner);
        vm.expectRevert("SW: wallet locked");
        wallet.execute(target, 1 ether, "");
    }

    function test_OwnerCanUnlock() public {
        vm.prank(owner);
        wallet.lockWallet();
        
        vm.prank(owner);
        wallet.unlockWallet();
        assertFalse(wallet.isLocked());
    }

    function test_GuardianCannotUnlock() public {
        vm.prank(owner);
        wallet.lockWallet();
        
        vm.prank(guardian);
        vm.expectRevert("SW: not owner");
        wallet.unlockWallet();
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Sessions
    // ═══════════════════════════════════════════════════════════════════

    function test_CreateSession() public {
        vm.prank(owner);
        wallet.createSession(sessionUser, block.timestamp + 1 days, 10 ether);
        
        (address key, uint256 validUntil, uint256 limit, uint256 spent) = wallet.sessions(sessionUser);
        assertEq(key, sessionUser);
        assertGt(validUntil, block.timestamp);
        assertEq(limit, 10 ether);
        assertEq(spent, 0);
    }

    function test_SessionExecution() public {
        vm.prank(owner);
        wallet.createSession(sessionUser, block.timestamp + 1 days, 10 ether);
        
        vm.prank(sessionUser);
        wallet.executeBySession(target, 5 ether, "");
        assertEq(target.balance, 5 ether);
    }

    function test_SessionLimitEnforced() public {
        vm.prank(owner);
        wallet.createSession(sessionUser, block.timestamp + 1 days, 10 ether);
        
        vm.startPrank(sessionUser);
        wallet.executeBySession(target, 10 ether, "");
        
        vm.expectRevert("SW: session limit");
        wallet.executeBySession(target, 1 ether, "");
        vm.stopPrank();
    }

    function test_SessionExpiry() public {
        vm.prank(owner);
        wallet.createSession(sessionUser, block.timestamp + 1 hours, 10 ether);
        
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(sessionUser);
        vm.expectRevert("SW: session expired");
        wallet.executeBySession(target, 1 ether, "");
    }

    function test_RevokeSession() public {
        vm.prank(owner);
        wallet.createSession(sessionUser, block.timestamp + 1 days, 10 ether);
        
        vm.prank(owner);
        wallet.revokeSession(sessionUser);
        
        vm.prank(sessionUser);
        vm.expectRevert("SW: not session key");
        wallet.executeBySession(target, 1 ether, "");
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Timelock Operations
    // ═══════════════════════════════════════════════════════════════════

    function test_QueueTimelockOp() public {
        vm.prank(owner);
        uint256 opId = wallet.queueTimelockOp(target, 50 ether, "");
        
        (address t, uint256 v, , uint256 ea, bool ex) = wallet.getTimelockOp(opId);
        assertEq(t, target);
        assertEq(v, 50 ether);
        assertGt(ea, block.timestamp);
        assertFalse(ex);
    }

    function test_ExecuteTimelockAfterDelay() public {
        vm.prank(owner);
        uint256 opId = wallet.queueTimelockOp(target, 50 ether, "");
        
        vm.warp(block.timestamp + 48 hours + 1);
        
        vm.prank(owner);
        wallet.executeTimelockOp(opId);
        assertEq(target.balance, 50 ether);
    }

    function test_TimelockTooEarlyReverts() public {
        vm.prank(owner);
        uint256 opId = wallet.queueTimelockOp(target, 50 ether, "");
        
        vm.prank(owner);
        vm.expectRevert("SW: too early");
        wallet.executeTimelockOp(opId);
    }

    function test_CancelTimelockOp() public {
        vm.prank(owner);
        uint256 opId = wallet.queueTimelockOp(target, 50 ether, "");
        
        vm.prank(owner);
        wallet.cancelTimelockOp(opId);
        
        vm.warp(block.timestamp + 48 hours + 1);
        
        vm.prank(owner);
        vm.expectRevert("SW: invalid op");
        wallet.executeTimelockOp(opId);
    }

    function test_GuardianCanCancelTimelock() public {
        vm.prank(owner);
        uint256 opId = wallet.queueTimelockOp(target, 50 ether, "");
        
        vm.prank(guardian);
        wallet.cancelTimelockOp(opId);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Recovery
    // ═══════════════════════════════════════════════════════════════════

    function test_GuardianInitiatesRecovery() public {
        address newOwner = makeAddr("newOwner");
        
        vm.prank(guardian);
        wallet.initiateRecovery(newOwner);
        
        (address no, uint256 ea, bool ex) = wallet.activeRecovery();
        assertEq(no, newOwner);
        assertGt(ea, block.timestamp);
        assertFalse(ex);
    }

    function test_RecoveryExecutedAfterDelay() public {
        address newOwner = makeAddr("newOwner");
        
        vm.prank(guardian);
        wallet.initiateRecovery(newOwner);
        
        vm.warp(block.timestamp + 72 hours + 1);
        
        vm.prank(guardian);
        wallet.executeRecovery();
        assertEq(wallet.owner(), newOwner);
    }

    function test_OwnerCancelsRecovery() public {
        address newOwner = makeAddr("newOwner");
        
        vm.prank(guardian);
        wallet.initiateRecovery(newOwner);
        
        vm.prank(owner);
        wallet.cancelRecovery();
        
        vm.warp(block.timestamp + 72 hours + 1);
        
        vm.prank(guardian);
        vm.expectRevert("SW: no recovery");
        wallet.executeRecovery();
    }

    function test_AttackerCannotInitiateRecovery() public {
        vm.prank(attacker);
        vm.expectRevert("SW: not guardian");
        wallet.initiateRecovery(attacker);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Receive ETH
    // ═══════════════════════════════════════════════════════════════════

    function test_ReceiveETH() public {
        uint256 before = address(wallet).balance;
        vm.deal(address(this), 5 ether);
        (bool ok,) = address(wallet).call{value: 5 ether}("");
        assertTrue(ok);
        assertEq(address(wallet).balance, before + 5 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Helper
    // ═══════════════════════════════════════════════════════════════════

    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }
}
