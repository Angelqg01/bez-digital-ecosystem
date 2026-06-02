// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../src/legal/SmartLegalContract.sol";

contract SmartLegalContractTest is Test {
    SmartLegalContract public slc;
    address public admin    = address(this);
    address public notary   = address(0xA1);
    address public partyA   = address(0xB1);
    address public partyB   = address(0xB2);
    address public anyone   = address(0xC1);

    function setUp() public {
        slc = new SmartLegalContract();
        slc.grantRole(slc.NOTARY_ROLE(), notary);
    }

    // ── helpers ──────────────────
    function _draft() internal returns (uint256) {
        address[] memory sigs = new address[](2);
        sigs[0] = partyA;
        sigs[1] = partyB;
        vm.prank(partyA);
        return slc.draftContract("Service Agreement", keccak256("doc1"), block.timestamp + 365 days, 2, sigs);
    }

    function _draftAndSign() internal returns (uint256) {
        uint256 cid = _draft();
        vm.prank(partyA);
        slc.signContract(cid);
        vm.prank(partyB);
        slc.signContract(cid);
        return cid;
    }

    // ── draftContract ──────────────────
    function testDraftContract() public {
        uint256 cid = _draft();
        (,,, bytes32 docHash,,,,, SmartLegalContract.ContractStatus status,) = slc.contracts(cid);
        assertEq(docHash, keccak256("doc1"));
        assertEq(uint8(status), uint8(SmartLegalContract.ContractStatus.PENDING_SIGNATURES));
        address[] memory sigs = slc.getSignatories(cid);
        assertEq(sigs.length, 2);
    }

    function testDraftRevertZeroSigs() public {
        address[] memory sigs = new address[](1);
        sigs[0] = partyA;
        vm.prank(partyA);
        vm.expectRevert("More sigs than signatories");
        slc.draftContract("Bad", keccak256("x"), block.timestamp + 1 days, 2, sigs);
    }

    function testDraftRevertExpiredDate() public {
        address[] memory sigs = new address[](1);
        sigs[0] = partyA;
        vm.prank(partyA);
        vm.expectRevert("Expiry must be future");
        slc.draftContract("Bad", keccak256("x"), block.timestamp - 1, 1, sigs);
    }

    // ── signContract ──────────────────
    function testSignAndActivate() public {
        uint256 cid = _draftAndSign();
        (,,,,,,,, SmartLegalContract.ContractStatus status,) = slc.contracts(cid);
        assertEq(uint8(status), uint8(SmartLegalContract.ContractStatus.ACTIVE));
    }

    function testSignRevertNotSignatory() public {
        uint256 cid = _draft();
        vm.prank(anyone);
        vm.expectRevert("Not a signatory");
        slc.signContract(cid);
    }

    function testSignRevertAlreadySigned() public {
        uint256 cid = _draft();
        vm.startPrank(partyA);
        slc.signContract(cid);
        vm.expectRevert("Already signed");
        slc.signContract(cid);
        vm.stopPrank();
    }

    // ── addClause ──────────────────
    function testAddClause() public {
        uint256 cid = _draft();
        vm.prank(notary);
        uint256 clid = slc.addClause(cid, SmartLegalContract.ClauseType.OBLIGATION, keccak256("clause1"), 1 ether);
        (uint256 contractId, SmartLegalContract.ClauseType ct,, bool fulfilled, uint256 penalty) = slc.clauses(clid);
        assertEq(contractId, cid);
        assertEq(uint8(ct), uint8(SmartLegalContract.ClauseType.OBLIGATION));
        assertFalse(fulfilled);
        assertEq(penalty, 1 ether);
    }

    function testAddClauseRevertNotNotary() public {
        uint256 cid = _draft();
        vm.prank(anyone);
        vm.expectRevert();
        slc.addClause(cid, SmartLegalContract.ClauseType.PENALTY, keccak256("x"), 0);
    }

    // ── fulfillClause ──────────────────
    function testFulfillClause() public {
        uint256 cid = _draftAndSign();
        vm.prank(notary);
        uint256 clid = slc.addClause(cid, SmartLegalContract.ClauseType.CONDITION, keccak256("c"), 0);
        vm.prank(notary);
        slc.fulfillClause(cid, clid);
        (,,, bool fulfilled,) = slc.clauses(clid);
        assertTrue(fulfilled);
    }

    // ── raiseDispute ──────────────────
    function testRaiseDispute() public {
        uint256 cid = _draftAndSign();
        vm.prank(partyA);
        slc.raiseDispute(cid);
        (,,,,,,,, SmartLegalContract.ContractStatus status,) = slc.contracts(cid);
        assertEq(uint8(status), uint8(SmartLegalContract.ContractStatus.DISPUTED));
    }

    function testRaiseDisputeRevertNotParty() public {
        uint256 cid = _draftAndSign();
        vm.prank(anyone);
        vm.expectRevert("Not a party");
        slc.raiseDispute(cid);
    }

    // ── terminateContract ──────────────────
    function testTerminateContract() public {
        uint256 cid = _draftAndSign();
        vm.prank(notary);
        slc.terminateContract(cid, "Breach of terms");
        (,,,,,,,, SmartLegalContract.ContractStatus status,) = slc.contracts(cid);
        assertEq(uint8(status), uint8(SmartLegalContract.ContractStatus.TERMINATED));
    }

    function testTerminateRevertNotNotary() public {
        uint256 cid = _draftAndSign();
        vm.prank(anyone);
        vm.expectRevert();
        slc.terminateContract(cid, "nope");
    }

    // ── checkExpiry ──────────────────
    function testCheckExpiry() public {
        uint256 cid = _draftAndSign();
        vm.warp(block.timestamp + 366 days);
        slc.checkExpiry(cid);
        (,,,,,,,, SmartLegalContract.ContractStatus status,) = slc.contracts(cid);
        assertEq(uint8(status), uint8(SmartLegalContract.ContractStatus.EXPIRED));
    }

    function testCheckExpiryRevertNotExpired() public {
        uint256 cid = _draftAndSign();
        vm.expectRevert("Not expired yet");
        slc.checkExpiry(cid);
    }
}
