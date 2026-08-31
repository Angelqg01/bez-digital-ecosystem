// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BeZhas Vault - Sistema de Dividendos para RWA
 * @dev Gestiona las rentas mensuales de activos tokenizados
 * Los dueños de fracciones pueden reclamar su parte proporcional
 */
contract BeZhasVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable bezCoin;
    IERC1155 public rwaFactory;

    struct DividendInfo {
        uint256 totalDeposited;      // Total de dividendos depositados
        uint256 lastDistributionTime; // Última vez que se distribuyó
        uint256 distributionCount;    // Número de distribuciones
        bool isActive;                // Si el activo está activo para dividendos
    }

    // assetId => información de dividendos
    mapping(uint256 => DividendInfo) public assetDividends;
    
    // assetId => usuario => rentas ya reclamadas
    mapping(uint256 => mapping(address => uint256)) public claimedDividends;
    
    // assetId => época de distribución => monto total
    mapping(uint256 => mapping(uint256 => uint256)) public distributionHistory;

    event MonthlyRentDeposited(uint256 indexed assetId, uint256 amount, address indexed depositor);
    event DividendsClaimed(uint256 indexed assetId, address indexed investor, uint256 amount);
    event AssetActivated(uint256 indexed assetId);
    event AssetDeactivated(uint256 indexed assetId);

    constructor(address _bezCoin, address _factory) Ownable(msg.sender) {
        bezCoin = IERC20(_bezCoin);
        rwaFactory = IERC1155(_factory);
    }

    /**
     * @dev El manager del activo deposita la renta mensual
     * @param _assetId ID del activo RWA
     * @param _amount Monto en BEZ-Coin
     */
    function depositMonthlyRent(uint256 _assetId, uint256 _amount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(_amount > 0, "Amount must be > 0");
        require(assetDividends[_assetId].isActive, "Asset not active for dividends");

        // Transferir BEZ-Coin al vault
        bezCoin.safeTransferFrom(msg.sender, address(this), _amount);

        // Actualizar información de dividendos
        assetDividends[_assetId].totalDeposited += _amount;
        assetDividends[_assetId].lastDistributionTime = block.timestamp;
        assetDividends[_assetId].distributionCount++;

        // Guardar en historial
        uint256 epoch = assetDividends[_assetId].distributionCount;
        distributionHistory[_assetId][epoch] = _amount;

        emit MonthlyRentDeposited(_assetId, _amount, msg.sender);
    }

    /**
     * @dev Calcula cuánto puede reclamar el usuario
     * @param _assetId ID del activo
     * @param _user Dirección del inversor
     * @return Monto pendiente en BEZ-Coin
     */
    function getPendingRewards(uint256 _assetId, address _user) 
        public 
        view 
        returns (uint256) 
    {
        uint256 userShares = rwaFactory.balanceOf(_user, _assetId);
        if (userShares == 0) return 0;

        // Obtener total supply del asset desde la factory
        // Nota: Necesitaríamos una función en RWAFactory para esto
        // Por ahora usamos un cálculo simplificado
        uint256 totalDeposited = assetDividends[_assetId].totalDeposited;
        uint256 alreadyClaimed = claimedDividends[_assetId][_user];

        // Calcular proporción con precisión
        // Asumimos que el total supply está disponible de alguna forma
        // En producción, esto debería consultar a RWAFactory.assets(id).totalSupply
        
        // Fórmula simplificada: (totalDeposited * userShares) / estimatedTotalSupply
        // Para evitar overflow, usamos el patrón de multiplicar primero
        uint256 entitlement = (totalDeposited * userShares) / 1000; // Asumimos 1000 supply
        
        return entitlement > alreadyClaimed ? entitlement - alreadyClaimed : 0;
    }

    /**
     * @dev Reclama dividendos pendientes
     * @param _assetId ID del activo
     */
    function claimDividends(uint256 _assetId) external nonReentrant whenNotPaused {
        uint256 reward = getPendingRewards(_assetId, msg.sender);
        require(reward > 0, "No pending dividends");

        claimedDividends[_assetId][msg.sender] += reward;
        bezCoin.safeTransfer(msg.sender, reward);

        emit DividendsClaimed(_assetId, msg.sender, reward);
    }

    /**
     * @dev Activar un activo para recibir dividendos
     * Solo el owner de la plataforma puede activar
     */
    function activateAsset(uint256 _assetId) external onlyOwner {
        assetDividends[_assetId].isActive = true;
        emit AssetActivated(_assetId);
    }

    /**
     * @dev Desactivar un activo (en caso de problemas)
     */
    function deactivateAsset(uint256 _assetId) external onlyOwner {
        assetDividends[_assetId].isActive = false;
        emit AssetDeactivated(_assetId);
    }

    /**
     * @dev Actualizar dirección del factory contract
     */
    function updateFactory(address _newFactory) external onlyOwner {
        rwaFactory = IERC1155(_newFactory);
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdraw (solo owner, en caso extremo)
     */
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
