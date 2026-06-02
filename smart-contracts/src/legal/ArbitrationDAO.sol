// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ArbitrationDAO — Decentralized dispute resolution with arbitrator panels
contract ArbitrationDAO is AccessControl {

    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    enum DisputeStatus { FILED, PANEL_ASSIGNED, DELIBERATION, RESOLVED, APPEALED }
    enum Ruling { NONE, FAVOR_CLAIMANT, FAVOR_RESPONDENT, SPLIT, DISMISSED }
    enum CaseCategory { CONTRACT, IP_INFRINGEMENT, EMPLOYMENT, TORT, REGULATORY, OTHER }

    struct Dispute {
        uint256 id;
        address claimant;
        address respondent;
        CaseCategory category;
        bytes32 descriptionHash;
        uint256 stakeAmount;
        uint256 filedAt;
        uint256 resolvedAt;
        DisputeStatus status;
        Ruling ruling;
        uint256 panelSize;
        uint256 votesForClaimant;
        uint256 votesForRespondent;
    }

    struct Appeal {
        uint256 disputeId;
        address appellant;
        bytes32 reasonHash;
        uint256 filedAt;
        bool processed;
    }

    uint256 public nextDisputeId;
    uint256 public nextAppealId;
    uint256 public minimumStake = 0.01 ether;

    mapping(uint256 => Dispute) internal disputes;
    mapping(uint256 => Appeal) public appeals;
    mapping(uint256 => address[]) public panelMembers;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => uint256) public arbitratorCaseCount;

    event DisputeFiled(uint256 indexed disputeId, address indexed claimant, address indexed respondent, CaseCategory category);
    event PanelAssigned(uint256 indexed disputeId, uint256 panelSize);
    event VoteCast(uint256 indexed disputeId, address indexed arbiter, bool favorClaimant);
    event DisputeResolved(uint256 indexed disputeId, Ruling ruling);
    event AppealFiled(uint256 indexed disputeId, uint256 indexed appealId, address indexed appellant);
    event StakeWithdrawn(uint256 indexed disputeId, address indexed to, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ARBITER_ROLE, msg.sender);
    }

    // ── File a dispute ──────────────────
    function fileDispute(
        address _respondent,
        CaseCategory _category,
        bytes32 _descriptionHash
    ) external payable returns (uint256) {
        require(msg.value >= minimumStake, "Insufficient stake");
        require(_respondent != address(0), "Invalid respondent");
        require(_respondent != msg.sender, "Cannot dispute self");

        uint256 did = nextDisputeId++;
        disputes[did] = Dispute({
            id: did,
            claimant: msg.sender,
            respondent: _respondent,
            category: _category,
            descriptionHash: _descriptionHash,
            stakeAmount: msg.value,
            filedAt: block.timestamp,
            resolvedAt: 0,
            status: DisputeStatus.FILED,
            ruling: Ruling.NONE,
            panelSize: 0,
            votesForClaimant: 0,
            votesForRespondent: 0
        });

        emit DisputeFiled(did, msg.sender, _respondent, _category);
        return did;
    }

    // ── Assign arbitrator panel ──────────────────
    function assignPanel(uint256 _disputeId, address[] calldata _arbitrators) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Dispute storage d = disputes[_disputeId];
        require(d.status == DisputeStatus.FILED, "Not in FILED status");
        require(_arbitrators.length >= 3, "Need at least 3 arbitrators");
        require(_arbitrators.length % 2 == 1, "Panel must be odd");

        for (uint256 i = 0; i < _arbitrators.length; i++) {
            require(hasRole(ARBITER_ROLE, _arbitrators[i]), "Not an arbiter");
            panelMembers[_disputeId].push(_arbitrators[i]);
        }
        d.panelSize = _arbitrators.length;
        d.status = DisputeStatus.PANEL_ASSIGNED;

        emit PanelAssigned(_disputeId, _arbitrators.length);
    }

    // ── Start deliberation ──────────────────
    function startDeliberation(uint256 _disputeId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Dispute storage d = disputes[_disputeId];
        require(d.status == DisputeStatus.PANEL_ASSIGNED, "Panel not assigned");
        d.status = DisputeStatus.DELIBERATION;
    }

    // ── Arbitrator casts vote ──────────────────
    function castVote(uint256 _disputeId, bool _favorClaimant) external onlyRole(ARBITER_ROLE) {
        Dispute storage d = disputes[_disputeId];
        require(d.status == DisputeStatus.DELIBERATION, "Not in deliberation");
        require(!hasVoted[_disputeId][msg.sender], "Already voted");
        require(_isPanelMember(_disputeId, msg.sender), "Not on panel");

        hasVoted[_disputeId][msg.sender] = true;
        if (_favorClaimant) {
            d.votesForClaimant++;
        } else {
            d.votesForRespondent++;
        }
        arbitratorCaseCount[msg.sender]++;

        emit VoteCast(_disputeId, msg.sender, _favorClaimant);
    }

    // ── Resolve the dispute ──────────────────
    function resolveDispute(uint256 _disputeId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Dispute storage d = disputes[_disputeId];
        require(d.status == DisputeStatus.DELIBERATION, "Not in deliberation");
        uint256 totalVotes = d.votesForClaimant + d.votesForRespondent;
        require(totalVotes > d.panelSize / 2, "Not enough votes");

        if (d.votesForClaimant > d.votesForRespondent) {
            d.ruling = Ruling.FAVOR_CLAIMANT;
        } else if (d.votesForRespondent > d.votesForClaimant) {
            d.ruling = Ruling.FAVOR_RESPONDENT;
        } else {
            d.ruling = Ruling.SPLIT;
        }

        d.status = DisputeStatus.RESOLVED;
        d.resolvedAt = block.timestamp;

        emit DisputeResolved(_disputeId, d.ruling);
    }

    // ── File an appeal ──────────────────
    function fileAppeal(uint256 _disputeId, bytes32 _reasonHash) external payable returns (uint256) {
        Dispute storage d = disputes[_disputeId];
        require(d.status == DisputeStatus.RESOLVED, "Not resolved");
        require(msg.sender == d.claimant || msg.sender == d.respondent, "Not a party");
        require(msg.value >= minimumStake, "Insufficient stake");

        uint256 aid = nextAppealId++;
        appeals[aid] = Appeal({
            disputeId: _disputeId,
            appellant: msg.sender,
            reasonHash: _reasonHash,
            filedAt: block.timestamp,
            processed: false
        });
        d.status = DisputeStatus.APPEALED;

        emit AppealFiled(_disputeId, aid, msg.sender);
        return aid;
    }

    // ── Withdraw stake after resolution ──────────────────
    function withdrawStake(uint256 _disputeId) external {
        Dispute storage d = disputes[_disputeId];
        require(d.status == DisputeStatus.RESOLVED, "Not resolved");
        require(d.stakeAmount > 0, "No stake");

        address winner;
        if (d.ruling == Ruling.FAVOR_CLAIMANT) {
            winner = d.claimant;
        } else if (d.ruling == Ruling.FAVOR_RESPONDENT) {
            winner = d.respondent;
        } else {
            winner = d.claimant; // split defaults to claimant withdrawing
        }
        require(msg.sender == winner, "Not the winner");

        uint256 amt = d.stakeAmount;
        d.stakeAmount = 0;
        (bool ok, ) = payable(msg.sender).call{value: amt}("");
        require(ok, "Transfer failed");

        emit StakeWithdrawn(_disputeId, msg.sender, amt);
    }

    // ── View helpers ──────────────────
    function getPanelMembers(uint256 _disputeId) external view returns (address[] memory) {
        return panelMembers[_disputeId];
    }

    function getDisputeStatus(uint256 _disputeId) external view returns (DisputeStatus) {
        return disputes[_disputeId].status;
    }

    function getDisputeRuling(uint256 _disputeId) external view returns (Ruling) {
        return disputes[_disputeId].ruling;
    }

    function getDisputeCore(uint256 _disputeId) external view returns (
        address claimant_,
        address respondent_,
        CaseCategory category_,
        uint256 stakeAmount_,
        DisputeStatus status_
    ) {
        Dispute storage d = disputes[_disputeId];
        return (d.claimant, d.respondent, d.category, d.stakeAmount, d.status);
    }

    function getDisputeVotes(uint256 _disputeId) external view returns (
        uint256 panelSize_,
        uint256 votesForClaimant_,
        uint256 votesForRespondent_
    ) {
        Dispute storage d = disputes[_disputeId];
        return (d.panelSize, d.votesForClaimant, d.votesForRespondent);
    }

    function _isPanelMember(uint256 _disputeId, address _addr) internal view returns (bool) {
        address[] memory members = panelMembers[_disputeId];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == _addr) return true;
        }
        return false;
    }
}
