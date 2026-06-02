const mongoose = require('mongoose');

const outreachSchema = new mongoose.Schema({
    channel: {
        type: String,
        enum: ['email', 'whatsapp', 'linkedin', 'telegram'],
        default: 'email'
    },
    subject: String,
    message: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'needs_approval', 'approved', 'sent', 'blocked', 'failed'],
        default: 'needs_approval',
        index: true
    },
    approvedBy: String,
    approvedAt: Date,
    sentAt: Date,
    providerMessageId: String,
    error: String
}, { _id: false, timestamps: true });

const b2bLeadSchema = new mongoose.Schema({
    campaignId: {
        type: String,
        required: true,
        index: true
    },
    sector: {
        type: String,
        required: true,
        index: true
    },
    companyName: {
        type: String,
        required: true,
        trim: true
    },
    url: String,
    type: {
        type: String,
        enum: ['B2B', 'B2G', 'Unknown'],
        default: 'B2B'
    },
    contactEmail: {
        type: String,
        trim: true,
        lowercase: true
    },
    whatsappNumber: String,
    linkedinProfile: String,
    score: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
        index: true
    },
    scoreReasons: [String],
    status: {
        type: String,
        enum: ['new', 'needs_approval', 'approved', 'sent', 'replied', 'qualified', 'disqualified', 'blocked', 'failed'],
        default: 'needs_approval',
        index: true
    },
    source: {
        type: String,
        default: 'openclaw'
    },
    outreach: outreachSchema,
    metadata: mongoose.Schema.Types.Mixed
}, { timestamps: true });

b2bLeadSchema.index({ contactEmail: 1, campaignId: 1 });
b2bLeadSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('B2BLead', b2bLeadSchema);
