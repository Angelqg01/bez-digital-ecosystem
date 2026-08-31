const mongoose = require('mongoose');

const adBalanceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    walletAddress: {
        type: String,
        required: true,
        unique: true
    },
    fiatBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    bezBalance: {
        type: Number,
        default: 0,
        min: 0
    },
    totalDeposited: {
        type: Number,
        default: 0
    },
    totalSpent: {
        type: Number,
        default: 0
    },
    totalRefunded: {
        type: Number,
        default: 0
    },
    pendingCharges: {
        type: Number,
        default: 0
    },
    lastDepositAt: Date,
    lastChargeAt: Date,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Índices
adBalanceSchema.index({ walletAddress: 1 });
adBalanceSchema.index({ userId: 1 });

// Método para verificar si tiene suficiente saldo
adBalanceSchema.methods.hasSufficientBalance = function (amountEur) {
    const totalAvailable = this.fiatBalance + this.bezBalance;
    return totalAvailable >= amountEur;
};

// Método para deducir saldo (prioriza FIAT primero)
adBalanceSchema.methods.deductBalance = function (amountEur) {
    let remaining = amountEur;

    // Primero usar saldo FIAT
    if (this.fiatBalance >= remaining) {
        this.fiatBalance -= remaining;
        remaining = 0;
    } else {
        remaining -= this.fiatBalance;
        this.fiatBalance = 0;
    }

    // Luego usar saldo BEZ
    if (remaining > 0 && this.bezBalance >= remaining) {
        this.bezBalance -= remaining;
        remaining = 0;
    }

    this.totalSpent += amountEur;
    this.lastChargeAt = new Date();
    this.updatedAt = new Date();

    return remaining === 0;
};

module.exports = mongoose.model('AdBalance', adBalanceSchema);
