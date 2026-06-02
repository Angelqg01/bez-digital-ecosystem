// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "openzeppelin-contracts/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title BeZhas Wallet Guardian Registry
 * @dev Registro global de guardianes para recuperación social de SmartWallets.
 * Permite: designar guardianes de confianza, verificar identidad de guardianes,
 * crear redes de confianza, y monitorear actividad de recuperación.
 * Complementa SmartWallet.sol con una capa de verificación social.
 */
contract WalletGuardian is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ─── Estado ───────────────────────────────────────────────────────
    struct GuardianInfo {
        address guardian;
        uint256 registeredAt;
        uint256 recoveryCount;
        bool isVerified;
        string label; // "Empresa X - CFO", "Notario ABC"
    }

    // wallet => guardian => info
    mapping(address => mapping(address => GuardianInfo)) public guardianRegistry;
    // wallet => lista de guardianes
    mapping(address => address[]) public walletGuardians;
    // guardian => wallets que protege
    mapping(address => address[]) public guardianWallets;
    // guardian => verificado globalmente
    mapping(address => bool) public verifiedGuardians;

    // ─── Trust Score ──────────────────────────────────────────────────
    mapping(address => uint256) public guardianTrustScore;
    uint256 public constant MAX_TRUST_SCORE = 100;
    uint256 public constant MIN_TRUST_FOR_VERIFIED = 50;

    // ─── Eventos ──────────────────────────────────────────────────────
    event GuardianDesignated(address indexed wallet, address indexed guardian, string label);
    event GuardianRevoked(address indexed wallet, address indexed guardian);
    event GuardianVerified(address indexed guardian);
    event GuardianUnverified(address indexed guardian);
    event TrustScoreUpdated(address indexed guardian, uint256 newScore);
    event RecoveryRecorded(address indexed wallet, address indexed guardian);

    constructor(address admin) Ownable(admin) {}

    // ═══════════════════════════════════════════════════════════════════
    //  DESIGNAR GUARDIANES
    // ═══════════════════════════════════════════════════════════════════

    function designateGuardian(address guardian, string calldata label) external {
        require(guardian != address(0), "WG: zero address");
        require(guardian != msg.sender, "WG: cannot be own guardian");
        require(guardianRegistry[msg.sender][guardian].registeredAt == 0, "WG: already designated");

        guardianRegistry[msg.sender][guardian] = GuardianInfo({
            guardian: guardian,
            registeredAt: block.timestamp,
            recoveryCount: 0,
            isVerified: verifiedGuardians[guardian],
            label: label
        });

        walletGuardians[msg.sender].push(guardian);
        guardianWallets[guardian].push(msg.sender);

        emit GuardianDesignated(msg.sender, guardian, label);
    }

    function revokeGuardian(address guardian) external {
        require(guardianRegistry[msg.sender][guardian].registeredAt > 0, "WG: not designated");
        delete guardianRegistry[msg.sender][guardian];

        // Remove from walletGuardians array
        address[] storage guards = walletGuardians[msg.sender];
        for (uint256 i = 0; i < guards.length; i++) {
            if (guards[i] == guardian) {
                guards[i] = guards[guards.length - 1];
                guards.pop();
                break;
            }
        }

        emit GuardianRevoked(msg.sender, guardian);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VERIFICACIÓN DE GUARDIANES (por admin/protocolo)
    // ═══════════════════════════════════════════════════════════════════

    function verifyGuardian(address guardian) external onlyOwner {
        verifiedGuardians[guardian] = true;
        if (guardianTrustScore[guardian] < MIN_TRUST_FOR_VERIFIED) {
            guardianTrustScore[guardian] = MIN_TRUST_FOR_VERIFIED;
        }
        emit GuardianVerified(guardian);
    }

    function unverifyGuardian(address guardian) external onlyOwner {
        verifiedGuardians[guardian] = false;
        emit GuardianUnverified(guardian);
    }

    function updateTrustScore(address guardian, uint256 score) external onlyOwner {
        require(score <= MAX_TRUST_SCORE, "WG: score too high");
        guardianTrustScore[guardian] = score;
        emit TrustScoreUpdated(guardian, score);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  REGISTRO DE RECUPERACIONES
    // ═══════════════════════════════════════════════════════════════════

    function recordRecovery(address wallet, address guardian) external onlyOwner {
        GuardianInfo storage info = guardianRegistry[wallet][guardian];
        require(info.registeredAt > 0, "WG: not designated");
        info.recoveryCount++;
        emit RecoveryRecorded(wallet, guardian);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISTAS
    // ═══════════════════════════════════════════════════════════════════

    function getWalletGuardians(address wallet) external view returns (address[] memory) {
        return walletGuardians[wallet];
    }

    function getGuardianWallets(address guardian) external view returns (address[] memory) {
        return guardianWallets[guardian];
    }

    function getGuardianInfo(address wallet, address guardian) external view returns (
        uint256 registeredAt,
        uint256 recoveryCount,
        bool isVerified,
        string memory label
    ) {
        GuardianInfo storage info = guardianRegistry[wallet][guardian];
        return (info.registeredAt, info.recoveryCount, info.isVerified, info.label);
    }

    function isDesignated(address wallet, address guardian) external view returns (bool) {
        return guardianRegistry[wallet][guardian].registeredAt > 0;
    }

    function getGuardianCount(address wallet) external view returns (uint256) {
        return walletGuardians[wallet].length;
    }
}
