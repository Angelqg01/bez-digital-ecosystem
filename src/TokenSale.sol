// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenSale is Ownable, ReentrancyGuard {
    IERC20 public token;
    address payable public wallet;
    uint256 public price; // Price of 1 token in wei
    uint256 public tokensSold;

    event TokensPurchased(address indexed purchaser, address indexed beneficiary, uint256 amount, uint256 value);

    constructor(IERC20 _token, address payable _wallet, uint256 _price) Ownable(msg.sender) {
        require(address(_token) != address(0), "Token address cannot be zero");
        require(_wallet != address(0), "Wallet address cannot be zero");
        require(_price > 0, "Token price must be greater than zero");

        token = _token;
        wallet = _wallet;
        price = _price;
    }

    function buyTokens() public payable nonReentrant {
        require(msg.value > 0, "You need to send some Ether to buy tokens");
        require(msg.value <= 10 ether, "Purchase amount too large"); // Prevent flash loan attacks
        
        uint256 amount = (msg.value * 1e18) / price; // Proper decimal handling
        require(amount > 0, "Ether sent is not enough to buy any tokens");

        uint256 availableTokens = token.balanceOf(address(this));
        require(availableTokens >= amount, "Not enough tokens in the contract for sale");

        tokensSold += amount;
        
        // Transfer tokens to the buyer
        bool sent = token.transfer(msg.sender, amount);
        require(sent, "Failed to transfer tokens to buyer");

        // Forward funds to the wallet
        (bool success, ) = wallet.call{value: msg.value}("");
        require(success, "Failed to send Ether to wallet");

        emit TokensPurchased(msg.sender, msg.sender, amount, msg.value);
    }

    function endSale() public onlyOwner {
        uint256 remainingTokens = token.balanceOf(address(this));
        if (remainingTokens > 0) {
            bool sent = token.transfer(owner(), remainingTokens);
            require(sent, "Failed to transfer remaining tokens to owner");
        }
        
        // Transfer any remaining ETH to owner
        uint256 remainingEth = address(this).balance;
        if (remainingEth > 0) {
            (bool success, ) = payable(owner()).call{value: remainingEth}("");
            require(success, "Failed to transfer remaining ETH to owner");
        }
    }
    
    function updatePrice(uint256 _newPrice) public onlyOwner {
        require(_newPrice > 0, "Price must be greater than zero");
        price = _newPrice;
    }
    
    function pause() public onlyOwner {
        // Implementation for pausing sales if needed
    }
    
    function getTokensRemaining() public view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
