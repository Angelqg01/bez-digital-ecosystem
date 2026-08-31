// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract DataOracle is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant CONSUMER_ROLE = keccak256("CONSUMER_ROLE");

    struct DataFeed {
        string name;
        string description;
        address provider;
        uint256 lastUpdate;
        bytes32 dataHash;
        bool isActive;
        uint256 updateInterval;
        uint256 price; // Cost to access this feed
    }

    struct PriceData {
        string symbol;
        uint256 price;
        uint256 timestamp;
        uint256 confidence;
        address provider;
    }

    struct Request {
        uint256 requestId;
        address requester;
        string dataType;
        bytes32 parameters;
        uint256 timestamp;
        bool fulfilled;
        bytes response;
        address fulfiller;
        uint256 payment;
    }

    struct OracleProvider {
        address providerAddress;
        string name;
        uint256 reputation;
        uint256 totalRequests;
        uint256 successfulRequests;
        bool isActive;
        uint256 minimumStake;
        uint256 stakedAmount;
    }

    // Storage
    mapping(bytes32 => DataFeed) public dataFeeds;
    mapping(string => PriceData) public priceFeeds;
    mapping(uint256 => Request) public requests;
    mapping(address => OracleProvider) public oracleProviders;
    mapping(bytes32 => mapping(address => bool)) public feedSubscriptions;
    mapping(address => uint256) public consumerBalances;
    
    bytes32[] public activeFeedIds;
    string[] public availableSymbols;
    uint256 public requestCounter;
    uint256 public defaultRequestFee = 0.001 ether;

    // Events
    event DataFeedCreated(bytes32 indexed feedId, string name, address provider);
    event DataFeedUpdated(bytes32 indexed feedId, bytes32 dataHash, uint256 timestamp);
    event PriceUpdated(string indexed symbol, uint256 price, uint256 timestamp, address provider);
    event RequestCreated(uint256 indexed requestId, address indexed requester, string dataType);
    event RequestFulfilled(uint256 indexed requestId, address indexed fulfiller, bytes response);
    event ProviderRegistered(address indexed provider, string name);
    event ProviderStaked(address indexed provider, uint256 amount);
    event SubscriptionCreated(bytes32 indexed feedId, address indexed subscriber);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    modifier validFeed(bytes32 feedId) {
        require(dataFeeds[feedId].provider != address(0), "Feed does not exist");
        _;
    }

    modifier onlyActiveProvider() {
        require(oracleProviders[msg.sender].isActive, "Provider not active");
        _;
    }

    function registerProvider(
        string memory name,
        uint256 minimumStake
    ) external payable nonReentrant {
        require(bytes(name).length > 0, "Name required");
        require(msg.value >= minimumStake, "Insufficient stake");
        require(oracleProviders[msg.sender].providerAddress == address(0), "Already registered");

        oracleProviders[msg.sender] = OracleProvider({
            providerAddress: msg.sender,
            name: name,
            reputation: 100, // Starting reputation
            totalRequests: 0,
            successfulRequests: 0,
            isActive: true,
            minimumStake: minimumStake,
            stakedAmount: msg.value
        });

        _grantRole(ORACLE_ROLE, msg.sender);
        emit ProviderRegistered(msg.sender, name);
        emit ProviderStaked(msg.sender, msg.value);
    }

    function createDataFeed(
        string memory name,
        string memory description,
        uint256 updateInterval,
        uint256 price
    ) external onlyRole(ORACLE_ROLE) onlyActiveProvider returns (bytes32) {
        bytes32 feedId = keccak256(abi.encodePacked(name, msg.sender, block.timestamp));
        
        dataFeeds[feedId] = DataFeed({
            name: name,
            description: description,
            provider: msg.sender,
            lastUpdate: 0,
            dataHash: bytes32(0),
            isActive: true,
            updateInterval: updateInterval,
            price: price
        });

        activeFeedIds.push(feedId);
        emit DataFeedCreated(feedId, name, msg.sender);
        return feedId;
    }

    function updateDataFeed(
        bytes32 feedId,
        bytes32 dataHash
    ) external validFeed(feedId) onlyActiveProvider nonReentrant {
        DataFeed storage feed = dataFeeds[feedId];
        require(feed.provider == msg.sender, "Not feed provider");
        require(
            block.timestamp >= feed.lastUpdate + feed.updateInterval,
            "Update interval not met"
        );

        feed.dataHash = dataHash;
        feed.lastUpdate = block.timestamp;

        emit DataFeedUpdated(feedId, dataHash, block.timestamp);
    }

    function updatePrice(
        string memory symbol,
        uint256 price,
        uint256 confidence
    ) external onlyRole(ORACLE_ROLE) onlyActiveProvider nonReentrant {
        _updatePrice(symbol, price, confidence);
    }

    function _updatePrice(
        string memory symbol,
        uint256 price,
        uint256 confidence
    ) internal {
        require(price > 0, "Invalid price");
        require(confidence <= 100, "Invalid confidence");

        // Check if symbol exists in array
        bool symbolExists = false;
        for (uint256 i = 0; i < availableSymbols.length; i++) {
            if (keccak256(abi.encodePacked(availableSymbols[i])) == keccak256(abi.encodePacked(symbol))) {
                symbolExists = true;
                break;
            }
        }

        if (!symbolExists) {
            availableSymbols.push(symbol);
        }

        priceFeeds[symbol] = PriceData({
            symbol: symbol,
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            provider: msg.sender
        });

        emit PriceUpdated(symbol, price, block.timestamp, msg.sender);
    }

    function createRequest(
        string memory dataType,
        bytes32 parameters
    ) external payable nonReentrant whenNotPaused returns (uint256) {
        require(msg.value >= defaultRequestFee, "Insufficient payment");
        
        uint256 requestId = ++requestCounter;
        
        requests[requestId] = Request({
            requestId: requestId,
            requester: msg.sender,
            dataType: dataType,
            parameters: parameters,
            timestamp: block.timestamp,
            fulfilled: false,
            response: "",
            fulfiller: address(0),
            payment: msg.value
        });

        emit RequestCreated(requestId, msg.sender, dataType);
        return requestId;
    }

    function fulfillRequest(
        uint256 requestId,
        bytes memory response
    ) external onlyRole(ORACLE_ROLE) onlyActiveProvider nonReentrant {
        Request storage request = requests[requestId];
        require(request.requestId != 0, "Request does not exist");
        require(!request.fulfilled, "Request already fulfilled");

        request.fulfilled = true;
        request.response = response;
        request.fulfiller = msg.sender;

        // Update provider stats
        OracleProvider storage provider = oracleProviders[msg.sender];
        provider.totalRequests++;
        provider.successfulRequests++;
        
        // Update reputation based on success rate
        uint256 successRate = (provider.successfulRequests * 100) / provider.totalRequests;
        provider.reputation = (provider.reputation + successRate) / 2;

        // Pay the provider
        uint256 payment = request.payment;
        uint256 platformFee = payment / 10; // 10% platform fee
        uint256 providerPayment = payment - platformFee;

        payable(msg.sender).transfer(providerPayment);

        emit RequestFulfilled(requestId, msg.sender, response);
    }

    function subscribeToFeed(bytes32 feedId) external payable validFeed(feedId) nonReentrant {
        DataFeed storage feed = dataFeeds[feedId];
        require(feed.isActive, "Feed not active");
        require(msg.value >= feed.price, "Insufficient payment");
        require(!feedSubscriptions[feedId][msg.sender], "Already subscribed");

        feedSubscriptions[feedId][msg.sender] = true;
        consumerBalances[msg.sender] += msg.value;

        // Pay the feed provider
        payable(feed.provider).transfer(msg.value);

        emit SubscriptionCreated(feedId, msg.sender);
    }

    function getPrice(string memory symbol) external view returns (
        uint256 price,
        uint256 timestamp,
        uint256 confidence,
        address provider
    ) {
        PriceData memory priceData = priceFeeds[symbol];
        require(priceData.timestamp > 0, "Price not available");
        
        return (
            priceData.price,
            priceData.timestamp,
            priceData.confidence,
            priceData.provider
        );
    }

    function getLatestPrice(string memory symbol) external view returns (uint256) {
        PriceData memory priceData = priceFeeds[symbol];
        require(priceData.timestamp > 0, "Price not available");
        require(block.timestamp - priceData.timestamp <= 3600, "Price too old"); // 1 hour max age
        
        return priceData.price;
    }

    function getFeedData(bytes32 feedId) external view validFeed(feedId) returns (
        string memory name,
        string memory description,
        address provider,
        uint256 lastUpdate,
        bytes32 dataHash,
        bool isActive,
        uint256 price
    ) {
        DataFeed memory feed = dataFeeds[feedId];
        require(feedSubscriptions[feedId][msg.sender] || hasRole(ADMIN_ROLE, msg.sender), "Not subscribed");
        
        return (
            feed.name,
            feed.description,
            feed.provider,
            feed.lastUpdate,
            feed.dataHash,
            feed.isActive,
            feed.price
        );
    }

    function getAvailableSymbols() external view returns (string[] memory) {
        return availableSymbols;
    }

    function getActiveFeedIds() external view returns (bytes32[] memory) {
        return activeFeedIds;
    }

    function getProviderInfo(address provider) external view returns (
        string memory name,
        uint256 reputation,
        uint256 totalRequests,
        uint256 successfulRequests,
        bool isActive,
        uint256 stakedAmount
    ) {
        OracleProvider memory providerInfo = oracleProviders[provider];
        return (
            providerInfo.name,
            providerInfo.reputation,
            providerInfo.totalRequests,
            providerInfo.successfulRequests,
            providerInfo.isActive,
            providerInfo.stakedAmount
        );
    }

    function getRequestInfo(uint256 requestId) external view returns (
        address requester,
        string memory dataType,
        bytes32 parameters,
        uint256 timestamp,
        bool fulfilled,
        bytes memory response,
        address fulfiller
    ) {
        Request memory request = requests[requestId];
        require(
            request.requester == msg.sender || 
            request.fulfiller == msg.sender ||
            hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        
        return (
            request.requester,
            request.dataType,
            request.parameters,
            request.timestamp,
            request.fulfilled,
            request.response,
            request.fulfiller
        );
    }

    function batchUpdatePrices(
        string[] memory symbols,
        uint256[] memory prices,
        uint256[] memory confidences
    ) external onlyRole(ORACLE_ROLE) onlyActiveProvider {
        require(
            symbols.length == prices.length && 
            prices.length == confidences.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < symbols.length; i++) {
            _updatePrice(symbols[i], prices[i], confidences[i]);
        }
    }

    function emergencyPause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function emergencyUnpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function deactivateProvider(address provider) external onlyRole(ADMIN_ROLE) {
        oracleProviders[provider].isActive = false;
    }

    function reactivateProvider(address provider) external onlyRole(ADMIN_ROLE) {
        require(oracleProviders[provider].providerAddress != address(0), "Provider not registered");
        oracleProviders[provider].isActive = true;
    }

    function deactivateFeed(bytes32 feedId) external validFeed(feedId) {
        require(
            dataFeeds[feedId].provider == msg.sender ||
            hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        dataFeeds[feedId].isActive = false;
    }

    function setDefaultRequestFee(uint256 newFee) external onlyRole(ADMIN_ROLE) {
        defaultRequestFee = newFee;
    }

    function withdrawStake() external nonReentrant {
        OracleProvider storage provider = oracleProviders[msg.sender];
        require(provider.providerAddress != address(0), "Not a provider");
        require(!provider.isActive, "Provider still active");
        require(provider.stakedAmount > 0, "No stake to withdraw");

        uint256 amount = provider.stakedAmount;
        provider.stakedAmount = 0;
        
        payable(msg.sender).transfer(amount);
    }

    function addStake() external payable {
        OracleProvider storage provider = oracleProviders[msg.sender];
        require(provider.providerAddress != address(0), "Not a provider");
        require(msg.value > 0, "Invalid stake amount");

        provider.stakedAmount += msg.value;
        emit ProviderStaked(msg.sender, msg.value);
    }

    function withdrawPlatformFees() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        payable(msg.sender).transfer(balance);
    }

    receive() external payable {
        // Accept ETH for staking and fees
    }
}
