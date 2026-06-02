// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title SocialInteractions
 * @dev Manages likes, comments, shares and other social interactions
 */
contract SocialInteractions is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    
    struct Comment {
        uint256 id;
        uint256 postId;
        address author;
        string content;
        uint256 timestamp;
        uint256 likesCount;
        bool isDeleted;
        uint256 parentCommentId; // For nested comments
    }
    
    struct Like {
        address user;
        uint256 timestamp;
        bool isActive;
    }
    
    struct Share {
        address user;
        uint256 timestamp;
        string shareText;
    }
    
    // Post ID => Like count
    mapping(uint256 => uint256) public postLikes;
    // Post ID => User => Like status
    mapping(uint256 => mapping(address => Like)) public userPostLikes;
    // Post ID => Comment ID => Comment
    mapping(uint256 => mapping(uint256 => Comment)) public postComments;
    // Post ID => Comment count
    mapping(uint256 => uint256) public postCommentCounts;
    // Comment ID => Like count
    mapping(uint256 => uint256) public commentLikes;
    // Comment ID => User => Like status
    mapping(uint256 => mapping(address => Like)) public userCommentLikes;
    // Post ID => Share count
    mapping(uint256 => uint256) public postShares;
    // Post ID => User => Share
    mapping(uint256 => mapping(address => Share)) public userPostShares;
    
    // Global counters
    uint256 public totalComments;
    uint256 public totalLikes;
    uint256 public totalShares;
    
    // Events
    event PostLiked(uint256 indexed postId, address indexed user, uint256 timestamp);
    event PostUnliked(uint256 indexed postId, address indexed user, uint256 timestamp);
    event CommentCreated(uint256 indexed postId, uint256 indexed commentId, address indexed author, string content, uint256 parentCommentId);
    event CommentLiked(uint256 indexed commentId, address indexed user, uint256 timestamp);
    event CommentUnliked(uint256 indexed commentId, address indexed user, uint256 timestamp);
    event PostShared(uint256 indexed postId, address indexed user, string shareText, uint256 timestamp);
    event CommentDeleted(uint256 indexed postId, uint256 indexed commentId, address indexed moderator);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
    }
    
    /**
     * @dev Like or unlike a post
     */
    function togglePostLike(uint256 postId) external nonReentrant whenNotPaused {
        require(postId > 0, "Invalid post ID");
        
        Like storage userLike = userPostLikes[postId][msg.sender];
        
        if (userLike.isActive) {
            // Unlike the post
            userLike.isActive = false;
            postLikes[postId]--;
            totalLikes--;
            emit PostUnliked(postId, msg.sender, block.timestamp);
        } else {
            // Like the post
            userLike.user = msg.sender;
            userLike.timestamp = block.timestamp;
            userLike.isActive = true;
            postLikes[postId]++;
            totalLikes++;
            emit PostLiked(postId, msg.sender, block.timestamp);
        }
    }
    
    /**
     * @dev Create a comment on a post
     */
    function createComment(
        uint256 postId, 
        string memory content, 
        uint256 parentCommentId
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(postId > 0, "Invalid post ID");
        require(bytes(content).length > 0, "Comment cannot be empty");
        require(bytes(content).length <= 1000, "Comment too long");
        
        // If it's a reply, verify parent comment exists
        if (parentCommentId > 0) {
            require(postComments[postId][parentCommentId].id > 0, "Parent comment does not exist");
            require(!postComments[postId][parentCommentId].isDeleted, "Cannot reply to deleted comment");
        }
        
        postCommentCounts[postId]++;
        totalComments++;
        uint256 commentId = postCommentCounts[postId];
        
        postComments[postId][commentId] = Comment({
            id: commentId,
            postId: postId,
            author: msg.sender,
            content: content,
            timestamp: block.timestamp,
            likesCount: 0,
            isDeleted: false,
            parentCommentId: parentCommentId
        });
        
        emit CommentCreated(postId, commentId, msg.sender, content, parentCommentId);
        return commentId;
    }
    
    /**
     * @dev Like or unlike a comment
     */
    function toggleCommentLike(uint256 postId, uint256 commentId) external nonReentrant whenNotPaused {
        require(postId > 0, "Invalid post ID");
        require(commentId > 0, "Invalid comment ID");
        require(postComments[postId][commentId].id > 0, "Comment does not exist");
        require(!postComments[postId][commentId].isDeleted, "Cannot like deleted comment");
        
        Like storage userLike = userCommentLikes[commentId][msg.sender];
        
        if (userLike.isActive) {
            // Unlike the comment
            userLike.isActive = false;
            commentLikes[commentId]--;
            postComments[postId][commentId].likesCount--;
            emit CommentUnliked(commentId, msg.sender, block.timestamp);
        } else {
            // Like the comment
            userLike.user = msg.sender;
            userLike.timestamp = block.timestamp;
            userLike.isActive = true;
            commentLikes[commentId]++;
            postComments[postId][commentId].likesCount++;
            emit CommentLiked(commentId, msg.sender, block.timestamp);
        }
    }
    
    /**
     * @dev Share a post
     */
    function sharePost(uint256 postId, string memory shareText) external nonReentrant whenNotPaused {
        require(postId > 0, "Invalid post ID");
        require(bytes(shareText).length <= 500, "Share text too long");
        
        // Check if user already shared this post
        require(userPostShares[postId][msg.sender].user == address(0) || 
                userPostShares[postId][msg.sender].timestamp == 0, "Already shared this post");
        
        userPostShares[postId][msg.sender] = Share({
            user: msg.sender,
            timestamp: block.timestamp,
            shareText: shareText
        });
        
        postShares[postId]++;
        totalShares++;
        
        emit PostShared(postId, msg.sender, shareText, block.timestamp);
    }
    
    /**
     * @dev Delete a comment (moderator only)
     */
    function deleteComment(uint256 postId, uint256 commentId) external onlyRole(MODERATOR_ROLE) {
        require(postId > 0, "Invalid post ID");
        require(commentId > 0, "Invalid comment ID");
        require(postComments[postId][commentId].id > 0, "Comment does not exist");
        require(!postComments[postId][commentId].isDeleted, "Comment already deleted");
        
        postComments[postId][commentId].isDeleted = true;
        postComments[postId][commentId].content = "[Comment deleted by moderator]";
        
        emit CommentDeleted(postId, commentId, msg.sender);
    }
    
    /**
     * @dev Get post interaction stats
     */
    function getPostStats(uint256 postId) external view returns (
        uint256 likes,
        uint256 comments,
        uint256 shares
    ) {
        return (
            postLikes[postId],
            postCommentCounts[postId],
            postShares[postId]
        );
    }
    
    /**
     * @dev Check if user liked a post
     */
    function hasUserLikedPost(uint256 postId, address user) external view returns (bool) {
        return userPostLikes[postId][user].isActive;
    }
    
    /**
     * @dev Check if user liked a comment
     */
    function hasUserLikedComment(uint256 commentId, address user) external view returns (bool) {
        return userCommentLikes[commentId][user].isActive;
    }
    
    /**
     * @dev Get comment details
     */
    function getComment(uint256 postId, uint256 commentId) external view returns (Comment memory) {
        return postComments[postId][commentId];
    }
    
    /**
     * @dev Get comments for a post (paginated)
     */
    function getPostComments(
        uint256 postId, 
        uint256 offset, 
        uint256 limit
    ) external view returns (Comment[] memory) {
        require(limit <= 50, "Limit too high");
        
        uint256 totalComments = postCommentCounts[postId];
        if (offset >= totalComments) {
            return new Comment[](0);
        }
        
        uint256 end = offset + limit;
        if (end > totalComments) {
            end = totalComments;
        }
        
        Comment[] memory comments = new Comment[](end - offset);
        uint256 index = 0;
        
        for (uint256 i = offset + 1; i <= end; i++) {
            if (!postComments[postId][i].isDeleted) {
                comments[index] = postComments[postId][i];
                index++;
            }
        }
        
        // Resize array to actual size
        Comment[] memory result = new Comment[](index);
        for (uint256 i = 0; i < index; i++) {
            result[i] = comments[i];
        }
        
        return result;
    }
    
    /**
     * @dev Get global platform stats
     */
    function getPlatformStats() external view returns (
        uint256 totalLikesCount,
        uint256 totalCommentsCount,
        uint256 totalSharesCount
    ) {
        return (totalLikes, totalComments, totalShares);
    }
    
    /**
     * @dev Emergency pause (admin only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause (admin only)
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
