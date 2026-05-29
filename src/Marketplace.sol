// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title BeZhas Marketplace RWA
 * @dev Optimizado para activos fraccionados (ERC-1155) usando BEZ-Coin.
 */
contract Marketplace is ReentrancyGuard, Ownable, Pausable, ERC1155Holder {
    using SafeERC20 for IERC20;

    struct MarketItem {
        uint256 itemId;
        address nftContract;
        uint256 tokenId;
        address seller;
        uint256 amount;        // Cantidad de fracciones en venta
        uint256 pricePerUnit;  // Precio de 1 fracción en BEZ
        bool isListed;
    }

    IERC20 public immutable bezhasToken;
    address public feeRecipient;
    uint256 public listingFeePercentage; // Base 1000 (25 = 2.5%)

    mapping(uint256 => MarketItem) public marketItemsById;
    uint256 private _itemIds;

    event MarketItemListed(uint256 indexed itemId, address indexed nftContract, uint256 indexed tokenId, address seller, uint256 amount, uint256 pricePerUnit);
    event MarketItemSold(uint256 indexed itemId, address buyer, uint256 amount, uint256 totalPrice);
    event MarketItemCancelled(uint256 indexed itemId);

    constructor() Ownable(msg.sender) {
        // Dirección fija de tu token BEZ-Coin proporcionada
        bezhasToken = IERC20(0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8);
        feeRecipient = msg.sender;
        listingFeePercentage = 25; // 2.5%
    }

    /**
     * @dev Pone en venta fracciones de un activo RWA.
     */
    function listItem(
        address nftContract, 
        uint256 tokenId, 
        uint256 amount, 
        uint256 pricePerUnit
    ) public nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(pricePerUnit > 0, "Price must be > 0");

        // Transferir las fracciones al contrato (Escrow)
        IERC1155(nftContract).safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        _itemIds++;
        uint256 itemId = _itemIds;

        marketItemsById[itemId] = MarketItem(
            itemId,
            nftContract,
            tokenId,
            msg.sender,
            amount,
            pricePerUnit,
            true
        );

        emit MarketItemListed(itemId, nftContract, tokenId, msg.sender, amount, pricePerUnit);
    }

    /**
     * @dev Compra de fracciones. Permite compras parciales (no hay que comprar todo el lote).
     */
    function buyItem(uint256 itemId, uint256 amountToBuy) public nonReentrant whenNotPaused {
        MarketItem storage item = marketItemsById[itemId];
        require(item.isListed, "Not listed");
        require(amountToBuy > 0 && amountToBuy <= item.amount, "Invalid amount");
        require(item.seller != msg.sender, "Sellers cannot buy");

        uint256 totalPrice = amountToBuy * item.pricePerUnit;
        uint256 fee = (totalPrice * listingFeePercentage) / 1000;
        uint256 sellerProceeds = totalPrice - fee;

        // Actualizar el inventario de la venta ANTES de transferir (Checks-Effects-Interactions)
        item.amount -= amountToBuy;
        if (item.amount == 0) {
            item.isListed = false;
        }

        // Transferencias de BEZ-Coin
        bezhasToken.safeTransferFrom(msg.sender, feeRecipient, fee);
        bezhasToken.safeTransferFrom(msg.sender, item.seller, sellerProceeds);

        // Transferencia de los tokens RWA al comprador
        IERC1155(item.nftContract).safeTransferFrom(address(this), msg.sender, item.tokenId, amountToBuy, "");

        emit MarketItemSold(itemId, msg.sender, amountToBuy, totalPrice);
    }

    function cancelListing(uint256 itemId) public nonReentrant {
        MarketItem storage item = marketItemsById[itemId];
        require(item.seller == msg.sender, "Not the seller");
        require(item.isListed, "Not listed");

        item.isListed = false;
        
        // Devolver tokens restantes al vendedor
        IERC1155(item.nftContract).safeTransferFrom(address(this), msg.sender, item.tokenId, item.amount, "");

        emit MarketItemCancelled(itemId);
    }

    // --- Admin Functions ---

    function updateListingFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 100, "Fee too high"); // Max 10%
        listingFeePercentage = _newFee;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
