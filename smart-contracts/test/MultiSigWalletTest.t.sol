// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MultiSigWallet} from "../src/wallet/MultiSigWallet.sol";

contract MultiSigWalletTest is Test {
    MultiSigWallet public msig;
    
    address public admin;
    address public signer2;
    address public signer3;
    address public attacker;
    address public target;

    uint256 constant DAILY_LIMIT = 500 ether;
    uint256 constant LARGE_THRESHOLD = 100 ether;

    function setUp() public {
        admin = makeAddr("admin");
        signer2 = makeAddr("signer2");
        signer3 = makeAddr("signer3");
        attacker = makeAddr("attacker");
        target = makeAddr("target");

        address[] memory signers = new address[](3);
        signers[0] = admin;
        signers[1] = signer2;
        signers[2] = signer3;

        msig = new MultiSigWallet(signers, 2, DAILY_LIMIT, LARGE_THRESHOLD);
        vm.deal(address(msig), 1000 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Constructor / Setup
    // ═══════════════════════════════════════════════════════════════════

    function test_InitialState() public view {
        assertEq(msig.required(), 2);
        assertEq(msig.dailyLimit(), DAILY_LIMIT);
        assertEq(msig.largeOpThreshold(), LARGE_THRESHOLD);
        assertTrue(msig.isSigner(admin));
        assertTrue(msig.isSigner(signer2));
        assertTrue(msig.isSigner(signer3));
        assertFalse(msig.isSigner(attacker));
    }

    function test_AdminRole() public view {
        assertEq(uint256(msig.signerRoles(admin)), uint256(MultiSigWallet.SignerRole.ADMIN));
        assertEq(uint256(msig.signerRoles(signer2)), uint256(MultiSigWallet.SignerRole.OPERATOR));
    }

    function test_CannotCreateWithLessThan2Signers() public {
        address[] memory s = new address[](1);
        s[0] = admin;
        vm.expectRevert("MS: min 2 signers");
        new MultiSigWallet(s, 1, DAILY_LIMIT, LARGE_THRESHOLD);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Submit & Confirm & Execute
    // ═══════════════════════════════════════════════════════════════════

    function test_SubmitTransaction() public {
        vm.prank(admin);
        uint256 txId = msig.submitTransaction(target, 10 ether, "", "Test tx");
        assertEq(txId, 0);
        assertEq(msig.getTransactionCount(), 1);
        // Auto-confirmed by submitter
        assertEq(msig.getConfirmationCount(0), 1);
    }

    function test_ConfirmAndExecute() public {
        vm.prank(admin);
        msig.submitTransaction(target, 10 ether, "", "Small tx");
        
        vm.prank(signer2);
        msig.confirmTransaction(0);
        assertEq(msig.getConfirmationCount(0), 2);
        
        vm.prank(admin);
        msig.executeTransaction(0);
        assertEq(target.balance, 10 ether);
    }

    function test_CannotExecuteWithout2Confirmations() public {
        vm.prank(admin);
        msig.submitTransaction(target, 10 ether, "", "Need 2");
        
        vm.prank(admin);
        vm.expectRevert("MS: not enough confirmations");
        msig.executeTransaction(0);
    }

    function test_NonSignerCannotSubmit() public {
        vm.prank(attacker);
        vm.expectRevert("MS: not signer");
        msig.submitTransaction(target, 10 ether, "", "Hack");
    }

    function test_CannotDoubleConfirm() public {
        vm.prank(admin);
        msig.submitTransaction(target, 10 ether, "", "Test");
        
        vm.prank(admin);
        vm.expectRevert("MS: already confirmed");
        msig.confirmTransaction(0);
    }

    function test_RevokeConfirmation() public {
        vm.prank(admin);
        msig.submitTransaction(target, 10 ether, "", "Test");
        
        vm.prank(admin);
        msig.revokeConfirmation(0);
        assertEq(msig.getConfirmationCount(0), 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Timelock for Large Operations
    // ═══════════════════════════════════════════════════════════════════

    function test_LargeOpGetsTimelock() public {
        vm.prank(admin);
        msig.submitTransaction(target, 200 ether, "", "Big tx");
        
        (,,,, bool executed, , uint256 executeAfter,) = msig.transactions(0);
        assertFalse(executed);
        assertGt(executeAfter, block.timestamp);
    }

    function test_LargeOpCannotExecuteBeforeTimelock() public {
        vm.prank(admin);
        msig.submitTransaction(target, 200 ether, "", "Big tx");
        
        vm.prank(signer2);
        msig.confirmTransaction(0);
        
        vm.prank(admin);
        vm.expectRevert("MS: timelock active");
        msig.executeTransaction(0);
    }

    function test_LargeOpExecutesAfterTimelock() public {
        vm.prank(admin);
        msig.submitTransaction(target, 200 ether, "", "Big tx");
        
        vm.prank(signer2);
        msig.confirmTransaction(0);
        
        vm.warp(block.timestamp + 48 hours + 1);
        
        vm.prank(admin);
        msig.executeTransaction(0);
        assertEq(target.balance, 200 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Daily Limit
    // ═══════════════════════════════════════════════════════════════════

    function test_DailyLimitEnforced() public {
        // Submit & confirm 5 txs of 100 ether each (total 500 = limit)
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(admin);
            msig.submitTransaction(target, 100 ether, "", "Tx");
            vm.prank(signer2);
            msig.confirmTransaction(i);
            vm.warp(block.timestamp + 48 hours + 1);
            vm.prank(admin);
            msig.executeTransaction(i);
        }
        
        // Next should fail
        vm.prank(admin);
        msig.submitTransaction(target, 1 ether, "", "Over limit");
        vm.prank(signer2);
        msig.confirmTransaction(5);
        
        vm.prank(admin);
        vm.expectRevert("MS: daily limit exceeded");
        msig.executeTransaction(5);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Pause / Unpause
    // ═══════════════════════════════════════════════════════════════════

    function test_SignerCanPause() public {
        vm.prank(signer2);
        msig.pause();
        assertTrue(msig.paused());
    }

    function test_PausedCannotExecute() public {
        vm.prank(admin);
        msig.submitTransaction(target, 10 ether, "", "Test");
        vm.prank(signer2);
        msig.confirmTransaction(0);
        
        vm.prank(admin);
        msig.pause();
        
        vm.prank(admin);
        vm.expectRevert("MS: paused");
        msig.executeTransaction(0);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Governance (via multisig)
    // ═══════════════════════════════════════════════════════════════════

    function test_AddSignerViaMultisig() public {
        address newSigner = makeAddr("new");
        bytes memory addData = abi.encodeWithSelector(
            msig.addSigner.selector, newSigner, MultiSigWallet.SignerRole.OPERATOR
        );
        
        vm.prank(admin);
        msig.submitTransaction(address(msig), 0, addData, "Add signer");
        vm.prank(signer2);
        msig.confirmTransaction(0);
        vm.prank(admin);
        msig.executeTransaction(0);
        
        assertTrue(msig.isSigner(newSigner));
    }

    function test_CannotAddSignerDirectly() public {
        address newSigner = makeAddr("new");
        vm.prank(admin);
        vm.expectRevert("MS: only via multisig");
        msig.addSigner(newSigner, MultiSigWallet.SignerRole.OPERATOR);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  Views
    // ═══════════════════════════════════════════════════════════════════

    function test_GetSigners() public view {
        address[] memory s = msig.getSigners();
        assertEq(s.length, 3);
    }

    function test_GetPendingTransactions() public {
        vm.startPrank(admin);
        msig.submitTransaction(target, 1 ether, "", "A");
        msig.submitTransaction(target, 2 ether, "", "B");
        vm.stopPrank();
        
        uint256[] memory pending = msig.getPendingTransactions();
        assertEq(pending.length, 2);
    }

    function test_ReceiveETH() public {
        uint256 before = address(msig).balance;
        vm.deal(address(this), 5 ether);
        (bool ok,) = address(msig).call{value: 5 ether}("");
        assertTrue(ok);
        assertEq(address(msig).balance, before + 5 ether);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  SEC-07: despausar y retirar firmantes
    // ═══════════════════════════════════════════════════════════════════

    function _governance(bytes memory data, string memory why) internal returns (uint256 id) {
        // admin propone (voto 1), signer2 confirma (voto 2) y se ejecuta.
        vm.prank(admin);
        msig.submitTransaction(address(msig), 0, data, why);
        id = msig.getTransactionCount() - 1;
        vm.prank(signer2);
        msig.confirmTransaction(id);
        vm.prank(admin);
        msig.executeTransaction(id);
    }

    // Antes: unpause() era onlyAdmin y el único ADMIN es el primer firmante, así que UNA sola
    // clave (admin) despausaba sin quórum aunque otro firmante hubiera pausado por una alerta,
    // y si esa clave se perdía la wallet quedaba pausada para siempre.
    function test_SingleAdminCannotUnpauseAlone() public {
        vm.prank(signer2);
        msig.pause(); // un firmante pausa ante una alerta

        vm.prank(admin);
        vm.expectRevert();
        msig.unpause();
        assertTrue(msig.paused(), "un solo firmante desbloqueo la wallet sin quorum");
    }

    function test_UnpauseNeedsTheQuorumEvenWhilePaused() public {
        vm.prank(signer2);
        msig.pause();

        // Proponer, confirmar y ejecutar el unpause debe poder hacerse CON la wallet pausada,
        // si no, nadie podría volver a abrirla.
        bytes memory data = abi.encodeWithSelector(msig.unpause.selector);
        vm.prank(admin);
        msig.submitTransaction(address(msig), 0, data, "Unpause");
        uint256 id = msig.getTransactionCount() - 1;

        vm.prank(admin);
        vm.expectRevert("MS: not enough confirmations");
        msig.executeTransaction(id); // sólo hay 1 voto

        vm.prank(signer3);
        msig.confirmTransaction(id);
        vm.prank(admin);
        msig.executeTransaction(id);
        assertFalse(msig.paused());
    }

    function test_PausedWalletStillRejectsEverythingElse() public {
        vm.prank(signer2);
        msig.pause();
        vm.prank(admin);
        vm.expectRevert("MS: paused");
        msig.submitTransaction(target, 1 ether, "", "no deberia poder");
    }

    // Antes: removeSigner no tocaba los votos ya emitidos, así que un firmante retirado
    // seguía aportando su confirmación a las transacciones pendientes.
    function test_RemovedSignerVoteNoLongerCounts() public {
        // T0: admin propone un pago y signer3 vota. Aún no se ejecuta.
        vm.prank(admin);
        msig.submitTransaction(target, 10 ether, "", "Pago pendiente");
        vm.prank(signer3);
        msig.confirmTransaction(0);
        assertEq(msig.getConfirmationCount(0), 2);

        // Se retira a signer3 por gobernanza (admin + signer2).
        _governance(abi.encodeWithSelector(msig.removeSigner.selector, signer3), "Retirar signer3");
        assertFalse(msig.isSigner(signer3));

        // El pago ya sólo tiene el voto del admin: no debe ejecutarse.
        vm.prank(admin);
        vm.expectRevert("MS: not enough confirmations");
        msig.executeTransaction(0);
        assertEq(target.balance, 0);
    }

    function test_RemovedSignerCannotVoteAnymore() public {
        _governance(abi.encodeWithSelector(msig.removeSigner.selector, signer3), "Retirar signer3");
        vm.prank(admin);
        msig.submitTransaction(target, 1 ether, "", "x");
        vm.prank(signer3);
        vm.expectRevert("MS: not signer");
        msig.confirmTransaction(1);
    }

    function test_RemainingSignersCanStillReachQuorumAfterRemoval() public {
        _governance(abi.encodeWithSelector(msig.removeSigner.selector, signer3), "Retirar signer3");
        vm.prank(admin);
        msig.submitTransaction(target, 5 ether, "", "Pago");
        vm.prank(signer2);
        msig.confirmTransaction(1);
        vm.prank(admin);
        msig.executeTransaction(1);
        assertEq(target.balance, 5 ether);
    }
}
