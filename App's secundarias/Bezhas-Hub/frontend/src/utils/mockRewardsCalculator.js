/**
 * Mock Calculator - Simula el smart contract localmente
 * Usa los mismos cálculos que BeZhasRewardsCalculator.sol
 * Se puede usar antes de deployar el contrato
 */

const DECIMALS = 1e18;

// Valores de tokens (en BEZ)
const TOKEN_VALUES = {
    POST_VALUE: 10,
    COMMENT_VALUE: 3,
    LIKE_VALUE: 1,
    SHARE_VALUE: 5,
    PREMIUM_INTERACTION_VALUE: 15,
    REFERRAL_VALUE: 50
};

// Límites diarios
const DAILY_LIMITS = {
    MAX_POSTS_PER_DAY: 10,
    MAX_COMMENTS_PER_DAY: 50,
    MAX_LIKES_PER_DAY: 100,
    MAX_SHARES_PER_DAY: 20,
    MAX_PREMIUM_INTERACTIONS_PER_DAY: 5,
    MAX_REFERRALS_PER_DAY: 3
};

// Multiplicadores de nivel (en porcentaje × 100)
const LEVEL_MULTIPLIERS = [
    10000, // Nivel 1: 100%
    11000, // Nivel 2: 110%
    12000, // Nivel 3: 120%
    13000, // Nivel 4: 130%
    14000, // Nivel 5: 140%
    16000, // Nivel 6: 160%
    18000, // Nivel 7: 180%
    22000, // Nivel 8: 220%
    26000, // Nivel 9: 260%
    30000  // Nivel 10: 300%
];

// Bonus por racha (en porcentaje × 100)
const STREAK_BONUSES = {
    STREAK_7_DAYS: 500,   // +5%
    STREAK_30_DAYS: 1000,  // +10%
    STREAK_90_DAYS: 2000   // +20%
};

// Multiplicadores VIP (en porcentaje × 100)
const VIP_MULTIPLIERS = {
    VIP_1_MONTH: 15000,  // 150%
    VIP_3_MONTHS: 20000, // 200%
    VIP_6_MONTHS: 25000, // 250%
    VIP_9_MONTHS: 30000  // 300%
};

/**
 * Calcula las recompensas base
 */
function calculateBaseRewards(actions) {
    let total = 0;

    total += Math.min(actions.posts, DAILY_LIMITS.MAX_POSTS_PER_DAY) * TOKEN_VALUES.POST_VALUE;
    total += Math.min(actions.comments, DAILY_LIMITS.MAX_COMMENTS_PER_DAY) * TOKEN_VALUES.COMMENT_VALUE;
    total += Math.min(actions.likes, DAILY_LIMITS.MAX_LIKES_PER_DAY) * TOKEN_VALUES.LIKE_VALUE;
    total += Math.min(actions.shares, DAILY_LIMITS.MAX_SHARES_PER_DAY) * TOKEN_VALUES.SHARE_VALUE;
    total += Math.min(actions.premiumInteractions, DAILY_LIMITS.MAX_PREMIUM_INTERACTIONS_PER_DAY) * TOKEN_VALUES.PREMIUM_INTERACTION_VALUE;
    total += Math.min(actions.referrals, DAILY_LIMITS.MAX_REFERRALS_PER_DAY) * TOKEN_VALUES.REFERRAL_VALUE;

    return total;
}

/**
 * Obtiene el multiplicador de nivel
 */
function getLevelMultiplier(level) {
    const clampedLevel = Math.max(1, Math.min(10, level));
    return LEVEL_MULTIPLIERS[clampedLevel - 1];
}

/**
 * Calcula el bonus por racha
 */
function calculateStreakBonus(loginStreak) {
    if (loginStreak >= 90) return STREAK_BONUSES.STREAK_90_DAYS;
    if (loginStreak >= 30) return STREAK_BONUSES.STREAK_30_DAYS;
    if (loginStreak >= 7) return STREAK_BONUSES.STREAK_7_DAYS;
    return 0;
}

/**
 * Obtiene el multiplicador VIP
 */
function getVIPMultiplier(vipTier) {
    switch (vipTier) {
        case 1: return VIP_MULTIPLIERS.VIP_1_MONTH;
        case 3: return VIP_MULTIPLIERS.VIP_3_MONTHS;
        case 6: return VIP_MULTIPLIERS.VIP_6_MONTHS;
        case 9: return VIP_MULTIPLIERS.VIP_9_MONTHS;
        default: return 10000; // Sin VIP = 100%
    }
}

/**
 * Calcula las recompensas diarias completas
 * Simula la función calculateDailyRewards del smart contract
 */
export function calculateDailyRewards(actions, userData) {
    // Validar límites
    if (actions.posts > DAILY_LIMITS.MAX_POSTS_PER_DAY) {
        throw new Error('Excede límite de posts diarios');
    }
    if (actions.comments > DAILY_LIMITS.MAX_COMMENTS_PER_DAY) {
        throw new Error('Excede límite de comentarios diarios');
    }
    if (actions.likes > DAILY_LIMITS.MAX_LIKES_PER_DAY) {
        throw new Error('Excede límite de likes diarios');
    }
    if (actions.shares > DAILY_LIMITS.MAX_SHARES_PER_DAY) {
        throw new Error('Excede límite de compartidos diarios');
    }
    if (actions.premiumInteractions > DAILY_LIMITS.MAX_PREMIUM_INTERACTIONS_PER_DAY) {
        throw new Error('Excede límite de interacciones premium diarias');
    }
    if (actions.referrals > DAILY_LIMITS.MAX_REFERRALS_PER_DAY) {
        throw new Error('Excede límite de referidos diarios');
    }

    // 1. Calcular recompensas base
    const baseRewards = calculateBaseRewards(actions);

    // 2. Aplicar multiplicador de nivel
    const levelMultiplier = getLevelMultiplier(userData.level);
    const rewardsWithLevel = (baseRewards * levelMultiplier) / 10000;

    // 3. Aplicar bonus por racha
    const streakBonus = calculateStreakBonus(userData.loginStreak);
    const streakBonusAmount = (rewardsWithLevel * streakBonus) / 10000;
    const totalDaily = rewardsWithLevel + streakBonusAmount;

    // 4. Aplicar multiplicador VIP
    const vipMultiplier = getVIPMultiplier(userData.vipTier);
    const totalWithVIP = (totalDaily * vipMultiplier) / 10000;

    return {
        baseRewards,
        levelMultiplier,
        streakBonus,
        vipMultiplier,
        totalDaily,
        totalWithVIP
    };
}

/**
 * Calcula recompensas trimestrales
 */
export function calculateQuarterlyRewards(actions, userData) {
    const daily = calculateDailyRewards(actions, userData);
    return daily.totalWithVIP * 90;
}

/**
 * Calcula recompensas anuales
 */
export function calculateYearlyRewards(actions, userData) {
    const daily = calculateDailyRewards(actions, userData);
    return daily.totalWithVIP * 365;
}

/**
 * Obtiene los límites diarios
 */
export function getDailyLimits() {
    return DAILY_LIMITS;
}

/**
 * Obtiene los valores de tokens
 */
export function getTokenValues() {
    return TOKEN_VALUES;
}

export default {
    calculateDailyRewards,
    calculateQuarterlyRewards,
    calculateYearlyRewards,
    getDailyLimits,
    getTokenValues
};
