// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title NFTStaking
 * @dev Contrato para stakear NFTs y ganar rewards en BEZ tokens
 * Soporta múltiples pools con diferentes APY y períodos de lock
 */
contract NFTStaking is Ownable, ReentrancyGuard, Pausable {
    
    IERC20 public immutable rewardsToken; // BEZ token
    
    struct StakingPool {
        string name;
        uint256 apyRate;           // APY en basis points (1000 = 10%)
        uint256 minLockPeriod;     // Período mínimo en segundos
        uint256 maxLockPeriod;     // Período máximo en segundos
        uint256 totalStaked;       // Total de NFTs stakeados
        uint256 totalRewardsDistributed; // Total rewards distribuidos
        bool isActive;
    }
    
    struct StakeInfo {
        address nftContract;
        uint256 tokenId;
        address staker;
        uint256 poolId;
        uint256 stakedAt;
        uint256 unlockAt;
        uint256 lastClaimAt;
        uint256 rewardsClaimed;
        bool isActive;
    }
    
    // Pools de staking
    mapping(uint256 => StakingPool) public stakingPools;
    uint256 public poolCount;
    
    // Información de stakes
    mapping(bytes32 => StakeInfo) public stakes; // keccak256(nftContract, tokenId) => StakeInfo
    mapping(address => bytes32[]) public userStakes; // user => stakeIds
    
    // NFT contracts permitidos
    mapping(address => bool) public allowedNFTContracts;
    
    // Multipliers por rareza (opcional)
    mapping(address => mapping(uint256 => uint256)) public rarityMultiplier; // nftContract => tokenId => multiplier (100 = 1x)
    
    // Emergency withdraw habilitado
    bool public emergencyWithdrawEnabled;
    
    // Eventos
    event PoolCreated(uint256 indexed poolId, string name, uint256 apyRate);
    event NFTStaked(
        bytes32 indexed stakeId,
        address indexed staker,
        address nftContract,
        uint256 tokenId,
        uint256 poolId,
        uint256 unlockAt
    );
    event NFTUnstaked(
        bytes32 indexed stakeId,
        address indexed staker,
        address nftContract,
        uint256 tokenId
    );
    event RewardsClaimed(
        bytes32 indexed stakeId,
        address indexed staker,
        uint256 amount
    );
    event EmergencyWithdraw(
        bytes32 indexed stakeId,
        address indexed staker
    );
    
    constructor(address _rewardsToken) Ownable(msg.sender) {
        rewardsToken = IERC20(_rewardsToken);
        
        // Crear pools por defecto
        _createPool("Flexible", 500, 0, 0); // 5% APY, sin lock
        _createPool("30 Days", 1000, 30 days, 30 days); // 10% APY, 30 días
        _createPool("90 Days", 2000, 90 days, 90 days); // 20% APY, 90 días
        _createPool("180 Days", 3500, 180 days, 180 days); // 35% APY, 180 días
        _createPool("1 Year", 5000, 365 days, 365 days); // 50% APY, 1 año
    }
    
    /**
     * @dev Crear un nuevo pool de staking
     */
    function _createPool(
        string memory name,
        uint256 apyRate,
        uint256 minLockPeriod,
        uint256 maxLockPeriod
    ) internal {
        stakingPools[poolCount] = StakingPool({
            name: name,
            apyRate: apyRate,
            minLockPeriod: minLockPeriod,
            maxLockPeriod: maxLockPeriod,
            totalStaked: 0,
            totalRewardsDistributed: 0,
            isActive: true
        });
        
        emit PoolCreated(poolCount, name, apyRate);
        poolCount++;
    }
    
    /**
     * @dev Stakear un NFT
     * @param nftContract Dirección del contrato NFT
     * @param tokenId ID del token
     * @param poolId ID del pool de staking
     */
    function stakeNFT(
        address nftContract,
        uint256 tokenId,
        uint256 poolId
    ) external nonReentrant whenNotPaused {
        require(allowedNFTContracts[nftContract], "NFT contract no permitido");
        require(poolId < poolCount, "Pool invalido");
        require(stakingPools[poolId].isActive, "Pool no activo");
        
        bytes32 stakeId = keccak256(abi.encodePacked(nftContract, tokenId));
        require(!stakes[stakeId].isActive, "NFT ya stakeado");
        
        // Transferir NFT al contrato
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        
        StakingPool storage pool = stakingPools[poolId];
        uint256 unlockAt = pool.minLockPeriod > 0 
            ? block.timestamp + pool.minLockPeriod 
            : 0;
        
        // Crear stake
        stakes[stakeId] = StakeInfo({
            nftContract: nftContract,
            tokenId: tokenId,
            staker: msg.sender,
            poolId: poolId,
            stakedAt: block.timestamp,
            unlockAt: unlockAt,
            lastClaimAt: block.timestamp,
            rewardsClaimed: 0,
            isActive: true
        });
        
        userStakes[msg.sender].push(stakeId);
        pool.totalStaked++;
        
        emit NFTStaked(stakeId, msg.sender, nftContract, tokenId, poolId, unlockAt);
    }
    
    /**
     * @dev Unstakear un NFT
     * @param nftContract Dirección del contrato NFT
     * @param tokenId ID del token
     */
    function unstakeNFT(address nftContract, uint256 tokenId) 
        external 
        nonReentrant 
    {
        bytes32 stakeId = keccak256(abi.encodePacked(nftContract, tokenId));
        StakeInfo storage stake = stakes[stakeId];
        
        require(stake.isActive, "Stake no activo");
        require(stake.staker == msg.sender, "No eres el staker");
        require(
            stake.unlockAt == 0 || block.timestamp >= stake.unlockAt,
            "Periodo de lock aun activo"
        );
        
        // Claim rewards pendientes
        _claimRewards(stakeId);
        
        // Marcar como inactivo
        stake.isActive = false;
        stakingPools[stake.poolId].totalStaked--;
        
        // Transferir NFT de vuelta
        IERC721(nftContract).transferFrom(address(this), msg.sender, tokenId);
        
        emit NFTUnstaked(stakeId, msg.sender, nftContract, tokenId);
    }
    
    /**
     * @dev Claim rewards de un stake
     * @param stakeId ID del stake
     */
    function claimRewards(bytes32 stakeId) external nonReentrant {
        StakeInfo storage stake = stakes[stakeId];
        require(stake.isActive, "Stake no activo");
        require(stake.staker == msg.sender, "No eres el staker");
        
        _claimRewards(stakeId);
    }
    
    /**
     * @dev Internal: calcular y distribuir rewards
     */
    function _claimRewards(bytes32 stakeId) internal {
        StakeInfo storage stake = stakes[stakeId];
        uint256 rewards = calculateRewards(stakeId);
        
        if (rewards > 0) {
            stake.lastClaimAt = block.timestamp;
            stake.rewardsClaimed += rewards;
            stakingPools[stake.poolId].totalRewardsDistributed += rewards;
            
            require(
                rewardsToken.transfer(stake.staker, rewards),
                "Transfer fallido"
            );
            
            emit RewardsClaimed(stakeId, stake.staker, rewards);
        }
    }
    
    /**
     * @dev Calcular rewards pendientes
     * @param stakeId ID del stake
     */
    function calculateRewards(bytes32 stakeId) 
        public 
        view 
        returns (uint256) 
    {
        StakeInfo memory stake = stakes[stakeId];
        if (!stake.isActive) return 0;
        
        StakingPool memory pool = stakingPools[stake.poolId];
        uint256 timeStaked = block.timestamp - stake.lastClaimAt;
        
        // Calcular rewards base (APY anualizado)
        // rewards = (timeStaked / 365 days) * apyRate / 10000 * baseAmount
        // Asumimos 1 NFT = 1000 BEZ como base
        uint256 baseAmount = 1000 * 10**18; // 1000 BEZ
        uint256 rewards = (baseAmount * pool.apyRate * timeStaked) / (365 days * 10000);
        
        // Aplicar multiplier por rareza si existe
        uint256 multiplier = rarityMultiplier[stake.nftContract][stake.tokenId];
        if (multiplier > 0) {
            rewards = (rewards * multiplier) / 100;
        }
        
        return rewards;
    }
    
    /**
     * @dev Emergency withdraw (sin rewards)
     * @param nftContract Dirección del contrato NFT
     * @param tokenId ID del token
     */
    function emergencyWithdraw(address nftContract, uint256 tokenId) 
        external 
        nonReentrant 
    {
        require(emergencyWithdrawEnabled, "Emergency withdraw deshabilitado");
        
        bytes32 stakeId = keccak256(abi.encodePacked(nftContract, tokenId));
        StakeInfo storage stake = stakes[stakeId];
        
        require(stake.isActive, "Stake no activo");
        require(stake.staker == msg.sender, "No eres el staker");
        
        stake.isActive = false;
        stakingPools[stake.poolId].totalStaked--;
        
        IERC721(nftContract).transferFrom(address(this), msg.sender, tokenId);
        
        emit EmergencyWithdraw(stakeId, msg.sender);
    }
    
    /**
     * @dev Obtener stakes de un usuario
     * @param user Dirección del usuario
     */
    function getUserStakes(address user) 
        external 
        view 
        returns (StakeInfo[] memory) 
    {
        bytes32[] memory stakeIds = userStakes[user];
        StakeInfo[] memory result = new StakeInfo[](stakeIds.length);
        
        for (uint256 i = 0; i < stakeIds.length; i++) {
            result[i] = stakes[stakeIds[i]];
        }
        
        return result;
    }
    
    /**
     * @dev Permitir un contrato NFT
     */
    function allowNFTContract(address nftContract, bool allowed) 
        external 
        onlyOwner 
    {
        allowedNFTContracts[nftContract] = allowed;
    }
    
    /**
     * @dev Set multiplier por rareza
     */
    function setRarityMultiplier(
        address nftContract,
        uint256 tokenId,
        uint256 multiplier
    ) external onlyOwner {
        require(multiplier >= 100 && multiplier <= 500, "Multiplier entre 1x-5x");
        rarityMultiplier[nftContract][tokenId] = multiplier;
    }
    
    /**
     * @dev Toggle emergency withdraw
     */
    function toggleEmergencyWithdraw() external onlyOwner {
        emergencyWithdrawEnabled = !emergencyWithdrawEnabled;
    }
    
    /**
     * @dev Pausar/despausar contratos
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Withdraw rewards tokens (solo owner)
     */
    function withdrawRewardsTokens(uint256 amount) external onlyOwner {
        require(
            rewardsToken.transfer(owner(), amount),
            "Transfer fallido"
        );
    }
}
