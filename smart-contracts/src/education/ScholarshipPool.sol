// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ScholarshipPool — DeFi scholarship pools with merit-based distribution on BeZhas Chain
/// @notice Create pools, apply, approve scholars, distribute awards
contract ScholarshipPool is AccessControl {

    bytes32 public constant SPONSOR_ROLE = keccak256("SPONSOR_ROLE");

    struct Pool {
        string  name;
        address sponsor;
        uint256 totalFund;
        uint256 distributed;
        uint256 scholarCount;
        uint256 minScore;       // 0-100
        bool    active;
    }

    struct Scholar {
        uint256 poolId;
        address student;
        uint256 gpaScore;       // 0-100
        uint256 awarded;
        uint256 appliedAt;
        bool    approved;
    }

    uint256 public nextPoolId;
    mapping(uint256 => Pool) public pools;

    uint256 public nextScholarId;
    mapping(uint256 => Scholar) public scholars;
    mapping(uint256 => uint256[]) public poolScholars;

    event PoolCreated(uint256 indexed poolId, string name, address indexed sponsor, uint256 totalFund);
    event ApplicationSubmitted(uint256 indexed poolId, uint256 scholarId, address indexed student, uint256 gpaScore);
    event ScholarApproved(uint256 indexed scholarId);
    event AwardDistributed(uint256 indexed scholarId, uint256 amount);
    event PoolClosed(uint256 indexed poolId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SPONSOR_ROLE, msg.sender);
    }

    function createPool(
        string calldata name,
        uint256 minScore
    ) external payable onlyRole(SPONSOR_ROLE) returns (uint256) {
        require(msg.value > 0, "Must fund pool");
        require(minScore <= 100, "Score 0-100");

        uint256 id = nextPoolId++;
        pools[id] = Pool({
            name: name,
            sponsor: msg.sender,
            totalFund: msg.value,
            distributed: 0,
            scholarCount: 0,
            minScore: minScore,
            active: true
        });

        emit PoolCreated(id, name, msg.sender, msg.value);
        return id;
    }

    function applyForScholarship(uint256 poolId, uint256 gpaScore) external returns (uint256) {
        Pool storage p = pools[poolId];
        require(p.active, "Pool not active");
        require(gpaScore >= p.minScore, "GPA below minimum");
        require(gpaScore <= 100, "Score 0-100");

        uint256 sid = nextScholarId++;
        scholars[sid] = Scholar({
            poolId: poolId,
            student: msg.sender,
            gpaScore: gpaScore,
            awarded: 0,
            appliedAt: block.timestamp,
            approved: false
        });
        poolScholars[poolId].push(sid);

        emit ApplicationSubmitted(poolId, sid, msg.sender, gpaScore);
        return sid;
    }

    function approveScholar(uint256 scholarId) external onlyRole(SPONSOR_ROLE) {
        Scholar storage s = scholars[scholarId];
        require(!s.approved, "Already approved");
        require(pools[s.poolId].active, "Pool closed");

        s.approved = true;
        pools[s.poolId].scholarCount++;

        emit ScholarApproved(scholarId);
    }

    function distributeAward(uint256 scholarId, uint256 amount) external onlyRole(SPONSOR_ROLE) {
        Scholar storage s = scholars[scholarId];
        require(s.approved, "Not approved");

        Pool storage p = pools[s.poolId];
        require(p.distributed + amount <= p.totalFund, "Exceeds fund");
        require(address(this).balance >= amount, "Insufficient balance");

        s.awarded += amount;
        p.distributed += amount;

        (bool ok, ) = payable(s.student).call{value: amount}("");
        require(ok, "Transfer failed");

        emit AwardDistributed(scholarId, amount);
    }

    function closePool(uint256 poolId) external onlyRole(SPONSOR_ROLE) {
        require(pools[poolId].active, "Already closed");
        pools[poolId].active = false;
        emit PoolClosed(poolId);
    }

    function getPool(uint256 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }

    function getScholar(uint256 scholarId) external view returns (Scholar memory) {
        return scholars[scholarId];
    }

    function getPoolScholarCount(uint256 poolId) external view returns (uint256) {
        return poolScholars[poolId].length;
    }

    receive() external payable {}
}
