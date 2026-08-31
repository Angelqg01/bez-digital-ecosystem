// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PersonalizedFeed
 * @dev Smart contract for managing personalized content feeds based on user interactions and preferences
 */
contract PersonalizedFeed is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant FEED_MANAGER_ROLE = keccak256("FEED_MANAGER_ROLE");

    struct UserInteraction {
        uint256 likes;
        uint256 comments;
        uint256 shares;
        uint256 views;
        uint256 timeSpent; // in seconds
        uint256 lastInteraction;
    }

    struct ContentScore {
        uint256 contentId;
        uint256 score;
        uint256 timestamp;
        string contentType; // "post", "comment", "share"
    }

    struct UserPreferences {
        string[] preferredTopics;
        string[] blockedTopics;
        uint256 contentFreshness; // 0-100, higher means prefer newer content
        uint256 socialWeight; // 0-100, higher means prefer content from connections
        uint256 engagementWeight; // 0-100, higher means prefer highly engaged content
        bool enablePersonalization;
        uint256 lastUpdated;
    }

    struct FeedItem {
        uint256 contentId;
        address author;
        string contentType;
        string[] topics;
        uint256 score;
        uint256 timestamp;
        uint256 engagementCount;
        bool isPromoted;
    }

    // Mappings
    mapping(address => mapping(uint256 => UserInteraction)) public userInteractions;
    mapping(address => UserPreferences) public userPreferences;
    mapping(address => mapping(string => uint256)) public topicInteractions;
    mapping(address => uint256[]) public userFeed;
    mapping(uint256 => ContentScore) public contentScores;
    mapping(address => mapping(address => uint256)) public authorInteractions;
    
    // Arrays for trending content
    uint256[] public trendingContent;
    string[] public trendingTopics;
    
    // Constants for scoring algorithm
    uint256 public constant MAX_FEED_SIZE = 100;
    uint256 public constant TRENDING_THRESHOLD = 1000;
    uint256 public constant DECAY_FACTOR = 86400; // 24 hours in seconds

    // Events
    event InteractionRecorded(address indexed user, uint256 indexed contentId, string interactionType, uint256 weight);
    event PreferencesUpdated(address indexed user, string[] preferredTopics, string[] blockedTopics);
    event FeedGenerated(address indexed user, uint256 itemCount, uint256 timestamp);
    event ContentScoreUpdated(uint256 indexed contentId, uint256 newScore, string reason);
    event TrendingContentUpdated(uint256[] contentIds, string[] topics);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
        _grantRole(FEED_MANAGER_ROLE, msg.sender);
    }

    /**
     * @dev Record user interaction with content for personalization
     */
    function recordInteraction(
        address user,
        uint256 contentId,
        string memory interactionType,
        uint256 timeSpent,
        string[] memory topics,
        address author
    ) external nonReentrant whenNotPaused {
        require(user != address(0), "Invalid user address");
        require(contentId > 0, "Invalid content ID");

        UserInteraction storage interaction = userInteractions[user][contentId];
        uint256 weight = 1;

        // Update interaction counts based on type
        if (keccak256(abi.encodePacked(interactionType)) == keccak256(abi.encodePacked("like"))) {
            interaction.likes++;
            weight = 2;
        } else if (keccak256(abi.encodePacked(interactionType)) == keccak256(abi.encodePacked("comment"))) {
            interaction.comments++;
            weight = 3;
        } else if (keccak256(abi.encodePacked(interactionType)) == keccak256(abi.encodePacked("share"))) {
            interaction.shares++;
            weight = 4;
        } else if (keccak256(abi.encodePacked(interactionType)) == keccak256(abi.encodePacked("view"))) {
            interaction.views++;
            weight = 1;
        }

        interaction.timeSpent += timeSpent;
        interaction.lastInteraction = block.timestamp;

        // Update topic interactions
        for (uint256 i = 0; i < topics.length; i++) {
            topicInteractions[user][topics[i]] += weight;
        }

        // Update author interactions
        if (author != address(0) && author != user) {
            authorInteractions[user][author] += weight;
        }

        // Update content score
        _updateContentScore(contentId, weight, interactionType);

        emit InteractionRecorded(user, contentId, interactionType, weight);
    }

    /**
     * @dev Update user preferences for personalized feed
     */
    function updateUserPreferences(
        string[] memory preferredTopics,
        string[] memory blockedTopics,
        uint256 contentFreshness,
        uint256 socialWeight,
        uint256 engagementWeight,
        bool enablePersonalization
    ) external nonReentrant {
        require(contentFreshness <= 100, "Invalid freshness value");
        require(socialWeight <= 100, "Invalid social weight");
        require(engagementWeight <= 100, "Invalid engagement weight");

        UserPreferences storage prefs = userPreferences[msg.sender];
        prefs.preferredTopics = preferredTopics;
        prefs.blockedTopics = blockedTopics;
        prefs.contentFreshness = contentFreshness;
        prefs.socialWeight = socialWeight;
        prefs.engagementWeight = engagementWeight;
        prefs.enablePersonalization = enablePersonalization;
        prefs.lastUpdated = block.timestamp;

        emit PreferencesUpdated(msg.sender, preferredTopics, blockedTopics);
    }

    /**
     * @dev Generate personalized feed for user
     */
    function generatePersonalizedFeed(
        address user,
        uint256[] memory availableContent,
        FeedItem[] memory contentItems
    ) external nonReentrant whenNotPaused returns (uint256[] memory) {
        require(user != address(0), "Invalid user address");
        require(availableContent.length == contentItems.length, "Mismatched arrays");

        UserPreferences memory prefs = userPreferences[user];
        uint256[] memory scoredContent = new uint256[](availableContent.length);
        uint256[] memory scores = new uint256[](availableContent.length);

        // Calculate scores for each content item
        for (uint256 i = 0; i < contentItems.length; i++) {
            uint256 score = _calculateContentScore(user, contentItems[i], prefs);
            scoredContent[i] = availableContent[i];
            scores[i] = score;
        }

        // Sort content by score (bubble sort for simplicity)
        for (uint256 i = 0; i < scores.length; i++) {
            for (uint256 j = 0; j < scores.length - 1 - i; j++) {
                if (scores[j] < scores[j + 1]) {
                    // Swap scores
                    uint256 tempScore = scores[j];
                    scores[j] = scores[j + 1];
                    scores[j + 1] = tempScore;
                    
                    // Swap content IDs
                    uint256 tempContent = scoredContent[j];
                    scoredContent[j] = scoredContent[j + 1];
                    scoredContent[j + 1] = tempContent;
                }
            }
        }

        // Limit feed size
        uint256 feedSize = availableContent.length > MAX_FEED_SIZE ? MAX_FEED_SIZE : availableContent.length;
        uint256[] memory finalFeed = new uint256[](feedSize);
        
        for (uint256 i = 0; i < feedSize; i++) {
            finalFeed[i] = scoredContent[i];
        }

        // Update user's feed
        userFeed[user] = finalFeed;

        emit FeedGenerated(user, feedSize, block.timestamp);
        return finalFeed;
    }

    /**
     * @dev Calculate personalized score for content item
     */
    function _calculateContentScore(
        address user,
        FeedItem memory item,
        UserPreferences memory prefs
    ) internal view returns (uint256) {
        if (!prefs.enablePersonalization) {
            return _getBaseScore(item);
        }

        uint256 score = _getBaseScore(item);
        
        // Topic relevance score
        uint256 topicScore = _calculateTopicScore(user, item.topics, prefs);
        
        // Social connection score
        uint256 socialScore = _calculateSocialScore(user, item.author, prefs);
        
        // Freshness score
        uint256 freshnessScore = _calculateFreshnessScore(item.timestamp, prefs);
        
        // Engagement score
        uint256 engagementScore = _calculateEngagementScore(item.engagementCount, prefs);

        // Combine scores with user preferences
        score = (score * 40 + 
                topicScore * 25 + 
                socialScore * (prefs.socialWeight * 20 / 100) + 
                freshnessScore * (prefs.contentFreshness * 10 / 100) + 
                engagementScore * (prefs.engagementWeight * 5 / 100)) / 100;

        // Boost promoted content
        if (item.isPromoted) {
            score = score * 120 / 100;
        }

        return score;
    }

    /**
     * @dev Calculate base score for content
     */
    function _getBaseScore(FeedItem memory item) internal view returns (uint256) {
        uint256 baseScore = 100;
        
        // Time decay
        uint256 age = block.timestamp - item.timestamp;
        if (age > DECAY_FACTOR) {
            baseScore = baseScore * DECAY_FACTOR / age;
        }
        
        return baseScore;
    }

    /**
     * @dev Calculate topic relevance score
     */
    function _calculateTopicScore(
        address user,
        string[] memory topics,
        UserPreferences memory prefs
    ) internal view returns (uint256) {
        uint256 score = 0;
        uint256 totalInteractions = 0;

        for (uint256 i = 0; i < topics.length; i++) {
            // Check if topic is blocked
            bool isBlocked = false;
            for (uint256 j = 0; j < prefs.blockedTopics.length; j++) {
                if (keccak256(abi.encodePacked(topics[i])) == keccak256(abi.encodePacked(prefs.blockedTopics[j]))) {
                    return 0; // Blocked topic, return 0 score
                }
            }

            // Check if topic is preferred
            bool isPreferred = false;
            for (uint256 j = 0; j < prefs.preferredTopics.length; j++) {
                if (keccak256(abi.encodePacked(topics[i])) == keccak256(abi.encodePacked(prefs.preferredTopics[j]))) {
                    isPreferred = true;
                    break;
                }
            }

            uint256 topicInteractionCount = topicInteractions[user][topics[i]];
            totalInteractions += topicInteractionCount;
            
            if (isPreferred) {
                score += topicInteractionCount * 150 / 100; // 50% boost for preferred topics
            } else {
                score += topicInteractionCount;
            }
        }

        return topics.length > 0 ? score / topics.length : 0;
    }

    /**
     * @dev Calculate social connection score
     */
    function _calculateSocialScore(
        address user,
        address author,
        UserPreferences memory prefs
    ) internal view returns (uint256) {
        if (user == author) {
            return 0; // Don't boost own content
        }
        
        uint256 authorInteractionCount = authorInteractions[user][author];
        return authorInteractionCount > 0 ? (authorInteractionCount * prefs.socialWeight / 100) : 50;
    }

    /**
     * @dev Calculate freshness score
     */
    function _calculateFreshnessScore(
        uint256 timestamp,
        UserPreferences memory prefs
    ) internal view returns (uint256) {
        uint256 age = block.timestamp - timestamp;
        uint256 maxAge = DECAY_FACTOR * 7; // 7 days
        
        if (age >= maxAge) {
            return 0;
        }
        
        uint256 freshnessScore = ((maxAge - age) * 100) / maxAge;
        return (freshnessScore * prefs.contentFreshness) / 100;
    }

    /**
     * @dev Calculate engagement score
     */
    function _calculateEngagementScore(
        uint256 engagementCount,
        UserPreferences memory prefs
    ) internal pure returns (uint256) {
        uint256 engagementScore = engagementCount > 100 ? 100 : engagementCount;
        return (engagementScore * prefs.engagementWeight) / 100;
    }

    /**
     * @dev Update content score based on interactions
     */
    function _updateContentScore(
        uint256 contentId,
        uint256 weight,
        string memory reason
    ) internal {
        ContentScore storage score = contentScores[contentId];
        score.contentId = contentId;
        score.score += weight;
        score.timestamp = block.timestamp;

        emit ContentScoreUpdated(contentId, score.score, reason);
    }

    /**
     * @dev Update trending content (admin function)
     */
    function updateTrendingContent(
        uint256[] memory contentIds,
        string[] memory topics
    ) external onlyRole(FEED_MANAGER_ROLE) {
        trendingContent = contentIds;
        trendingTopics = topics;
        
        emit TrendingContentUpdated(contentIds, topics);
    }

    /**
     * @dev Get user's current feed
     */
    function getUserFeed(address user) external view returns (uint256[] memory) {
        return userFeed[user];
    }

    /**
     * @dev Get user preferences
     */
    function getUserPreferences(address user) external view returns (UserPreferences memory) {
        return userPreferences[user];
    }

    /**
     * @dev Get trending content
     */
    function getTrendingContent() external view returns (uint256[] memory, string[] memory) {
        return (trendingContent, trendingTopics);
    }

    /**
     * @dev Get content score
     */
    function getContentScore(uint256 contentId) external view returns (ContentScore memory) {
        return contentScores[contentId];
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(MODERATOR_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause
     */
    function unpause() external onlyRole(MODERATOR_ROLE) {
        _unpause();
    }
}
