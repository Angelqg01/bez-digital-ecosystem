const express = require('express');
const { generateNonce, SiweMessage } = require('siwe');
const db = require('../db/pool');

const router = express.Router();

router.get('/nonce', async (req, res) => {
    const nonce = generateNonce();
    // Assuming express-session is used
    if(!req.session) req.session = {};
    req.session.nonce = nonce;
    res.json({ nonce });
});

router.post('/verify', async (req, res) => {
    try {
        const { message, signature } = req.body;
        const siweMessage = new SiweMessage(message);
        const { data: fields } = await siweMessage.verify({ signature });

        if (fields.nonce !== req.session.nonce) {
            return res.status(422).json({ message: 'Invalid nonce.' });
        }

        // Upsert user
        let userResult = await db.query('SELECT * FROM users WHERE wallet_address = $1', [fields.address]);
        if (userResult.rows.length === 0) {
            userResult = await db.query(
                'INSERT INTO users (wallet_address) VALUES ($1) RETURNING *',
                [fields.address]
            );
        }
        const user = userResult.rows[0];

        req.session.siwe = fields;
        req.session.userId = user.id;
        if (fields.expirationTime) {
            req.session.cookie.expires = new Date(fields.expirationTime);
        }
        req.session.save(() => res.status(200).send(true));
    } catch (e) {
        req.session.siwe = null;
        req.session.nonce = null;
        if (e.name === 'Error') {
             return res.status(422).json({ message: e.message });
        }
        res.status(500).json({ message: e.message });
    }
});

module.exports = router;
