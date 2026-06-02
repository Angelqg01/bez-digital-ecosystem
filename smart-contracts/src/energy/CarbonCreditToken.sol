// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import "openzeppelin-contracts/contracts/access/AccessControl.sol";

/// @title CarbonCreditToken — ERC-1155 carbon credits & RECs on BeZhas Chain
/// @notice Each token ID represents a unique credit batch (VCS, GS, ACR, CDM, REC)
contract CarbonCreditToken is ERC1155, AccessControl {

    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");

    struct CreditBatch {
        string  registryId;
        string  registry;       // Verra, Gold Standard, ACR, CDM, AIB
        string  projectName;
        uint256 totalTonnes;    // tCO2e minted (or MWh for RECs)
        uint256 retiredTonnes;
        uint256 pricePerUnit;   // price in BEZ wei
        string  vintage;
        bool    verified;
    }

    uint256 public nextTokenId;
    mapping(uint256 => CreditBatch) public batches;
    mapping(uint256 => mapping(address => uint256)) public retired; // tokenId => holder => retired
    uint256 public totalRetiredGlobal;

    event BatchMinted(uint256 indexed tokenId, string registryId, string registry, uint256 tonnes);
    event CreditsRetired(uint256 indexed tokenId, address indexed holder, uint256 tonnes);
    event BatchVerified(uint256 indexed tokenId);
    event CreditsTraded(uint256 indexed tokenId, address indexed from, address indexed to, uint256 qty);

    constructor(address admin) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(ORACLE_ROLE, admin);
    }

    function mintCreditBatch(
        string calldata registryId,
        string calldata registry,
        string calldata projectName,
        uint256 totalTonnes,
        uint256 pricePerUnit,
        string calldata vintage
    ) external onlyRole(VERIFIER_ROLE) returns (uint256 tokenId) {
        require(totalTonnes > 0, "Zero tonnes");
        tokenId = nextTokenId++;
        batches[tokenId] = CreditBatch({
            registryId: registryId,
            registry: registry,
            projectName: projectName,
            totalTonnes: totalTonnes,
            retiredTonnes: 0,
            pricePerUnit: pricePerUnit,
            vintage: vintage,
            verified: false
        });
        _mint(msg.sender, tokenId, totalTonnes, "");
        emit BatchMinted(tokenId, registryId, registry, totalTonnes);
    }

    function verifyBatch(uint256 tokenId) external onlyRole(ORACLE_ROLE) {
        require(tokenId < nextTokenId, "Invalid token");
        batches[tokenId].verified = true;
        emit BatchVerified(tokenId);
    }

    function retireCredits(uint256 tokenId, uint256 tonnes) external {
        require(tokenId < nextTokenId, "Invalid token");
        require(balanceOf(msg.sender, tokenId) >= tonnes, "Insufficient balance");
        _burn(msg.sender, tokenId, tonnes);
        batches[tokenId].retiredTonnes += tonnes;
        retired[tokenId][msg.sender] += tonnes;
        totalRetiredGlobal += tonnes;
        emit CreditsRetired(tokenId, msg.sender, tonnes);
    }

    function tradeCredits(uint256 tokenId, address to, uint256 qty) external {
        require(to != address(0), "Zero address");
        safeTransferFrom(msg.sender, to, tokenId, qty, "");
        emit CreditsTraded(tokenId, msg.sender, to, qty);
    }

    function getRetirementCertificate(uint256 tokenId, address holder) external view returns (uint256) {
        return retired[tokenId][holder];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
