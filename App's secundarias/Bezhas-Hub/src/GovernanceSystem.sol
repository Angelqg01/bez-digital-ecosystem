// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract GovernanceSystem is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");

    IERC20 public immutable governanceToken;

    enum ProposalState { Pending, Active, Succeeded, Defeated, Queued, Executed, Cancelled }
    enum VoteType { Against, For, Abstain }

    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        uint256 quorumRequired;
        uint256 threshold;
        ProposalState state;
        mapping(address => bool) hasVoted;
        mapping(address => VoteType) votes;
        mapping(address => uint256) votingPower;
    }

    struct ProposalConfig {
        uint256 votingDelay;
        uint256 votingPeriod;
        uint256 proposalThreshold;
        uint256 quorumPercentage;
        uint256 executionDelay;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public votingPower;
    mapping(address => uint256) public delegatedPower;
    mapping(address => address) public delegates;

    uint256 public proposalCount;
    ProposalConfig public config;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        uint256 startTime,
        uint256 endTime
    );
    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        VoteType vote,
        uint256 weight
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCancelled(uint256 indexed proposalId);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    constructor(
        IERC20 _governanceToken,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumPercentage
    ) {
        governanceToken = _governanceToken;
        
        config = ProposalConfig({
            votingDelay: _votingDelay,
            votingPeriod: _votingPeriod,
            proposalThreshold: _proposalThreshold,
            quorumPercentage: _quorumPercentage,
            executionDelay: 2 days
        });

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PROPOSER_ROLE, msg.sender);
    }

    function createProposal(
        string memory title,
        string memory description
    ) external whenNotPaused returns (uint256) {
        require(hasRole(PROPOSER_ROLE, msg.sender) || 
                governanceToken.balanceOf(msg.sender) >= config.proposalThreshold, 
                "Insufficient tokens to propose");

        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.startTime = block.timestamp + config.votingDelay;
        proposal.endTime = proposal.startTime + config.votingPeriod;
        proposal.state = ProposalState.Pending;
        proposal.quorumRequired = (governanceToken.totalSupply() * config.quorumPercentage) / 10000;
        proposal.threshold = proposal.quorumRequired / 2; // Simple majority

        emit ProposalCreated(proposalId, msg.sender, title, proposal.startTime, proposal.endTime);
        return proposalId;
    }

    function vote(uint256 proposalId, VoteType voteType) external nonReentrant whenNotPaused {
        require(proposalId < proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");

        uint256 weight = getVotingPower(msg.sender);
        require(weight > 0, "No voting power");

        proposal.hasVoted[msg.sender] = true;
        proposal.votes[msg.sender] = voteType;
        proposal.votingPower[msg.sender] = weight;

        if (voteType == VoteType.For) {
            proposal.forVotes += weight;
        } else if (voteType == VoteType.Against) {
            proposal.againstVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }

        emit VoteCast(msg.sender, proposalId, voteType, weight);
    }

    function executeProposal(uint256 proposalId) external nonReentrant {
        require(proposalId < proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        require(proposal.state == ProposalState.Succeeded, "Proposal not ready for execution");
        require(block.timestamp >= proposal.endTime + config.executionDelay, "Execution delay not met");

        proposal.state = ProposalState.Executed;
        emit ProposalExecuted(proposalId);
    }

    function cancelProposal(uint256 proposalId) external {
        require(proposalId < proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.proposer || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        require(proposal.state == ProposalState.Pending || proposal.state == ProposalState.Active, "Cannot cancel");

        proposal.state = ProposalState.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    function delegate(address delegatee) external {
        address currentDelegate = delegates[msg.sender];
        delegates[msg.sender] = delegatee;

        uint256 delegatorBalance = governanceToken.balanceOf(msg.sender);
        
        if (currentDelegate != address(0)) {
            delegatedPower[currentDelegate] -= delegatorBalance;
        }
        
        if (delegatee != address(0)) {
            delegatedPower[delegatee] += delegatorBalance;
        }

        emit DelegateChanged(msg.sender, currentDelegate, delegatee);
    }

    function getVotingPower(address account) public view returns (uint256) {
        return governanceToken.balanceOf(account) + delegatedPower[account];
    }

    function getProposalState(uint256 proposalId) public view returns (ProposalState) {
        require(proposalId < proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[proposalId];

        if (proposal.state == ProposalState.Cancelled || 
            proposal.state == ProposalState.Executed) {
            return proposal.state;
        }

        if (block.timestamp < proposal.startTime) {
            return ProposalState.Pending;
        }

        if (block.timestamp <= proposal.endTime) {
            return ProposalState.Active;
        }

        uint256 totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        
        if (totalVotes < proposal.quorumRequired) {
            return ProposalState.Defeated;
        }

        if (proposal.forVotes > proposal.againstVotes) {
            return ProposalState.Succeeded;
        } else {
            return ProposalState.Defeated;
        }
    }

    function getProposalVotes(uint256 proposalId) 
        external 
        view 
        returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes) 
    {
        require(proposalId < proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        return (proposal.forVotes, proposal.againstVotes, proposal.abstainVotes);
    }

    function getProposalDetails(uint256 proposalId) 
        external 
        view 
        returns (
            address proposer,
            string memory title,
            string memory description,
            uint256 startTime,
            uint256 endTime,
            ProposalState state
        ) 
    {
        require(proposalId < proposalCount, "Invalid proposal");
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.title,
            proposal.description,
            proposal.startTime,
            proposal.endTime,
            getProposalState(proposalId)
        );
    }

    function hasVoted(uint256 proposalId, address account) external view returns (bool) {
        require(proposalId < proposalCount, "Invalid proposal");
        return proposals[proposalId].hasVoted[account];
    }

    // Admin functions
    function updateConfig(
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumPercentage,
        uint256 _executionDelay
    ) external onlyRole(ADMIN_ROLE) {
        config.votingDelay = _votingDelay;
        config.votingPeriod = _votingPeriod;
        config.proposalThreshold = _proposalThreshold;
        config.quorumPercentage = _quorumPercentage;
        config.executionDelay = _executionDelay;
    }

    function grantProposerRole(address account) external onlyRole(ADMIN_ROLE) {
        grantRole(PROPOSER_ROLE, account);
    }

    function revokeProposerRole(address account) external onlyRole(ADMIN_ROLE) {
        revokeRole(PROPOSER_ROLE, account);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
