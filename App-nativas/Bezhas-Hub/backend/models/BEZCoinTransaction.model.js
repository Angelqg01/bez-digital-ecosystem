const mongoose = require('mongoose');

const bezCoinTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    walletAddress: {
        type: String,
        required: true,
        index: true,
        lowercase: true
    },
    type: {
        type: String,
        enum: ['buy', 'swap', 'stake', 'unstake', 'reward', 'transfer', 'vip_bonus', 'refund'],
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },

    // Información de moneda fiat
    currency: {
        type: String,
        default: 'EUR',
        uppercase: true
    },
    fiatAmount: {
        type: Number,
        min: 0
    },
    exchangeRate: {
        type: Number,
        min: 0
    },

    // Proveedor de pago
    provider: {
        type: String,
        enum: ['moonpay', 'stripe', 'internal', 'wallet', 'vip_bonus'],
        required: true,
        index: true
    },

    // IDs de transacciones externas
    externalTransactionId: {
        type: String,
        sparse: true,
        index: true
    },
    stripePaymentIntentId: {
        type: String,
        sparse: true
    },
    moonpayTransactionId: {
        type: String,
        sparse: true
    },

    // Información blockchain
    blockchain: {
        txHash: {
            type: String,
            sparse: true,
            index: true
        },
        chainId: {
            type: Number,
            default: 80002 // Polygon Amoy Testnet
        },
        blockNumber: Number,
        gasUsed: Number,
        gasFee: Number,
        confirmations: {
            type: Number,
            default: 0
        }
    },

    // Estado de la transacción
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
        default: 'pending',
        index: true
    },

    // Información de stake (si aplica)
    staking: {
        isStaked: {
            type: Boolean,
            default: false
        },
        stakedAmount: {
            type: Number,
            default: 0
        },
        stakingPeriod: {
            type: Number, // días
            default: 0
        },
        stakingStartDate: Date,
        stakingEndDate: Date,
        stakingReward: {
            type: Number,
            default: 0
        },
        autoCompound: {
            type: Boolean,
            default: false
        }
    },

    // Información de swap (si aplica)
    swap: {
        fromToken: String,
        toToken: String,
        fromAmount: Number,
        toAmount: Number,
        slippage: Number,
        dexUsed: String // 'uniswap', 'quickswap', etc.
    },

    // Información de fee
    fees: {
        platformFee: {
            type: Number,
            default: 0
        },
        platformFeePercentage: {
            type: Number,
            default: 0
        },
        paymentProcessorFee: {
            type: Number,
            default: 0
        },
        networkFee: {
            type: Number,
            default: 0
        },
        totalFees: {
            type: Number,
            default: 0
        }
    },

    // VIP Benefits aplicados
    vipDiscount: {
        applied: {
            type: Boolean,
            default: false
        },
        tier: {
            type: String,
            enum: ['bronze', 'silver', 'gold', 'platinum']
        },
        discountPercentage: {
            type: Number,
            default: 0
        },
        discountAmount: {
            type: Number,
            default: 0
        }
    },

    // Metadata adicional
    metadata: {
        userAgent: String,
        ipAddress: String,
        source: {
            type: String,
            enum: ['web', 'mobile', 'api', 'admin'],
            default: 'web'
        },
        referralCode: String,
        campaignId: String,
        notes: String
    },

    // Información de error (si failed)
    error: {
        code: String,
        message: String,
        details: mongoose.Schema.Types.Mixed,
        timestamp: Date
    },

    // Información de refund (si aplica)
    refund: {
        refundedAt: Date,
        refundAmount: Number,
        refundReason: String,
        refundTransactionId: String,
        refundedBy: {
            type: String,
            enum: ['user', 'admin', 'system', 'provider']
        }
    },

    // Timestamps de estados
    statusHistory: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String
    }],

    // Completado
    completedAt: Date,
    processedAt: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Índices compuestos para queries comunes
