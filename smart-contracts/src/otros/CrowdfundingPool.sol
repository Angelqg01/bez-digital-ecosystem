// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CrowdfundingPool — Tokenized crowdfunding campaigns with milestones and refunds
contract CrowdfundingPool is AccessControl {
    bytes32 public constant CAMPAIGN_ROLE = keccak256("CAMPAIGN_ROLE");

    enum CampaignStatus { ACTIVE, FUNDED, FAILED, CANCELLED }

    struct Campaign {
        uint256 id;
        address creator;
        uint256 goal;
        uint256 raised;
        uint256 deadline;
        bytes32 descHash;
        CampaignStatus status;
        uint256 backerCount;
    }

    struct Pledge {
        uint256 id;
        uint256 campaignId;
        address backer;
        uint256 amount;
        bool refunded;
    }

    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Pledge) public pledges;
    mapping(uint256 => uint256[]) internal _campaignPledges;
    mapping(address => uint256[]) internal _creatorCampaigns;

    uint256 public nextCampaignId = 1;
    uint256 public nextPledgeId = 1;

    event CampaignCreated(uint256 indexed campaignId, address indexed creator, uint256 goal);
    event Pledged(uint256 indexed campaignId, address indexed backer, uint256 amount);
    event CampaignFunded(uint256 indexed campaignId);
    event CampaignFailed(uint256 indexed campaignId);
    event Refunded(uint256 indexed pledgeId, address indexed backer, uint256 amount);
    event FundsWithdrawn(uint256 indexed campaignId, uint256 amount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CAMPAIGN_ROLE, msg.sender);
    }

    function createCampaign(uint256 _goal, uint256 _duration, bytes32 _descHash) external onlyRole(CAMPAIGN_ROLE) returns (uint256) {
        require(_goal > 0, "Goal required");
        require(_duration > 0, "Duration required");

        uint256 cid = nextCampaignId++;
        campaigns[cid] = Campaign({
            id: cid,
            creator: msg.sender,
            goal: _goal,
            raised: 0,
            deadline: block.timestamp + _duration,
            descHash: _descHash,
            status: CampaignStatus.ACTIVE,
            backerCount: 0
        });
        _creatorCampaigns[msg.sender].push(cid);

        emit CampaignCreated(cid, msg.sender, _goal);
        return cid;
    }

    function pledge(uint256 _campaignId) external payable returns (uint256) {
        Campaign storage c = campaigns[_campaignId];
        require(c.status == CampaignStatus.ACTIVE, "Not active");
        require(block.timestamp <= c.deadline, "Campaign ended");
        require(msg.value > 0, "Amount required");

        uint256 pid = nextPledgeId++;
        pledges[pid] = Pledge({
            id: pid,
            campaignId: _campaignId,
            backer: msg.sender,
            amount: msg.value,
            refunded: false
        });
        _campaignPledges[_campaignId].push(pid);
        c.raised += msg.value;
        c.backerCount++;

        emit Pledged(_campaignId, msg.sender, msg.value);
        return pid;
    }

    function finalizeCampaign(uint256 _campaignId) external onlyRole(CAMPAIGN_ROLE) {
        Campaign storage c = campaigns[_campaignId];
        require(c.status == CampaignStatus.ACTIVE, "Not active");
        require(block.timestamp > c.deadline, "Not ended yet");

        if (c.raised >= c.goal) {
            c.status = CampaignStatus.FUNDED;
            emit CampaignFunded(_campaignId);
        } else {
            c.status = CampaignStatus.FAILED;
            emit CampaignFailed(_campaignId);
        }
    }

    function withdrawFunds(uint256 _campaignId) external {
        Campaign storage c = campaigns[_campaignId];
        require(c.status == CampaignStatus.FUNDED, "Not funded");
        require(msg.sender == c.creator, "Not creator");
        require(c.raised > 0, "No funds");

        uint256 amount = c.raised;
        c.raised = 0;
        (bool ok,) = c.creator.call{value: amount}("");
        require(ok, "Transfer failed");

        emit FundsWithdrawn(_campaignId, amount);
    }

    function refund(uint256 _pledgeId) external {
        Pledge storage p = pledges[_pledgeId];
        require(p.backer == msg.sender, "Not backer");
        require(!p.refunded, "Already refunded");

        Campaign storage c = campaigns[p.campaignId];
        require(c.status == CampaignStatus.FAILED || c.status == CampaignStatus.CANCELLED, "Cannot refund");

        p.refunded = true;
        (bool ok,) = p.backer.call{value: p.amount}("");
        require(ok, "Transfer failed");

        emit Refunded(_pledgeId, p.backer, p.amount);
    }

    function cancelCampaign(uint256 _campaignId) external {
        Campaign storage c = campaigns[_campaignId];
        require(msg.sender == c.creator, "Not creator");
        require(c.status == CampaignStatus.ACTIVE, "Not active");
        c.status = CampaignStatus.CANCELLED;
    }

    // ── View helpers ──
    function getCampaignPledges(uint256 _campaignId) external view returns (uint256[] memory) {
        return _campaignPledges[_campaignId];
    }

    function getCreatorCampaigns(address _creator) external view returns (uint256[] memory) {
        return _creatorCampaigns[_creator];
    }

    function isCampaignActive(uint256 _campaignId) external view returns (bool) {
        return campaigns[_campaignId].status == CampaignStatus.ACTIVE && block.timestamp <= campaigns[_campaignId].deadline;
    }
}
