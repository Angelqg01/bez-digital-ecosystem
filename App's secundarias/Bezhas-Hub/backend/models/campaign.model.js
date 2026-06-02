const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    advertiserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    advertiserWallet: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    objective: {
        type: String,
        enum: ['clicks', 'impressions', 'conversions', 'video-views', 'engagement'],
        required: true
    },
    creative: {
        title: {
            type: String,
            required: true,
            maxlength: 100
        },
        description: {
            type: String,
            required: true,
            maxlength: 300
        },
        imageUrl: {
            type: String,
            required: true
        },
        videoUrl: String,
        destinationUrl: {
            type: String,
            required: true
        },
        callToAction: {
            type: String,
            enum: ['learn-more', 'shop-now', 'sign-up', 'download', 'get-started', 'join-now'],
            default: 'learn-more'
        }
    },
    targeting: {
        keywords: [String],
        locations: [String],
        demographics: {
            ageRange: {
                min: {
                    type: Number,
                    min: 13,
                    max: 100
                },
                max: {
                    type: Number,
                    min: 13,
                    max: 100
                }
            },
            genders: [{
                type: String,
                enum: ['male', 'female', 'other', 'all']
            }],
            interests: [String]
        },
        deviceTypes: [{
            type: String,
            enum: ['desktop', 'mobile', 'tablet', 'all']
        }],
        languages: [String],
        platforms: [{
            type: String,
            enum: ['web', 'mobile-app', 'both']
        }],
        contentCategories: [String]
    },
    budget: {
        dailyBudget: {
            type: Number,
            required: true,
            min: 5
        },
        totalBudget: {
            type: Number,
            required: true,
            min: 10
        },
        bidAmount: {
            type: Number,
            required: true,
            min: 0.01
        },
        bidStrategy: {
            type: String,
            enum: ['manual', 'automatic', 'target-cpa'],
            default: 'manual'
        },
        currency: {
            type: String,
            enum: ['EUR', 'BEZ'],
            default: 'EUR'
        }
    },
    schedule: {
        startDate: {
            type: Date,
            required: true
        },
        endDate: Date,
        timeRanges: [{
            dayOfWeek: {
                type: Number,
                min: 0,
                max: 6
            },
            startHour: {
                type: Number,
                min: 0,
                max: 23
            },
            endHour: {
                type: Number,
                min: 0,
                max: 23
            }
        }],
        timezone: {
            type: String,
            default: 'UTC'
        }
    },
    status: {
        type: String,
        enum: ['draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'rejected', 'suspended'],
        default: 'draft'
    },
    rejectionReason: String,
    suspensionReason: String,
    metrics: {
        impressions: {
            type: Number,
            default: 0
        },
        clicks: {
            type: Number,
            default: 0
        },
        spent: {
            type: Number,
            default: 0
        },
        conversions: {
            type: Number,
            default: 0
        },
        videoViews: {
            type: Number,
            default: 0
        },
        engagement: {
            type: Number,
            default: 0
        }
    },
    performance: {
        ctr: {
            type: Number,
            default: 0
        },
        cpc: {
            type: Number,
            default: 0
        },
        cpm: {
            type: Number,
            default: 0
        },
        conversionRate: {
            type: Number,
            default: 0
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    approvedAt: Date,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastActiveAt: Date
});

// Índices para búsquedas eficientes
campaignSchema.index({ advertiserId: 1, status: 1 });
campaignSchema.index({ advertiserWallet: 1 });
campaignSchema.index({ 'targeting.keywords': 1, status: 1 });
campaignSchema.index({ status: 1, 'schedule.startDate': 1 });
campaignSchema.index({ status: 1, createdAt: -1 });

// Middleware para actualizar updatedAt
campaignSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Método para calcular métricas de performance
campaignSchema.methods.calculatePerformance = function () {
    if (this.metrics.impressions > 0) {
        this.performance.ctr = (this.metrics.clicks / this.metrics.impressions * 100);
        this.performance.cpm = (this.metrics.spent / this.metrics.impressions * 1000);
    }

    if (this.metrics.clicks > 0) {
        this.performance.cpc = (this.metrics.spent / this.metrics.clicks);
        this.performance.conversionRate = (this.metrics.conversions / this.metrics.clicks * 100);
    }
};

module.exports = mongoose.model('Campaign', campaignSchema);
