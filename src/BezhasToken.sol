// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BezhasToken (BEZ-Coin)
 * @author BeZhas Team
 * @notice Token principal del ecosistema BeZhas con sistema de deflación inteligente.
 * @dev Implementa redirección de burn a Treasury DAO con multiplicador de incentivos.
 * 
 * SISTEMA DE DEFLACIÓN:
 * - El % destinado a "burn" se redirige al Treasury DAO
 * - Multiplicador x0.3 para incentivar a los LPs
 * - Treasury Address Polygon: 0x89c23890c742d710265dd61be789c71dc8999b12
 */
contract BezhasToken is ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // ═══════════════════════════════════════════════════════════════════════
    // TREASURY & DEFLATION SYSTEM
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice Wallet del Treasury DAO (Polygon Mainnet)
    address public treasuryDAO;
    
    /// @notice Multiplicador de incentivo para LPs (base 1000 = 1.0x)
    /// @dev 300 = 0.3x multiplicador adicional sobre rewards
    uint256 public lpIncentiveMultiplier = 300;
    uint256 public constant MULTIPLIER_PRECISION = 1000;
    
    /// @notice Pool de rewards acumulado para LPs
    uint256 public lpRewardsPool;
    
    /// @notice Total enviado al Treasury (antes era burn)
    uint256 public totalSentToTreasury;
    
    /// @notice Total de rewards distribuidos a LPs
    uint256 public totalLPRewardsDistributed;
    
    /// @notice Porcentaje del "burn" que va a LP rewards (base 100)
    /// @dev 30 = 30% va a LP rewards, 70% va a Treasury
    uint256 public lpRewardsSplit = 30;

    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════
    
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DeflationProcessed(uint256 amount, uint256 toTreasury, uint256 toLPRewards);
    event LPRewardsDistributed(address indexed recipient, uint256 amount);
    event MultiplierUpdated(uint256 oldMultiplier, uint256 newMultiplier);
    event LPRewardsSplitUpdated(uint256 oldSplit, uint256 newSplit);

    constructor(uint256 initialSupply) ERC20("Bez-Coin", "BEZ") ERC20Pausable() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(TREASURY_ROLE, msg.sender);
        
        // Treasury DAO Polygon Mainnet (checksum correcto)
        treasuryDAO = 0x89c23890c742d710265dD61be789C71dC8999b12;
        
        _mint(msg.sender, initialSupply);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @notice Procesa la deflación: en lugar de quemar, envía al Treasury DAO
     * @dev Split: 70% Treasury, 30% LP Rewards Pool
     * @param amount Cantidad a procesar (antes se quemaba)
     */
    function processDeflation(uint256 amount) public onlyRole(BURNER_ROLE) {
        require(amount > 0, "BEZ: Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "BEZ: Insufficient balance");
        
        // Calcular split
        uint256 toLPRewards = (amount * lpRewardsSplit) / 100;
        uint256 toTreasury = amount - toLPRewards;
        
        // Transferir al Treasury DAO
        if (toTreasury > 0) {
            _transfer(msg.sender, treasuryDAO, toTreasury);
            totalSentToTreasury += toTreasury;
        }
        
        // Acumular en pool de LP rewards
        if (toLPRewards > 0) {
            lpRewardsPool += toLPRewards;
            _transfer(msg.sender, address(this), toLPRewards);
        }
        
        emit DeflationProcessed(amount, toTreasury, toLPRewards);
    }

    /**
     * @notice Burn tradicional (mantener compatibilidad)
     * @dev Ahora redirige a processDeflation
     */
    function burn(uint256 amount) public onlyRole(BURNER_ROLE) {
        processDeflation(amount);
    }

    /**
     * @notice Burn desde otra cuenta (mantener compatibilidad)
     */
    function burnFrom(address account, uint256 amount) public onlyRole(BURNER_ROLE) {
        _spendAllowance(account, msg.sender, amount);
        _transfer(account, msg.sender, amount);
        processDeflation(amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LP REWARDS DISTRIBUTION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Distribuir rewards del pool a LPs con multiplicador
     * @param recipient Dirección del LP
     * @param baseAmount Cantidad base de rewards
     */
    function distributeLPRewards(address recipient, uint256 baseAmount) 
        external 
        onlyRole(TREASURY_ROLE) 
    {
        require(recipient != address(0), "BEZ: Invalid recipient");
        
        // Aplicar multiplicador x0.3 adicional
        uint256 bonusAmount = (baseAmount * lpIncentiveMultiplier) / MULTIPLIER_PRECISION;
        uint256 totalReward = baseAmount + bonusAmount;
        
        require(lpRewardsPool >= totalReward, "BEZ: Insufficient LP rewards pool");
        
        lpRewardsPool -= totalReward;
        totalLPRewardsDistributed += totalReward;
        
        _transfer(address(this), recipient, totalReward);
        
        emit LPRewardsDistributed(recipient, totalReward);
    }

    /**
     * @notice Calcular reward con multiplicador para un LP
     * @param baseAmount Cantidad base
     * @return Total con multiplicador aplicado
     */
    function calculateLPReward(uint256 baseAmount) external view returns (uint256) {
        uint256 bonusAmount = (baseAmount * lpIncentiveMultiplier) / MULTIPLIER_PRECISION;
        return baseAmount + bonusAmount;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Actualizar dirección del Treasury DAO
     */
    function setTreasuryDAO(address _newTreasury) external onlyRole(TREASURY_ROLE) {
        require(_newTreasury != address(0), "BEZ: Invalid address");
        address oldTreasury = treasuryDAO;
        treasuryDAO = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    /**
     * @notice Actualizar multiplicador de incentivo LP
     * @param _newMultiplier Nuevo multiplicador (base 1000)
     */
    function setLPIncentiveMultiplier(uint256 _newMultiplier) external onlyRole(TREASURY_ROLE) {
        require(_newMultiplier <= 1000, "BEZ: Max multiplier is 1.0x (1000)");
        uint256 oldMultiplier = lpIncentiveMultiplier;
        lpIncentiveMultiplier = _newMultiplier;
        emit MultiplierUpdated(oldMultiplier, _newMultiplier);
    }

    /**
     * @notice Actualizar split entre Treasury y LP Rewards
     * @param _newSplit Nuevo porcentaje para LP (0-50)
     */
    function setLPRewardsSplit(uint256 _newSplit) external onlyRole(TREASURY_ROLE) {
        require(_newSplit <= 50, "BEZ: Max LP split is 50%");
        uint256 oldSplit = lpRewardsSplit;
        lpRewardsSplit = _newSplit;
        emit LPRewardsSplitUpdated(oldSplit, _newSplit);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ALLOWANCE: PROTECCIÓN CONTRA LA CARRERA DEL APPROVE
    // ═══════════════════════════════════════════════════════════════════════
    //
    // `approve` sobrescribe la asignación anterior en vez de sumarla, y ahí está
    // la carrera clásica del ERC-20: si el titular tiene aprobados N al gastador
    // y firma un `approve(M)`, el gastador puede ver esa transacción en el
    // mempool, gastar los N antes de que entre y gastar los M después. Se lleva
    // N+M cuando el titular solo quiso autorizar M.
    //
    // OpenZeppelin ofrecía `increaseAllowance`/`decreaseAllowance` para
    // esquivarlo, pero las **eliminó en la versión 5.0**: al heredar de OZ 5.x
    // este token se quedó sin ellas y sin ninguna otra mitigación en cadena.
    // Se recuperan aquí, con la misma semántica que tenían.
    //
    // No se toca `approve`: prohibir pasar de un valor distinto de cero a otro
    // —como hace USDT— rompería integraciones que dan por buena la semántica
    // estándar del ERC-20. Esto añade la salida segura sin quitar la de siempre.

    /// @notice Se intentó bajar una asignación por debajo de cero.
    error BezInsufficientAllowanceToDecrease(address spender, uint256 currentAllowance, uint256 requestedDecrease);

    /**
     * @notice Aumenta en `addedValue` lo que `spender` puede gastar.
     * @dev Alternativa segura a `approve` cuando ya hay una asignación viva: al
     *      partir del valor actual en el momento de ejecutarse, no hay ventana
     *      que un gastador pueda aprovechar entre el valor viejo y el nuevo.
     */
    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        address owner = _msgSender();
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    /**
     * @notice Reduce en `subtractedValue` lo que `spender` puede gastar.
     * @dev Revierte si la reducción supera la asignación actual, en vez de
     *      dejarla en cero en silencio: bajar de más casi siempre significa que
     *      quien llama tenía una idea equivocada del estado.
     */
    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        address owner = _msgSender();
        uint256 currentAllowance = allowance(owner, spender);
        if (currentAllowance < subtractedValue) {
            revert BezInsufficientAllowanceToDecrease(spender, currentAllowance, subtractedValue);
        }
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }
        return true;
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Obtener estadísticas del sistema de deflación
     */
    function getDeflationStats() external view returns (
        uint256 _totalSentToTreasury,
        uint256 _lpRewardsPool,
        uint256 _totalLPRewardsDistributed,
        uint256 _lpIncentiveMultiplier,
        uint256 _lpRewardsSplit
    ) {
        return (
            totalSentToTreasury,
            lpRewardsPool,
            totalLPRewardsDistributed,
            lpIncentiveMultiplier,
            lpRewardsSplit
        );
    }
}
