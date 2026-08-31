// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GamificationSystem is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant GAME_MASTER_ROLE = keccak256("GAME_MASTER_ROLE");

    IERC20 public bezhasToken;
    
    uint256 private _achievementIds;
    uint256 private _challengeIds;

    // User progression
    struct UserProfile {
        uint256 level;
        uint256 experience;
        uint256 totalPoints;
        uint256 streakDays;
        uint256 lastActivityDate;
        uint256 questsCompleted;
        mapping(uint256 => bool) unlockedAchievements;
        mapping(uint256 => bool) completedChallenges;
        mapping(string => uint256) stats;
    }

    struct UserStats {
        uint256 level;
        uint256 exp;
        uint256 questsCompleted;
    }

    // Achievement system
    struct Achievement {
        uint256 id;
        string name;
        string description;
        string category;
        uint256 pointsReward;
        uint256 tokenReward;
        bytes32 criteria;
        bool isActive;
        uint256 rarity; // 1=Common, 2=Rare, 3=Epic, 4=Legendary
        string badgeURI;
    }

    // Challenge system
    struct Challenge {
        uint256 id;
        string name;
        string description;
        uint256 startTime;
        uint256 endTime;
        uint256 pointsReward;
        uint256 tokenReward;
        bytes32 requirements;
        uint256 maxParticipants;
        uint256 currentParticipants;
        bool isActive;
        mapping(address => bool) participants;
        mapping(address => bool) completed;
    }

    // Leaderboard entry
    struct LeaderboardEntry {
        address user;
        uint256 score;
        uint256 rank;
    }

    mapping(address => UserProfile) public userProfiles;
    mapping(uint256 => Achievement) public achievements;
    mapping(uint256 => Challenge) public challenges;
    mapping(string => LeaderboardEntry[]) public leaderboards;
    mapping(uint256 => uint256) public levelRequirements;

    // Events
    event UserLevelUp(address indexed user, uint256 newLevel);
    event AchievementUnlocked(address indexed user, uint256 achievementId);
    event ChallengeCompleted(address indexed user, uint256 challengeId);
    event PointsAwarded(address indexed user, uint256 points, string reason);
    event TokensAwarded(address indexed user, uint256 tokens, string reason);
    event StreakUpdated(address indexed user, uint256 streakDays);

    constructor(address _bezhasToken) {
        bezhasToken = IERC20(_bezhasToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
        _grantRole(GAME_MASTER_ROLE, msg.sender);
        
        _initializeLevelRequirements();
        _createDefaultAchievements();
    }

    function _initializeLevelRequirements() internal {
        levelRequirements[1] = 100;
        levelRequirements[2] = 250;
        levelRequirements[3] = 500;
        levelRequirements[4] = 1000;
        levelRequirements[5] = 2000;
        levelRequirements[6] = 4000;
        levelRequirements[7] = 8000;
        levelRequirements[8] = 16000;
        levelRequirements[9] = 32000;
        levelRequirements[10] = 64000;
    }

    function _createDefaultAchievements() internal {
        _createAchievement("First Steps", "Complete your first transaction", "beginner", 50, 10 * 10**18, keccak256("FIRST_TRANSACTION"), 1, "");
        _createAchievement("NFT Creator", "Mint your first NFT", "creation", 100, 25 * 10**18, keccak256("FIRST_NFT"), 2, "");
        _createAchievement("Trader", "Complete 10 trades", "trading", 200, 50 * 10**18, keccak256("TRADES_10"), 2, "");
        _createAchievement("Staking Master", "Stake tokens for 30 days", "staking", 300, 100 * 10**18, keccak256("STAKE_30_DAYS"), 3, "");
        _createAchievement("Community Leader", "Refer 5 new users", "social", 500, 200 * 10**18, keccak256("REFERRALS_5"), 3, "");
        _createAchievement("Whale", "Hold 10,000 BEZ tokens", "wealth", 1000, 500 * 10**18, keccak256("HOLD_10K_BEZ"), 4, "");
    }

    function _createAchievement(
        string memory name,
        string memory description,
        string memory category,
        uint256 pointsReward,
        uint256 tokenReward,
        bytes32 criteria,
        uint256 rarity,
        string memory badgeURI
    ) internal {
        _achievementIds++;
        uint256 achievementId = _achievementIds;
        
        achievements[achievementId] = Achievement({
            id: achievementId,
            name: name,
            description: description,
            category: category,
            pointsReward: pointsReward,
            tokenReward: tokenReward,
            criteria: criteria,
            isActive: true,
            rarity: rarity,
            badgeURI: badgeURI
        });
    }

    function createAchievement(
        string memory name,
        string memory description,
        string memory category,
        uint256 pointsReward,
        uint256 tokenReward,
        bytes32 criteria,
        uint256 rarity,
        string memory badgeURI
    ) external onlyRole(GAME_MASTER_ROLE) {
        _createAchievement(name, description, category, pointsReward, tokenReward, criteria, rarity, badgeURI);
    }

    function createChallenge(
        string memory name,
        string memory description,
        uint256 duration,
        uint256 pointsReward,
        uint256 tokenReward,
        bytes32 requirements,
        uint256 maxParticipants
    ) external onlyRole(GAME_MASTER_ROLE) {
        _challengeIds++;
        uint256 challengeId = _challengeIds;
        
        Challenge storage challenge = challenges[challengeId];
        challenge.id = challengeId;
        challenge.name = name;
        challenge.description = description;
        challenge.startTime = block.timestamp;
        challenge.endTime = block.timestamp + duration;
        challenge.pointsReward = pointsReward;
        challenge.tokenReward = tokenReward;
        challenge.requirements = requirements;
        challenge.maxParticipants = maxParticipants;
        challenge.currentParticipants = 0;
        challenge.isActive = true;
    }

    function awardPoints(address user, uint256 points, string memory reason) external onlyRole(MODERATOR_ROLE) {
        UserProfile storage profile = userProfiles[user];
        profile.totalPoints += points;
        profile.experience += points;
        
        _checkLevelUp(user);
        _updateStreak(user);
        
        emit PointsAwarded(user, points, reason);
    }

    function awardTokens(address user, uint256 tokens, string memory reason) external onlyRole(MODERATOR_ROLE) {
        require(bezhasToken.transfer(user, tokens), "Token transfer failed");
        emit TokensAwarded(user, tokens, reason);
    }

    function unlockAchievement(address user, uint256 achievementId) external onlyRole(MODERATOR_ROLE) {
        require(achievements[achievementId].isActive, "Achievement not active");
        require(!userProfiles[user].unlockedAchievements[achievementId], "Achievement already unlocked");
        
        UserProfile storage profile = userProfiles[user];
        profile.unlockedAchievements[achievementId] = true;
        
        Achievement memory achievement = achievements[achievementId];
        profile.totalPoints += achievement.pointsReward;
        profile.experience += achievement.pointsReward;
        
        if (achievement.tokenReward > 0) {
            bezhasToken.transfer(user, achievement.tokenReward);
        }
        
        _checkLevelUp(user);
        
        emit AchievementUnlocked(user, achievementId);
        emit PointsAwarded(user, achievement.pointsReward, "Achievement unlocked");
        
        if (achievement.tokenReward > 0) {
            emit TokensAwarded(user, achievement.tokenReward, "Achievement reward");
        }
    }

    function joinChallenge(uint256 challengeId) external nonReentrant {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.isActive, "Challenge not active");
        require(block.timestamp >= challenge.startTime, "Challenge not started");
        require(block.timestamp <= challenge.endTime, "Challenge ended");
        require(challenge.currentParticipants < challenge.maxParticipants, "Challenge full");
        require(!challenge.participants[msg.sender], "Already participating");
        
        challenge.participants[msg.sender] = true;
        challenge.currentParticipants++;
    }

    function completeChallenge(address user, uint256 challengeId) external onlyRole(MODERATOR_ROLE) {
        Challenge storage challenge = challenges[challengeId];
        require(challenge.participants[user], "User not participating");
        require(!challenge.completed[user], "Challenge already completed");
        require(block.timestamp <= challenge.endTime, "Challenge ended");
        
        challenge.completed[user] = true;
        
        UserProfile storage profile = userProfiles[user];
        profile.completedChallenges[challengeId] = true;
        profile.questsCompleted++;
        profile.totalPoints += challenge.pointsReward;
        profile.experience += challenge.pointsReward;
        
        if (challenge.tokenReward > 0) {
            bezhasToken.transfer(user, challenge.tokenReward);
        }
        
        _checkLevelUp(user);
        
        emit ChallengeCompleted(user, challengeId);
        emit PointsAwarded(user, challenge.pointsReward, "Challenge completed");
        
        if (challenge.tokenReward > 0) {
            emit TokensAwarded(user, challenge.tokenReward, "Challenge reward");
        }
    }

    function updateUserStat(address user, string memory statName, uint256 value) external onlyRole(MODERATOR_ROLE) {
        userProfiles[user].stats[statName] = value;
        _checkAchievements(user, statName, value);
    }

    function _checkLevelUp(address user) internal {
        UserProfile storage profile = userProfiles[user];
        uint256 currentLevel = profile.level;
        uint256 newLevel = _calculateLevel(profile.experience);
        
        if (newLevel > currentLevel) {
            profile.level = newLevel;
            emit UserLevelUp(user, newLevel);
            
            // Award level up bonus
            uint256 levelBonus = newLevel * 50;
            profile.totalPoints += levelBonus;
            emit PointsAwarded(user, levelBonus, "Level up bonus");
        }
    }

    function _calculateLevel(uint256 experience) internal view returns (uint256) {
        for (uint256 level = 10; level >= 1; level--) {
            if (experience >= levelRequirements[level]) {
                return level;
            }
        }
        return 0;
    }

    function _updateStreak(address user) internal {
        UserProfile storage profile = userProfiles[user];
        uint256 today = block.timestamp / 86400;
        uint256 lastActivity = profile.lastActivityDate / 86400;
        
        if (today == lastActivity + 1) {
            profile.streakDays++;
        } else if (today > lastActivity + 1) {
            profile.streakDays = 1;
        }
        
        profile.lastActivityDate = block.timestamp;
        emit StreakUpdated(user, profile.streakDays);
    }

    function _checkAchievements(address user, string memory statName, uint256 value) internal {
        // Check for automatic achievement unlocks based on stats
        bytes32 statHash = keccak256(abi.encodePacked(statName));
        
        if (statHash == keccak256("TRANSACTIONS") && value == 1) {
            _autoUnlockAchievement(user, keccak256("FIRST_TRANSACTION"));
        } else if (statHash == keccak256("NFTS_MINTED") && value == 1) {
            _autoUnlockAchievement(user, keccak256("FIRST_NFT"));
        } else if (statHash == keccak256("TRADES") && value == 10) {
            _autoUnlockAchievement(user, keccak256("TRADES_10"));
        } else if (statHash == keccak256("BEZ_BALANCE") && value >= 10000 * 10**18) {
            _autoUnlockAchievement(user, keccak256("HOLD_10K_BEZ"));
        }
    }

    function _autoUnlockAchievement(address user, bytes32 criteria) internal {
        for (uint256 i = 1; i <= _achievementIds; i++) {
            if (achievements[i].criteria == criteria && !userProfiles[user].unlockedAchievements[i]) {
                userProfiles[user].unlockedAchievements[i] = true;
                
                Achievement memory achievement = achievements[i];
                userProfiles[user].totalPoints += achievement.pointsReward;
                userProfiles[user].experience += achievement.pointsReward;
                
                if (achievement.tokenReward > 0) {
                    bezhasToken.transfer(user, achievement.tokenReward);
                }
                
                emit AchievementUnlocked(user, i);
                break;
            }
        }
    }

    function updateLeaderboard(string memory leaderboardType, address[] memory users, uint256[] memory scores) 
        external onlyRole(MODERATOR_ROLE) {
        require(users.length == scores.length, "Arrays length mismatch");
        
        delete leaderboards[leaderboardType];
        
        for (uint256 i = 0; i < users.length; i++) {
            leaderboards[leaderboardType].push(LeaderboardEntry({
                user: users[i],
                score: scores[i],
                rank: i + 1
            }));
        }
    }

    // View functions
    function getUserStats(address user) external view returns (UserStats memory) {
        UserProfile storage profile = userProfiles[user];
        return UserStats({
            level: profile.level,
            exp: profile.experience,
            questsCompleted: profile.questsCompleted
        });
    }

    function getUserProfile(address user) external view returns (
        uint256 level,
        uint256 experience,
        uint256 totalPoints,
        uint256 streakDays,
        uint256 lastActivityDate
    ) {
        UserProfile storage profile = userProfiles[user];
        return (
            profile.level,
            profile.experience,
            profile.totalPoints,
            profile.streakDays,
            profile.lastActivityDate
        );
    }

    function getUserStat(address user, string memory statName) external view returns (uint256) {
        return userProfiles[user].stats[statName];
    }

    function hasAchievement(address user, uint256 achievementId) external view returns (bool) {
        return userProfiles[user].unlockedAchievements[achievementId];
    }

    function hasCompletedChallenge(address user, uint256 challengeId) external view returns (bool) {
        return userProfiles[user].completedChallenges[challengeId];
    }

    function getUnlockedAchievements(address user) external view returns (Achievement[] memory) {
        UserProfile storage profile = userProfiles[user];
        uint256 unlockedCount = 0;
        for (uint256 i = 1; i <= _achievementIds; i++) {
            if (profile.unlockedAchievements[i]) {
                unlockedCount++;
            }
        }

        Achievement[] memory unlocked = new Achievement[](unlockedCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= _achievementIds; i++) {
            if (profile.unlockedAchievements[i]) {
                unlocked[index] = achievements[i];
                index++;
            }
        }
        return unlocked;
    }

    function getLeaderboard(string memory leaderboardType) external view returns (LeaderboardEntry[] memory) {
        return leaderboards[leaderboardType];
    }

    function getActiveAchievements() external view returns (Achievement[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= _achievementIds; i++) {
            if (achievements[i].isActive) {
                activeCount++;
            }
        }
        
        Achievement[] memory activeAchievements = new Achievement[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= _achievementIds; i++) {
            if (achievements[i].isActive) {
                activeAchievements[index] = achievements[i];
                index++;
            }
        }
        
        return activeAchievements;
    }

    function getActiveChallenges() external view returns (uint256[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= _challengeIds; i++) {
            if (challenges[i].isActive && block.timestamp <= challenges[i].endTime) {
                activeCount++;
            }
        }
        
        uint256[] memory activeChallenges = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i <= _challengeIds; i++) {
            if (challenges[i].isActive && block.timestamp <= challenges[i].endTime) {
                activeChallenges[index] = i;
                index++;
            }
        }
        
        return activeChallenges;
    }

    // Admin functions
    function setLevelRequirement(uint256 level, uint256 experience) external onlyRole(ADMIN_ROLE) {
        levelRequirements[level] = experience;
    }

    function toggleAchievement(uint256 achievementId) external onlyRole(ADMIN_ROLE) {
        achievements[achievementId].isActive = !achievements[achievementId].isActive;
    }

    function toggleChallenge(uint256 challengeId) external onlyRole(ADMIN_ROLE) {
        challenges[challengeId].isActive = !challenges[challengeId].isActive;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function emergencyWithdraw() external onlyRole(ADMIN_ROLE) {
        uint256 balance = bezhasToken.balanceOf(address(this));
        bezhasToken.transfer(msg.sender, balance);
    }
}
