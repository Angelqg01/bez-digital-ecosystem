// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Messages is Ownable {
    struct Message {
        address from;
        address to;
        string encryptedContent; // Content will be encrypted on the frontend
        uint256 timestamp;
    }

    // Mapping from a user to their received messages
    mapping(address => Message[]) private receivedMessages;

    // Mapping from a user to their sent messages
    mapping(address => Message[]) private sentMessages;

    event MessageSent(address indexed from, address indexed to, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    function sendMessage(address _to, string calldata _encryptedContent) public {
        Message memory newMessage = Message({
            from: msg.sender,
            to: _to,
            encryptedContent: _encryptedContent,
            timestamp: block.timestamp
        });

        sentMessages[msg.sender].push(newMessage);
        receivedMessages[_to].push(newMessage);

        emit MessageSent(msg.sender, _to, block.timestamp);
    }

    function getReceivedMessages() public view returns (Message[] memory) {
        return receivedMessages[msg.sender];
    }

    function getSentMessages() public view returns (Message[] memory) {
        return sentMessages[msg.sender];
    }
}
