/**
 * Validation Model - Para persistir validaciones del Quality Oracle
 * Almacena validaciones de contenido en blockchain
 * 
 * Supports both MongoDB (production) and in-memory storage (development)
 */

let mongoose;
let ValidationSchema;
let MongooseValidation;
let useMongoose = false;

try {
    mongoose = require('mongoose');

    // Only use Mongoose if we have a connection
    if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
        useMongoose = true;

        ValidationSchema = new mongoose.Schema({
            contentHash: { type: String, required: true, index: true },
            authorAddress: { type: String, required: true, index: true },
            transactionHash: { type: String, sparse: true },
            blockNumber: { type: Number },
            paymentMethod: { type: String, enum: ['crypto', 'fiat'], default: 'crypto' },
            paymentSessionId: { type: String },
            paymentAmount: { type: Number },
            paymentCurrency: { type: String },
            status: {
                type: String,
                enum: ['pending', 'confirmed', 'failed', 'processing'],
                default: 'pending',
                index: true
            },
            validationType: { type: String, enum: ['post', 'comment', 'content', 'document'], default: 'post' },
            validatedBy: { type: String }, // 'backend-direct' | 'queue-worker' | 'oracle'
            metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
            gasUsed: { type: String },
            confirmedAt: { type: Date },
            errorMessage: { type: String }
        }, {
            timestamps: true // Adds createdAt and updatedAt automatically
        });

        // Compound indexes for common queries
        ValidationSchema.index({ authorAddress: 1, status: 1 });
        ValidationSchema.index({ contentHash: 1, status: 1 });
        ValidationSchema.index({ createdAt: -1 });

        MongooseValidation = mongoose.models.Validation || mongoose.model('Validation', ValidationSchema);
    }
} catch (error) {
    console.warn('Mongoose not available, using in-memory storage for validations');
}

// Fallback to in-memory database
const db = require('../database/inMemoryDB');

/**
 * Validation class - Hybrid model that uses MongoDB when available
 */
