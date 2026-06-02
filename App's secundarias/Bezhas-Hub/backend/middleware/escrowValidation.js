const { z } = require('zod');
const rateLimit = require('express-rate-limit');

// 1. Validation Schema (Zod)
const createServiceSchema = z.object({
    clientWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum Address"),
    amount: z.string().regex(/^\d+$/, "Amount must be a string number (wei)"), // Handle BigInt as string
    initialQuality: z.number().min(1).max(100)
});

const validateCreateService = (req, res, next) => {
    try {
        createServiceSchema.parse(req.body);
        next();
    } catch (error) {
        return res.status(400).json({ error: 'Validation Error', details: error.errors });
    }
};

// 2. Rate Limiter (Security)
const escrowLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: "Too many service creation requests, please try again later."
});

module.exports = { validateCreateService, escrowLimiter };
