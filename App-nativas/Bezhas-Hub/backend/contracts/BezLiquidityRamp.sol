// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title BezLiquidityRamp
 * @dev Contrato de liquidez optimizado con:
 * - Sistema de ingresos por comisiones (Revenue Stream)
 * - Validación por firma criptográfica de IA (Off-chain Risk Engine)
 * - Protección contra replay attacks
 * - Gas optimizado (sin whitelist on-chain)
 */

interface IDEXRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts);
}

contract BezLiquidityRamp is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    bytes32 public constant TREASURY_MANAGER_ROLE = keccak256("TREASURY_MANAGER_ROLE");
    
    IDEXRouter public immutable dexRouter;
    address public immutable bezToken;
    address public immutable stableCoin;

    // --- Revenue Configuration ---
    address public treasuryWallet;
    uint256 public platformFeeBps = 50; // 50 Basis Points = 0.5% (Max 5%)
    uint256 public constant MAX_FEE_BPS = 500; // 5% máximo

    // Anti-replay attack protection
    mapping(bytes32 => bool) public executedSignatures;

    // Estadísticas para dashboards
    uint256 public totalVolumeProcessed;
    uint256 public totalFeesCollected;
    uint256 public totalTransactions;

    event AutoSwapExecuted(
        address indexed buyer, 
        uint256 stableAmountIn, 
        uint256 bezAmountOut, 
        uint256 feeCollected,
        string serviceId
    );
    event PlatformFeeCollected(uint256 amount, address indexed treasury);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    constructor(
        address _router, 
        address _bezToken, 
        address _stableCoin, 
        address _admin, 
        address _treasury
    ) {
        require(_router != address(0), "Invalid router");
        require(_bezToken != address(0), "Invalid BEZ token");
        require(_stableCoin != address(0), "Invalid stablecoin");
        require(_treasury != address(0), "Invalid treasury");

        dexRouter = IDEXRouter(_router);
        bezToken = _bezToken;
        stableCoin = _stableCoin;
        treasuryWallet = _treasury;
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(SIGNER_ROLE, _admin); // Backend IA tendrá este rol
        _grantRole(TREASURY_MANAGER_ROLE, _admin);
    }

    /**
     * @dev Actualiza la wallet de tesorería (solo TREASURY_MANAGER_ROLE)
     */
    function setTreasury(address _newTreasury) external onlyRole(TREASURY_MANAGER_ROLE) {
        require(_newTreasury != address(0), "BEZ: Invalid treasury address");
        address oldTreasury = treasuryWallet;
        treasuryWallet = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    /**
     * @dev Actualiza la comisión de plataforma (máx 5%)
     */
    function setPlatformFee(uint256 _bps) external onlyRole(TREASURY_MANAGER_ROLE) {
        require(_bps <= MAX_FEE_BPS, "BEZ: Fee too high (max 5%)");
        uint256 oldFee = platformFeeBps;
        platformFeeBps = _bps;
        emit FeeUpdated(oldFee, _bps);
    }

    /**
     * @dev Ejecuta swap con validación de firma de IA Risk Engine
     * @param _amountInUSDC Cantidad en stablecoin a swappear
     * @param _minBezOut Cantidad mínima de BEZ esperada (protección slippage)
     * @param _serviceId ID del servicio/producto siendo comprado
     * @param _deadline Timestamp de expiración de la firma
     * @param signature Firma criptográfica del backend IA (EIP-191)
     */
    function swapFiatToBezWithSignature(
        uint256 _amountInUSDC, 
        uint256 _minBezOut, 
        string calldata _serviceId,
        uint256 _deadline,
        bytes calldata signature
    ) external nonReentrant returns (uint256 bezReceived) {
        require(block.timestamp <= _deadline, "BEZ: Signature expired");
        require(_amountInUSDC > 0, "BEZ: Invalid amount");

        // 1. Verificación de Firma Criptográfica (Off-chain AI Risk Engine)
        bytes32 messageHash = keccak256(abi.encodePacked(
            msg.sender,     // Usuario específico
            _amountInUSDC,  // Monto exacto autorizado
            _serviceId,     // Servicio vinculado
            _deadline,      // Expiración temporal
            address(this)   // Contrato específico (evita reutilización)
        ));

        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedMessageHash.recover(signature);
        
        require(hasRole(SIGNER_ROLE, signer), "BEZ: Invalid AI signature");
        require(!executedSignatures[messageHash], "BEZ: Signature already used");
        
        executedSignatures[messageHash] = true;

        // 2. Transferir stablecoin del usuario al contrato
        IERC20(stableCoin).safeTransferFrom(msg.sender, address(this), _amountInUSDC);

        // 3. Calcular y cobrar comisión de plataforma
        uint256 feeAmount = (_amountInUSDC * platformFeeBps) / 10000;
        uint256 swapAmount = _amountInUSDC - feeAmount;

        // Enviar fee a Tesorería BeZhas (Revenue Stream)
        if (feeAmount > 0) {
            IERC20(stableCoin).safeTransfer(treasuryWallet, feeAmount);
            totalFeesCollected += feeAmount;
            emit PlatformFeeCollected(feeAmount, treasuryWallet);
        }

        // 4. Ejecutar Swap en DEX
        IERC20(stableCoin).safeApprove(address(dexRouter), swapAmount);
        
        address[] memory path = new address[](2);
        path[0] = stableCoin;
        path[1] = bezToken;

        uint[] memory amounts = dexRouter.swapExactTokensForTokens(
            swapAmount,
            _minBezOut,
            path,
            msg.sender, // Usuario recibe los tokens BEZ directamente
            block.timestamp + 300 // 5 minutos de margen técnico
        );

        bezReceived = amounts[1];

        // 5. Actualizar estadísticas
        totalVolumeProcessed += _amountInUSDC;
        totalTransactions += 1;

        emit AutoSwapExecuted(msg.sender, _amountInUSDC, bezReceived, feeAmount, _serviceId);
    }

    /**
     * @dev Estima cuántos BEZ recibirá el usuario (para SDK/Frontend)
     */
    function getEstimatedBez(uint256 _amountInUSDC) external view returns (
        uint256 bezAmount,
        uint256 feeAmount,
        uint256 swapAmount
    ) {
        feeAmount = (_amountInUSDC * platformFeeBps) / 10000;
        swapAmount = _amountInUSDC - feeAmount;

        address[] memory path = new address[](2);
        path[0] = stableCoin;
        path[1] = bezToken;
        
        try dexRouter.getAmountsOut(swapAmount, path) returns (uint[] memory amounts) {
            bezAmount = amounts[1];
        } catch {
            bezAmount = 0;
        }
    }

    /**
     * @dev Obtiene estadísticas del contrato (para dashboards)
     */
    function getStats() external view returns (
        uint256 volume,
        uint256 fees,
        uint256 transactions,
        uint256 currentFeeBps
    ) {
        return (totalVolumeProcessed, totalFeesCollected, totalTransactions, platformFeeBps);
    }

    /**
     * @dev Recupera tokens enviados accidentalmente (solo admin)
     */
    function recoverERC20(address _token, uint256 _amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_token != bezToken && _token != stableCoin, "BEZ: Cannot recover main tokens");
        IERC20(_token).safeTransfer(msg.sender, _amount);
    }
}
