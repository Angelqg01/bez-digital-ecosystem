// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PropertyNFT is ERC721, Ownable {
    uint256 public nextId;
    mapping(uint256 => string) private _metadata;

    constructor() ERC721("BeZhas Property", "BPROP") Ownable(msg.sender) {}

    function mintProperty(address to, string memory uri) external onlyOwner returns (uint256) {
        nextId++;
        _mint(to, nextId);
        _metadata[nextId] = uri;
        return nextId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Nonexistent token");
        return _metadata[tokenId];
    }
}
