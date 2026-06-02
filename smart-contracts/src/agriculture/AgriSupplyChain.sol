// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title AgriSupplyChain — Farm-to-table traceability with GPS proofs on BeZhas Chain
/// @notice Register products, track checkpoints, manage certifications along the chain
contract AgriSupplyChain is AccessControl {

    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant CERTIFIER_ROLE = keccak256("CERTIFIER_ROLE");

    struct Product {
        string  name;
        string  origin;
        string  batchId;
        address farmer;
        uint256 weight;         // grams
        uint256 harvestDate;
        bool    delivered;
    }

    struct CheckpointLog {
        uint256 productId;
        string  location;
        uint256 temperature;    // scaled 1e2 (420 = 4.20°C)
        bytes32 gpsProof;
        uint256 timestamp;
    }

    struct Certification {
        uint256 productId;
        string  certName;
        address certifier;
        uint256 issuedAt;
        bool    valid;
    }

    uint256 public nextProductId;
    mapping(uint256 => Product) public products;

    uint256 public totalCheckpoints;
    mapping(uint256 => CheckpointLog) public checkpoints;
    mapping(uint256 => uint256) public productCheckpointCount;

    uint256 public totalCertifications;
    mapping(uint256 => Certification) public certifications;
    mapping(uint256 => uint256) public productCertCount;

    event ProductRegistered(uint256 indexed productId, string name, string batchId, address indexed farmer);
    event CheckpointAdded(uint256 indexed productId, uint256 checkpointId, string location);
    event CertificationAdded(uint256 indexed productId, uint256 certId, string certName);
    event ProductDelivered(uint256 indexed productId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(FARMER_ROLE, msg.sender);
        _grantRole(DISTRIBUTOR_ROLE, msg.sender);
        _grantRole(CERTIFIER_ROLE, msg.sender);
    }

    function registerProduct(
        string calldata name,
        string calldata origin,
        string calldata batchId,
        uint256 weight,
        uint256 harvestDate
    ) external onlyRole(FARMER_ROLE) returns (uint256) {
        require(bytes(batchId).length > 0, "Empty batchId");
        require(weight > 0, "Weight must be > 0");

        uint256 id = nextProductId++;
        products[id] = Product({
            name: name,
            origin: origin,
            batchId: batchId,
            farmer: msg.sender,
            weight: weight,
            harvestDate: harvestDate,
            delivered: false
        });

        emit ProductRegistered(id, name, batchId, msg.sender);
        return id;
    }

    function addCheckpoint(
        uint256 productId,
        string calldata location,
        uint256 temperature,
        bytes32 gpsProof
    ) external onlyRole(DISTRIBUTOR_ROLE) {
        require(productId < nextProductId, "Product does not exist");
        require(!products[productId].delivered, "Already delivered");

        uint256 cpId = totalCheckpoints++;
        checkpoints[cpId] = CheckpointLog({
            productId: productId,
            location: location,
            temperature: temperature,
            gpsProof: gpsProof,
            timestamp: block.timestamp
        });
        productCheckpointCount[productId]++;

        emit CheckpointAdded(productId, cpId, location);
    }

    function addCertification(
        uint256 productId,
        string calldata certName
    ) external onlyRole(CERTIFIER_ROLE) {
        require(productId < nextProductId, "Product does not exist");

        uint256 certId = totalCertifications++;
        certifications[certId] = Certification({
            productId: productId,
            certName: certName,
            certifier: msg.sender,
            issuedAt: block.timestamp,
            valid: true
        });
        productCertCount[productId]++;

        emit CertificationAdded(productId, certId, certName);
    }

    function markDelivered(uint256 productId) external onlyRole(DISTRIBUTOR_ROLE) {
        require(productId < nextProductId, "Product does not exist");
        require(!products[productId].delivered, "Already delivered");
        products[productId].delivered = true;
        emit ProductDelivered(productId);
    }

    function getProduct(uint256 id) external view returns (
        string memory name, string memory origin, string memory batchId,
        address farmer, uint256 weight, uint256 harvestDate, bool delivered
    ) {
        Product storage p = products[id];
        return (p.name, p.origin, p.batchId, p.farmer, p.weight, p.harvestDate, p.delivered);
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
