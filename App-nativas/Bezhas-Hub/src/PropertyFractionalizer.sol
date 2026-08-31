// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ShareToken.sol";

contract PropertyFractionalizer is Ownable {
    IERC721 public immutable property;
    uint256 public immutable tokenId;
    ShareToken public shareToken;
    uint256 public totalShares;
    uint256 public pricePerShareWei;
    bool public fractionalized;
    uint256 public revenueBalance;

    event Fractionalized(address shareToken, uint256 totalShares, uint256 pricePerShareWei);
    event SharesBought(address buyer, uint256 amount, uint256 paidWei);
    event RevenueReceived(address from, uint256 amount);
    event RevenueWithdrawn(address to, uint256 amount);

    constructor(address _property, uint256 _tokenId) Ownable(msg.sender) {
        property = IERC721(_property);
        tokenId = _tokenId;
    }

    // Owner calls to fractionalize after approving transfer of NFT to this contract
    function fractionalize(string calldata name_, string calldata symbol_, uint256 _totalShares, uint256 _pricePerShareWei) external onlyOwner {
        require(!fractionalized, "Already fractionalized");
        require(property.ownerOf(tokenId) == msg.sender, "Not owner of NFT");
        // transfer NFT to contract
        property.transferFrom(msg.sender, address(this), tokenId);
        totalShares = _totalShares;
        pricePerShareWei = _pricePerShareWei;
        // deploy simple ERC20 - minted to this contract
        ShareToken st = new ShareToken(name_, symbol_, _totalShares, address(this));
        shareToken = st;
        fractionalized = true;
        emit Fractionalized(address(st), _totalShares, _pricePerShareWei);
    }

    // Buy shares by paying exact ETH = amount * pricePerShareWei
    function buyShares(uint256 amount) external payable {
        require(fractionalized, "Not fractionalized");
        require(amount > 0, "Zero amount");
        uint256 cost = amount * pricePerShareWei;
        require(msg.value == cost, "Incorrect payment");
        // transfer shares held by this contract to buyer
        require(shareToken.balanceOf(address(this)) >= amount, "Not enough shares");
        // transfer
        shareToken.transfer(msg.sender, amount);
        revenueBalance += msg.value;
        emit SharesBought(msg.sender, amount, msg.value);
    }

    // Accept revenue from bookings (payable)
    receive() external payable {
        revenueBalance += msg.value;
        emit RevenueReceived(msg.sender, msg.value);
    }

    // Owner withdraws revenue (for demo: owner withdraws; in prod distribute pro rata)
    function withdrawRevenue(address payable to) external onlyOwner {
        uint256 amount = revenueBalance;
        require(amount > 0, "No revenue");
        revenueBalance = 0;
        to.transfer(amount);
        emit RevenueWithdrawn(to, amount);
    }

    // Simple helper: holder can check shares
    function sharesOf(address who) external view returns (uint256) {
        if (address(shareToken) == address(0)) return 0;
        return shareToken.balanceOf(who);
    }
}
