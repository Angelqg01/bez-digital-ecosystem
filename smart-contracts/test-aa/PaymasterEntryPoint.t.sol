// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, Vm} from "forge-std/Test.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation as AAUserOp} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {SimpleAccount} from "account-abstraction/accounts/SimpleAccount.sol";
import {SimpleAccountFactory} from "account-abstraction/accounts/SimpleAccountFactory.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {GasTankVault} from "../src/gas/GasTankVault.sol";
import {BeZhasVerifyingPaymaster} from "../src/gas/BeZhasVerifyingPaymaster.sol";
import {IEntryPointV8, PackedUserOperation, PostOpMode} from "../src/gas/IEntryPointV8.sol";

contract MockBEZ is ERC20 {
    constructor() ERC20("BeZhas Coin", "BEZ") { _mint(msg.sender, 1_000_000 ether); }
}

/// Imita RWAFactory.tokenizeAsset: cobra la comisión con transferFrom(msg.sender, owner, fee).
contract MockFactory {
    ERC20 public immutable bez;
    address public immutable owner;
    uint256 public assets;
    constructor(ERC20 b, address o) { bez = b; owner = o; }
    function tokenizeAsset(string calldata) external returns (uint256) {
        require(bez.transferFrom(msg.sender, owner, 100 ether), "fee");
        return ++assets;
    }
}

contract Counter {
    uint256 public n;
    function bump() external { n += 1; }
}

