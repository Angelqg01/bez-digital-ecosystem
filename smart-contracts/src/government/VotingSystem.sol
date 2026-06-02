// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title VotingSystem — Secure on-chain elections with ballot casting and result tallying
contract VotingSystem is AccessControl {

    bytes32 public constant ELECTION_ADMIN_ROLE = keccak256("ELECTION_ADMIN_ROLE");

    enum ElectionStatus { CREATED, REGISTRATION, VOTING, TALLIED, CANCELLED }

    struct Election {
        uint256 id;
        bytes32 titleHash;
        ElectionStatus status;
        uint256 candidateCount;
        uint256 totalVotes;
        uint256 registrationEnd;
        uint256 votingEnd;
        uint256 createdAt;
    }

    struct Candidate {
        uint256 id;
        uint256 electionId;
        bytes32 nameHash;
        address addr;
        uint256 votes;
        bool registered;
    }

    uint256 public nextElectionId;
    uint256 public nextCandidateId;

    mapping(uint256 => Election) public elections;
    mapping(uint256 => Candidate) public candidates;
    mapping(uint256 => uint256[]) public electionCandidates;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public isRegisteredVoter;

    event ElectionCreated(uint256 indexed electionId, bytes32 titleHash);
    event RegistrationOpened(uint256 indexed electionId, uint256 registrationEnd);
    event CandidateRegistered(uint256 indexed electionId, uint256 indexed candidateId);
    event VoterRegistered(uint256 indexed electionId, address indexed voter);
    event VotingStarted(uint256 indexed electionId, uint256 votingEnd);
    event BallotCast(uint256 indexed electionId, address indexed voter);
    event ElectionTallied(uint256 indexed electionId, uint256 winnerId);
    event ElectionCancelled(uint256 indexed electionId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ELECTION_ADMIN_ROLE, msg.sender);
    }

    // ── Create an election ──────────────────
    function createElection(bytes32 _titleHash) external onlyRole(ELECTION_ADMIN_ROLE) returns (uint256) {
        uint256 eid = nextElectionId++;
        elections[eid] = Election({
            id: eid,
            titleHash: _titleHash,
            status: ElectionStatus.CREATED,
            candidateCount: 0,
            totalVotes: 0,
            registrationEnd: 0,
            votingEnd: 0,
            createdAt: block.timestamp
        });

        emit ElectionCreated(eid, _titleHash);
        return eid;
    }

    // ── Open candidate & voter registration ──────────────────
    function openRegistration(uint256 _electionId, uint256 _duration) external onlyRole(ELECTION_ADMIN_ROLE) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.CREATED, "Not created");
        require(_duration > 0, "Duration must be > 0");
        e.status = ElectionStatus.REGISTRATION;
        e.registrationEnd = block.timestamp + _duration;
        emit RegistrationOpened(_electionId, e.registrationEnd);
    }

    // ── Register a candidate ──────────────────
    function registerCandidate(
        uint256 _electionId,
        bytes32 _nameHash,
        address _addr
    ) external onlyRole(ELECTION_ADMIN_ROLE) returns (uint256) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.REGISTRATION, "Not in registration");
        require(block.timestamp < e.registrationEnd, "Registration ended");
        require(_addr != address(0), "Invalid address");

        uint256 cid = nextCandidateId++;
        candidates[cid] = Candidate({
            id: cid,
            electionId: _electionId,
            nameHash: _nameHash,
            addr: _addr,
            votes: 0,
            registered: true
        });
        electionCandidates[_electionId].push(cid);
        e.candidateCount++;

        emit CandidateRegistered(_electionId, cid);
        return cid;
    }

    // ── Register a voter ──────────────────
    function registerVoter(uint256 _electionId, address _voter) external onlyRole(ELECTION_ADMIN_ROLE) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.REGISTRATION, "Not in registration");
        require(block.timestamp < e.registrationEnd, "Registration ended");
        require(!isRegisteredVoter[_electionId][_voter], "Already registered");

        isRegisteredVoter[_electionId][_voter] = true;
        emit VoterRegistered(_electionId, _voter);
    }

    // ── Start voting phase ──────────────────
    function startVoting(uint256 _electionId, uint256 _duration) external onlyRole(ELECTION_ADMIN_ROLE) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.REGISTRATION, "Not in registration");
        require(block.timestamp >= e.registrationEnd, "Registration not ended");
        require(e.candidateCount >= 2, "Need at least 2 candidates");
        require(_duration > 0, "Duration must be > 0");

        e.status = ElectionStatus.VOTING;
        e.votingEnd = block.timestamp + _duration;
        emit VotingStarted(_electionId, e.votingEnd);
    }

    // ── Cast a ballot ──────────────────
    function castBallot(uint256 _electionId, uint256 _candidateId) external {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.VOTING, "Not in voting");
        require(block.timestamp < e.votingEnd, "Voting ended");
        require(isRegisteredVoter[_electionId][msg.sender], "Not registered voter");
        require(!hasVoted[_electionId][msg.sender], "Already voted");
        require(candidates[_candidateId].electionId == _electionId, "Wrong election");
        require(candidates[_candidateId].registered, "Candidate not registered");

        hasVoted[_electionId][msg.sender] = true;
        candidates[_candidateId].votes++;
        e.totalVotes++;

        emit BallotCast(_electionId, msg.sender);
    }

    // ── Tally results ──────────────────
    function tallyResults(uint256 _electionId) external onlyRole(ELECTION_ADMIN_ROLE) returns (uint256 winnerId) {
        Election storage e = elections[_electionId];
        require(e.status == ElectionStatus.VOTING, "Not in voting");
        require(block.timestamp >= e.votingEnd, "Voting not ended");

        uint256[] memory cids = electionCandidates[_electionId];
        uint256 maxVotes = 0;
        winnerId = cids[0];
        for (uint256 i = 0; i < cids.length; i++) {
            if (candidates[cids[i]].votes > maxVotes) {
                maxVotes = candidates[cids[i]].votes;
                winnerId = cids[i];
            }
        }

        e.status = ElectionStatus.TALLIED;
        emit ElectionTallied(_electionId, winnerId);
    }

    // ── Cancel election ──────────────────
    function cancelElection(uint256 _electionId) external onlyRole(ELECTION_ADMIN_ROLE) {
        Election storage e = elections[_electionId];
        require(e.status != ElectionStatus.TALLIED && e.status != ElectionStatus.CANCELLED, "Cannot cancel");
        e.status = ElectionStatus.CANCELLED;
        emit ElectionCancelled(_electionId);
    }

    // ── View helpers ──────────────────
    function getElectionCandidates(uint256 _electionId) external view returns (uint256[] memory) {
        return electionCandidates[_electionId];
    }

    function getCandidateVotes(uint256 _candidateId) external view returns (uint256) {
        return candidates[_candidateId].votes;
    }
}
