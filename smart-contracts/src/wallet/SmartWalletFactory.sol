// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SmartWallet} from "./SmartWallet.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title BeZhas SmartWallet Factory
 * @dev Despliega wallets inteligentes con CREATE2 para direcciones determinísticas.
 * NO CUSTODIAL: la factory NO retiene control sobre las wallets creadas.
 * El owner de cada wallet es exclusivamente su creador.
 */
contract SmartWalletFactory is Ownable {
    
    // ─── Estado ───────────────────────────────────────────────────────
    mapping(address => address[]) public walletsByOwner;
    mapping(address => bool) public isBeZhasWallet;
    uint256 public totalWallets;
    
    uint256 public defaultDailyLimit;
    
    // ─── Eventos ──────────────────────────────────────────────────────
    event WalletCreated(
        address indexed owner,
        address indexed wallet,
        address guardian,
        uint256 dailyLimit,
        uint256 walletIndex
    );
    event DefaultDailyLimitChanged(uint256 oldLimit, uint256 newLimit);

    constructor(address admin, uint256 _defaultDailyLimit) Ownable(admin) {
        defaultDailyLimit = _defaultDailyLimit;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CREAR WALLET
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @dev Crea una wallet inteligente para el caller.
     * @param guardian Dirección del guardián para recuperación social.
     * @param dailyLimit Límite diario de retiro (0 = sin límite).
     * @param salt Sal para CREATE2 — permite calcular la dirección antes del deploy.
     */
    function createWallet(
        address guardian,
        uint256 dailyLimit,
        bytes32 salt
    ) external returns (address wallet) {
        wallet = _createWalletFor(msg.sender, guardian, dailyLimit, salt);
    }

    /**
     * @dev Crea una wallet para un owner explicito.
     *      Permite onboarding FIAT/Web2 donde BeZhas despliega la wallet
     *      pero el owner criptografico es la cuenta del perfil, no el relayer.
     */
    function createWalletFor(
        address walletOwner,
        address guardian,
        uint256 dailyLimit,
        bytes32 salt
    ) external returns (address wallet) {
        wallet = _createWalletFor(walletOwner, guardian, dailyLimit, salt);
    }

    /**
     * @dev Crea wallet con límite default.
     */
    function createWalletSimple(address guardian) external returns (address wallet) {
        bytes32 salt = keccak256(abi.encodePacked(
            msg.sender, block.timestamp, walletsByOwner[msg.sender].length
        ));
        wallet = _createWalletFor(msg.sender, guardian, defaultDailyLimit, salt);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  CALCULAR DIRECCIÓN (antes del deploy)
    // ═══════════════════════════════════════════════════════════════════

    function computeWalletAddress(
        address walletOwner,
        address guardian,
        uint256 dailyLimit,
        bytes32 salt
    ) external view returns (address) {
        bytes32 finalSalt = keccak256(abi.encodePacked(walletOwner, salt));
        
        bytes32 hash = keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            finalSalt,
            keccak256(abi.encodePacked(
                type(SmartWallet).creationCode,
                abi.encode(walletOwner, guardian, dailyLimit)
            ))
        ));
        return address(uint160(uint256(hash)));
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISTAS
    // ═══════════════════════════════════════════════════════════════════

    function getWalletsByOwner(address walletOwner) external view returns (address[] memory) {
        return walletsByOwner[walletOwner];
    }

    function getWalletCount(address walletOwner) external view returns (uint256) {
        return walletsByOwner[walletOwner].length;
    }

    // ─── Admin (solo Default Limit global) ────────────────────────────

    function setDefaultDailyLimit(uint256 newLimit) external onlyOwner {
        emit DefaultDailyLimitChanged(defaultDailyLimit, newLimit);
        defaultDailyLimit = newLimit;
    }

    function _createWalletFor(
        address walletOwner,
        address guardian,
        uint256 dailyLimit,
        bytes32 salt
    ) internal returns (address wallet) {
        require(walletOwner != address(0), "SWF: zero owner");
        bytes32 finalSalt = keccak256(abi.encodePacked(walletOwner, salt));

        wallet = address(new SmartWallet{salt: finalSalt}(
            walletOwner,
            guardian,
            dailyLimit
        ));

        walletsByOwner[walletOwner].push(wallet);
        isBeZhasWallet[wallet] = true;
        totalWallets++;

        emit WalletCreated(walletOwner, wallet, guardian, dailyLimit, totalWallets);
    }
}
