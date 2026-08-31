/**
 * Database Service for Revenue Stream Analytics
 * 
 * Handles all database operations using Prisma ORM
 */

const { PrismaClient } = require('@prisma/client');
const { ethers } = require('ethers');

class DatabaseService {
    constructor() {
        this.prisma = new PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SWAP OPERATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async saveSwap(swapData) {
        try {
            const {
                transactionHash,
                blockNumber,
                blockTimestamp,
                userAddress,
                usdcAmount,
                bezAmount,
                feeAmount,
                serviceId,
                riskScore,
                riskLevel,
                wasBlocked
            } = swapData;

            // Check if user is new
            const existingSwaps = await this.prisma.swap.count({
                where: { userAddress }
            });
            const userType = existingSwaps === 0 ? 'new' : 'returning';

            const swap = await this.prisma.swap.create({
                data: {
                    transactionHash,
                    blockNumber: BigInt(blockNumber),
                    blockTimestamp: new Date(blockTimestamp * 1000),
                    userAddress,
                    userType,
                    usdcAmount: ethers.formatUnits(usdcAmount, 6),
                    bezAmount: ethers.formatUnits(bezAmount, 18),
                    feeAmount: ethers.formatUnits(feeAmount, 6),
                    serviceId,
                    serviceName: this.getServiceName(serviceId),
                    riskScore,
                    riskLevel,
                    wasBlocked
                }
            });

            // Update wallet analytics
            await this.updateWalletAnalytics(userAddress, swap);

            // Update daily stats
            await this.updateDailyStats(new Date(blockTimestamp * 1000), swap);

            return swap;
        } catch (error) {
            console.error('Error saving swap:', error);
            throw error;
        }
    }

    async getSwap(transactionHash) {
        return this.prisma.swap.findUnique({
            where: { transactionHash },
            include: {
                fees: true,
                services: true
            }
        });
    }

    async getSwaps(filters = {}) {
        const {
            userAddress,
            serviceId,
            startDate,
            endDate,
            limit = 50,
            offset = 0
        } = filters;

        const where = {};
        if (userAddress) where.userAddress = userAddress;
        if (serviceId) where.serviceId = serviceId;
        if (startDate || endDate) {
            where.blockTimestamp = {};
            if (startDate) where.blockTimestamp.gte = new Date(startDate);
            if (endDate) where.blockTimestamp.lte = new Date(endDate);
        }

        return this.prisma.swap.findMany({
            where,
            orderBy: { blockTimestamp: 'desc' },
            take: limit,
            skip: offset,
            include: {
                fees: true,
                services: true
            }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // FEE OPERATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async saveFee(feeData) {
        try {
            const {
                transactionHash,
                blockNumber,
                blockTimestamp,
                userAddress,
                feeAmount,
                serviceId,
                swapId
            } = feeData;

            return this.prisma.fee.create({
                data: {
                    transactionHash,
                    blockNumber: BigInt(blockNumber),
                    blockTimestamp: new Date(blockTimestamp * 1000),
                    userAddress,
                    feeAmount: ethers.formatUnits(feeAmount, 6),
                    serviceId,
                    swapId
                }
            });
        } catch (error) {
            console.error('Error saving fee:', error);
            throw error;
        }
    }

    async getTotalFees(filters = {}) {
        const { startDate, endDate, serviceId } = filters;

        const where = {};
        if (serviceId) where.serviceId = serviceId;
        if (startDate || endDate) {
            where.blockTimestamp = {};
            if (startDate) where.blockTimestamp.gte = new Date(startDate);
            if (endDate) where.blockTimestamp.lte = new Date(endDate);
        }

        const result = await this.prisma.fee.aggregate({
            where,
            _sum: { feeAmount: true },
            _count: true
        });

        return {
            totalFees: result._sum.feeAmount || 0,
            count: result._count
        };
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SERVICE DELIVERY OPERATIONS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async createServiceDelivery(deliveryData) {
        try {
            const {
                serviceId,
                serviceType,
                userAddress,
                swapId,
                deliveryData: data
            } = deliveryData;

            return this.prisma.serviceDelivery.create({
                data: {
                    serviceId,
                    serviceType,
                    userAddress,
                    swapId,
                    deliveryData: data,
                    status: 'pending'
                }
            });
        } catch (error) {
            console.error('Error creating service delivery:', error);
            throw error;
        }
    }

    async updateServiceDelivery(id, updateData) {
        const { status, deliveryData, errorMessage } = updateData;

        const data = { status };
        if (deliveryData) data.deliveryData = deliveryData;
        if (errorMessage) data.errorMessage = errorMessage;
        if (status === 'delivered') data.deliveredAt = new Date();

        return this.prisma.serviceDelivery.update({
            where: { id },
            data
        });
    }

    async getPendingDeliveries() {
        return this.prisma.serviceDelivery.findMany({
            where: {
                status: { in: ['pending', 'processing'] },
                retryCount: { lt: 3 }
            },
            orderBy: { requestedAt: 'asc' }
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ANALYTICS & STATS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async updateDailyStats(date, swap) {
        const dateOnly = new Date(date.toDateString());

        const existing = await this.prisma.dailyStats.findUnique({
            where: { date: dateOnly }
        });

        if (existing) {
            // Update existing
            return this.prisma.dailyStats.update({
                where: { date: dateOnly },
                data: {
                    totalVolume: { increment: parseFloat(swap.usdcAmount) },
                    totalFees: { increment: parseFloat(swap.feeAmount) },
                    totalSwaps: { increment: 1 },
                    ...(swap.userType === 'new' && { newUsers: { increment: 1 } }),
                    ...(swap.userType === 'returning' && { returningUsers: { increment: 1 } }),
                    ...(swap.wasBlocked && { blockedSwaps: { increment: 1 } }),
                    ...(swap.riskScore > 70 && { highRiskSwaps: { increment: 1 } })
                }
            });
        } else {
            // Create new
            return this.prisma.dailyStats.create({
                data: {
                    date: dateOnly,
                    totalVolume: parseFloat(swap.usdcAmount),
                    totalFees: parseFloat(swap.feeAmount),
                    totalSwaps: 1,
                    uniqueUsers: 1,
                    newUsers: swap.userType === 'new' ? 1 : 0,
                    returningUsers: swap.userType === 'returning' ? 1 : 0,
                    blockedSwaps: swap.wasBlocked ? 1 : 0,
                    highRiskSwaps: swap.riskScore > 70 ? 1 : 0
                }
            });
        }
    }

    async getDailyStats(startDate, endDate) {
        return this.prisma.dailyStats.findMany({
            where: {
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                }
            },
            orderBy: { date: 'asc' }
        });
    }

    async updateWalletAnalytics(address, swap) {
        const existing = await this.prisma.walletAnalytics.findUnique({
            where: { address }
        });

        if (existing) {
            return this.prisma.walletAnalytics.update({
                where: { address },
                data: {
                    lastSwapAt: new Date(swap.blockTimestamp),
                    totalSwaps: { increment: 1 },
                    totalVolume: { increment: parseFloat(swap.usdcAmount) },
                    totalFees: { increment: parseFloat(swap.feeAmount) },
                    lifetimeValue: { increment: parseFloat(swap.usdcAmount) },
                    ...(swap.wasBlocked && { blockedCount: { increment: 1 } })
                }
            });
        } else {
            return this.prisma.walletAnalytics.create({
                data: {
                    address,
                    firstSwapAt: new Date(swap.blockTimestamp),
                    lastSwapAt: new Date(swap.blockTimestamp),
                    totalSwaps: 1,
                    totalVolume: parseFloat(swap.usdcAmount),
                    totalFees: parseFloat(swap.feeAmount),
                    lifetimeValue: parseFloat(swap.usdcAmount),
                    userType: 'new',
                    blockedCount: swap.wasBlocked ? 1 : 0
                }
            });
        }
    }

    async getWalletAnalytics(address) {
        return this.prisma.walletAnalytics.findUnique({
            where: { address }
        });
    }

    async getTopWallets(limit = 10) {
        return this.prisma.walletAnalytics.findMany({
            orderBy: { totalVolume: 'desc' },
            take: limit
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HEALTH & ALERTS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    async saveHealthCheck(healthData) {
        return this.prisma.healthCheck.create({
            data: healthData
        });
    }

    async getRecentHealthChecks(limit = 10) {
        return this.prisma.healthCheck.findMany({
            orderBy: { timestamp: 'desc' },
            take: limit
        });
    }

    async saveAlert(alertData) {
        return this.prisma.alert.create({
            data: alertData
        });
    }

    async getAlerts(filters = {}) {
        const { type, severity, startDate, endDate, limit = 50 } = filters;

        const where = {};
        if (type) where.type = type;
        if (severity) where.severity = severity;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        return this.prisma.alert.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // UTILITIES
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    getServiceName(serviceId) {
        const services = {
            LIQUIDITY_RAMP: 'Liquidity Ramp',
            NFT_PURCHASE: 'NFT Purchase',
            PREMIUM_SUBSCRIPTION: 'Premium Subscription',
            PRODUCT_PURCHASE: 'Product Purchase'
        };
        return services[serviceId] || serviceId;
    }

    async disconnect() {
        await this.prisma.$disconnect();
    }

    async healthCheck() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { status: 'healthy' };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

// Singleton instance
let dbService = null;

function getDatabaseService() {
    if (!dbService) {
        dbService = new DatabaseService();
    }
    return dbService;
}

module.exports = { DatabaseService, getDatabaseService };
