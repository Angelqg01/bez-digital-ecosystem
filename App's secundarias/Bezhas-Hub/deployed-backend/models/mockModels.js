/**
 * Mock models that use the in-memory database
 * These replace the Mongoose models for development
 */

const db = require('../database/inMemoryDB');

// User Roles Enum
const UserRole = {
    USER: 'USER',
    CERTIFIED_USER: 'CERTIFIED_USER',
    EDITOR: 'EDITOR',
    MODERATOR: 'MODERATOR',
    DEVELOPER: 'DEVELOPER',
    ADMIN: 'ADMIN'
};

// Subscription Tiers Enum
const SubscriptionTier = {
    FREE: 'FREE',
    PREMIUM: 'PREMIUM',
    VIP: 'VIP'
};

// User Model
class User {
    constructor(userData) {
        // Set default values for new fields
        const defaults = {
            role: UserRole.USER,
            subscription: SubscriptionTier.FREE,
            isVerified: false,
            isBanned: false,
            isVendor: false,
            interests: [],
            firstName: '',
            lastName: '',
            bio: '',
            email: '',
            avatarUrl: '',
            coverUrl: '',
            vendorProfile: null,
            // OAuth provider IDs
            googleId: null,
            facebookId: null,
            twitterId: null,
            githubId: null,
            // VIP/Subscription fields
            vipTier: null, // 'bronze' | 'silver' | 'gold' | 'platinum' | null
            vipStatus: 'inactive', // 'active' | 'inactive' | 'expired' | 'cancelled'
            vipStartDate: null,
            vipEndDate: null,
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            vipFeatures: {
                adFree: false,
                prioritySupport: false,
                customBadge: false,
                analyticsAccess: false,
                apiAccess: false,
                unlimitedPosts: false
            },
            // 2FA (Two-Factor Authentication) fields
            twoFactorAuth: {
                // TOTP (Time-based One-Time Password)
                totp: {
                    enabled: false,
                    secret: null, // Encrypted TOTP secret
                    backupCodes: [], // One-time use recovery codes
                    enabledAt: null,
                },
                // WebAuthn / Passkeys
                webauthn: {
                    enabled: false,
                    credentials: [], // Array of registered passkeys
                    enabledAt: null,
                },
                // General 2FA settings
                preferredMethod: null, // 'totp' | 'webauthn' | null
                lastVerifiedAt: null,
                trustedDevices: [], // Device IDs that don't require 2FA
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        Object.assign(this, defaults, userData);
    }

    static async findOne(query) {
        // Búsqueda genérica por cualquier campo
        for (const user of db.users.values()) {
            let match = true;
            for (const key in query) {
                if (user[key] !== query[key]) {
                    match = false;
                    break;
                }
            }
            if (match) return user;
        }
        return null;
    }

    static async findById(id) {
        return db.findUserById(id);
    }

    static async find(query = {}) {
        const users = Array.from(db.users.values());
        if (Object.keys(query).length === 0) {
            return users;
        }
        return users.filter(user => {
            for (const key in query) {
                if (user[key] !== query[key]) return false;
            }
            return true;
        });
    }

    static async findOneAndUpdate(query, update) {
        const user = await this.findOne(query);
        if (user) {
            Object.assign(user, update, { updatedAt: new Date().toISOString() });
            return db.updateUser(user._id, user);
        }
        return null;
    }

    async save() {
        this.updatedAt = new Date().toISOString();
        if (this._id) {
            return db.updateUser(this._id, this);
        } else {
            return db.createUser(this);
        }
    }
}

// Contact Model
class Contact {
    constructor(contactData) {
        Object.assign(this, contactData);
    }

    async save() {
        return db.createContact(this);
    }

    static async find(query) {
        return db.find('contacts', query);
    }
}

// AffiliateEvent Model
class AffiliateEvent {
    constructor(eventData) {
        Object.assign(this, eventData);
    }

    async save() {
        if (this._id) {
            // Update existing
            const existing = db.affiliateEvents.get(this._id);
            if (existing) {
                const updated = { ...existing, ...this };
                db.affiliateEvents.set(this._id, updated);
                return updated;
            }
        }
        return db.createAffiliateEvent(this);
    }

    static async countDocuments(filter) {
        return db.countAffiliateEvents(filter);
    }

    static async find(filter) {
        return db.findAffiliateEventsByReferrer(filter.referrerId, filter);
    }
}

// Post Model (for future use if needed)
class Post {
    constructor(postData) {
        Object.assign(this, postData);
    }

    async save() {
        return db.createPost(this);
    }

    static async find(query = {}) {
        return db.find('posts', query);
    }

    static async findById(id) {
        return db.findPostById(id);
    }
}

// Product Model (for Marketplace)
class Product {
    constructor(productData) {
        Object.assign(this, productData);
    }

    static async create(data) {
        const product = new Product(data);
        // Simulate DB creation
        product._id = 'prod_' + Date.now();
        db.marketplaceListings.set(product._id, product);
        return product;
    }

    static async findOneAndUpdate(query, update) {
        // Simple query matching
        for (const product of db.marketplaceListings.values()) {
            let match = true;
            for (const key in query) {
                if (product[key] !== query[key]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                Object.assign(product, update);
                db.marketplaceListings.set(product._id, product);
                return product;
            }
        }
        return null;
    }
}

module.exports = {
    User,
    Contact,
    AffiliateEvent,
    Post,
    Product,
    UserRole,
    SubscriptionTier
};