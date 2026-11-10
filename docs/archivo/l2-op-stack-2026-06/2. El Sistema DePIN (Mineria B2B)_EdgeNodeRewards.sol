// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EdgeNodeRewards
 * @dev Sistema de "Minería" B2B. Recompensa a las empresas por procesar datos IoT,
 * validar manifiestos y utilizar la IA nativa del protocolo BeZhas.
 */
contract EdgeNodeRewards is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    IERC20 public bezToken;
    
    // Cuántos BEZ se pagan por cada "Punto de Validación"
    uint256 public rewardPerPoint = 1 * 10**18; // 1 BEZ por defecto

    struct NodeInfo {
        uint256 totalValidations;
        uint256 claimablePoints;
        uint256 totalBEZEarned;
        bool isActive;
    }

    mapping(address => NodeInfo) public enterpriseNodes;

    event NodeRegistered(address indexed nodeAddress);
    event ValidationRecorded(address indexed nodeAddress, uint256 pointsAdded, string taskType);
    event RewardsClaimed(address indexed nodeAddress, uint256 bezAmount);

    constructor(address _bezTokenAddress, address defaultAdmin) {
        bezToken = IERC20(_bezTokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
    }

    /**
     * @dev Registra a una nueva empresa en el sistema DePIN.
     */
    function registerNode(address nodeAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!enterpriseNodes[nodeAddress].isActive, "Node already active");
        enterpriseNodes[nodeAddress].isActive = true;
        emit NodeRegistered(nodeAddress);
    }

    /**
     * @dev Llamado por tu IA o Secuenciador cuando la empresa automatiza un proceso.
     * @param nodeAddress La wallet del servidor de la empresa.
     * @param points Cuánto valor aportó (ej. Trazabilidad IoT = 5 pts, IA Image = 10 pts).
     */
    function recordValidation(address nodeAddress, uint256 points, string calldata taskType) 
        external 
        onlyRole(ORACLE_ROLE) 
    {
        require(enterpriseNodes[nodeAddress].isActive, "Node not registered");
        
        enterpriseNodes[nodeAddress].totalValidations += 1;
        enterpriseNodes[nodeAddress].claimablePoints += points;
        
        emit ValidationRecorded(nodeAddress, points, taskType);
    }

    /**
     * @dev Las empresas llaman a esta funcion para retirar su BEZ-Coin minado a su tesoreria.
     */
    function claimRewards() external nonReentrant {
        NodeInfo storage node = enterpriseNodes[msg.sender];
        require(node.claimablePoints > 0, "No rewards to claim");

        uint256 bezToMint = node.claimablePoints * rewardPerPoint;
        
        // Reseteamos los puntos antes de la transferencia para evitar ataques de reentrada
        node.claimablePoints = 0;
        node.totalBEZEarned += bezToMint;

        // Transfiere los BEZ desde las reservas del contrato a la empresa
        require(bezToken.transfer(msg.sender, bezToMint), "Transfer failed");

        emit RewardsClaimed(msg.sender, bezToMint);
    }

    // Funciones administrativas para ajustar la economía
    function updateRewardPerPoint(uint256 _newRate) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardPerPoint = _newRate;
    }
}