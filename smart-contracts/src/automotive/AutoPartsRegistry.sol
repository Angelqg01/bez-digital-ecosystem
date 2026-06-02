// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title AutoPartsRegistry — Supply chain tracking with anti-counterfeit & recall management
/// @notice Tracks auto parts from manufacturer to end consumer on BeZhas Chain
contract AutoPartsRegistry is AccessControl {

    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant INSPECTOR_ROLE    = keccak256("INSPECTOR_ROLE");

    struct Part {
        string  serialNumber;
        string  name;
        address manufacturer;
        string  batchId;
        uint256 registeredAt;
        bool    verified;
        bool    recalled;
        string  recallReason;
    }

    struct CustodyLog {
        address fromEntity;
        address toEntity;
        uint256 timestamp;
        bytes32 conditionProof;
    }

    uint256 public nextPartId;
    mapping(uint256 => Part) public parts;
    mapping(uint256 => CustodyLog[]) private _custodyChain;
    mapping(string => bool) public recalledBatches;
    uint256 public totalParts;
    uint256 public totalRecalls;

    event PartRegistered(uint256 indexed partId, string serialNumber, address manufacturer);
    event PartVerified(uint256 indexed partId);
    event CustodyTransferred(uint256 indexed partId, address from, address to);
    event RecallIssued(string batchId, string reason);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANUFACTURER_ROLE, admin);
        _grantRole(INSPECTOR_ROLE, admin);
    }

    function registerPart(
        string calldata serialNumber,
        string calldata name,
        string calldata batchId
    ) external onlyRole(MANUFACTURER_ROLE) returns (uint256) {
        require(bytes(serialNumber).length > 0, "Serial required");
        require(bytes(name).length > 0, "Name required");

        uint256 partId = nextPartId++;
        parts[partId] = Part({
            serialNumber: serialNumber,
            name: name,
            manufacturer: msg.sender,
            batchId: batchId,
            registeredAt: block.timestamp,
            verified: false,
            recalled: false,
            recallReason: ""
        });

        totalParts++;
        emit PartRegistered(partId, serialNumber, msg.sender);
        return partId;
    }

    function verifyAuthenticity(uint256 partId) external onlyRole(INSPECTOR_ROLE) {
        require(partId < nextPartId, "Part does not exist");
        require(!parts[partId].recalled, "Part is recalled");
        parts[partId].verified = true;

        emit PartVerified(partId);
    }

    function transferCustody(
        uint256 partId,
        address to,
        bytes32 conditionProof
    ) external {
        require(partId < nextPartId, "Part does not exist");
        require(!parts[partId].recalled, "Part is recalled");

        _custodyChain[partId].push(CustodyLog({
            fromEntity: msg.sender,
            toEntity: to,
            timestamp: block.timestamp,
            conditionProof: conditionProof
        }));

        emit CustodyTransferred(partId, msg.sender, to);
    }

    function issueRecall(
        string calldata batchId,
        string calldata reason
    ) external onlyRole(MANUFACTURER_ROLE) {
        require(bytes(batchId).length > 0, "Batch ID required");
        require(!recalledBatches[batchId], "Already recalled");

        recalledBatches[batchId] = true;
        totalRecalls++;

        emit RecallIssued(batchId, reason);
    }

    function markPartRecalled(uint256 partId, string calldata reason) external onlyRole(MANUFACTURER_ROLE) {
        require(partId < nextPartId, "Part does not exist");
        parts[partId].recalled = true;
        parts[partId].recallReason = reason;
        parts[partId].verified = false;
    }

    function getCustodyChain(uint256 partId) external view returns (CustodyLog[] memory) {
        return _custodyChain[partId];
    }

    function getCustodyLength(uint256 partId) external view returns (uint256) {
        return _custodyChain[partId].length;
    }

    function isPartRecalled(uint256 partId) external view returns (bool) {
        return parts[partId].recalled;
    }
}
