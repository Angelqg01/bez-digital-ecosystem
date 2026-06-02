const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
require('dotenv').config();

const contractJson = require('../../artifacts/contracts/NFTRental.sol/NFTRental.json');
const abi = contractJson.abi;
const contractAddress = process.env.NFT_RENTAL_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC || process.env.POLYGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(contractAddress, abi, wallet);

/**
 * @route   POST /api/nft-rental/list
 * @desc    List an NFT for rent
 * @body    { nftContract, tokenId, pricePerDay, minDays, maxDays, collateralAmount }
 */
router.post('/list', async (req, res) => {
    try {
        const { nftContract, tokenId, pricePerDay, minDays, maxDays, collateralAmount } = req.body;

        // Validations
        if (!nftContract || !tokenId || !pricePerDay || !minDays || !maxDays || !collateralAmount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Convert to Wei if needed
        const pricePerDayWei = ethers.parseUnits(pricePerDay.toString(), 18);
        const collateralWei = ethers.parseUnits(collateralAmount.toString(), 18);

        // Call contract
        const tx = await contract.listNFTForRent(
            nftContract,
            tokenId,
            pricePerDayWei,
            minDays,
            maxDays,
            collateralWei
        );

        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'NFT listed for rent successfully',
            listingId: receipt.logs[0]?.topics[1] // Extract listing ID from event
        });
    } catch (error) {
        console.error('Error listing NFT for rent:', error);
        res.status(500).json({
            error: error.message || 'Error listing NFT for rent',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-rental/rent/:listingId
 * @desc    Rent an NFT
 * @body    { rentalDays }
 */
router.post('/rent/:listingId', async (req, res) => {
    try {
        const { listingId } = req.params;
        const { rentalDays } = req.body;

        if (!rentalDays) {
            return res.status(400).json({ error: 'Rental days required' });
        }

        const tx = await contract.rentNFT(listingId, rentalDays);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'NFT rented successfully',
            rentalId: receipt.logs[0]?.topics[1]
        });
    } catch (error) {
        console.error('Error renting NFT:', error);
        res.status(500).json({
            error: error.message || 'Error renting NFT',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-rental/return/:rentalId
 * @desc    Return a rented NFT
 */
router.post('/return/:rentalId', async (req, res) => {
    try {
        const { rentalId } = req.params;

        const tx = await contract.returnNFT(rentalId);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'NFT returned successfully'
        });
    } catch (error) {
        console.error('Error returning NFT:', error);
        res.status(500).json({
            error: error.message || 'Error returning NFT',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-rental/cancel/:listingId
 * @desc    Cancel a listing
 */
router.post('/cancel/:listingId', async (req, res) => {
    try {
        const { listingId } = req.params;

        const tx = await contract.cancelListing(listingId);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Listing cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling listing:', error);
        res.status(500).json({
            error: error.message || 'Error cancelling listing',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   GET /api/nft-rental/listings/:owner
 * @desc    Get listings by owner
 */
router.get('/listings/:owner', async (req, res) => {
    try {
        const { owner } = req.params;

        const listings = await contract.getOwnerListings(owner);

        res.json({
            success: true,
            listings: listings.map(listing => ({
                nftContract: listing.nftContract,
                tokenId: listing.tokenId.toString(),
                owner: listing.owner,
                pricePerDay: ethers.formatUnits(listing.pricePerDay, 18),
                minRentalDays: listing.minRentalDays.toString(),
                maxRentalDays: listing.maxRentalDays.toString(),
                collateralAmount: ethers.formatUnits(listing.collateralAmount, 18),
                isActive: listing.isActive
            }))
        });
    } catch (error) {
        console.error('Error getting listings:', error);
        res.status(500).json({
            error: error.message || 'Error getting listings'
        });
    }
});

/**
 * @route   GET /api/nft-rental/rentals/:renter
 * @desc    Get rental agreements by renter
 */
router.get('/rentals/:renter', async (req, res) => {
    try {
        const { renter } = req.params;

        const rentals = await contract.getRenterAgreements(renter);

        res.json({
            success: true,
            rentals: rentals.map(rental => ({
                listingId: rental.listingId,
                renter: rental.renter,
                rentalStart: rental.rentalStart.toString(),
                rentalEnd: rental.rentalEnd.toString(),
                totalPrice: ethers.formatUnits(rental.totalPrice, 18),
                collateralPaid: ethers.formatUnits(rental.collateralPaid, 18),
                isActive: rental.isActive,
                isReturned: rental.isReturned
            }))
        });
    } catch (error) {
        console.error('Error getting rentals:', error);
        res.status(500).json({
            error: error.message || 'Error getting rentals'
        });
    }
});

/**
 * @route   POST /api/nft-rental/claim-overdue/:rentalId
 * @desc    Claim an overdue NFT (owner only)
 */
router.post('/claim-overdue/:rentalId', async (req, res) => {
    try {
        const { rentalId } = req.params;

        const tx = await contract.claimOverdueNFT(rentalId);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Overdue NFT claimed successfully'
        });
    } catch (error) {
        console.error('Error claiming overdue NFT:', error);
        res.status(500).json({
            error: error.message || 'Error claiming overdue NFT',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   POST /api/nft-rental/update-price/:listingId
 * @desc    Update listing price
 * @body    { newPricePerDay }
 */
router.post('/update-price/:listingId', async (req, res) => {
    try {
        const { listingId } = req.params;
        const { newPricePerDay } = req.body;

        if (!newPricePerDay) {
            return res.status(400).json({ error: 'New price required' });
        }

        const priceWei = ethers.parseUnits(newPricePerDay.toString(), 18);

        const tx = await contract.updateListingPrice(listingId, priceWei);
        const receipt = await tx.wait();

        res.json({
            success: true,
            txHash: receipt.hash,
            message: 'Price updated successfully'
        });
    } catch (error) {
        console.error('Error updating price:', error);
        res.status(500).json({
            error: error.message || 'Error updating price',
            details: error.reason || error.code
        });
    }
});

/**
 * @route   GET /api/nft-rental/config
 * @desc    Get contract configuration
 */
router.get('/config', async (req, res) => {
    try {
        const paymentToken = await contract.paymentToken();
        const feeRecipient = await contract.feeRecipient();
        const protocolFee = await contract.protocolFee();

        res.json({
            success: true,
            config: {
                contractAddress,
                paymentToken,
                feeRecipient,
                protocolFee: (Number(protocolFee) / 100).toString() + '%'
            }
        });
    } catch (error) {
        console.error('Error getting config:', error);
        res.status(500).json({
            error: error.message || 'Error getting config'
        });
    }
});

module.exports = router;
