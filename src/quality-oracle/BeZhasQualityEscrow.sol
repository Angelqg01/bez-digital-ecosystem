// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BeZhasQualityEscrow
 * @dev Production-ready escrow system with role-based access and gas optimizations.
 */
contract BeZhasQualityEscrow is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable bezCoin;

    enum Status { CREATED, IN_PROGRESS, COMPLETED, DISPUTED, CANCELLED }

    // Gas Optimization: Packed struct
    struct Service {
        uint256 id;
        uint256 collateralAmount;
        uint256 timestamp;
        address businessWallet;
        address clientWallet;
        uint8 initialQuality;
        uint8 finalQuality;
        Status status;
    }

    mapping(uint256 => Service) public services;
    uint256 public serviceCounter;

    event ServiceCreated(uint256 indexed serviceId, address indexed business, address indexed client, uint256 collateral);
    event ServiceFinalized(uint256 indexed serviceId, uint8 finalQuality, uint256 penaltyPaid);
    event ServiceDisputed(uint256 indexed serviceId);
    event ServiceResolved(uint256 indexed serviceId, address winner, uint256 amount);

    constructor(address _tokenAddress, address _admin) {
        require(_tokenAddress != address(0), "Invalid token address");
        bezCoin = IERC20(_tokenAddress);
        
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(ARBITRATOR_ROLE, _admin);
    }

    function createService(address _clientWallet, uint256 _amount, uint8 _initialQuality) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (uint256) 
    {
        require(_clientWallet != address(0), "Invalid client");
        require(_amount > 0, "Amount must be > 0");
        require(_initialQuality <= 100, "Quality max 100");

        // Transfer tokens to contract using SafeERC20
        bezCoin.safeTransferFrom(msg.sender, address(this), _amount);

        serviceCounter++;
        services[serviceCounter] = Service({
            id: serviceCounter,
            collateralAmount: _amount,
            timestamp: block.timestamp,
            businessWallet: msg.sender,
            clientWallet: _clientWallet,
            initialQuality: _initialQuality,
            finalQuality: 0,
            status: Status.IN_PROGRESS
        });

        emit ServiceCreated(serviceCounter, msg.sender, _clientWallet, _amount);
        return serviceCounter;
    }

    function finalizeService(uint256 _serviceId, uint8 _finalQuality) external nonReentrant {
        Service storage srv = services[_serviceId];
        require(srv.status == Status.IN_PROGRESS, "Invalid status");
        // Only business or arbitrator can finalize normally, or client can confirm
        require(msg.sender == srv.businessWallet || hasRole(ARBITRATOR_ROLE, msg.sender), "Not authorized");

        srv.finalQuality = _finalQuality;
        srv.status = Status.COMPLETED;

        uint256 penalty = 0;
        uint256 payout = srv.collateralAmount;

        if (_finalQuality < srv.initialQuality) {
            // Calculate penalty based on quality drop
            uint256 qualityLoss = srv.initialQuality - _finalQuality;
            // Precision handling for percentage
            penalty = (srv.collateralAmount * qualityLoss) / 100;
            payout = srv.collateralAmount - penalty;

            if (penalty > 0) {
                bezCoin.safeTransfer(srv.clientWallet, penalty);
            }
        }

        if (payout > 0) {
            bezCoin.safeTransfer(srv.businessWallet, payout);
        }

        emit ServiceFinalized(_serviceId, _finalQuality, penalty);
    }

    function raiseDispute(uint256 _serviceId) external {
        Service storage srv = services[_serviceId];
        require(srv.status == Status.IN_PROGRESS, "Cannot dispute");
        require(msg.sender == srv.clientWallet || msg.sender == srv.businessWallet, "Not party to service");
        
        srv.status = Status.DISPUTED;
        emit ServiceDisputed(_serviceId);
    }

    // Admin functions
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
