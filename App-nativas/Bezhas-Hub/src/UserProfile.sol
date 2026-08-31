// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UserProfile
 * @dev This contract manages user profiles for the Bezhas social network.
 */
contract UserProfile is Ownable {

    struct Profile {
        string username;
        string bio;
        string profilePictureUri;
        string publicKey; // For end-to-end encrypted messaging
        bool isCreated;
    }

    mapping(address => Profile) public profiles;
    mapping(string => bool) public usernameTaken;
    mapping(string => address) public usernameToAddress;
    address[] public users;

    event ProfileCreated(address indexed user, string username);

    // Event emitted when a profile is updated.
    event ProfileUpdated(address indexed user, string username);


    constructor(address initialOwner) Ownable(initialOwner) {
        require(initialOwner != address(0), "Ownable: initial owner is the zero address");
    }

    function createProfile(string memory _username, string memory _bio, string memory _profilePictureUri, string memory _publicKey) public {
        require(!profiles[msg.sender].isCreated, "Profile already exists");
        require(!usernameTaken[_username], "Username is already taken");

        profiles[msg.sender] = Profile({
            username: _username,
            bio: _bio,
            profilePictureUri: _profilePictureUri,
            publicKey: _publicKey,
            isCreated: true
        });

        usernameTaken[_username] = true;
        usernameToAddress[_username] = msg.sender;
        users.push(msg.sender);
        emit ProfileCreated(msg.sender, _username);
    }

    function updateProfile(string memory _username, string memory _bio, string memory _profilePictureUri, string memory _publicKey) public {
        require(profiles[msg.sender].isCreated, "Profile does not exist");

        // If username is being changed, free up the old one and claim the new one
        if (keccak256(abi.encodePacked(profiles[msg.sender].username)) != keccak256(abi.encodePacked(_username))) {
            require(!usernameTaken[_username], "Username is already taken");
            string memory oldUsername = profiles[msg.sender].username;
            usernameTaken[oldUsername] = false;
            usernameToAddress[oldUsername] = address(0);
            usernameTaken[_username] = true;
            usernameToAddress[_username] = msg.sender;
            profiles[msg.sender].username = _username;
        }

        profiles[msg.sender].bio = _bio;
        profiles[msg.sender].profilePictureUri = _profilePictureUri;
        profiles[msg.sender].publicKey = _publicKey;

        emit ProfileUpdated(msg.sender, _username);
    }

    function getProfile(address _user) public view returns (Profile memory) {
        require(profiles[_user].isCreated, "Profile does not exist");
        return profiles[_user];
    }

    function getProfileByUsername(string memory _username) public view returns (address) {
        require(usernameTaken[_username], "Username does not exist");
        return usernameToAddress[_username];
    }
    
    function isUsernameAvailable(string memory _username) public view returns (bool) {
        return !usernameTaken[_username];
    }

    function getAllUsers() public view returns (address[] memory) {
        return users;
    }
}
