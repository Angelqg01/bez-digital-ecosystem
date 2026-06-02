// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title EvidenceVault — Tamper-proof evidence storage with chain of custody
contract EvidenceVault is AccessControl {

    bytes32 public constant CUSTODIAN_ROLE = keccak256("CUSTODIAN_ROLE");

    enum EvidenceType { DOCUMENT, PHOTO, VIDEO, AUDIO, DIGITAL_FORENSIC, TESTIMONY }
    enum CustodyAction { SUBMITTED, TRANSFERRED, SEALED, RELEASED, CHALLENGED }

    struct Evidence {
        uint256 id;
        address submitter;
        bytes32 contentHash;
        EvidenceType evidenceType;
        uint256 caseId;
        uint256 submittedAt;
        uint256 custodyCount;
        bool isSealed;
        bool challenged;
    }

    struct CustodyRecord {
        uint256 evidenceId;
        address from;
        address to;
        CustodyAction action;
        bytes32 notesHash;
        uint256 timestamp;
    }

    uint256 public nextEvidenceId;
    uint256 public nextCustodyRecordId;

    mapping(uint256 => Evidence) public evidences;
    mapping(uint256 => CustodyRecord) public custodyRecords;
    mapping(uint256 => uint256[]) public evidenceCustody;
    mapping(uint256 => uint256[]) public caseEvidences;
    mapping(bytes32 => bool) public hashRegistered;

    event EvidenceSubmitted(uint256 indexed evidenceId, address indexed submitter, uint256 indexed caseId, EvidenceType evidenceType);
    event CustodyTransferred(uint256 indexed evidenceId, address indexed from, address indexed to);
    event EvidenceSealed(uint256 indexed evidenceId);
    event EvidenceChallenged(uint256 indexed evidenceId, address indexed challenger);
    event EvidenceReleased(uint256 indexed evidenceId, address indexed to);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CUSTODIAN_ROLE, msg.sender);
    }

    // ── Submit new evidence ──────────────────
    function submitEvidence(
        bytes32 _contentHash,
        EvidenceType _evidenceType,
        uint256 _caseId
    ) external returns (uint256) {
        require(_contentHash != bytes32(0), "Empty hash");
        require(!hashRegistered[_contentHash], "Hash already registered");

        uint256 eid = nextEvidenceId++;
        evidences[eid] = Evidence({
            id: eid,
            submitter: msg.sender,
            contentHash: _contentHash,
            evidenceType: _evidenceType,
            caseId: _caseId,
            submittedAt: block.timestamp,
            custodyCount: 0,
            isSealed: false,
            challenged: false
        });
        hashRegistered[_contentHash] = true;
        caseEvidences[_caseId].push(eid);

        _recordCustody(eid, address(0), msg.sender, CustodyAction.SUBMITTED, bytes32(0));

        emit EvidenceSubmitted(eid, msg.sender, _caseId, _evidenceType);
        return eid;
    }

    // ── Transfer custody ──────────────────
    function transferCustody(
        uint256 _evidenceId,
        address _to,
        bytes32 _notesHash
    ) external onlyRole(CUSTODIAN_ROLE) {
        Evidence storage ev = evidences[_evidenceId];
        require(!ev.isSealed, "Evidence sealed");
        require(_to != address(0), "Invalid recipient");

        _recordCustody(_evidenceId, msg.sender, _to, CustodyAction.TRANSFERRED, _notesHash);
        emit CustodyTransferred(_evidenceId, msg.sender, _to);
    }

    // ── Seal evidence (no further transfers) ──────────────────
    function sealEvidence(uint256 _evidenceId) external onlyRole(CUSTODIAN_ROLE) {
        Evidence storage ev = evidences[_evidenceId];
        require(!ev.isSealed, "Already sealed");

        ev.isSealed = true;
        _recordCustody(_evidenceId, msg.sender, address(0), CustodyAction.SEALED, bytes32(0));
        emit EvidenceSealed(_evidenceId);
    }

    // ── Challenge evidence authenticity ──────────────────
    function challengeEvidence(uint256 _evidenceId) external {
        Evidence storage ev = evidences[_evidenceId];
        require(ev.submittedAt > 0, "Evidence not found");
        require(!ev.challenged, "Already challenged");

        ev.challenged = true;
        _recordCustody(_evidenceId, msg.sender, address(0), CustodyAction.CHALLENGED, bytes32(0));
        emit EvidenceChallenged(_evidenceId, msg.sender);
    }

    // ── Release evidence to a party ──────────────────
    function releaseEvidence(uint256 _evidenceId, address _to) external onlyRole(CUSTODIAN_ROLE) {
        Evidence storage ev = evidences[_evidenceId];
        require(ev.isSealed, "Must be sealed first");
        require(_to != address(0), "Invalid recipient");

        _recordCustody(_evidenceId, msg.sender, _to, CustodyAction.RELEASED, bytes32(0));
        emit EvidenceReleased(_evidenceId, _to);
    }

    // ── Verify evidence hash on-chain ──────────────────
    function verifyHash(uint256 _evidenceId, bytes32 _hash) external view returns (bool) {
        return evidences[_evidenceId].contentHash == _hash;
    }

    // ── View helpers ──────────────────
    function getCaseEvidences(uint256 _caseId) external view returns (uint256[] memory) {
        return caseEvidences[_caseId];
    }

    function getEvidenceCustody(uint256 _evidenceId) external view returns (uint256[] memory) {
        return evidenceCustody[_evidenceId];
    }

    function _recordCustody(
        uint256 _evidenceId,
        address _from,
        address _to,
        CustodyAction _action,
        bytes32 _notesHash
    ) internal {
        uint256 rid = nextCustodyRecordId++;
        custodyRecords[rid] = CustodyRecord({
            evidenceId: _evidenceId,
            from: _from,
            to: _to,
            action: _action,
            notesHash: _notesHash,
            timestamp: block.timestamp
        });
        evidenceCustody[_evidenceId].push(rid);
        evidences[_evidenceId].custodyCount++;
    }
}
