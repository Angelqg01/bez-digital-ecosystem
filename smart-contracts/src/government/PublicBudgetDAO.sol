// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title PublicBudgetDAO — Transparent public budget with proposals, voting and fund allocation
contract PublicBudgetDAO is AccessControl {

    bytes32 public constant COUNCIL_ROLE = keccak256("COUNCIL_ROLE");

    enum ProposalStatus { DRAFT, OPEN, APPROVED, REJECTED, EXECUTED, CANCELLED }
    enum BudgetCategory { INFRASTRUCTURE, EDUCATION, HEALTH, SECURITY, ENVIRONMENT, SOCIAL, OTHER }

    struct Proposal {
        uint256 id;
        address proposer;
        bytes32 titleHash;
        bytes32 descHash;
        BudgetCategory category;
        uint256 amount;
        address beneficiary;
        ProposalStatus status;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 createdAt;
        uint256 deadline;
    }

    uint256 public nextProposalId;
    uint256 public treasuryBalance;

    mapping(uint256 => Proposal) internal proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, BudgetCategory category);
    event ProposalOpened(uint256 indexed proposalId, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalApproved(uint256 indexed proposalId);
    event ProposalRejected(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId, uint256 amount, address beneficiary);
    event ProposalCancelled(uint256 indexed proposalId);
    event FundsDeposited(address indexed from, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COUNCIL_ROLE, msg.sender);
    }

    receive() external payable {
        treasuryBalance += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }

    // ── Create a budget proposal ──────────────────
    function createProposal(
        bytes32 _titleHash,
        bytes32 _descHash,
        BudgetCategory _category,
        uint256 _amount,
        address _beneficiary
    ) external onlyRole(COUNCIL_ROLE) returns (uint256) {
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_amount > 0, "Amount must be > 0");

        uint256 pid = nextProposalId++;
        proposals[pid] = Proposal({
            id: pid,
            proposer: msg.sender,
            titleHash: _titleHash,
            descHash: _descHash,
            category: _category,
            amount: _amount,
            beneficiary: _beneficiary,
            status: ProposalStatus.DRAFT,
            votesFor: 0,
            votesAgainst: 0,
            createdAt: block.timestamp,
            deadline: 0
        });

        emit ProposalCreated(pid, msg.sender, _category);
        return pid;
    }

    // ── Open proposal for voting ──────────────────
    function openProposal(uint256 _proposalId, uint256 _duration) external onlyRole(COUNCIL_ROLE) {
        Proposal storage p = proposals[_proposalId];
        require(p.status == ProposalStatus.DRAFT, "Not draft");
        require(_duration > 0, "Duration must be > 0");
        p.status = ProposalStatus.OPEN;
        p.deadline = block.timestamp + _duration;
        emit ProposalOpened(_proposalId, p.deadline);
    }

    // ── Cast a vote ──────────────────
    function castVote(uint256 _proposalId, bool _support) external onlyRole(COUNCIL_ROLE) {
        Proposal storage p = proposals[_proposalId];
        require(p.status == ProposalStatus.OPEN, "Not open");
        require(block.timestamp < p.deadline, "Voting ended");
        require(!hasVoted[_proposalId][msg.sender], "Already voted");

        hasVoted[_proposalId][msg.sender] = true;
        if (_support) {
            p.votesFor++;
        } else {
            p.votesAgainst++;
        }

        emit VoteCast(_proposalId, msg.sender, _support);
    }

    // ── Tally votes and finalize ──────────────────
    function tallyVotes(uint256 _proposalId) external onlyRole(COUNCIL_ROLE) {
        Proposal storage p = proposals[_proposalId];
        require(p.status == ProposalStatus.OPEN, "Not open");
        require(block.timestamp >= p.deadline, "Voting not ended");

        if (p.votesFor > p.votesAgainst) {
            p.status = ProposalStatus.APPROVED;
            emit ProposalApproved(_proposalId);
        } else {
            p.status = ProposalStatus.REJECTED;
            emit ProposalRejected(_proposalId);
        }
    }

    // ── Execute approved proposal (release funds) ──────────────────
    function executeProposal(uint256 _proposalId) external onlyRole(COUNCIL_ROLE) {
        Proposal storage p = proposals[_proposalId];
        require(p.status == ProposalStatus.APPROVED, "Not approved");
        require(treasuryBalance >= p.amount, "Insufficient treasury");

        treasuryBalance -= p.amount;
        p.status = ProposalStatus.EXECUTED;

        (bool ok, ) = p.beneficiary.call{value: p.amount}("");
        require(ok, "Transfer failed");

        emit ProposalExecuted(_proposalId, p.amount, p.beneficiary);
    }

    // ── Cancel a proposal ──────────────────
    function cancelProposal(uint256 _proposalId) external onlyRole(COUNCIL_ROLE) {
        Proposal storage p = proposals[_proposalId];
        require(p.status == ProposalStatus.DRAFT || p.status == ProposalStatus.OPEN, "Cannot cancel");
        p.status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(_proposalId);
    }

    // ── View helpers (proposals is internal to avoid stack-too-deep) ──────────
    function getProposalStatus(uint256 _proposalId) external view returns (ProposalStatus) {
        return proposals[_proposalId].status;
    }

    function getProposalVotes(uint256 _proposalId) external view returns (uint256 votesFor, uint256 votesAgainst) {
        Proposal storage p = proposals[_proposalId];
        return (p.votesFor, p.votesAgainst);
    }

    function getProposalCore(uint256 _proposalId) external view returns (
        address proposer, BudgetCategory category, uint256 amount,
        address beneficiary, uint256 deadline
    ) {
        Proposal storage p = proposals[_proposalId];
        return (p.proposer, p.category, p.amount, p.beneficiary, p.deadline);
    }
}
