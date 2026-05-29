// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./UserProfile.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Post
 * @dev This contract manages user posts, comments, and likes for the Bezhas social network.
 */
contract Post is Ownable {

    UserProfile public userProfileContract;


    struct PostData {
        uint256 id;
        address author;
        string contentURI; // URI to content on IPFS/Arweave
        uint256 timestamp;
        uint256 likeCount;
    }

    struct CommentData {
        address author;
        string contentURI;
        uint256 timestamp;
    }

    uint256 private _postCounter;

    mapping(uint256 => PostData) public posts;
    mapping(uint256 => CommentData[]) public comments;
    mapping(uint256 => mapping(address => bool)) public postLikes; // postId => user => liked?

    event PostCreated(uint256 indexed postId, address indexed author);
    event CommentCreated(uint256 indexed postId, address indexed author);
    event PostLiked(uint256 indexed postId, address indexed user, bool liked);

    constructor(address _userProfileAddress) Ownable(msg.sender) {
        require(_userProfileAddress != address(0), "Invalid UserProfile contract address");
        userProfileContract = UserProfile(_userProfileAddress);
    }

    function createPost(string memory _contentURI) public {
        (,,,,bool isCreated) = userProfileContract.profiles(msg.sender);
        require(isCreated, "User must have a profile");

        _postCounter++;
        uint256 newPostId = _postCounter;

        posts[newPostId] = PostData({
            id: newPostId,
            author: msg.sender,
            contentURI: _contentURI,
            timestamp: block.timestamp,
            likeCount: 0
        });

        emit PostCreated(newPostId, msg.sender);
    }

    function createComment(uint256 _postId, string memory _contentURI) public {
        require(posts[_postId].id != 0, "Post does not exist");
        (,,,,bool isCreated) = userProfileContract.profiles(msg.sender);
        require(isCreated, "User must have a profile");

        comments[_postId].push(CommentData(msg.sender, _contentURI, block.timestamp));
        emit CommentCreated(_postId, msg.sender);
    }

    function toggleLike(uint256 _postId) public {
        require(posts[_postId].id != 0, "Post does not exist");
        (,,,,bool isCreated) = userProfileContract.profiles(msg.sender);
        require(isCreated, "User must have a profile");

        if (postLikes[_postId][msg.sender]) {
            // User has already liked, so unlike
            postLikes[_postId][msg.sender] = false;
            posts[_postId].likeCount--;
            emit PostLiked(_postId, msg.sender, false);
        } else {
            // User has not liked, so like
            postLikes[_postId][msg.sender] = true;
            posts[_postId].likeCount++;
            emit PostLiked(_postId, msg.sender, true);
        }
    }

    function getComments(uint256 _postId) public view returns (CommentData[] memory) {
        return comments[_postId];
    }

    function getTotalPosts() public view returns (uint256) {
        return _postCounter;
    }
}
