const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { addContactSyncJob } = require('../services/queue.service');
const Contact = require('../models/pg/Contact');
const BEZCoinTransaction = require('../models/pg/BEZCoinTransaction');

// Recompensa por descubrir un amigo (se paga una sola vez por contacto: ver Contact.claimInvite).
const FRIEND_REWARD_BEZ = 50;
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
        const matches = await Contact.findMatches(req.user._id);
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
    const contactId = req.params.id;
    if (!Contact.isValidId(contactId)) return res.status(404).json({ error: 'Matched contact not found' });

    // El libro de BEZ-Coin exige wallet (wallet_address NOT NULL): sin ella no hay dónde anotar la recompensa.
    const walletAddress = req.user.walletAddress || req.user.wallet_address;
    if (!walletAddress) return res.status(409).json({ error: 'Link a wallet to claim the reward', code: 'WALLET_REQUIRED' });

    let contact = null;
    try {
        // Reclamo ATÓMICO: sólo una petición pasa de is_user a invited, así que la recompensa no se cobra dos veces.
        contact = await Contact.claimInvite(contactId, req.user._id);
        if (!contact) return res.status(404).json({ error: 'Matched contact not found' });

        // TODO: crear aquí la relación de amistad en el modelo social cuando exista.

        await BEZCoinTransaction.create({
            userId: req.user._id,
            walletAddress,
            type: 'EARN',
            amount: FRIEND_REWARD_BEZ,
            currency: 'BEZ',
            status: 'completed',
            metadata: { reason: 'friend_discovery_reward', contactId },
        });

        res.json({ message: `Friend request sent and ${FRIEND_REWARD_BEZ} BEZ-Coins rewarded successfully!` });
    } catch (error) {
        // Si falló el pago de la recompensa, el contacto vuelve a poder reclamarse.
        if (contact) await Contact.releaseInvite(contactId, req.user._id).catch(() => {});
        req.log.error({ err: error }, 'Failed to add friend from contacts');
        res.status(500).json({ error: 'Failed to add friend' });
    }
});

module.exports = router;
