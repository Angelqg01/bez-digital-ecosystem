// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BeZhas Paymaster (Gas Sponsor)
 * @dev Permite a empresas pagar el gas de sus usuarios con BEZ depositados.
 * Cada empresa deposita BEZ → el Paymaster patrocina transacciones → descuenta del saldo.
 * NO CUSTODIAL: la empresa puede retirar su saldo en cualquier momento.
 * Integra: límites por tx, por día, whitelist de contratos, y pausa de emergencia.
 */
contract Paymaster is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Estado ───────────────────────────────────────────────────────
    IERC20 public bezToken;
    
    struct EnterpriseAccount {
        uint256 balance;
        uint256 dailyLimit;
        uint256 dailySpent;
        uint256 lastDayReset;
        uint256 maxGasPerTx;
        bool isActive;
    }
    
    mapping(address => EnterpriseAccount) public enterprises;
    mapping(address => mapping(address => bool)) public whitelistedContracts; // enterprise => contract => allowed
    mapping(address => address[]) public enterpriseUsers; // enterprise => sponsored users
    mapping(address => mapping(address => bool)) public isEnterpriseUser; // enterprise => user => bool
    
    address[] public enterpriseList;
    mapping(address => bool) public isEnterpriseRegistered;

    // ─── Operadores autorizados de relay ──────────────────────────────
    mapping(address => bool) public relayers;
    
    bool public paused;

    // ─── Eventos ──────────────────────────────────────────────────────
    event EnterpriseRegistered(address indexed enterprise);
    event EnterpriseDeactivated(address indexed enterprise);
    event Deposited(address indexed enterprise, uint256 amount);
    event Withdrawn(address indexed enterprise, uint256 amount);
    event GasSponsored(address indexed enterprise, address indexed user, uint256 gasCost, address target);
    event ContractWhitelisted(address indexed enterprise, address indexed contractAddr);
    event ContractRemoved(address indexed enterprise, address indexed contractAddr);
    event UserAdded(address indexed enterprise, address indexed user);
    event UserRemoved(address indexed enterprise, address indexed user);
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event EmergencyPaused(address indexed by);
    event EmergencyUnpaused(address indexed by);

    // ─── Modificadores ────────────────────────────────────────────────
    modifier onlyRelayer() {
        require(relayers[msg.sender] || msg.sender == owner(), "PM: not relayer");
        _;
    }

    modifier notPaused() {
        require(!paused, "PM: paused");
        _;
    }

    modifier onlyActiveEnterprise(address enterprise) {
        require(enterprises[enterprise].isActive, "PM: not active enterprise");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(address _bezToken, address admin) Ownable(admin) {
        bezToken = IERC20(_bezToken);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  REGISTRO DE EMPRESA
    // ═══════════════════════════════════════════════════════════════════

    function registerEnterprise(
        uint256 _dailyLimit,
        uint256 _maxGasPerTx
    ) external {
        require(!isEnterpriseRegistered[msg.sender], "PM: already registered");
        
        enterprises[msg.sender] = EnterpriseAccount({
            balance: 0,
            dailyLimit: _dailyLimit,
            dailySpent: 0,
            lastDayReset: block.timestamp,
            maxGasPerTx: _maxGasPerTx,
            isActive: true
        });
        
        enterpriseList.push(msg.sender);
        isEnterpriseRegistered[msg.sender] = true;
        emit EnterpriseRegistered(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  DEPOSITAR / RETIRAR BEZ
    // ═══════════════════════════════════════════════════════════════════

    function deposit(uint256 amount) external nonReentrant onlyActiveEnterprise(msg.sender) {
        require(amount > 0, "PM: zero amount");
        bezToken.safeTransferFrom(msg.sender, address(this), amount);
        enterprises[msg.sender].balance += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant onlyActiveEnterprise(msg.sender) {
        EnterpriseAccount storage acct = enterprises[msg.sender];
        require(acct.balance >= amount, "PM: insufficient balance");
        acct.balance -= amount;
        bezToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  PATROCINIO DE GAS (llamado por relayer)
    // ═══════════════════════════════════════════════════════════════════

    function sponsorGas(
        address enterprise,
        address user,
        address target,
        uint256 gasCost
    ) external onlyRelayer notPaused nonReentrant onlyActiveEnterprise(enterprise) {
        EnterpriseAccount storage acct = enterprises[enterprise];
        
        require(isEnterpriseUser[enterprise][user], "PM: user not authorized");
        require(whitelistedContracts[enterprise][target] || target == address(0), "PM: contract not whitelisted");
        require(gasCost <= acct.maxGasPerTx, "PM: exceeds max gas per tx");
        require(acct.balance >= gasCost, "PM: insufficient balance");
        
        // Reset diario (epoch-day based to prevent same-block race)
        uint256 today = block.timestamp / 1 days;
        if (acct.lastDayReset != today) {
            acct.dailySpent = 0;
            acct.lastDayReset = today;
        }
        
        acct.dailySpent += gasCost;
        require(acct.dailySpent <= acct.dailyLimit, "PM: daily limit exceeded");
        
        acct.balance -= gasCost;
        emit GasSponsored(enterprise, user, gasCost, target);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  GESTIÓN DE USUARIOS Y CONTRATOS
    // ═══════════════════════════════════════════════════════════════════

    function addUser(address user) external onlyActiveEnterprise(msg.sender) {
        require(!isEnterpriseUser[msg.sender][user], "PM: user exists");
        isEnterpriseUser[msg.sender][user] = true;
        enterpriseUsers[msg.sender].push(user);
        emit UserAdded(msg.sender, user);
    }

    function removeUser(address user) external onlyActiveEnterprise(msg.sender) {
        require(isEnterpriseUser[msg.sender][user], "PM: user not found");
        isEnterpriseUser[msg.sender][user] = false;
        emit UserRemoved(msg.sender, user);
    }

    function whitelistContract(address contractAddr) external onlyActiveEnterprise(msg.sender) {
        whitelistedContracts[msg.sender][contractAddr] = true;
        emit ContractWhitelisted(msg.sender, contractAddr);
    }

    function removeContract(address contractAddr) external onlyActiveEnterprise(msg.sender) {
        whitelistedContracts[msg.sender][contractAddr] = false;
        emit ContractRemoved(msg.sender, contractAddr);
    }

    function setDailyLimit(uint256 _dailyLimit) external onlyActiveEnterprise(msg.sender) {
        enterprises[msg.sender].dailyLimit = _dailyLimit;
    }

    function setMaxGasPerTx(uint256 _maxGas) external onlyActiveEnterprise(msg.sender) {
        enterprises[msg.sender].maxGasPerTx = _maxGas;
    }

    // ═══════════════════════════════════════════════════════════════════
    //  ADMIN
    // ═══════════════════════════════════════════════════════════════════

    function addRelayer(address relayer) external onlyOwner {
        relayers[relayer] = true;
        emit RelayerAdded(relayer);
    }

    function removeRelayer(address relayer) external onlyOwner {
        relayers[relayer] = false;
        emit RelayerRemoved(relayer);
    }

    function deactivateEnterprise(address enterprise) external onlyOwner {
        enterprises[enterprise].isActive = false;
        emit EnterpriseDeactivated(enterprise);
    }

    function emergencyPause() external onlyOwner {
        paused = true;
        emit EmergencyPaused(msg.sender);
    }

    function emergencyUnpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpaused(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════
    //  VISTAS
    // ═══════════════════════════════════════════════════════════════════

    function getEnterpriseBalance(address enterprise) external view returns (uint256) {
        return enterprises[enterprise].balance;
    }

    function getEnterpriseRemainingDaily(address enterprise) external view returns (uint256) {
        EnterpriseAccount storage acct = enterprises[enterprise];
        if (block.timestamp >= acct.lastDayReset + 1 days) {
            return acct.dailyLimit;
        }
        if (acct.dailySpent >= acct.dailyLimit) return 0;
        return acct.dailyLimit - acct.dailySpent;
    }

    function getEnterpriseUsers(address enterprise) external view returns (address[] memory) {
        return enterpriseUsers[enterprise];
    }

    function getEnterpriseCount() external view returns (uint256) {
        return enterpriseList.length;
    }
}