bezCoinTransactionSchema.index({ walletAddress: 1, type: 1 });
bezCoinTransactionSchema.index({ status: 1, createdAt: -1 });
bezCoinTransactionSchema.index({ provider: 1, status: 1 });
bezCoinTransactionSchema.index({ 'blockchain.txHash': 1 }, { sparse: true });
bezCoinTransactionSchema.index({ externalTransactionId: 1 }, { sparse: true });

// Virtual para net amount (después de fees)
bezCoinTransactionSchema.virtual('netAmount').get(function () {
    return this.amount - (this.fees.totalFees || 0);
});

// Virtual para verificar si está completado
bezCoinTransactionSchema.virtual('isCompleted').get(function () {
    return this.status === 'completed';
});

// Método estático para obtener transacciones por wallet
bezCoinTransactionSchema.statics.getByWallet = async function (walletAddress, options = {}) {
    const query = { walletAddress: walletAddress.toLowerCase() };

    if (options.type) query.type = options.type;
    if (options.status) query.status = options.status;

    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);
};

// Método estático para calcular balance total
bezCoinTransactionSchema.statics.calculateBalance = async function (walletAddress) {
    const transactions = await this.find({
        walletAddress: walletAddress.toLowerCase(),
        status: 'completed'
    });

    let balance = 0;
    transactions.forEach(tx => {
        if (['buy', 'reward', 'vip_bonus'].includes(tx.type)) {
            balance += tx.amount;
        } else if (['transfer', 'swap'].includes(tx.type)) {
            balance -= tx.amount;
        }
    });

    return balance;
};

// Método estático para obtener total comprado
bezCoinTransactionSchema.statics.getTotalPurchased = async function (walletAddress) {
    const result = await this.aggregate([
        {
            $match: {
                walletAddress: walletAddress.toLowerCase(),
                type: 'buy',
                status: 'completed'
            }
        },
        {
            $group: {
                _id: null,
                totalAmount: { $sum: '$amount' },
                totalFiat: { $sum: '$fiatAmount' },
                count: { $sum: 1 }
            }
        }
    ]);

    return result[0] || { totalAmount: 0, totalFiat: 0, count: 0 };
};

// Método para actualizar estado
bezCoinTransactionSchema.methods.updateStatus = function (newStatus, note = '') {
    this.status = newStatus;
    this.statusHistory.push({
        status: newStatus,
        timestamp: new Date(),
        note
    });

    if (newStatus === 'completed') {
        this.completedAt = new Date();
    }
};

// Método para calcular fees totales
bezCoinTransactionSchema.methods.calculateTotalFees = function () {
    const { platformFee, paymentProcessorFee, networkFee } = this.fees;
    this.fees.totalFees = (platformFee || 0) + (paymentProcessorFee || 0) + (networkFee || 0);
    return this.fees.totalFees;
};

// Método para aplicar descuento VIP
bezCoinTransactionSchema.methods.applyVIPDiscount = function (vipTier, discountPercentage) {
    const discountAmount = this.fiatAmount * (discountPercentage / 100);
    this.vipDiscount = {
        applied: true,
        tier: vipTier,
        discountPercentage,
        discountAmount
    };
    this.fiatAmount -= discountAmount;
};

// Hook pre-save para calcular fees totales
bezCoinTransactionSchema.pre('save', function (next) {
    if (this.isModified('fees')) {
        this.calculateTotalFees();
    }
    next();
});

// Método estático para MoonPay webhook processing
bezCoinTransactionSchema.statics.processMoonPayWebhook = async function (webhookData) {
    const { externalTransactionId, status } = webhookData;

    const transaction = await this.findOne({ moonpayTransactionId: externalTransactionId });
    if (!transaction) {
        throw new Error('Transaction not found');
    }

    let newStatus = 'pending';
    if (status === 'completed') newStatus = 'completed';
    else if (status === 'failed') newStatus = 'failed';
    else if (status === 'pending') newStatus = 'processing';

    transaction.updateStatus(newStatus, `MoonPay webhook: ${status}`);
    await transaction.save();

    return transaction;
};

module.exports = mongoose.model('BEZCoinTransaction', bezCoinTransactionSchema);
