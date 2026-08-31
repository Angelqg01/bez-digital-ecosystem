const mongoose = require('mongoose');

const daoDelegateSchema = new mongoose.Schema({
    delegator: {
        type: String,
        required: true,
        lowercase: true,
    },
    delegate: {
        type: String,
        required: true,
        lowercase: true,
    },
    active: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

// Índices
daoDelegateSchema.index({ delegator: 1, active: 1 });
daoDelegateSchema.index({ delegate: 1, active: 1 });

module.exports = mongoose.model('DAODelegate', daoDelegateSchema);