class Validation {
    constructor(validationData) {
        const defaults = {
            _id: null,
            contentHash: '',
            authorAddress: '',
            transactionHash: '',
            blockNumber: null,
            paymentMethod: 'crypto', // 'crypto' | 'fiat'
            paymentSessionId: null,
            paymentAmount: null,
            paymentCurrency: null,
            status: 'pending', // 'pending' | 'confirmed' | 'failed'
            validationType: 'post', // 'post' | 'comment' | 'content'
            validatedBy: null,
            metadata: {},
            gasUsed: null,
            confirmedAt: null,
            errorMessage: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        Object.assign(this, defaults, validationData);
    }

    /**
     * Create a new validation - uses MongoDB if available
     */
    static async create(validationData) {
        // Try MongoDB first
        if (useMongoose && MongooseValidation) {
            try {
                const doc = await MongooseValidation.create(validationData);
                return doc.toObject();
            } catch (mongoError) {
                console.error('MongoDB create failed, falling back to memory:', mongoError.message);
            }
        }

        // Fallback to in-memory
        const validation = new Validation(validationData);
        return validation.save();
    }

    async save() {
        this.updatedAt = new Date().toISOString();

        if (this._id) {
            // Update existing validation in memory
            const existing = db.validations.get(this._id);
            if (existing) {
                const updated = { ...existing, ...this };
                db.validations.set(this._id, updated);
                return updated;
            }
        }

        // Create new validation in memory
        const id = this._id || `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this._id = id;
        db.validations.set(id, this);
        return this;
    }

    static async findOne(query) {
        // Try MongoDB first
        if (useMongoose && MongooseValidation) {
            try {
                const doc = await MongooseValidation.findOne(query).lean();
                if (doc) return doc;
            } catch (err) {
                console.warn('MongoDB findOne failed, using memory:', err.message);
            }
        }

        // Fallback to in-memory
        for (const validation of db.validations.values()) {
            let match = true;
            for (const key in query) {
                if (validation[key] !== query[key]) {
                    match = false;
                    break;
                }
            }
            if (match) return validation;
        }
        return null;
    }

    static async findById(id) {
        // Try MongoDB first
        if (useMongoose && MongooseValidation) {
            try {
                const doc = await MongooseValidation.findById(id).lean();
                if (doc) return doc;
            } catch (err) {
                // ID might be in-memory format, continue
            }
        }

        return db.validations.get(id) || null;
    }

    static async find(query = {}, options = {}) {
        // Try MongoDB first
        if (useMongoose && MongooseValidation) {
            try {
                let mongoQuery = MongooseValidation.find(query);
                if (options.sort) mongoQuery = mongoQuery.sort(options.sort);
                if (options.limit) mongoQuery = mongoQuery.limit(options.limit);
                if (options.skip) mongoQuery = mongoQuery.skip(options.skip);
                const docs = await mongoQuery.lean();
                return docs;
            } catch (err) {
                console.warn('MongoDB find failed, using memory:', err.message);
            }
        }

        // Fallback to in-memory
        let validations = Array.from(db.validations.values());

        // Filter by query
        if (Object.keys(query).length > 0) {
            validations = validations.filter(validation => {
                for (const key in query) {
                    if (validation[key] !== query[key]) return false;
                }
                return true;
            });
        }

        // Sort
        if (options.sort) {
            const sortKey = Object.keys(options.sort)[0];
            const sortOrder = options.sort[sortKey];
            validations.sort((a, b) => {
                if (a[sortKey] < b[sortKey]) return sortOrder === 1 ? -1 : 1;
                if (a[sortKey] > b[sortKey]) return sortOrder === 1 ? 1 : -1;
                return 0;
            });
        }

        // Skip
        if (options.skip) {
            validations = validations.slice(options.skip);
        }

        // Limit
        if (options.limit) {
            validations = validations.slice(0, options.limit);
        }

        return validations;
    }

    static async findByAuthor(authorAddress, options = {}) {
        return this.find({ authorAddress }, options);
    }

    static async findByStatus(status, options = {}) {
        return this.find({ status }, options);
    }

    static async updateStatus(id, status, additionalData = {}) {
        // Try MongoDB first
        if (useMongoose && MongooseValidation) {
            try {
                const doc = await MongooseValidation.findByIdAndUpdate(
                    id,
                    { status, ...additionalData, updatedAt: new Date() },
                    { new: true }
                ).lean();
                if (doc) return doc;
            } catch (err) {
                // ID might be in-memory format, continue
            }
        }

        // Fallback to in-memory
        const validation = db.validations.get(id);
        if (validation) {
            validation.status = status;
            validation.updatedAt = new Date().toISOString();
            Object.assign(validation, additionalData);
            db.validations.set(id, validation);
            return validation;
        }
        return null;
    }

    static async countDocuments(query = {}) {
        // Try MongoDB first
        if (useMongoose && MongooseValidation) {
            try {
                return await MongooseValidation.countDocuments(query);
            } catch (err) {
                console.warn('MongoDB countDocuments failed, using memory:', err.message);
            }
        }

        // Fallback to in-memory
        const validations = await this.find(query);
        return validations.length;
    }

    static async deleteOne(query) {
        // Try MongoDB first
        if (useMongoose && MongooseValidation) {
            try {
                const result = await MongooseValidation.deleteOne(query);
                if (result.deletedCount > 0) return result;
            } catch (err) {
                console.warn('MongoDB deleteOne failed, using memory:', err.message);
            }
        }

        // Fallback to in-memory
        const validation = await this.findOne(query);
        if (validation) {
            db.validations.delete(validation._id);
            return { deletedCount: 1 };
        }
        return { deletedCount: 0 };
    }

    static async deleteMany(query = {}) {
        // Try MongoDB first
        if (useMongoose && MongooseValidation) {
            try {
                return await MongooseValidation.deleteMany(query);
            } catch (err) {
                console.warn('MongoDB deleteMany failed, using memory:', err.message);
            }
        }

        // Fallback to in-memory
        const validations = await this.find(query);
        let deletedCount = 0;
        for (const validation of validations) {
            db.validations.delete(validation._id);
            deletedCount++;
        }
        return { deletedCount };
    }

    // Get the Mongoose model for direct access when needed
    static getMongooseModel() {
        return MongooseValidation;
    }

    // Check if using MongoDB
    static isUsingMongoDB() {
        return useMongoose && MongooseValidation !== null;
    }
}

module.exports = Validation;
