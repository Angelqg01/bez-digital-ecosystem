const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { addContactSyncJob } = require('../services/queue.service');
const User = require('../models/user.model');
const Contact = require('../models/contact.model');
const { protect } = require('../middleware/auth.middleware');

const syncRules = () => {
  return [
    body('contacts', 'Contacts must be a non-empty array').isArray({ min: 1 }),
    body('contacts.*.name').optional().isString().trim().escape(),
    body('contacts.*.emailHash').optional().isString().trim().escape(),
    body('contacts.*.phoneHash').optional().isString().trim().escape(),
    body('contacts.*.encryptedData').optional().isString().trim(),
    body('contacts.*').custom((value) => {
      if (!value.emailHash && !value.phoneHash) {
        throw new Error('Each contact must have at least an emailHash or a phoneHash.');
      }
      return true;
    }),
  ];
};

/**
 * @route   POST /api/contacts/sync
 * @desc    Accepts a list of contacts and adds a job to the queue for background processing.
 * @access  Private
 */
router.post('/sync', protect, syncRules(), async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { contacts } = req.body;
    const userId = req.user._id;

    try {
        await addContactSyncJob(userId, contacts);
        res.status(202).json({ message: 'Contact synchronization has been queued and will be processed in the background.' });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to add contact sync job to the queue');
        res.status(500).json({ error: 'Failed to queue contact synchronization.' });
    }
});

/**
 * @route   GET /api/contacts/matches
 * @desc    Get current user's matched contacts
 * @access  Private
 */
router.get('/matches', protect, async (req, res) => {
    try {
        const matches = await Contact.find({ 
            ownerId: req.user._id, 
            status: 'is_user',
            matchedUserId: { $exists: true } 
        }).populate('matchedUserId', 'username profileImage isVerified');
        
        res.json({ matches });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to fetch contact matches');
        res.status(500).json({ error: 'Failed to fetch contact matches' });
    }
});

/**
 * @route   POST /api/contacts/:id/add-friend
 * @desc    Add a matched contact as a friend and earn 50 BEZ-Coins
 * @access  Private
 */
router.post('/:id/add-friend', protect, async (req, res) => {
    try {
        const contactId = req.params.id;
        
        // Ensure the contact belongs to the user and is a match
        const contact = await Contact.findOne({ _id: contactId, ownerId: req.user._id, status: 'is_user' });
        if (!contact) {
             return res.status(404).json({ error: 'Matched contact not found' });
        }

        // TODO: Actually create the Friend relation in a Social/Friend model here based on existing system structure

        // Update the contact status so the reward cannot be claimed twice
        contact.status = 'invited'; // Using 'invited' to signify the connection request was sent
        await contact.save();

        // Distribute 50 BEZ-Coin Reward
        const BEZCoinTransaction = require('../models/BEZCoinTransaction.model'); // Adjust path if needed
        const user = await User.findById(req.user._id);
        
        if (user && BEZCoinTransaction) {
            // Create a reward transaction
            await BEZCoinTransaction.create({
                userId: user._id,
                amount: 50,
                type: 'EARN',
                status: 'COMPLETED',
                description: 'Friend Discovery Reward',
                referenceId: contactId
            });
            // NOTE: In a robust setup, there is likely a User Wallet/Balance field that should also be updated.
            // Mocking the behavior based on assumed BEZCoin structure.
        }

        res.json({ message: 'Friend request sent and 50 BEZ-Coins rewarded successfully!' });
    } catch (error) {
        req.log.error({ err: error }, 'Failed to add friend from contacts');
        res.status(500).json({ error: 'Failed to add friend' });
    }
});

module.exports = router;
