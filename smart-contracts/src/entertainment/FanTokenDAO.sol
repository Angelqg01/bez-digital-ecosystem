// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title FanTokenDAO — Fan engagement governance for teams and artists on BeZhas Chain
/// @notice Mint fan tokens, create polls, vote, earn engagement rewards
contract FanTokenDAO is AccessControl {

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    struct FanClub {
        string  name;
        string  category; // "Sports", "Music", "eSports", "Film"
        address manager;
        uint256 totalMembers;
        uint256 totalPolls;
        uint256 rewardPool;
        bool    active;
    }

    struct Member {
        uint256 clubId;
        address fan;
        uint256 joinedAt;
        uint256 engagementScore;
        uint256 votesCount;
        uint256 rewardsClaimed;
    }

    struct Poll {
        uint256 clubId;
        string  question;
        string[] options;
        uint256 startTime;
        uint256 endTime;
        bool    finalized;
        uint256 winningOption;
    }

    uint256 public nextClubId;
    mapping(uint256 => FanClub) public clubs;

    uint256 public nextMemberId;
    mapping(uint256 => Member) public members;
    mapping(uint256 => mapping(address => uint256)) public clubMemberId; // clubId => fan => memberId
    mapping(uint256 => mapping(address => bool)) public isMember;

    uint256 public nextPollId;
    mapping(uint256 => Poll) public polls;
    mapping(uint256 => mapping(uint256 => uint256)) public pollVotes; // pollId => optionIndex => count
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ClubCreated(uint256 indexed clubId, string name, string category, address indexed manager);
    event MemberJoined(uint256 indexed clubId, uint256 memberId, address indexed fan);
    event PollCreated(uint256 indexed clubId, uint256 indexed pollId, string question);
    event VoteCast(uint256 indexed pollId, address indexed voter, uint256 option);
    event PollFinalized(uint256 indexed pollId, uint256 winningOption);
    event RewardDeposited(uint256 indexed clubId, uint256 amount);
    event RewardClaimed(uint256 indexed clubId, address indexed fan, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANAGER_ROLE, msg.sender);
    }

    function createClub(
        string calldata name,
        string calldata category
    ) external onlyRole(MANAGER_ROLE) returns (uint256) {
        uint256 id = nextClubId++;
        clubs[id] = FanClub({
            name: name,
            category: category,
            manager: msg.sender,
            totalMembers: 0,
            totalPolls: 0,
            rewardPool: 0,
            active: true
        });

        emit ClubCreated(id, name, category, msg.sender);
        return id;
    }

    function joinClub(uint256 clubId) external {
        FanClub storage club = clubs[clubId];
        require(club.active, "Club not active");
        require(!isMember[clubId][msg.sender], "Already member");

        uint256 mid = nextMemberId++;
        members[mid] = Member({
            clubId: clubId,
            fan: msg.sender,
            joinedAt: block.timestamp,
            engagementScore: 0,
            votesCount: 0,
            rewardsClaimed: 0
        });
        clubMemberId[clubId][msg.sender] = mid;
        isMember[clubId][msg.sender] = true;
        club.totalMembers++;

        emit MemberJoined(clubId, mid, msg.sender);
    }

    function createPoll(
        uint256 clubId,
        string calldata question,
        string[] calldata options,
        uint256 duration
    ) external onlyRole(MANAGER_ROLE) returns (uint256) {
        require(options.length >= 2, "Min 2 options");
        require(options.length <= 10, "Max 10 options");
        require(duration > 0, "Duration must be > 0");

        FanClub storage club = clubs[clubId];
        require(club.active, "Club not active");

        uint256 pid = nextPollId++;
        Poll storage p = polls[pid];
        p.clubId = clubId;
        p.question = question;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + duration;
        p.finalized = false;
        for (uint256 i = 0; i < options.length; i++) {
            p.options.push(options[i]);
        }
        club.totalPolls++;

        emit PollCreated(clubId, pid, question);
        return pid;
    }

    function vote(uint256 pollId, uint256 optionIndex) external {
        Poll storage p = polls[pollId];
        require(block.timestamp >= p.startTime, "Not started");
        require(block.timestamp <= p.endTime, "Poll ended");
        require(!p.finalized, "Already finalized");
        require(isMember[p.clubId][msg.sender], "Not a member");
        require(!hasVoted[pollId][msg.sender], "Already voted");
        require(optionIndex < p.options.length, "Invalid option");

        hasVoted[pollId][msg.sender] = true;
        pollVotes[pollId][optionIndex]++;

        uint256 mid = clubMemberId[p.clubId][msg.sender];
        members[mid].engagementScore += 10;
        members[mid].votesCount++;

        emit VoteCast(pollId, msg.sender, optionIndex);
    }

    function finalizePoll(uint256 pollId) external onlyRole(MANAGER_ROLE) {
        Poll storage p = polls[pollId];
        require(block.timestamp > p.endTime, "Poll not ended");
        require(!p.finalized, "Already finalized");

        uint256 maxVotes;
        uint256 winner;
        for (uint256 i = 0; i < p.options.length; i++) {
            if (pollVotes[pollId][i] > maxVotes) {
                maxVotes = pollVotes[pollId][i];
                winner = i;
            }
        }

        p.finalized = true;
        p.winningOption = winner;

        emit PollFinalized(pollId, winner);
    }

    function depositRewards(uint256 clubId) external payable onlyRole(MANAGER_ROLE) {
        require(msg.value > 0, "No value");
        clubs[clubId].rewardPool += msg.value;

        emit RewardDeposited(clubId, msg.value);
    }

    function claimReward(uint256 clubId, uint256 amount) external {
        require(isMember[clubId][msg.sender], "Not a member");

        FanClub storage club = clubs[clubId];
        require(club.rewardPool >= amount, "Insufficient pool");

        uint256 mid = clubMemberId[clubId][msg.sender];
        require(members[mid].engagementScore >= 10, "Low engagement");

        club.rewardPool -= amount;
        members[mid].rewardsClaimed += amount;

        (bool sent,) = msg.sender.call{value: amount}("");
        require(sent, "Transfer failed");

        emit RewardClaimed(clubId, msg.sender, amount);
    }

    function getClub(uint256 clubId) external view returns (FanClub memory) {
        return clubs[clubId];
    }

    function getMember(uint256 memberId) external view returns (Member memory) {
        return members[memberId];
    }

    function getPollOptionCount(uint256 pollId) external view returns (uint256) {
        return polls[pollId].options.length;
    }

    function getPollVotes(uint256 pollId, uint256 optionIndex) external view returns (uint256) {
        return pollVotes[pollId][optionIndex];
    }

    receive() external payable {}
}
