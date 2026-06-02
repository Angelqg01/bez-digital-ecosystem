const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    author: { type: String, required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const postSchema = new mongoose.Schema({
    author: { type: String, required: true },
    content: { type: String, required: true },
    likes: { type: [String], default: [] }, // array of user addresses
    comments: { type: [commentSchema], default: [] },
    image: { type: String, default: '' },
    hidden: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    validated: { type: Boolean, default: false },
    blockchainData: {
        txHash: { type: String, default: null },
        blockNumber: { type: Number, default: null },
        network: { type: String, default: 'polygon' },
        validationScore: { type: Number, default: 0 },
    },
    metadata: {
        title: { type: String, default: '' },
        category: { type: String, default: 'general' },
        tags: { type: [String], default: [] },
        externalLinks: { type: [String], default: [] },
    },
    modifiedAt: { type: Date, default: null },
}, {
    timestamps: true,
});

// Index for efficient querying
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ pinned: -1, createdAt: -1 });
postSchema.index({ hidden: 1 });

module.exports = mongoose.model('Post', postSchema);

