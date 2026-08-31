const { z } = require('zod');

/**
 * User Profile Update Schema
 * For regular users updating their own profile
 */
const userProfileSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters').optional(),
    firstName: z.string().max(50, 'First name is too long').optional(),
    lastName: z.string().max(50, 'Last name is too long').optional(),
    bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    avatarUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
    coverUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
    interests: z.array(z.string()).optional(),
});

/**
 * Admin User Update Schema
 * For admins managing user roles and statuses
 */
const adminUserUpdateSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    role: z.enum(['USER', 'CERTIFIED_USER', 'EDITOR', 'MODERATOR', 'DEVELOPER', 'ADMIN']).optional(),
    subscription: z.enum(['FREE', 'PREMIUM', 'VIP']).optional(),
    isVerified: z.boolean().optional(),
    isBanned: z.boolean().optional(),
});

/**
 * User Search/Filter Schema
 */
const userFilterSchema = z.object({
    role: z.enum(['USER', 'CERTIFIED_USER', 'EDITOR', 'MODERATOR', 'DEVELOPER', 'ADMIN']).optional(),
    subscription: z.enum(['FREE', 'PREMIUM', 'VIP']).optional(),
    isVerified: z.boolean().optional(),
    isBanned: z.boolean().optional(),
    search: z.string().optional(),
});

module.exports = {
    userProfileSchema,
    adminUserUpdateSchema,
    userFilterSchema
};
