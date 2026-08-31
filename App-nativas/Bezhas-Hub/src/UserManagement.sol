// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract UserManagement is AccessControl, ReentrancyGuard {
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant VERIFIED_ROLE = keccak256("VERIFIED_ROLE");
    
    uint256 private _userIdCounter;
    
    enum PrivacyLevel { PUBLIC, FRIENDS_ONLY, PRIVATE }
    enum VerificationStatus { NONE, PENDING, VERIFIED, REJECTED }
    
    struct UserProfile {
        uint256 userId;
        string username;
        string displayName;
        string bio;
        string avatarUrl;
        string bannerUrl;
        bool isActive;
        uint256 createdAt;
        uint256 lastActive;
        VerificationStatus verificationStatus;
        string verificationBadge;
        PrivacyLevel privacyLevel;
        bool allowDirectMessages;
        bool showOnlineStatus;
        uint256 followersCount;
        uint256 followingCount;
        uint256 postsCount;
    }
    
    struct FollowRelation {
        bool isFollowing;
        uint256 followedAt;
        bool isFriend;
        uint256 friendsSince;
    }
    
    struct UserSearch {
        address userAddress;
        string username;
        string displayName;
        bool isVerified;
        uint256 lastActive;
    }
    
    mapping(address => UserProfile) public userProfiles;
    mapping(string => address) public usernameToAddress;
    mapping(address => mapping(address => FollowRelation)) public followRelations;
    mapping(address => address[]) public userFollowers;
    mapping(address => address[]) public userFollowing;
    mapping(address => address[]) public userFriends;
    mapping(address => mapping(address => bool)) public blockedUsers;
    
    // Search indexes
    mapping(uint256 => address) public userIdToAddress;
    address[] public allUsers;
    
    // Verification requests
    mapping(address => string) public verificationRequests;
    mapping(address => uint256) public verificationRequestTime;
    
    event UserRegistered(address indexed user, string username, uint256 userId);
    event ProfileUpdated(address indexed user, string field);
    event UserFollowed(address indexed follower, address indexed followed);
    event UserUnfollowed(address indexed follower, address indexed unfollowed);
    event FriendRequestSent(address indexed from, address indexed to);
    event FriendRequestAccepted(address indexed from, address indexed to);
    event UserBlocked(address indexed blocker, address indexed blocked);
    event UserUnblocked(address indexed blocker, address indexed unblocked);
    event VerificationRequested(address indexed user, string evidence);
    event UserVerified(address indexed user, string badge);
    event VerificationRejected(address indexed user, string reason);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
    }
    
    function registerUser(
        string memory username,
        string memory displayName,
        string memory bio
    ) external nonReentrant {
        require(userProfiles[msg.sender].userId == 0, "User already registered");
        require(bytes(username).length >= 3 && bytes(username).length <= 20, "Invalid username length");
        require(usernameToAddress[username] == address(0), "Username already taken");
        require(_isValidUsername(username), "Invalid username format");
        
        _userIdCounter++;
        uint256 newUserId = _userIdCounter;
        
        userProfiles[msg.sender] = UserProfile({
            userId: newUserId,
            username: username,
            displayName: displayName,
            bio: bio,
            avatarUrl: "",
            bannerUrl: "",
            isActive: true,
            createdAt: block.timestamp,
            lastActive: block.timestamp,
            verificationStatus: VerificationStatus.NONE,
            verificationBadge: "",
            privacyLevel: PrivacyLevel.PUBLIC,
            allowDirectMessages: true,
            showOnlineStatus: true,
            followersCount: 0,
            followingCount: 0,
            postsCount: 0
        });
        
        usernameToAddress[username] = msg.sender;
        userIdToAddress[newUserId] = msg.sender;
        allUsers.push(msg.sender);
        
        emit UserRegistered(msg.sender, username, newUserId);
    }
    
    function updateProfile(
        string memory displayName,
        string memory bio,
        string memory avatarUrl,
        string memory bannerUrl
    ) external {
        require(userProfiles[msg.sender].userId != 0, "User not registered");
        
        UserProfile storage profile = userProfiles[msg.sender];
        profile.displayName = displayName;
        profile.bio = bio;
        profile.avatarUrl = avatarUrl;
        profile.bannerUrl = bannerUrl;
        profile.lastActive = block.timestamp;
        
        emit ProfileUpdated(msg.sender, "profile");
    }
    
    function updatePrivacySettings(
        PrivacyLevel privacyLevel,
        bool allowDirectMessages,
        bool showOnlineStatus
    ) external {
        require(userProfiles[msg.sender].userId != 0, "User not registered");
        
        UserProfile storage profile = userProfiles[msg.sender];
        profile.privacyLevel = privacyLevel;
        profile.allowDirectMessages = allowDirectMessages;
        profile.showOnlineStatus = showOnlineStatus;
        
        emit ProfileUpdated(msg.sender, "privacy");
    }
    
    function followUser(address userToFollow) external nonReentrant {
        require(userProfiles[msg.sender].userId != 0, "User not registered");
        require(userProfiles[userToFollow].userId != 0, "Target user not registered");
        require(msg.sender != userToFollow, "Cannot follow yourself");
        require(!followRelations[msg.sender][userToFollow].isFollowing, "Already following");
        require(!blockedUsers[userToFollow][msg.sender], "You are blocked by this user");
        require(!blockedUsers[msg.sender][userToFollow], "You have blocked this user");
        
        followRelations[msg.sender][userToFollow] = FollowRelation({
            isFollowing: true,
            followedAt: block.timestamp,
            isFriend: false,
            friendsSince: 0
        });
        
        userFollowing[msg.sender].push(userToFollow);
        userFollowers[userToFollow].push(msg.sender);
        
        userProfiles[msg.sender].followingCount++;
        userProfiles[userToFollow].followersCount++;
        
        // Check if mutual follow (becomes friends)
        if (followRelations[userToFollow][msg.sender].isFollowing) {
            followRelations[msg.sender][userToFollow].isFriend = true;
            followRelations[userToFollow][msg.sender].isFriend = true;
            followRelations[msg.sender][userToFollow].friendsSince = block.timestamp;
            followRelations[userToFollow][msg.sender].friendsSince = block.timestamp;
            
            userFriends[msg.sender].push(userToFollow);
            userFriends[userToFollow].push(msg.sender);
            
            emit FriendRequestAccepted(msg.sender, userToFollow);
        }
        
        emit UserFollowed(msg.sender, userToFollow);
    }
    
    function unfollowUser(address userToUnfollow) external nonReentrant {
        _unfollowUser(msg.sender, userToUnfollow);
    }

    function _unfollowUser(address follower, address followed) internal {
        require(followRelations[follower][followed].isFollowing, "Not following this user");
        
        followRelations[follower][followed].isFollowing = false;
        
        // Remove from arrays
        _removeFromArray(userFollowing[follower], followed);
        _removeFromArray(userFollowers[followed], follower);
        
        userProfiles[follower].followingCount--;
        userProfiles[followed].followersCount--;
        
        // Handle friend relationship
        if (followRelations[follower][followed].isFriend) {
            followRelations[follower][followed].isFriend = false;
            followRelations[followed][follower].isFriend = false;
            
            _removeFromArray(userFriends[follower], followed);
            _removeFromArray(userFriends[followed], follower);
        }
        
        emit UserUnfollowed(follower, followed);
    }
    
    function blockUser(address userToBlock) external {
        require(userProfiles[msg.sender].userId != 0, "User not registered");
        require(userProfiles[userToBlock].userId != 0, "Target user not registered");
        require(msg.sender != userToBlock, "Cannot block yourself");
        require(!hasRole(DEFAULT_ADMIN_ROLE, userToBlock), "Cannot block admin");
        
        blockedUsers[msg.sender][userToBlock] = true;
        
        // Unfollow if following
        if (followRelations[msg.sender][userToBlock].isFollowing) {
            _unfollowUser(msg.sender, userToBlock);
        }
        if (followRelations[userToBlock][msg.sender].isFollowing) {
            // Force unfollow from blocked user's side
            followRelations[userToBlock][msg.sender].isFollowing = false;
            _removeFromArray(userFollowing[userToBlock], msg.sender);
            _removeFromArray(userFollowers[msg.sender], userToBlock);
            userProfiles[userToBlock].followingCount--;
            userProfiles[msg.sender].followersCount--;
        }
        
        emit UserBlocked(msg.sender, userToBlock);
    }
    
    function unblockUser(address userToUnblock) external {
        require(blockedUsers[msg.sender][userToUnblock], "User not blocked");
        
        blockedUsers[msg.sender][userToUnblock] = false;
        emit UserUnblocked(msg.sender, userToUnblock);
    }
    
    function searchUsers(
        string memory query,
        uint256 offset,
        uint256 limit
    ) external view returns (UserSearch[] memory) {
        require(limit <= 50, "Limit too high");
        
        UserSearch[] memory results = new UserSearch[](limit);
        uint256 resultCount = 0;
        uint256 currentOffset = 0;
        
        for (uint256 i = 0; i < allUsers.length && resultCount < limit; i++) {
            address userAddr = allUsers[i];
            UserProfile memory profile = userProfiles[userAddr];
            
            if (!profile.isActive) continue;
            
            bool matches = _stringContains(profile.username, query) ||
                          _stringContains(profile.displayName, query);
            
            if (matches) {
                if (currentOffset >= offset) {
                    results[resultCount] = UserSearch({
                        userAddress: userAddr,
                        username: profile.username,
                        displayName: profile.displayName,
                        isVerified: profile.verificationStatus == VerificationStatus.VERIFIED,
                        lastActive: profile.lastActive
                    });
                    resultCount++;
                }
                currentOffset++;
            }
        }
        
        // Resize array to actual results
        UserSearch[] memory finalResults = new UserSearch[](resultCount);
        for (uint256 i = 0; i < resultCount; i++) {
            finalResults[i] = results[i];
        }
        
        return finalResults;
    }
    
    function requestVerification(string memory evidence) external {
        require(userProfiles[msg.sender].userId != 0, "User not registered");
        require(userProfiles[msg.sender].verificationStatus == VerificationStatus.NONE, "Already verified or pending");
        
        userProfiles[msg.sender].verificationStatus = VerificationStatus.PENDING;
        verificationRequests[msg.sender] = evidence;
        verificationRequestTime[msg.sender] = block.timestamp;
        
        emit VerificationRequested(msg.sender, evidence);
    }
    
    function approveVerification(address user, string memory badge) external onlyRole(MODERATOR_ROLE) {
        require(userProfiles[user].verificationStatus == VerificationStatus.PENDING, "No pending verification");
        
        userProfiles[user].verificationStatus = VerificationStatus.VERIFIED;
        userProfiles[user].verificationBadge = badge;
        _grantRole(VERIFIED_ROLE, user);
        
        emit UserVerified(user, badge);
    }
    
    function rejectVerification(address user, string memory reason) external onlyRole(MODERATOR_ROLE) {
        require(userProfiles[user].verificationStatus == VerificationStatus.PENDING, "No pending verification");
        
        userProfiles[user].verificationStatus = VerificationStatus.REJECTED;
        
        emit VerificationRejected(user, reason);
    }
    
    function getFollowers(address user, uint256 offset, uint256 limit) external view returns (address[] memory) {
        require(limit <= 100, "Limit too high");
        
        address[] memory followers = userFollowers[user];
        uint256 start = offset;
        uint256 end = offset + limit;
        
        if (end > followers.length) {
            end = followers.length;
        }
        if (start >= followers.length) {
            return new address[](0);
        }
        
        address[] memory result = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = followers[i];
        }
        
        return result;
    }
    
    function getFollowing(address user, uint256 offset, uint256 limit) external view returns (address[] memory) {
        require(limit <= 100, "Limit too high");
        
        address[] memory following = userFollowing[user];
        uint256 start = offset;
        uint256 end = offset + limit;
        
        if (end > following.length) {
            end = following.length;
        }
        if (start >= following.length) {
            return new address[](0);
        }
        
        address[] memory result = new address[](end - start);
        for (uint256 i = start; i < end; i++) {
            result[i - start] = following[i];
        }
        
        return result;
    }
    
    function getFriends(address user) external view returns (address[] memory) {
        return userFriends[user];
    }
    
    function isFollowing(address follower, address followed) external view returns (bool) {
        return followRelations[follower][followed].isFollowing;
    }
    
    function areFriends(address user1, address user2) external view returns (bool) {
        return followRelations[user1][user2].isFriend && followRelations[user2][user1].isFriend;
    }
    
    function isBlocked(address blocker, address blocked) external view returns (bool) {
        return blockedUsers[blocker][blocked];
    }
    
    function getUserByUsername(string memory username) external view returns (address) {
        return usernameToAddress[username];
    }
    
    function getTotalUsers() external view returns (uint256) {
        return allUsers.length;
    }
    
    function _isValidUsername(string memory username) internal pure returns (bool) {
        bytes memory usernameBytes = bytes(username);
        
        for (uint256 i = 0; i < usernameBytes.length; i++) {
            bytes1 char = usernameBytes[i];
            
            if (!(char >= 0x30 && char <= 0x39) && // 0-9
                !(char >= 0x41 && char <= 0x5A) && // A-Z
                !(char >= 0x61 && char <= 0x7A) && // a-z
                char != 0x5F) { // _
                return false;
            }
        }
        
        return true;
    }
    
    function _stringContains(string memory str, string memory substr) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory substrBytes = bytes(substr);
        
        if (substrBytes.length == 0) return true;
        if (substrBytes.length > strBytes.length) return false;
        
        for (uint256 i = 0; i <= strBytes.length - substrBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < substrBytes.length; j++) {
                if (strBytes[i + j] != substrBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        
        return false;
    }
    
    function _removeFromArray(address[] storage array, address element) internal {
        for (uint256 i = 0; i < array.length; i++) {
            if (array[i] == element) {
                array[i] = array[array.length - 1];
                array.pop();
                break;
            }
        }
    }
}
