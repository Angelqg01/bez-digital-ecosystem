const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
require('dotenv').config();

const contractJson = require('../../artifacts/contracts/NFTOffers.sol/NFTOffers.json');
const abi = contractJson.abi;
const contractAddress = process.env.NFT_OFFERS_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC || process.env.POLYGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, abi, wallet);

/**
 * @route   POST /api/nft-offers/create
 * @desc    Create an offer for an NFT
 * @body    { nftContract, tokenId, offerAmount, duration, message }
 */
router.post('/create', async (req, res) => {
    try {
        const { nftContract, tokenId, offerAmount, duration, message } = req.body;

        // Validations
        if (!nftContract || !tokenId || !offerAmount || !duration) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Convert amount to Wei
        const offerAmountWei = ethers.parseUnits(offerAmount.toString(), 18);

        // Duration in seconds (convert days to seconds if needed)
        const durationSeconds = duration * 24 * 60 * 60;

        const tx = await contract.createOffer(
            nftContract,
            tokenId,
            offerAmountWei,
            durationSeconds,
            message || ''
        );

        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Offer created successfully',
            offerId: receipt.logs[0]?.topics[1]
        });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({
            error: error.message || 'Error creating offer',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-offers/counter/:offerId
 * @desc    Create a counter offer
 * @body    { counterAmount, duration, message }
 */
router.post('/counter/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;
        const { counterAmount, duration, message } = req.body;

        if (!counterAmount || !duration) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const counterAmountWei = ethers.parseUnits(counterAmount.toString(), 18);
        const durationSeconds = duration * 24 * 60 * 60;

        const tx = await contract.createCounterOffer(
            offerId,
            counterAmountWei,
            message || '',
            durationSeconds
        );

        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Counter offer created successfully'
        });
    } catch (error) {
        console.error('Error creating counter offer:', error);
        res.status(500).json({
            error: error.message || 'Error creating counter offer',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-offers/accept/:offerId
 * @desc    Accept an offer
 */
router.post('/accept/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;

        const tx = await contract.acceptOffer(offerId);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Offer accepted successfully'
        });
    } catch (error) {
        console.error('Error accepting offer:', error);
        res.status(500).json({
            error: error.message || 'Error accepting offer',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-offers/accept-counter/:offerId
 * @desc    Accept a counter offer
 */
router.post('/accept-counter/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;

        const tx = await contract.acceptCounterOffer(offerId);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Counter offer accepted successfully'
        });
    } catch (error) {
        console.error('Error accepting counter offer:', error);
        res.status(500).json({
            error: error.message || 'Error accepting counter offer',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-offers/reject/:offerId
 * @desc    Reject an offer
 */
router.post('/reject/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;

        const tx = await contract.rejectOffer(offerId);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Offer rejected successfully'
        });
    } catch (error) {
        console.error('Error rejecting offer:', error);
        res.status(500).json({
            error: error.message || 'Error rejecting offer',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-offers/cancel/:offerId
 * @desc    Cancel an offer
 */
router.post('/cancel/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;

        const tx = await contract.cancelOffer(offerId);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Offer cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling offer:', error);
        res.status(500).json({
            error: error.message || 'Error cancelling offer',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   GET /api/nft-offers/nft/:nftContract/:tokenId
 * @desc    Get offers for a specific NFT
 */
router.get('/nft/:nftContract/:tokenId', async (req, res) => {
    try {
        const { nftContract, tokenId } = req.params;

        const offers = await contract.getNFTOffers(nftContract, tokenId);

        res.json({
            success: true,
            offers: offers.map(offer => ({
                offerId: offer.offerId.toString(),
                nftContract: offer.nftContract,
                tokenId: offer.tokenId.toString(),
                offerer: offer.offerer,
                nftOwner: offer.nftOwner,
                offerAmount: ethers.formatUnits(offer.offerAmount, 18),
                expiresAt: offer.expiresAt.toString(),
                status: getStatusString(offer.status),
                createdAt: offer.createdAt.toString(),
                message: offer.message
            }))
        });
    } catch (error) {
        console.error('Error getting NFT offers:', error);
        res.status(500).json({
            error: error.message || 'Error getting NFT offers'
        });
    }
});

/**
 * @route   GET /api/nft-offers/user/:address
 * @desc    Get offers made by a user
 */
router.get('/user/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const offers = await contract.getUserOffers(address);

        res.json({
            success: true,
            offers: offers.map(offer => ({
                offerId: offer.offerId.toString(),
                nftContract: offer.nftContract,
                tokenId: offer.tokenId.toString(),
                offerer: offer.offerer,
                nftOwner: offer.nftOwner,
                offerAmount: ethers.formatUnits(offer.offerAmount, 18),
                expiresAt: offer.expiresAt.toString(),
                status: getStatusString(offer.status),
                createdAt: offer.createdAt.toString(),
                message: offer.message
            }))
        });
    } catch (error) {
        console.error('Error getting user offers:', error);
        res.status(500).json({
            error: error.message || 'Error getting user offers'
        });
    }
});

/**
 * @route   GET /api/nft-offers/received/:address
 * @desc    Get offers received by a user
 */
router.get('/received/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const offers = await contract.getReceivedOffers(address);

        res.json({
            success: true,
            offers: offers.map(offer => ({
                offerId: offer.offerId.toString(),
                nftContract: offer.nftContract,
                tokenId: offer.tokenId.toString(),
                offerer: offer.offerer,
                nftOwner: offer.nftOwner,
                offerAmount: ethers.formatUnits(offer.offerAmount, 18),
                expiresAt: offer.expiresAt.toString(),
                status: getStatusString(offer.status),
                createdAt: offer.createdAt.toString(),
                message: offer.message
            }))
        });
    } catch (error) {
        console.error('Error getting received offers:', error);
        res.status(500).json({
            error: error.message || 'Error getting received offers'
        });
    }
});

/**
 * @route   GET /api/nft-offers/counter/:offerId
 * @desc    Get counter offer for an offer
 */
router.get('/counter/:offerId', async (req, res) => {
    try {
        const { offerId } = req.params;

        const counter = await contract.counterOffers(offerId);

        if (!counter.isActive) {
            return res.json({
                success: true,
                hasCounter: false
            });
        }

        res.json({
            success: true,
            hasCounter: true,
            counterOffer: {
                originalOfferId: counter.originalOfferId.toString(),
                counterAmount: ethers.formatUnits(counter.counterAmount, 18),
                message: counter.message,
                createdAt: counter.createdAt.toString(),
                expiresAt: counter.expiresAt.toString(),
                isActive: counter.isActive
            }
        });
    } catch (error) {
        console.error('Error getting counter offer:', error);
        res.status(500).json({
            error: error.message || 'Error getting counter offer'
        });
    }
});

/**
 * @route   POST /api/nft-offers/expire
 * @desc    Batch expire offers
 * @body    { offerIds: [] }
 */
router.post('/expire', async (req, res) => {
    try {
        const { offerIds } = req.body;

        if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
            return res.status(400).json({ error: 'Invalid offer IDs array' });
        }

        const tx = await contract.batchExpireOffers(offerIds);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: `${offerIds.length} offers expired successfully`
        });
    } catch (error) {
        console.error('Error expiring offers:', error);
        res.status(500).json({
            error: error.message || 'Error expiring offers',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   GET /api/nft-offers/config
 * @desc    Get contract configuration
 */
router.get('/config', async (req, res) => {
    try {
        const paymentToken = await contract.paymentToken();
        const feeRecipient = await contract.feeRecipient();
        const protocolFee = await contract.protocolFee();
        const minOfferDuration = await contract.minOfferDuration();
        const maxOfferDuration = await contract.maxOfferDuration();

        res.json({
            success: true,
            config: {
                contractAddress,
                paymentToken,
                feeRecipient,
                protocolFee: (Number(protocolFee) / 100).toString() + '%',
                minOfferDuration: (Number(minOfferDuration) / 3600).toString() + ' hours',
                maxOfferDuration: (Number(maxOfferDuration) / 86400).toString() + ' days'
            }
        });
    } catch (error) {
        console.error('Error getting config:', error);
        res.status(500).json({
            error: error.message || 'Error getting config'
        });
    }
});

// Helper function to convert status enum to string
function getStatusString(status) {
    const statuses = ['Pending', 'Countered', 'Accepted', 'Rejected', 'Cancelled', 'Expired'];
    return statuses[status] || 'Unknown';
}

module.exports = router;
