// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";

/**
 * @title IdentityRegistry v2
 * @notice Registro de identidad y roles para el ecosistema BeZhas.
 * Permite a agentes de IA (Legal, Marketing) y contratos del ecosistema
 * consultar el rol y estado de verificación de cualquier address.
 *
 * Mejoras v2:
 * - Implementación de AccessControl para permitir múltiples verificadores (Agentes IA).
 * - Soporte para metadatos de identidad (hashes IPFS).
 * - Integración con el sistema de agentes OpenClaw.
 */
contract IdentityRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");

    enum Role {
        None,
        Retail,
        PrivateInvestor,
        Whale,
        Company,
        Corporation,
        Institution,
        Government,
        Partner // Nuevo: Para la red de socios pre-verificados
    }

    struct Identity {
        Role role;
        bool verified;
        address multiSigWallet;
        string metadataHash; // Hash IPFS con documentación/KYC (encriptado)
        uint256 lastUpdate;
    }

    mapping(address => Identity) public identities;
    mapping(address => bool) public isRegistered;

    event RoleAssigned(address indexed user, Role role, address multiSigWallet, address indexed assignedBy);
    event VerificationStatusChanged(address indexed user, bool verified, address indexed verifier);
    event MetadataUpdated(address indexed user, string newHash);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    /**
     * @dev Asigna un rol a un usuario. Solo verificadores u admins.
     */
    function assignRole(address user, Role role, address multiSig)
        external
        onlyRole(VERIFIER_ROLE)
    {
        require(role != Role.None, "Invalid role");
        
        identities[user].role = role;
        identities[user].lastUpdate = block.timestamp;
        
        if (role == Role.Institution || role == Role.Government) {
            require(multiSig != address(0), "MultiSig required");
            identities[user].multiSigWallet = multiSig;
        }

        isRegistered[user] = true;
        emit RoleAssigned(user, role, multiSig, msg.sender);
    }

    /**
     * @dev Cambia el estado de verificación. Ideal para el legal-agent.
     */
    function setVerification(address user, bool status) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        require(isRegistered[user], "User not registered");
        identities[user].verified = status;
        identities[user].lastUpdate = block.timestamp;
        emit VerificationStatusChanged(user, status, msg.sender);
    }

    /**
     * @dev Actualiza metadatos (hash de KYC/Docs).
     */
    function updateMetadata(address user, string calldata newHash) 
        external 
        onlyRole(VERIFIER_ROLE) 
    {
        require(isRegistered[user], "User not registered");
        identities[user].metadataHash = newHash;
        identities[user].lastUpdate = block.timestamp;
        emit MetadataUpdated(user, newHash);
    }

    // ─── Getters ──────────────────────────────────────────────────────────────

    function getIdentity(address user) external view returns (Identity memory) {
        return identities[user];
    }

    function isVerified(address user) external view returns (bool) {
        return identities[user].verified;
    }

    function getRole(address user) external view returns (Role) {
        return identities[user].role;
    }
}
