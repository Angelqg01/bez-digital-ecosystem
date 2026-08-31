// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HyperlocalEscrow
 * @dev Escrow contract for BZ Sphere hyperlocal commerce.
 * Handles locking and releasing BEZ-Coin credits based on in-chat confirmations.
 */
contract HyperlocalEscrow {
    
    struct Transaction {
        address buyer;
        address seller;
        uint256 amount;
        bool locked;
        bool completed;
        bool disputed;
        bool reviewed;
        bytes32 qrHash;
    }

    struct Review {
        address reviewer;
        uint8 rating;
        string comment;
        uint256 timestamp;
    }

    mapping(uint256 => Transaction) public transactions;
    mapping(address => Review[]) public vendorReviews;
    mapping(address => uint256) public vendorTotalRating;
    mapping(address => uint256) public vendorReviewCount;
    
    uint256 public nextTxId;
    
    address public platformTreasury;
    uint256 public constant PLATFORM_FEE_BPS = 250; // 2.5%

    event FundsLocked(uint256 indexed txId, address buyer, uint256 amount);
    event FundsReleased(uint256 indexed txId, address seller, uint256 amount);
    event TransactionDisputed(uint256 indexed txId);
    event ReviewSubmitted(uint256 indexed txId, address indexed vendor, uint8 rating);

    constructor(address _treasury) {
        platformTreasury = _treasury;
    }

    /**
     * @dev Buyer locks funds for an offer.
     */
    function lockFunds(address _seller, uint256 _amount, bytes32 _qrHash) external payable {
        // In a real BEZ-Coin implementation, this would involve ERC20.transferFrom
        // For this MVP, we use native value or simulated ledger logic.
        
        transactions[nextTxId] = Transaction({
            buyer: msg.sender,
            seller: _seller,
            amount: _amount,
            locked: true,
            completed: false,
            disputed: false,
            qrHash: _qrHash
        });

        emit FundsLocked(nextTxId, msg.sender, _amount);
        nextTxId++;
    }

    /**
     * @dev Seller releases funds by providing the raw QR secret that matches the hash.
     */
    function releaseFunds(uint256 _txId, string memory _qrSecret) external {
        Transaction storage trx = transactions[_txId];
        require(trx.locked, "Funds not locked");
        require(!trx.completed, "Already completed");
        require(keccak256(abi.encodePacked(_qrSecret)) == trx.qrHash, "Invalid QR secret");

        uint256 fee = (trx.amount * PLATFORM_FEE_BPS) / 10000;
        uint256 sellerAmount = trx.amount - fee;

        trx.completed = true;
        trx.locked = false;

        // Perform transfers (Simulated)
        // payable(trx.seller).transfer(sellerAmount);
        // payable(platformTreasury).transfer(fee);

        emit FundsReleased(_txId, trx.seller, sellerAmount);
    }

    /**
     * @dev Submit an immutable review for a completed transaction.
     */
    function submitReview(uint256 _txId, uint8 _rating, string calldata _comment) external {
        Transaction storage trx = transactions[_txId];
        require(trx.completed, "Transaction not completed");
        require(msg.sender == trx.buyer, "Only buyer can review");
        require(!trx.reviewed, "Already reviewed");
        require(_rating >= 1 && _rating <= 5, "Rating must be 1-5");

        trx.reviewed = true;
        
        Review memory newReview = Review({
            reviewer: msg.sender,
            rating: _rating,
            comment: _comment,
            timestamp: block.timestamp
        });

        vendorReviews[trx.seller].push(newReview);
        vendorTotalRating[trx.seller] += _rating;
        vendorReviewCount[trx.seller]++;

        emit ReviewSubmitted(_txId, trx.seller, _rating);
    }
}
