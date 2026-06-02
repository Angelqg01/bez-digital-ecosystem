const mongoose = require('mongoose');

const ShareSchema = new mongoose.Schema({
    postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    platform: {
        type: String,
        required: true,
        enum: ['twitter', 'facebook', 'linkedin', 'whatsapp', 'telegram', 'reddit', 'email', 'discord', 'copy', 'native'],
        index: true
    },
    url: {
        type: String,
        required: false
    },
    comment: {
        type: String,
        maxlength: 500,
        default: ''
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    ipAddress: {
        type: String,
        required: false
    },
    userAgent: {
        type: String,
        required: false
    },
    // Metadatos adicionales
    metadata: {
        hashtags: [String],
        mentions: [String],
        location: String
    },
    // Tracking
    clicks: {
        type: Number,
        default: 0
    },
    reach: {
        type: Number,
        default: 0
    },
    engagement: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Índices compuestos para queries comunes
ShareSchema.index({ userId: 1, timestamp: -1 });
ShareSchema.index({ postId: 1, platform: 1 });
ShareSchema.index({ platform: 1, timestamp: -1 });

// Índice TTL para eliminar shares antiguos después de 1 año
ShareSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

// Métodos estáticos
ShareSchema.statics.getShareStats = async function (postId) {
    const total = await this.countDocuments({ postId });

    const byPlatform = await this.aggregate([
        { $match: { postId: mongoose.Types.ObjectId(postId) } },
        {
            $group: {
                _id: '$platform',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    return {
        total,
        byPlatform: byPlatform.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
        }, {})
    };
};

ShareSchema.statics.getTrendingShares = async function (limit = 10) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return await this.aggregate([
        { $match: { timestamp: { $gte: last24h } } },
        {
            $group: {
                _id: '$postId',
                shareCount: { $sum: 1 },
                platforms: { $addToSet: '$platform' }
            }
        },
        { $sort: { shareCount: -1 } },
        { $limit: limit }
    ]);
};

ShareSchema.statics.getUserShareLimit = async function (userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayShares = await this.countDocuments({
        userId,
        timestamp: { $gte: today }
    });

    return {
        used: todayShares,
        limit: 20,
        remaining: Math.max(0, 20 - todayShares),
        canShare: todayShares < 20
    };
};

// Métodos de instancia
ShareSchema.methods.incrementEngagement = async function () {
    this.engagement += 1;
    return await this.save();
};

// Pre-save middleware
ShareSchema.pre('save', function (next) {
    // Calcular reach estimado basado en la plataforma
    const reachMultipliers = {
        twitter: 100,
        facebook: 150,
        linkedin: 75,
        whatsapp: 50,
        telegram: 40,
        reddit: 200,
        email: 10,
        discord: 30,
        copy: 5,
        native: 25
    };

    this.reach = reachMultipliers[this.platform] || 10;
    next();
});

// Virtual para calcular engagement rate
ShareSchema.virtual('engagementRate').get(function () {
    return this.reach > 0 ? (this.engagement / this.reach) * 100 : 0;
});

// Asegurar que los virtuals se incluyan en JSON
ShareSchema.set('toJSON', { virtuals: true });
ShareSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Share', ShareSchema);
