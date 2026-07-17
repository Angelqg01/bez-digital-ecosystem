// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title TelemetryAnchor — merkle roots of IoT telemetry batches per B-UID shipment
/// @notice BZ CargoLink consolidates each shipment's sensor readings into a
///         sha256 sorted-pair merkle root and anchors it here. Any single
///         reading can later be proven against the on-chain root with an
///         inclusion proof ("route without alterations" as cryptography).
contract TelemetryAnchor is AccessControl {

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct Anchor {
        bytes32 merkleRoot;   // sha256, sorted-pair pairing
        uint64 fromTs;        // first reading timestamp (unix)
        uint64 toTs;          // last reading timestamp (unix)
        uint32 leafCount;
        uint64 anchoredAt;    // block timestamp
        address operator;
    }

    /// keccak256(bUid) → ordered anchor list
    mapping(bytes32 => Anchor[]) private _anchors;

    event BatchAnchored(
        bytes32 indexed bUidHash,
        string bUid,
        uint256 indexed index,
        bytes32 merkleRoot,
        uint32 leafCount,
        uint64 fromTs,
        uint64 toTs
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    /// @notice Anchor one telemetry batch for a shipment.
    function anchorBatch(
        string calldata bUid,
        bytes32 merkleRoot,
        uint64 fromTs,
        uint64 toTs,
        uint32 leafCount
    ) external onlyRole(OPERATOR_ROLE) returns (uint256 index) {
        require(bytes(bUid).length > 0, "Empty bUid");
        require(merkleRoot != bytes32(0), "Empty root");
        require(leafCount > 0, "Empty batch");
        require(toTs >= fromTs, "Bad time range");

        bytes32 key = keccak256(bytes(bUid));
        index = _anchors[key].length;
        _anchors[key].push(Anchor({
            merkleRoot: merkleRoot,
            fromTs: fromTs,
            toTs: toTs,
            leafCount: leafCount,
            anchoredAt: uint64(block.timestamp),
            operator: msg.sender
        }));

        emit BatchAnchored(key, bUid, index, merkleRoot, leafCount, fromTs, toTs);
    }

    function anchorCount(string calldata bUid) external view returns (uint256) {
        return _anchors[keccak256(bytes(bUid))].length;
    }

    function getAnchor(string calldata bUid, uint256 index) external view returns (Anchor memory) {
        Anchor[] storage list = _anchors[keccak256(bytes(bUid))];
        require(index < list.length, "Anchor not found");
        return list[index];
    }

    /// @notice Verify a reading's inclusion proof against an anchored root.
    /// @dev sha256 sorted-pair pairing — mirrors api/services/cargoTelemetryAnchor.js.
    function verify(
        string calldata bUid,
        uint256 index,
        bytes32 leaf,
        bytes32[] calldata proof
    ) external view returns (bool) {
        Anchor[] storage list = _anchors[keccak256(bytes(bUid))];
        require(index < list.length, "Anchor not found");

        bytes32 acc = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            acc = acc <= proof[i]
                ? sha256(abi.encodePacked(acc, proof[i]))
                : sha256(abi.encodePacked(proof[i], acc));
        }
        return acc == list[index].merkleRoot;
    }
}
