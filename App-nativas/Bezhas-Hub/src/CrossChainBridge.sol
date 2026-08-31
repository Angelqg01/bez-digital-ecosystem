// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BeZhas Cross-Chain Bridge
 * @author BeZhas Team
 * @notice Multi-chain bridge for BEZ token transfers between Polygon, Arbitrum, and zkSync
 * @dev Implements lock-and-mint / burn-and-unlock pattern with relayer validation
 * 
 * Supported Networks:
 * - Polygon (137) - Main chain
 * - Polygon Amoy (80002) - Testnet
 * - Arbitrum One (42161)
 * - Arbitrum Sepolia (421614)
 * - zkSync Era (324)
 * - zkSync Sepolia (300)
 */
contract CrossChainBridge is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============================================
    // Roles
    // ============================================
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============================================
    // Chain Identifiers
    // ============================================
    uint256 public constant POLYGON_CHAIN_ID = 137;
    uint256 public constant POLYGON_AMOY_CHAIN_ID = 80002;
    uint256 public constant ARBITRUM_ONE_CHAIN_ID = 42161;
    uint256 public constant ARBITRUM_SEPOLIA_CHAIN_ID = 421614;
    uint256 public constant ZKSYNC_ERA_CHAIN_ID = 324;
    uint256 public constant ZKSYNC_SEPOLIA_CHAIN_ID = 300;

    // ============================================
    // State Variables
    // ============================================
    IERC20 public immutable token;
    uint256 public immutable sourceChainId;
    
    // Bridge parameters
    uint256 public bridgeFee = 0.001 ether; // Native token fee
    uint256 public minBridgeAmount = 1e18; // 1 token minimum
    uint256 public maxBridgeAmount = 1_000_000e18; // 1M token maximum
    uint256 public dailyLimit = 10_000_000e18; // 10M daily limit
    uint256 public dailyBridgedAmount;
    uint256 public lastResetTimestamp;
    
    // Nonce for replay protection
    uint256 public nonce;
    
    // Trusted remote bridges per chain
    mapping(uint256 => address) public trustedRemotes;
    
    // Supported chains
    mapping(uint256 => bool) public supportedChains;
    
    // Processed messages for replay protection
    mapping(bytes32 => bool) public processedMessages;
    
    // Pending bridge requests
    mapping(bytes32 => BridgeRequest) public bridgeRequests;
    
    // User pending amounts
    mapping(address => uint256) public pendingBridgeAmounts;

    // ============================================
    // Structs
    // ============================================
    struct BridgeRequest {
        address sender;
        address recipient;
        uint256 amount;
        uint256 sourceChain;
        uint256 destinationChain;
        uint256 timestamp;
        bool processed;
        bool cancelled;
    }

    struct ChainConfig {
        bool isSupported;
        address bridgeAddress;
        uint256 confirmations;
        uint256 gasLimit;
    }

    mapping(uint256 => ChainConfig) public chainConfigs;

    // ============================================
    // Events
    // ============================================
    event BridgeInitiated(
        bytes32 indexed messageId,
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 sourceChain,
        uint256 destinationChain,
        uint256 timestamp
    );

    event BridgeCompleted(
        bytes32 indexed messageId,
        address indexed recipient,
        uint256 amount,
        uint256 sourceChain
    );

    event BridgeCancelled(
        bytes32 indexed messageId,
        address indexed sender,
        uint256 amount
    );

    event TrustedRemoteSet(
        uint256 indexed chainId,
        address indexed remoteAddress
    );

    event ChainSupportUpdated(
        uint256 indexed chainId,
        bool supported
    );

    event FeesUpdated(
        uint256 bridgeFee,
        uint256 minAmount,
        uint256 maxAmount
    );

    event DailyLimitUpdated(uint256 newLimit);
    event EmergencyWithdraw(address indexed token, uint256 amount);

    // ============================================
    // Errors
    // ============================================
    error InvalidAmount();
    error UnsupportedChain();
    error InsufficientFee();
    error MessageAlreadyProcessed();
    error UntrustedRemote();
    error DailyLimitExceeded();
    error InvalidRecipient();
    error RequestNotFound();
    error RequestAlreadyProcessed();
    error UnauthorizedCaller();

    // ============================================
    // Constructor
    // ============================================
    constructor(address _token) {
        require(_token != address(0), "Invalid token");
        
        token = IERC20(_token);
        sourceChainId = block.chainid;
        lastResetTimestamp = block.timestamp;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        // Initialize supported chains based on current network
        _initializeSupportedChains();
    }

    // ============================================
    // External Functions - User Actions
    // ============================================
    
    /**
     * @notice Initiate a bridge transfer to another chain
     * @param recipient The recipient address on the destination chain
     * @param amount The amount of tokens to bridge
     * @param destinationChain The destination chain ID
     * @return messageId The unique identifier for this bridge request
     */
    function bridgeTokens(
        address recipient,
        uint256 amount,
        uint256 destinationChain
    ) external payable nonReentrant whenNotPaused returns (bytes32 messageId) {
        // Validations
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount < minBridgeAmount || amount > maxBridgeAmount) revert InvalidAmount();
        if (!supportedChains[destinationChain]) revert UnsupportedChain();
        if (msg.value < bridgeFee) revert InsufficientFee();
        
        // Check daily limit
        _checkAndUpdateDailyLimit(amount);
        
        // Generate unique message ID
        messageId = keccak256(abi.encodePacked(
            sourceChainId,
            destinationChain,
            msg.sender,
            recipient,
            amount,
            nonce++,
            block.timestamp
        ));
        
        // Lock tokens in this contract
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Store bridge request
        bridgeRequests[messageId] = BridgeRequest({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            sourceChain: sourceChainId,
            destinationChain: destinationChain,
            timestamp: block.timestamp,
            processed: false,
            cancelled: false
        });
        
        pendingBridgeAmounts[msg.sender] += amount;
        
        emit BridgeInitiated(
            messageId,
            msg.sender,
            recipient,
            amount,
            sourceChainId,
            destinationChain,
            block.timestamp
        );
        
        return messageId;
    }

    /**
     * @notice Complete a bridge transfer from another chain (called by relayer)
     * @param messageId The unique message ID from the source chain
     * @param recipient The recipient address
     * @param amount The amount of tokens to release
     * @param sourceChain The source chain ID
     * @param signature The relayer signature for verification
     */
    function completeBridge(
        bytes32 messageId,
        address recipient,
        uint256 amount,
        uint256 sourceChain,
        bytes calldata signature
    ) external nonReentrant whenNotPaused onlyRole(RELAYER_ROLE) {
        // Verify message hasn't been processed
        if (processedMessages[messageId]) revert MessageAlreadyProcessed();
        
        // Verify source chain is supported
        if (!supportedChains[sourceChain]) revert UnsupportedChain();
        
        // Verify trusted remote
        address trustedRemote = trustedRemotes[sourceChain];
        if (trustedRemote == address(0)) revert UntrustedRemote();
        
        // Verify signature (basic implementation - production should use more robust verification)
        bytes32 messageHash = keccak256(abi.encodePacked(
            messageId,
            recipient,
            amount,
            sourceChain,
            sourceChainId
        ));
        
        require(_verifySignature(messageHash, signature), "Invalid signature");
        
        // Mark as processed
        processedMessages[messageId] = true;
        
        // Release tokens to recipient
        token.safeTransfer(recipient, amount);
        
        emit BridgeCompleted(messageId, recipient, amount, sourceChain);
    }

    /**
     * @notice Cancel a pending bridge request (only within timeout)
     * @param messageId The message ID to cancel
     */
    function cancelBridge(bytes32 messageId) external nonReentrant {
        BridgeRequest storage request = bridgeRequests[messageId];
        
        if (request.sender == address(0)) revert RequestNotFound();
        if (request.sender != msg.sender) revert UnauthorizedCaller();
        if (request.processed || request.cancelled) revert RequestAlreadyProcessed();
        
        // Allow cancellation only within 24 hours
        require(block.timestamp <= request.timestamp + 24 hours, "Cancellation timeout");
        
        request.cancelled = true;
        pendingBridgeAmounts[msg.sender] -= request.amount;
        
        // Return tokens to sender
        token.safeTransfer(msg.sender, request.amount);
        
        emit BridgeCancelled(messageId, msg.sender, request.amount);
    }

    // ============================================
    // View Functions
    // ============================================
    
    /**
     * @notice Get bridge request details
     */
    function getBridgeRequest(bytes32 messageId) external view returns (BridgeRequest memory) {
        return bridgeRequests[messageId];
    }

    /**
     * @notice Check if a chain is supported
     */
    function isChainSupported(uint256 chainId) external view returns (bool) {
        return supportedChains[chainId];
    }

    /**
     * @notice Get remaining daily limit
     */
    function getRemainingDailyLimit() external view returns (uint256) {
        if (block.timestamp >= lastResetTimestamp + 1 days) {
            return dailyLimit;
        }
        return dailyLimit > dailyBridgedAmount ? dailyLimit - dailyBridgedAmount : 0;
    }

    /**
     * @notice Get all supported chain IDs
     */
    function getSupportedChains() external pure returns (uint256[] memory) {
        uint256[] memory chains = new uint256[](6);
        chains[0] = POLYGON_CHAIN_ID;
        chains[1] = POLYGON_AMOY_CHAIN_ID;
        chains[2] = ARBITRUM_ONE_CHAIN_ID;
        chains[3] = ARBITRUM_SEPOLIA_CHAIN_ID;
        chains[4] = ZKSYNC_ERA_CHAIN_ID;
        chains[5] = ZKSYNC_SEPOLIA_CHAIN_ID;
        return chains;
    }

    /**
     * @notice Get bridge statistics
     */
    function getBridgeStats() external view returns (
        uint256 totalLocked,
        uint256 todayBridged,
        uint256 remainingLimit,
        uint256 currentNonce
    ) {
        totalLocked = token.balanceOf(address(this));
        todayBridged = dailyBridgedAmount;
        remainingLimit = dailyLimit > dailyBridgedAmount ? dailyLimit - dailyBridgedAmount : 0;
        currentNonce = nonce;
    }

    // ============================================
    // Admin Functions
    // ============================================
    
    /**
     * @notice Set trusted remote bridge address for a chain
     */
    function setTrustedRemote(uint256 chainId, address remoteAddress) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        trustedRemotes[chainId] = remoteAddress;
        emit TrustedRemoteSet(chainId, remoteAddress);
    }

    /**
     * @notice Update chain support status
     */
    function setChainSupport(uint256 chainId, bool supported) 
        external 
        onlyRole(OPERATOR_ROLE) 
    {
        supportedChains[chainId] = supported;
        emit ChainSupportUpdated(chainId, supported);
    }

    /**
     * @notice Configure chain parameters
     */
    function setChainConfig(
        uint256 chainId,
        bool isSupported,
        address bridgeAddress,
        uint256 confirmations,
        uint256 gasLimit
    ) external onlyRole(OPERATOR_ROLE) {
        chainConfigs[chainId] = ChainConfig({
            isSupported: isSupported,
            bridgeAddress: bridgeAddress,
            confirmations: confirmations,
            gasLimit: gasLimit
        });
        supportedChains[chainId] = isSupported;
    }

    /**
     * @notice Update bridge fees and limits
     */
    function updateFees(
        uint256 _bridgeFee,
        uint256 _minAmount,
        uint256 _maxAmount
    ) external onlyRole(OPERATOR_ROLE) {
        require(_minAmount > 0 && _maxAmount > _minAmount, "Invalid amounts");
        bridgeFee = _bridgeFee;
        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;
        emit FeesUpdated(_bridgeFee, _minAmount, _maxAmount);
    }

    /**
     * @notice Update daily limit
     */
    function updateDailyLimit(uint256 _dailyLimit) external onlyRole(OPERATOR_ROLE) {
        dailyLimit = _dailyLimit;
        emit DailyLimitUpdated(_dailyLimit);
    }

    /**
     * @notice Add a relayer
     */
    function addRelayer(address relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(RELAYER_ROLE, relayer);
    }

    /**
     * @notice Remove a relayer
     */
    function removeRelayer(address relayer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(RELAYER_ROLE, relayer);
    }

    /**
     * @notice Pause the bridge
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause the bridge
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw (admin only)
     */
    function emergencyWithdraw(address tokenAddress, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        if (tokenAddress == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(tokenAddress).safeTransfer(msg.sender, amount);
        }
        emit EmergencyWithdraw(tokenAddress, amount);
    }

    /**
     * @notice Withdraw collected fees
     */
    function withdrawFees() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(msg.sender).transfer(balance);
    }

    // ============================================
    // Internal Functions
    // ============================================
    
    function _initializeSupportedChains() internal {
        // Enable all chains except current
        if (sourceChainId != POLYGON_CHAIN_ID) supportedChains[POLYGON_CHAIN_ID] = true;
        if (sourceChainId != POLYGON_AMOY_CHAIN_ID) supportedChains[POLYGON_AMOY_CHAIN_ID] = true;
        if (sourceChainId != ARBITRUM_ONE_CHAIN_ID) supportedChains[ARBITRUM_ONE_CHAIN_ID] = true;
        if (sourceChainId != ARBITRUM_SEPOLIA_CHAIN_ID) supportedChains[ARBITRUM_SEPOLIA_CHAIN_ID] = true;
        if (sourceChainId != ZKSYNC_ERA_CHAIN_ID) supportedChains[ZKSYNC_ERA_CHAIN_ID] = true;
        if (sourceChainId != ZKSYNC_SEPOLIA_CHAIN_ID) supportedChains[ZKSYNC_SEPOLIA_CHAIN_ID] = true;
    }

    function _checkAndUpdateDailyLimit(uint256 amount) internal {
        // Reset if new day
        if (block.timestamp >= lastResetTimestamp + 1 days) {
            dailyBridgedAmount = 0;
            lastResetTimestamp = block.timestamp;
        }
        
        if (dailyBridgedAmount + amount > dailyLimit) revert DailyLimitExceeded();
        dailyBridgedAmount += amount;
    }

    function _verifySignature(bytes32 messageHash, bytes calldata signature) 
        internal 
        view 
        returns (bool) 
    {
        // Simple ECDSA verification
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        address signer = ecrecover(ethSignedHash, v, r, s);
        
        return hasRole(RELAYER_ROLE, signer);
    }

    function _splitSignature(bytes calldata sig) 
        internal 
        pure 
        returns (bytes32 r, bytes32 s, uint8 v) 
    {
        require(sig.length == 65, "Invalid signature length");
        
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        
        if (v < 27) v += 27;
    }

    // ============================================
    // Receive ETH
    // ============================================
    receive() external payable {}
}
