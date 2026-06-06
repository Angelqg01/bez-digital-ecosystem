// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title EnergyOracle — on-chain dMRV registry for BeZhas VPP telemetry
/// @notice Edge nodes (REPORTER_ROLE) submit energy readings; auditors
///         (AUDITOR_ROLE) verify them. Verified, certifiable kWh accumulate per
///         (account, period) and are consumed by EnergyCAEToken (CONSUMER_ROLE)
///         when a CAE certificate is minted — preventing the same energy from
///         being certified twice (double-counting protection for RD 88/2026).
contract EnergyOracle is AccessControl {
    bytes32 public constant REPORTER_ROLE = keccak256("REPORTER_ROLE");
    bytes32 public constant AUDITOR_ROLE  = keccak256("AUDITOR_ROLE");
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    /// @dev GENERATION = energy injected; SAVING = negawatt / demand-response saving.
    enum ProofType { GENERATION, SAVING }

    struct Node {
        address owner;
        string  nodeType;       // SOLAR, WIND, HYDRO, BATTERY, LOAD
        string  location;
        bool    active;
        uint64  lastReadingAt;
    }

    struct EnergyProof {
        address   account;      // prosumer / beneficiary the kWh accrue to
        bytes32   nodeId;
        ProofType proofType;
        uint256   kWh;
        string    period;       // e.g. "2025-Q1"
        string    dataURI;      // IPFS CID / telemetry merkle root
        uint64    timestamp;
        bool      exists;
        bool      verified;
    }

    mapping(bytes32 => Node) public nodes;
    mapping(bytes32 => EnergyProof) public proofs;

    /// @dev Verified, not-yet-consumed certifiable energy: account => keccak(period) => kWh.
    mapping(address => mapping(bytes32 => uint256)) private _verifiedKWh;

    event NodeRegistered(bytes32 indexed nodeId, address indexed owner, string nodeType);
    event NodeStatusChanged(bytes32 indexed nodeId, bool active);
    event ProofSubmitted(bytes32 indexed proofId, bytes32 indexed nodeId, address indexed account, uint256 kWh, ProofType proofType);
    event ProofVerified(bytes32 indexed proofId, uint256 kWh);
    event SavingsConsumed(address indexed account, bytes32 indexed periodHash, uint256 kWh);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REPORTER_ROLE, admin);
        _grantRole(AUDITOR_ROLE, admin);
    }

    // ─────────────────────────────────────────────────────────────
    // Node registry
    // ─────────────────────────────────────────────────────────────

    function registerNode(bytes32 nodeId, address owner, string calldata nodeType, string calldata location)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(owner != address(0), "Zero owner");
        require(nodes[nodeId].owner == address(0), "Node exists");
        nodes[nodeId] = Node({ owner: owner, nodeType: nodeType, location: location, active: true, lastReadingAt: 0 });
        emit NodeRegistered(nodeId, owner, nodeType);
    }

    function setNodeActive(bytes32 nodeId, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(nodes[nodeId].owner != address(0), "Unknown node");
        nodes[nodeId].active = active;
        emit NodeStatusChanged(nodeId, active);
    }

    // ─────────────────────────────────────────────────────────────
    // Telemetry submission (Edge Node → chain)
    // ─────────────────────────────────────────────────────────────

    function submitProof(
        bytes32 proofId,
        bytes32 nodeId,
        address account,
        ProofType proofType,
        uint256 kWh,
        string calldata period,
        string calldata dataURI
    ) external onlyRole(REPORTER_ROLE) {
        require(account != address(0), "Zero account");
        require(kWh > 0, "Zero kWh");
        require(nodes[nodeId].active, "Node inactive");
        require(!proofs[proofId].exists, "Proof exists");

        proofs[proofId] = EnergyProof({
            account: account,
            nodeId: nodeId,
            proofType: proofType,
            kWh: kWh,
            period: period,
            dataURI: dataURI,
            timestamp: uint64(block.timestamp),
            exists: true,
            verified: false
        });
        nodes[nodeId].lastReadingAt = uint64(block.timestamp);
        emit ProofSubmitted(proofId, nodeId, account, kWh, proofType);
    }

    // ─────────────────────────────────────────────────────────────
    // Auditing
    // ─────────────────────────────────────────────────────────────

    function verifyProof(bytes32 proofId) external onlyRole(AUDITOR_ROLE) {
        EnergyProof storage p = proofs[proofId];
        require(p.exists, "Unknown proof");
        require(!p.verified, "Already verified");
        p.verified = true;
        _verifiedKWh[p.account][periodKey(p.period)] += p.kWh;
        emit ProofVerified(proofId, p.kWh);
    }

    // ─────────────────────────────────────────────────────────────
    // Consumption (called by EnergyCAEToken when a certificate is minted)
    // ─────────────────────────────────────────────────────────────

    function consumeVerifiedSavings(address account, string calldata period, uint256 kWh)
        external
        onlyRole(CONSUMER_ROLE)
    {
        bytes32 pk = periodKey(period);
        require(_verifiedKWh[account][pk] >= kWh, "Insufficient verified kWh");
        _verifiedKWh[account][pk] -= kWh;
        emit SavingsConsumed(account, pk, kWh);
    }

    // ─────────────────────────────────────────────────────────────
    // Views
    // ─────────────────────────────────────────────────────────────

    function periodKey(string memory period) public pure returns (bytes32) {
        return keccak256(bytes(period));
    }

    function verifiedKWh(address account, string calldata period) external view returns (uint256) {
        return _verifiedKWh[account][periodKey(period)];
    }

    /// @notice True if the node reported within `maxAgeSeconds` (telemetry freshness).
    function isFresh(bytes32 nodeId, uint64 maxAgeSeconds) external view returns (bool) {
        uint64 last = nodes[nodeId].lastReadingAt;
        return last != 0 && block.timestamp - last <= maxAgeSeconds;
    }
}
