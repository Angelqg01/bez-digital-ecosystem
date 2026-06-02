// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title EduDAO — DAO governance for educational institutions on BeZhas Chain
/// @notice Register institutions, create proposals, cast votes, execute decisions
contract EduDAO is AccessControl {

    bytes32 public constant INSTITUTION_ADMIN_ROLE = keccak256("INSTITUTION_ADMIN_ROLE");

    struct Institution {
        string  name;
        address admin;
        uint256 memberCount;
        uint256 treasuryBez;
        bool    active;
    }

    struct Proposal {
        string  title;
        string  category;
        address proposer;
        uint256 institutionId;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 quorum;
        uint256 deadline;
        bool    executed;
    }

    uint256 public nextInstitutionId;
    mapping(uint256 => Institution) public institutions;

    uint256 public nextProposalId;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => uint256[]) public institutionProposals;

    event InstitutionRegistered(uint256 indexed instId, string name, address indexed admin);
    event ProposalCreated(uint256 indexed proposalId, uint256 indexed instId, string title, string category);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId);
    event TreasuryFunded(uint256 indexed instId, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(INSTITUTION_ADMIN_ROLE, msg.sender);
    }

    function registerInstitution(string calldata name) external onlyRole(INSTITUTION_ADMIN_ROLE) returns (uint256) {
        uint256 id = nextInstitutionId++;
        institutions[id] = Institution({
            name: name,
            admin: msg.sender,
            memberCount: 0,
            treasuryBez: 0,
            active: true
        });

        emit InstitutionRegistered(id, name, msg.sender);
        return id;
    }

    function createProposal(
        uint256 instId,
        string calldata title,
        string calldata category,
        uint256 quorum,
        uint256 deadline
    ) external returns (uint256) {
        require(institutions[instId].active, "Institution not active");
        require(deadline > block.timestamp, "Deadline must be future");
        require(quorum > 0, "Quorum must be > 0");

        uint256 pid = nextProposalId++;
        proposals[pid] = Proposal({
            title: title,
            category: category,
            proposer: msg.sender,
            institutionId: instId,
            forVotes: 0,
            againstVotes: 0,
            quorum: quorum,
            deadline: deadline,
            executed: false
        });
        institutionProposals[instId].push(pid);

        emit ProposalCreated(pid, instId, title, category);
        return pid;
    }

    function castVote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(block.timestamp <= p.deadline, "Voting ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        require(!p.executed, "Already executed");

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            p.forVotes++;
        } else {
            p.againstVotes++;
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    function executeProposal(uint256 proposalId) external onlyRole(INSTITUTION_ADMIN_ROLE) {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "Already executed");
        require(p.forVotes + p.againstVotes >= p.quorum, "Quorum not met");
        require(p.forVotes > p.againstVotes, "Not passed");

        p.executed = true;
        emit ProposalExecuted(proposalId);
    }

    function fundTreasury(uint256 instId) external payable {
        require(institutions[instId].active, "Not active");
        require(msg.value > 0, "Must send funds");

        institutions[instId].treasuryBez += msg.value;
        emit TreasuryFunded(instId, msg.value);
    }

    function getInstitution(uint256 instId) external view returns (Institution memory) {
        return institutions[instId];
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getInstitutionProposalCount(uint256 instId) external view returns (uint256) {
        return institutionProposals[instId].length;
    }

    receive() external payable {}
}
