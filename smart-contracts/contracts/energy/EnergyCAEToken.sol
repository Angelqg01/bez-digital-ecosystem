// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title EnergyCAEToken
 * @dev Tokenizes Certificados de Ahorro Energético (CAEs).
 * 1 CAE = 1 kWh of verified energy savings/generation.
 * Can only be minted by the authorized BeZhas VPP or Aegis Verification service.
 */
contract EnergyCAEToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Mapping to store the verification hash (e.g. Aegis IPFS hash) for a specific minting
    mapping(uint256 => string) public verificationProofs;
    uint256 public nextProofId;

    event CAEMinted(address indexed to, uint256 amount, uint256 proofId, string ipfsHash);

    constructor() ERC20("BeZhas Energy CAE", "BZCAE") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Mints new CAE tokens based on verified energy savings.
     * @param to The address of the prosumer who generated the savings.
     * @param amount The amount of kWh saved.
     * @param ipfsHash The IPFS hash containing the Aegis AI verification report.
     */
    function mintCAE(address to, uint256 amount, string calldata ipfsHash) external onlyRole(MINTER_ROLE) {
        uint256 proofId = nextProofId++;
        verificationProofs[proofId] = ipfsHash;
        
        _mint(to, amount);
        
        emit CAEMinted(to, amount, proofId, ipfsHash);
    }
    
    function burnCAE(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
