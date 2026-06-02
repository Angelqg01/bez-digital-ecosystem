const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { addContactSyncJob } = require('../services/queue.service');
const User = require('../models/user.model');
const { protect } = require('../middleware/auth.middleware');

const syncRules = () => {
  return [
    body('contacts', 'Contacts must be a non-empty array').isArray({ min: 1 }),
    body('contacts.*.name').optional().isString().trim().escape(),
    body('contacts.*.email').optional().isEmail().normalizeEmail(),
    body('contacts.*.phone').optional().isString().trim().escape(),
    // Custom validation to ensure each contact has at least an email or a phone
    body('contacts.*').custom((value) => {
      if (!value.email && !value.phone) {
        throw new Error('Each contact must have at least an email or a phone number.');
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

module.exports = router;
