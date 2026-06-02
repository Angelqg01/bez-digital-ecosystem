// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";

/**
 * @title IWrappedBEZ
 */
interface IWrappedBEZ {
    function bridgeMint(address to, uint256 amount, bytes32 srcTxHash) external;
    function bridgeBurn(address from, uint256 amount, uint256 targetChainId) external;
}

/**
 * @title IBEZCoinV2
 */
interface IBEZCoinV2 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title BEZPolygonBridge
 * @dev Cross-chain bridge between BeZhas L2 (BEZCoinV2) and Polygon/other chains (wBEZ).
 * 
 * Architecture:
 *   L2 Side (this contract on L2):
 *     - lock(): User locks BEZ → emits BridgeLocked → relayer mints wBEZ on Polygon
 *     - unlock(): Relayer unlocks BEZ → sends to user (when wBEZ burned on Polygon)
 *
 *   Polygon Side (WrappedBEZ.sol):
 *     - bridgeMint(): Relayer mints wBEZ after BEZ locked on L2
 *     - burnForBridge(): User burns wBEZ → emits BridgeBurn → relayer unlocks on L2
 *
 * Security:
 *   - Nonce-based replay protection per user
 *   - Per-tx and daily limits
 *   - Pausable by admin for emergencies
 *   - ReentrancyGuard on all state-changing functions
 */
contract BEZPolygonBridge is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IBEZCoinV2 public immutable bezToken;

    // ─── Bridge Config ──────────────────────────────
    uint256 public bridgeFeeRate = 50; // 0.5% (50 / 10000)
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public minimumFee = 10 * 1e18; // 10 BEZ minimum fee ($1 USD)
    uint256 public maxPerTx = 1_000_000 * 1e18;   // 1M BEZ per tx
    uint256 public dailyLimit = 10_000_000 * 1e18; // 10M BEZ daily

    // ─── State ──────────────────────────────────────
    uint256 public totalLocked;
    uint256 public totalFees;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public processedTxs;

    // Daily tracking
    uint256 public currentDay;
    uint256 public dailyVolume;

    // ─── Events ─────────────────────────────────────
    event BridgeLocked(
        address indexed sender,
        uint256 amount,
        uint256 fee,
        uint256 netAmount,
        uint256 indexed targetChainId,
        uint256 nonce
    );
    event BridgeUnlocked(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed srcTxHash
    );
    event FeeCollected(uint256 amount);
    event ConfigUpdated(string param, uint256 value);

    constructor(address _bezToken, address admin) {
        require(_bezToken != address(0), "Invalid token");
        require(admin != address(0), "Invalid admin");

        bezToken = IBEZCoinV2(_bezToken);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        currentDay = block.timestamp / 1 days;
    }

    // ─── User Functions ─────────────────────────────

    /**
     * @dev Lock BEZ on L2 to receive wBEZ on target chain.
     * @param amount Amount of BEZ to lock.
     * @param targetChainId Target chain (137 for Polygon, 1 for Ethereum).
     */
    function lock(uint256 amount, uint256 targetChainId)
        external
        nonReentrant
        whenNotPaused
    {
        require(amount > 0, "Amount must be > 0");
        require(amount <= maxPerTx, "Exceeds max per tx");
        _checkDailyLimit(amount);

        uint256 fee = (amount * bridgeFeeRate) / FEE_DENOMINATOR;
        if (fee < minimumFee) fee = minimumFee;
        require(amount > fee, "Amount must cover minimum fee");
        uint256 netAmount = amount - fee;

        // Transfer BEZ from user to this contract (lock)
        bool success = bezToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        totalLocked += netAmount;
        totalFees += fee;

        uint256 nonce = nonces[msg.sender]++;

        emit BridgeLocked(msg.sender, amount, fee, netAmount, targetChainId, nonce);
    }

    /**
     * @dev Relayer unlocks BEZ when wBEZ is burned on the source chain.
     *
     * SECURITY / TRUST MODEL: this is a custodial lock-mint bridge. `RELAYER_ROLE` is fully
     * trusted to assert that a burn happened on the remote chain — there is NO on-chain proof
     * (Merkle/light-client) here. Therefore RELAYER_ROLE MUST be a multisig or a threshold/MPC
     * signer, never a single hot EOA. Replay is bounded per `srcTxHash`; solvency is bounded by
     * `totalLocked -= amount` (reverts on underflow if a relayer tries to unlock more than locked).
     *
     * @param recipient User to receive BEZ.
     * @param amount Amount to unlock.
     * @param srcTxHash Hash of the burn tx on the source chain.
     */
    function unlock(address recipient, uint256 amount, bytes32 srcTxHash)
        external
        nonReentrant
        whenNotPaused
        onlyRole(RELAYER_ROLE)
    {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(!processedTxs[srcTxHash], "Already processed");

        processedTxs[srcTxHash] = true;
        totalLocked -= amount;

        bool success = bezToken.transfer(recipient, amount);
        require(success, "Transfer failed");

        emit BridgeUnlocked(recipient, amount, srcTxHash);
    }

    // ─── Admin Functions ────────────────────────────

    function withdrawFees(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid address");
        uint256 fees = totalFees;
        totalFees = 0;
        bezToken.transfer(to, fees);
        emit FeeCollected(fees);
    }

    function setFeeRate(uint256 newRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newRate <= 500, "Fee too high"); // max 5%
        bridgeFeeRate = newRate;
        emit ConfigUpdated("feeRate", newRate);
    }

    function setMinimumFee(uint256 newMinFee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMinFee <= 100 * 1e18, "Min fee too high"); // max 100 BEZ
        minimumFee = newMinFee;
        emit ConfigUpdated("minimumFee", newMinFee);
    }

    function setMaxPerTx(uint256 newMax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxPerTx = newMax;
        emit ConfigUpdated("maxPerTx", newMax);
    }

    function setDailyLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dailyLimit = newLimit;
        emit ConfigUpdated("dailyLimit", newLimit);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ─── View Functions ─────────────────────────────

    function getLockedBalance() external view returns (uint256) {
        return totalLocked;
    }

    function isProcessed(bytes32 txHash) external view returns (bool) {
        return processedTxs[txHash];
    }

    // ─── Internal ───────────────────────────────────

    function _checkDailyLimit(uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        if (today != currentDay) {
            currentDay = today;
            dailyVolume = 0;
        }
        dailyVolume += amount;
        require(dailyVolume <= dailyLimit, "Daily limit exceeded");
    }
}
