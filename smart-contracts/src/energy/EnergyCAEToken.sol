// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "openzeppelin-contracts/contracts/token/ERC1155/ERC1155.sol";
import "openzeppelin-contracts/contracts/access/AccessControl.sol";

interface IEnergyOracle {
    function consumeVerifiedSavings(address account, string calldata period, uint256 kWh) external;
}

/// @title EnergyCAEToken — Certificados de Ahorro Energético (CAE) as ERC-1155
/// @notice Each token id is a CAE batch backed by verified savings in EnergyOracle.
///         1 token unit = 1 kWh of certified saved/generated energy. Minting
///         consumes the matching (account, period) kWh in the oracle so the same
///         energy cannot be certified twice. Holders retire (burn) certificates
///         to claim the underlying saving immutably for compliance.
contract EnergyCAEToken is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    enum Certifier { CNMC, IDAE, BEZHAS_ORACLE }

    struct Certificate {
        uint256   savingsKwh;
        string    period;
        Certifier certifier;
        bytes32   nodeId;
        string    dataURI;
        uint64    mintedAt;
        uint256   retiredKwh;
    }

    IEnergyOracle public immutable oracle;
    uint256 public nextTokenId;
    uint256 public totalRetiredKwh;
    mapping(uint256 => Certificate) public certificates;
    mapping(uint256 => string) private _tokenURIs;

    event CertificateMinted(uint256 indexed tokenId, address indexed to, uint256 savingsKwh, string period, Certifier certifier);
    event CertificateRetired(uint256 indexed tokenId, address indexed holder, uint256 kWh);

    constructor(address admin, address oracleAddr) ERC1155("") {
        require(oracleAddr != address(0), "Zero oracle");
        oracle = IEnergyOracle(oracleAddr);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /// @notice Mint a CAE certificate backed by verified savings in the oracle.
    /// @dev Reverts if the oracle has insufficient verified kWh for (to, period).
    function mintFromOracle(
        address to,
        uint256 savingsKwh,
        string calldata period,
        Certifier certifier,
        bytes32 nodeId,
        string calldata dataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(to != address(0), "Zero to");
        require(savingsKwh > 0, "Zero kWh");

        oracle.consumeVerifiedSavings(to, period, savingsKwh);

        tokenId = nextTokenId++;
        certificates[tokenId] = Certificate({
            savingsKwh: savingsKwh,
            period: period,
            certifier: certifier,
            nodeId: nodeId,
            dataURI: dataURI,
            mintedAt: uint64(block.timestamp),
            retiredKwh: 0
        });
        _tokenURIs[tokenId] = dataURI;
        _mint(to, tokenId, savingsKwh, "");
        emit CertificateMinted(tokenId, to, savingsKwh, period, certifier);
    }

    /// @notice Retire (burn) certificate units — permanent, for compliance claims.
    function retire(uint256 tokenId, uint256 kWh) external {
        require(tokenId < nextTokenId, "Invalid token");
        require(kWh > 0, "Zero kWh");
        require(balanceOf(msg.sender, tokenId) >= kWh, "Insufficient balance");
        _burn(msg.sender, tokenId, kWh);
        certificates[tokenId].retiredKwh += kWh;
        totalRetiredKwh += kWh;
        emit CertificateRetired(tokenId, msg.sender, kWh);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
