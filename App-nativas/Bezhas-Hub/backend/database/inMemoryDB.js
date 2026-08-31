/**
 * In-Memory Database for BeZhas Backend
 * Replaces MongoDB and Redis for development without external dependencies
 */

class InMemoryDatabase {
    constructor() {
        // Users collection
        this.users = new Map();

        // Posts collection (for feed)
        this.posts = new Map();
        this.postIdCounter = 1;

        // Contacts collection
        this.contacts = new Map();
        this.contactIdCounter = 1;

        // Affiliate events collection
        this.affiliateEvents = new Map();
        this.affiliateEventIdCounter = 1;

        // Marketplace listings
        this.marketplaceListings = new Map();
        this.listingIdCounter = 1;

        // Quests and user progress
        this.quests = new Map();
        this.userProgress = new Map(); // userId -> { questId -> progress }

        // Badges and user badges
        this.badges = new Map();
        this.userBadges = new Map(); // userId -> [badgeId, ...]
        this.userStats = new Map(); // userId -> stats object

        // Groups and communities
        this.groups = new Map();
        this.groupMembers = new Map(); // groupId -> [userId, ...]
        this.userGroups = new Map(); // userId -> [groupId, ...]
        this.groupIdCounter = 1;

        // Staking data
        this.stakingPools = new Map();
        this.userStakes = new Map(); // userId -> [stake objects]

        // File uploads
        this.uploads = new Map();
        this.uploadIdCounter = 1;

        // API Keys (Developer Console)
        this.apiKeys = new Map();

        // Validations collection (Quality Oracle)
        this.validations = new Map();

        // VIP Subscriptions
        this.vipSubscriptions = new Map();
        this.vipSubscriptionIdCounter = 1;

        this.initializeDefaultData();
    }

