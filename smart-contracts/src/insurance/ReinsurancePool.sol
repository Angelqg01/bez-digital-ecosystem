// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title ReinsurancePool — DeFi reinsurance pools with risk tokenization on BeZhas Chain
/// @notice Create pools, deposit/withdraw capital, distribute yield, cover claims
contract ReinsurancePool is AccessControl {

    bytes32 public constant POOL_ADMIN_ROLE = keccak256("POOL_ADMIN_ROLE");

    enum RiskTier { CONSERVATIVE, MODERATE, AGGRESSIVE }

    struct Pool {
        string   name;
        string   sector;
        uint256  tvl;
        uint256  maxCapacity;
        uint256  maxLossPerEvent;
        RiskTier riskTier;
        uint256  yieldBps;       // basis points (10000 = 100%)
        uint256  investorCount;
        bool     open;
    }

    struct Deposit {
        uint256 poolId;
        address investor;
        uint256 amount;
        uint256 depositedAt;
        uint256 yieldClaimed;
    }

    uint256 public nextPoolId;
    mapping(uint256 => Pool) public pools;

    uint256 public nextDepositId;
    mapping(uint256 => Deposit) public deposits;
    mapping(uint256 => uint256[]) public poolDeposits;

    event PoolCreated(uint256 indexed poolId, string name, string sector, uint256 maxCapacity);
    event DepositMade(uint256 indexed poolId, uint256 depositId, address indexed investor, uint256 amount);
    event WithdrawalMade(uint256 indexed poolId, uint256 depositId, address indexed investor, uint256 amount);
    event YieldClaimed(uint256 indexed depositId, address indexed investor, uint256 amount);
    event ClaimPaidFromPool(uint256 indexed poolId, uint256 amount, string reason);
    event PoolCapped(uint256 indexed poolId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POOL_ADMIN_ROLE, msg.sender);
    }

    function createPool(
        string calldata name,
        string calldata sector,
        uint256 maxCapacity,
        uint256 maxLossPerEvent,
        RiskTier riskTier,
        uint256 yieldBps
    ) external onlyRole(POOL_ADMIN_ROLE) returns (uint256) {
        require(maxCapacity > 0, "Capacity must be > 0");
        require(maxLossPerEvent <= maxCapacity, "Loss > capacity");
        require(yieldBps <= 5000, "Yield too high");

        uint256 id = nextPoolId++;
        pools[id] = Pool({
            name: name,
            sector: sector,
            tvl: 0,
            maxCapacity: maxCapacity,
            maxLossPerEvent: maxLossPerEvent,
            riskTier: riskTier,
            yieldBps: yieldBps,
            investorCount: 0,
            open: true
        });

        emit PoolCreated(id, name, sector, maxCapacity);
        return id;
    }

    function deposit(uint256 poolId) external payable {
        Pool storage p = pools[poolId];
        require(p.open, "Pool is closed");
        require(msg.value > 0, "Must deposit > 0");
        require(p.tvl + msg.value <= p.maxCapacity, "Exceeds capacity");

        uint256 did = nextDepositId++;
        deposits[did] = Deposit({
            poolId: poolId,
            investor: msg.sender,
            amount: msg.value,
            depositedAt: block.timestamp,
            yieldClaimed: 0
        });
        poolDeposits[poolId].push(did);

        p.tvl += msg.value;
        p.investorCount++;

        emit DepositMade(poolId, did, msg.sender, msg.value);
    }

    function withdraw(uint256 depositId) external {
        Deposit storage d = deposits[depositId];
        require(d.investor == msg.sender, "Not investor");
        require(d.amount > 0, "Nothing to withdraw");

        uint256 amt = d.amount;
        Pool storage p = pools[d.poolId];

        d.amount = 0;
        p.tvl -= amt;
        p.investorCount--;

        (bool ok, ) = payable(msg.sender).call{value: amt}("");
        require(ok, "Transfer failed");

        emit WithdrawalMade(d.poolId, depositId, msg.sender, amt);
    }

    function claimYield(uint256 depositId) external {
        Deposit storage d = deposits[depositId];
        require(d.investor == msg.sender, "Not investor");
        require(d.amount > 0, "No deposit");

        Pool storage p = pools[d.poolId];
        uint256 elapsed = block.timestamp - d.depositedAt;
        uint256 annualYield = (d.amount * p.yieldBps) / 10000;
        uint256 totalYield = (annualYield * elapsed) / 365 days;
        uint256 claimable = totalYield - d.yieldClaimed;
        require(claimable > 0, "No yield");
        require(address(this).balance >= claimable, "Insufficient balance");

        d.yieldClaimed += claimable;

        (bool ok, ) = payable(msg.sender).call{value: claimable}("");
        require(ok, "Transfer failed");

        emit YieldClaimed(depositId, msg.sender, claimable);
    }

    function payClaimFromPool(uint256 poolId, uint256 amount, string calldata reason) external onlyRole(POOL_ADMIN_ROLE) {
        Pool storage p = pools[poolId];
        require(amount <= p.maxLossPerEvent, "Exceeds max loss");
        require(amount <= p.tvl, "Exceeds TVL");
        require(address(this).balance >= amount, "Insufficient balance");

        p.tvl -= amount;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "Transfer failed");

        emit ClaimPaidFromPool(poolId, amount, reason);
    }

    function capPool(uint256 poolId) external onlyRole(POOL_ADMIN_ROLE) {
        pools[poolId].open = false;
        emit PoolCapped(poolId);
    }

    function getPool(uint256 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }

    function getPoolDepositCount(uint256 poolId) external view returns (uint256) {
        return poolDeposits[poolId].length;
    }

    receive() external payable {}
}