/// Integración con el EntryPoint v0.8 REAL: una UserOp de una cuenta sin ETH, pagada por nuestro paymaster.
contract PaymasterEntryPointTest is Test {
    EntryPoint ep;
    SimpleAccount account;
    BeZhasVerifyingPaymaster pm;
    Counter counter;
    address admin = makeAddr("admin");
    address payable beneficiary = payable(makeAddr("bundler"));
    uint256 ownerPk = 0xB0B;
    uint256 signerPk = 0xA11CE;
    bytes32 constant ORG = keccak256("acme");

    function setUp() public {
        vm.warp(1_800_000_000);
        ep = new EntryPoint();
        SimpleAccountFactory f = new SimpleAccountFactory(IEntryPoint(address(ep)));
        vm.prank(address(ep.senderCreator())); // v0.8: la fábrica solo acepta al SenderCreator del EntryPoint
        account = f.createAccount(vm.addr(ownerPk), 0);
        counter = new Counter();
        pm = new BeZhasVerifyingPaymaster(IEntryPointV8(address(ep)), admin, vm.addr(signerPk), 1 ether);
        vm.deal(address(this), 10 ether);
        pm.deposit{value: 5 ether}();
        vm.deal(admin, 1 ether);
        vm.prank(admin);
        pm.addStake{value: 1 ether}(86400);
    }

    function _build(bytes memory callData, bytes32 org, uint48 until, uint48 after_, uint256 signedMax, uint256 pmPk)
        internal view returns (AAUserOp memory aaOp)
    {
        PackedUserOperation memory op;
        op.sender = address(account);
        op.nonce = ep.getNonce(address(account), 0);
        op.callData = callData;
        op.accountGasLimits = bytes32(abi.encodePacked(uint128(200_000), uint128(200_000))); // verification | call
        op.preVerificationGas = 60_000;
        op.gasFees = bytes32(abi.encodePacked(uint128(1 gwei), uint128(2 gwei)));            // priority | maxFee
        bytes memory head = abi.encodePacked(address(pm), uint128(150_000), uint128(80_000));
        op.paymasterAndData = abi.encodePacked(head, abi.encode(org, until, after_, signedMax), new bytes(65));
        bytes32 h = pm.getHash(op, org, until, after_, signedMax);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pmPk, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h)));
        op.paymasterAndData = abi.encodePacked(head, abi.encode(org, until, after_, signedMax), r, s, v);

        aaOp = _toAA(op);
        bytes32 userOpHash = ep.getUserOpHash(aaOp);
        (v, r, s) = vm.sign(ownerPk, userOpHash);
        aaOp.signature = abi.encodePacked(r, s, v);
    }

    function _toAA(PackedUserOperation memory o) internal pure returns (AAUserOp memory a) {
        a.sender = o.sender; a.nonce = o.nonce; a.initCode = o.initCode; a.callData = o.callData;
        a.accountGasLimits = o.accountGasLimits; a.preVerificationGas = o.preVerificationGas; a.gasFees = o.gasFees;
        a.paymasterAndData = o.paymasterAndData; a.signature = o.signature;
    }

    function _exec(bytes memory inner) internal view returns (bytes memory) {
        return abi.encodeWithSelector(bytes4(keccak256("execute(address,uint256,bytes)")), address(counter), uint256(0), inner);
    }

    function _bump() internal view returns (bytes memory) {
        return _exec(abi.encodeCall(Counter.bump, ()));
    }

    function _handle(AAUserOp memory op) internal {
        AAUserOp[] memory ops = new AAUserOp[](1);
        ops[0] = op;
        ep.handleOps(ops, beneficiary);
    }

    function test_sponsoredOp_executes_andPaymasterPays() public {
        assertEq(address(account).balance, 0);
        uint256 depositBefore = pm.getDeposit();
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 600), 0, 0.5 ether, signerPk);

        vm.recordLogs();
        _handle(op);

        assertEq(counter.n(), 1, "la llamada se ejecuto");
        assertEq(address(account).balance, 0, "la cuenta no puso ETH");
        assertLt(pm.getDeposit(), depositBefore, "el paymaster pago el gas");
        assertGt(beneficiary.balance, 0, "el bundler cobro");

        // GasCharged lleva la organizacion y el coste que ve el paymaster en postOp. OJO: el EntryPoint carga ADEMAS
        // el gas del propio postOp, asi que el cargo definitivo (el que descuenta del deposito) es el de
        // UserOperationEvent.actualGasCost. El conciliador off-chain debe liquidar con ese, no con GasCharged.
        uint256 deposited = depositBefore - pm.getDeposit();
        bytes32 uoEvent = keccak256("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool foundCharged;
        bool foundFinal;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(pm) && logs[i].topics[0] == BeZhasVerifyingPaymaster.GasCharged.selector) {
                foundCharged = true;
                assertEq(logs[i].topics[1], ORG);
                (uint256 cost,, PostOpMode mode) = abi.decode(logs[i].data, (uint256, uint256, PostOpMode));
                assertLe(cost, deposited, "GasCharged nunca supera el cargo definitivo");
                assertGt(cost, (deposited * 80) / 100, "y se acerca a el (el resto es el gas del postOp)");
                assertEq(uint8(mode), uint8(PostOpMode.opSucceeded));
            }
            if (logs[i].emitter == address(ep) && logs[i].topics[0] == uoEvent) {
                foundFinal = true;
                assertEq(address(uint160(uint256(logs[i].topics[3]))), address(pm), "UserOperationEvent identifica al paymaster");
                (, , uint256 finalCost,) = abi.decode(logs[i].data, (uint256, bool, uint256, uint256));
                assertEq(finalCost, deposited, "UserOperationEvent.actualGasCost == descuento real del deposito");
            }
        }
        assertTrue(foundCharged, "GasCharged emitido");
        assertTrue(foundFinal, "UserOperationEvent emitido");
    }

    function test_wrongPaymasterSigner_rejectedByEntryPoint() public {
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 600), 0, 0.5 ether, 0xBAD);
        vm.expectRevert(abi.encodeWithSignature("FailedOp(uint256,string)", 0, "AA34 signature error"));
        _handle(op);
        assertEq(counter.n(), 0);
    }

    function test_tamperedCallDataAfterPaymasterSigned_rejected() public {
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 600), 0, 0.5 ether, signerPk);
        op.callData = _exec(abi.encodeCall(Counter.bump, ()));
        op.callData = bytes.concat(op.callData, hex"00"); // cambia el calldata: firma del paymaster y del dueño ya no valen
        vm.expectRevert();
        _handle(op);
        assertEq(counter.n(), 0);
    }

    function test_expiredWindow_rejectedByEntryPoint() public {
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 10), 0, 0.5 ether, signerPk);
        vm.warp(vm.getBlockTimestamp() + 11);
        vm.expectRevert(abi.encodeWithSignature("FailedOp(uint256,string)", 0, "AA32 paymaster expired or not due"));
        _handle(op);
    }

    function test_notYetValidWindow_rejected() public {
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 600), uint48(block.timestamp + 300), 0.5 ether, signerPk);
        vm.expectRevert(abi.encodeWithSignature("FailedOp(uint256,string)", 0, "AA32 paymaster expired or not due"));
        _handle(op);
    }

    function test_suspendedOrg_rejectedAtValidation() public {
        vm.prank(admin); pm.suspendOrg(ORG, true);
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 600), 0, 0.5 ether, signerPk);
        vm.expectRevert();
        _handle(op);
        assertEq(counter.n(), 0);
    }

    function test_signedMaxTooLow_rejected() public {
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 600), 0, 1 wei, signerPk);
        vm.expectRevert();
        _handle(op);
    }

    function test_replaySameOp_rejectedByNonce() public {
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 600), 0, 0.5 ether, signerPk);
        _handle(op);
        vm.expectRevert(abi.encodeWithSignature("FailedOp(uint256,string)", 0, "AA25 invalid account nonce"));
        _handle(op);
        assertEq(counter.n(), 1);
    }

    function test_revertedCall_stillChargesOrg() public {
        bytes memory bad = _exec(hex"deadbeef");
        AAUserOp memory op = _build(bad, ORG, uint48(block.timestamp + 600), 0, 0.5 ether, signerPk);
        uint256 depositBefore = pm.getDeposit();
        vm.recordLogs();
        _handle(op);
        assertLt(pm.getDeposit(), depositBefore, "el gas de una llamada revertida tambien se paga");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bool reverted;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].emitter == address(pm) && logs[i].topics[0] == BeZhasVerifyingPaymaster.GasCharged.selector) {
                (,, PostOpMode mode) = abi.decode(logs[i].data, (uint256, uint256, PostOpMode));
                reverted = mode == PostOpMode.opReverted;
            }
        }
        assertTrue(reverted, "GasCharged con modo opReverted");
    }

    function test_pausedPaymaster_rejected() public {
        vm.prank(admin); pm.setPaused(true);
        AAUserOp memory op = _build(_bump(), ORG, uint48(block.timestamp + 600), 0, 0.5 ether, signerPk);
        vm.expectRevert();
        _handle(op);
    }

    /// Flujo completo de tokenización patrocinada: UNA UserOp sin ETH ni BEZ en la cuenta; la bóveda aporta los 100 BEZ,
    /// el paymaster paga el gas y la fábrica cobra su comisión a la smart account.
    function test_sponsoredTokenization_batch_vaultFundsFee() public {
        MockBEZ bez = new MockBEZ();
        address factoryOwner = makeAddr("factoryOwner");
        MockFactory factory = new MockFactory(bez, factoryOwner);
        GasTankVault vault = new GasTankVault(bez, admin, vm.addr(signerPk), 1000 ether);
        bez.transfer(address(vault), 1000 ether);
        bytes4 sel = MockFactory.tokenizeAsset.selector;
        vm.prank(admin); vault.setFeeRule(address(factory), sel, 100 ether);

        uint48 until = uint48(block.timestamp + 600);
        bytes32 nonce = bytes32("pull-1");
        bytes32 h = vault.getHash(ORG, address(account), address(factory), sel, 100 ether, until, nonce);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h)));

        // executeBatch(Call[]) con Call{target,value,data}
        bytes memory batch = abi.encodeWithSignature(
            "executeBatch((address,uint256,bytes)[])",
            _calls(
                address(vault), abi.encodeCall(GasTankVault.pullProtocolFee, (ORG, address(factory), sel, 100 ether, until, nonce, abi.encodePacked(r, s, v))),
                address(bez), abi.encodeCall(ERC20.approve, (address(factory), 100 ether)),
                address(factory), abi.encodeCall(MockFactory.tokenizeAsset, ("galpon-algeciras"))
            )
        );

        assertEq(bez.balanceOf(address(account)), 0);
        AAUserOp memory op = _build(batch, ORG, until, 0, 0.5 ether, signerPk);
        _handle(op);

        assertEq(factory.assets(), 1, "se tokenizo el activo");
        assertEq(bez.balanceOf(factoryOwner), 100 ether, "la fabrica cobro su comision");
        assertEq(bez.balanceOf(address(account)), 0, "la cuenta no se queda con BEZ");
        assertEq(bez.balanceOf(address(vault)), 900 ether, "la boveda aporto exactamente 100 BEZ");
        assertEq(address(account).balance, 0);
        assertTrue(vault.usedNonce(nonce));
    }

    struct Call3 { address target; uint256 value; bytes data; }
    function _calls(address t1, bytes memory d1, address t2, bytes memory d2, address t3, bytes memory d3)
        internal pure returns (Call3[] memory c)
    {
        c = new Call3[](3);
        c[0] = Call3(t1, 0, d1); c[1] = Call3(t2, 0, d2); c[2] = Call3(t3, 0, d3);
    }

    receive() external payable {}
}