    initializeDefaultData() {
        // Initialize default quests
        const defaultQuests = [
            {
                id: 1,
                title: "First Post",
                description: "Create your first post on BeZhasFeed",
                type: "social",
                requirements: { posts: 1 },
                rewards: { bzh: 10, xp: 50 },
                isActive: true,
                difficulty: "easy"
            },
            {
                id: 2,
                title: "Social Butterfly",
                description: "Like 10 posts from other users",
                type: "social",
                requirements: { likes: 10 },
                rewards: { bzh: 25, xp: 100 },
                isActive: true,
                difficulty: "medium"
            },
            {
                id: 3,
                title: "Community Builder",
                description: "Comment on 5 different posts",
                type: "social",
                requirements: { comments: 5 },
                rewards: { bzh: 15, xp: 75 },
                isActive: true,
                difficulty: "medium"
            }
        ];

        defaultQuests.forEach(quest => this.quests.set(quest.id, quest));

        // Initialize default badges
        const defaultBadges = [
            {
                id: 1,
                name: "Early Adopter",
                description: "One of the first 100 users to join BeZhas",
                icon: "🚀",
                rarity: "legendary",
                requirements: { userNumber: { max: 100 } }
            },
            {
                id: 2,
                name: "Social Starter",
                description: "Created your first post",
                icon: "📝",
                rarity: "common",
                requirements: { posts: 1 }
            },
            {
                id: 3,
                name: "Community Lover",
                description: "Liked 100 posts",
                icon: "❤️",
                rarity: "rare",
                requirements: { likes: 100 }
            }
        ];

        defaultBadges.forEach(badge => this.badges.set(badge.id, badge));

        // Initialize default staking pools
        const defaultStakingPools = [
            {
                id: 1,
                name: "BZH Staking Pool",
                token: "BZH",
                apy: 12.5,
                totalStaked: 1000000,
                minStake: 100,
                lockPeriod: 30,
                isActive: true,
                createdAt: new Date().toISOString()
            }
        ];

        defaultStakingPools.forEach(pool => this.stakingPools.set(pool.id, pool));

        // Initialize default groups
        const defaultGroups = [
            {
                id: 1,
                name: "BeZhas Developers",
                description: "Official group for BeZhas platform developers",
                type: "public",
                category: "technology",
                memberCount: 1,
                createdBy: "dev-user-01",
                createdAt: new Date().toISOString(),
                avatar: "🔧",
                isVerified: true
            }
        ];

        defaultGroups.forEach(group => this.groups.set(group.id, group));
        this.groupMembers.set(1, ["dev-user-01"]);
        this.userGroups.set("dev-user-01", [1]);

        // Usuario administrador temporal
        const bcrypt = require('bcryptjs');
        const tempAdminEmail = 'admin@bezhas.io';
        const tempAdminPassword = 'admin123';
        const tempAdminUsername = 'Admin';
        const tempAdminId = 'admin_01';
        // Hashear la contraseña de forma síncrona para inicialización
        const hashedPassword = bcrypt.hashSync(tempAdminPassword, 10);
        this.users.set(tempAdminId, {
            _id: tempAdminId,
            email: tempAdminEmail,
            password: hashedPassword,
            role: 'admin',
            username: tempAdminUsername,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    // User methods
    createUser(userData) {
        const id = userData._id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const user = {
            _id: id,
            ...userData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.users.set(id, user);
        return user;
    }

    findUserById(id) {
        return this.users.get(id) || null;
    }

    findUserByWallet(walletAddress) {
        for (const user of this.users.values()) {
            if (user.walletAddress && user.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
                return user;
            }
        }
        return null;
    }

    updateUser(id, updateData) {
        const user = this.users.get(id);
        if (!user) return null;

        const updatedUser = {
            ...user,
            ...updateData,
            updatedAt: new Date().toISOString()
        };
        this.users.set(id, updatedUser);
        return updatedUser;
    }

    // Post methods
    createPost(postData) {
        const id = this.postIdCounter++;
        const post = {
            _id: id,
            ...postData,
            likes: postData.likes || [],
            comments: postData.comments || [],
            createdAt: new Date().toISOString()
        };
        this.posts.set(id, post);
        return post;
    }

    getAllPosts() {
        return Array.from(this.posts.values()).sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    findPostById(id) {
        return this.posts.get(parseInt(id)) || null;
    }

    updatePost(id, updateData) {
        const post = this.posts.get(parseInt(id));
        if (!post) return null;

        const updatedPost = { ...post, ...updateData };
        this.posts.set(parseInt(id), updatedPost);
        return updatedPost;
    }

    // Affiliate event methods
    createAffiliateEvent(eventData) {
        const id = this.affiliateEventIdCounter++;
        const event = {
            _id: id,
            ...eventData,
            createdAt: new Date().toISOString()
        };
        this.affiliateEvents.set(id, event);
        return event;
    }

    findAffiliateEventsByReferrer(referrerId, options = {}) {
        const events = Array.from(this.affiliateEvents.values())
            .filter(event => event.referrerId === referrerId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (options.limit || options.skip) {
            const skip = options.skip || 0;
            const limit = options.limit || events.length;
            return events.slice(skip, skip + limit);
        }

        return events;
    }

    countAffiliateEvents(filter) {
        return Array.from(this.affiliateEvents.values())
            .filter(event => {
                for (const [key, value] of Object.entries(filter)) {
                    if (event[key] !== value) return false;
                }
                return true;
            }).length;
    }

    // Contact methods
    createContact(contactData) {
        const id = this.contactIdCounter++;
        const contact = {
            _id: id,
            ...contactData,
            createdAt: new Date().toISOString()
        };
        this.contacts.set(id, contact);
        return contact;
    }

    // Generic query methods for collections
    find(collection, filter = {}) {
        const map = this[collection];
        if (!map) return [];

        return Array.from(map.values()).filter(item => {
            for (const [key, value] of Object.entries(filter)) {
                if (item[key] !== value) return false;
            }
            return true;
        });
    }

    count(collection, filter = {}) {
        return this.find(collection, filter).length;
    }

    // Save data to file (for persistence across restarts)
    async saveToFile() {
        // This could be implemented to save to JSON files if needed
        console.log('In-memory database state saved (placeholder)');
    }

    // Load data from file
    async loadFromFile() {
        // This could be implemented to load from JSON files if needed
        console.log('In-memory database state loaded (placeholder)');
    }

    // Clear all data
    clear() {
        this.users.clear();
        this.posts.clear();
        this.contacts.clear();
        this.affiliateEvents.clear();
        this.marketplaceListings.clear();
        this.quests.clear();
        this.userProgress.clear();
        this.badges.clear();
        this.userBadges.clear();
        this.userStats.clear();
        this.groups.clear();
        this.groupMembers.clear();
        this.userGroups.clear();
        this.stakingPools.clear();
        this.userStakes.clear();
        this.uploads.clear();
        this.apiKeys.clear();
        this.validations.clear();
        this.vipSubscriptions.clear();

        // Reset counters
        this.postIdCounter = 1;
        this.contactIdCounter = 1;
        this.affiliateEventIdCounter = 1;
        this.listingIdCounter = 1;
        this.groupIdCounter = 1;
        this.uploadIdCounter = 1;
        this.vipSubscriptionIdCounter = 1;

        this.initializeDefaultData();
    }
}

// Export singleton instance
const db = new InMemoryDatabase();
module.exports = db;