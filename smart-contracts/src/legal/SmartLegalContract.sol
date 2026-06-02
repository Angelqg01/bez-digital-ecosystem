// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title SmartLegalContract — On-chain legal agreements with digital signatures
contract SmartLegalContract is AccessControl {

    bytes32 public constant NOTARY_ROLE = keccak256("NOTARY_ROLE");

    enum ContractStatus { DRAFT, PENDING_SIGNATURES, ACTIVE, DISPUTED, TERMINATED, EXPIRED }
    enum ClauseType { OBLIGATION, CONDITION, PENALTY, TERMINATION, CONFIDENTIALITY }

    struct LegalContract {
        uint256 id;
        address drafter;
        string title;
        bytes32 documentHash;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 signaturesRequired;
        uint256 signatureCount;
        ContractStatus status;
        uint256 disputeCount;
    }

    struct Clause {
        uint256 contractId;
        ClauseType clauseType;
        bytes32 contentHash;
        bool fulfilled;
        uint256 penalty;
    }

    uint256 public nextContractId;
    uint256 public nextClauseId;

    mapping(uint256 => LegalContract) public contracts;
    mapping(uint256 => Clause) public clauses;
    mapping(uint256 => uint256[]) public contractClauses;
    mapping(uint256 => mapping(address => bool)) public hasSigned;
    mapping(uint256 => address[]) public signatories;

    event ContractDrafted(uint256 indexed contractId, address indexed drafter, string title);
    event ContractSigned(uint256 indexed contractId, address indexed signer, uint256 signatureCount);
    event ContractActivated(uint256 indexed contractId);
    event ContractTerminated(uint256 indexed contractId, string reason);
    event ContractDisputed(uint256 indexed contractId, address indexed disputant);
    event ClauseAdded(uint256 indexed contractId, uint256 indexed clauseId, ClauseType clauseType);
    event ClauseFulfilled(uint256 indexed contractId, uint256 indexed clauseId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(NOTARY_ROLE, msg.sender);
    }

    // ── Draft a new legal contract ──────────────────
    function draftContract(
        string calldata _title,
        bytes32 _documentHash,
        uint256 _expiresAt,
        uint256 _signaturesRequired,
        address[] calldata _signatories
    ) external returns (uint256) {
        require(_signaturesRequired > 0, "Need at least 1 signature");
        require(_signaturesRequired <= _signatories.length, "More sigs than signatories");
        require(_expiresAt > block.timestamp, "Expiry must be future");

        uint256 cid = nextContractId++;
        contracts[cid] = LegalContract({
            id: cid,
            drafter: msg.sender,
            title: _title,
            documentHash: _documentHash,
            createdAt: block.timestamp,
            expiresAt: _expiresAt,
            signaturesRequired: _signaturesRequired,
            signatureCount: 0,
            status: ContractStatus.PENDING_SIGNATURES,
            disputeCount: 0
        });

        for (uint256 i = 0; i < _signatories.length; i++) {
            signatories[cid].push(_signatories[i]);
        }

        emit ContractDrafted(cid, msg.sender, _title);
        return cid;
    }

    // ── Sign a contract ──────────────────
    function signContract(uint256 _contractId) external {
        LegalContract storage lc = contracts[_contractId];
        require(lc.status == ContractStatus.PENDING_SIGNATURES, "Not pending");
        require(!hasSigned[_contractId][msg.sender], "Already signed");
        require(_isSignatory(_contractId, msg.sender), "Not a signatory");

        hasSigned[_contractId][msg.sender] = true;
        lc.signatureCount++;

        emit ContractSigned(_contractId, msg.sender, lc.signatureCount);

        if (lc.signatureCount >= lc.signaturesRequired) {
            lc.status = ContractStatus.ACTIVE;
            emit ContractActivated(_contractId);
        }
    }

    // ── Add a clause to a contract ──────────────────
    function addClause(
        uint256 _contractId,
        ClauseType _clauseType,
        bytes32 _contentHash,
        uint256 _penalty
    ) external onlyRole(NOTARY_ROLE) returns (uint256) {
        LegalContract storage lc = contracts[_contractId];
        require(
            lc.status == ContractStatus.PENDING_SIGNATURES || lc.status == ContractStatus.ACTIVE,
            "Contract not modifiable"
        );

        uint256 clid = nextClauseId++;
        clauses[clid] = Clause({
            contractId: _contractId,
            clauseType: _clauseType,
            contentHash: _contentHash,
            fulfilled: false,
            penalty: _penalty
        });
        contractClauses[_contractId].push(clid);

        emit ClauseAdded(_contractId, clid, _clauseType);
        return clid;
    }

    // ── Mark a clause as fulfilled ──────────────────
    function fulfillClause(uint256 _contractId, uint256 _clauseId) external onlyRole(NOTARY_ROLE) {
        require(contracts[_contractId].status == ContractStatus.ACTIVE, "Not active");
        Clause storage cl = clauses[_clauseId];
        require(cl.contractId == _contractId, "Clause mismatch");
        require(!cl.fulfilled, "Already fulfilled");

        cl.fulfilled = true;
        emit ClauseFulfilled(_contractId, _clauseId);
    }

    // ── Raise a dispute on a contract ──────────────────
    function raiseDispute(uint256 _contractId) external {
        LegalContract storage lc = contracts[_contractId];
        require(lc.status == ContractStatus.ACTIVE, "Not active");
        require(_isSignatory(_contractId, msg.sender), "Not a party");

        lc.status = ContractStatus.DISPUTED;
        lc.disputeCount++;
        emit ContractDisputed(_contractId, msg.sender);
    }

    // ── Terminate a contract ──────────────────
    function terminateContract(uint256 _contractId, string calldata _reason) external onlyRole(NOTARY_ROLE) {
        LegalContract storage lc = contracts[_contractId];
        require(
            lc.status == ContractStatus.ACTIVE || lc.status == ContractStatus.DISPUTED,
            "Cannot terminate"
        );
        lc.status = ContractStatus.TERMINATED;
        emit ContractTerminated(_contractId, _reason);
    }

    // ── Check contract expiry ──────────────────
    function checkExpiry(uint256 _contractId) external {
        LegalContract storage lc = contracts[_contractId];
        require(block.timestamp >= lc.expiresAt, "Not expired yet");
        require(lc.status != ContractStatus.TERMINATED && lc.status != ContractStatus.EXPIRED, "Already closed");
        lc.status = ContractStatus.EXPIRED;
    }

    // ── View helpers ──────────────────
    function getContractClauses(uint256 _contractId) external view returns (uint256[] memory) {
        return contractClauses[_contractId];
    }

    function getSignatories(uint256 _contractId) external view returns (address[] memory) {
        return signatories[_contractId];
    }

    function _isSignatory(uint256 _contractId, address _addr) internal view returns (bool) {
        address[] memory sigs = signatories[_contractId];
        for (uint256 i = 0; i < sigs.length; i++) {
            if (sigs[i] == _addr) return true;
        }
        return false;
    }
}
