// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title BeZhasRewardsCalculator
 * @dev Contrato inteligente para calcular recompensas diarias de tokens BEZ
 * @notice Este contrato maneja la lógica de cálculo de recompensas on-chain para transparencia
 */
contract BeZhasRewardsCalculator {
    // ============================================
    // CONSTANTES DE LA PLATAFORMA
    // ============================================
    
    // Factor de decimales (10^18 para precisión de tokens)
    uint256 public constant DECIMALS = 1e18;
    
    // Valores de tokens por acción (multiplicados por DECIMALS)
    uint256 public constant POST_VALUE = 10 * DECIMALS;           // 10 BEZ por post
    uint256 public constant COMMENT_VALUE = 3 * DECIMALS;         // 3 BEZ por comentario
    uint256 public constant LIKE_VALUE = 1 * DECIMALS;            // 1 BEZ por like
    uint256 public constant SHARE_VALUE = 5 * DECIMALS;           // 5 BEZ por compartir
    uint256 public constant PREMIUM_INTERACTION_VALUE = 15 * DECIMALS; // 15 BEZ por interacción premium
    uint256 public constant REFERRAL_VALUE = 50 * DECIMALS;       // 50 BEZ por referido
    
    // Límites diarios
    uint256 public constant MAX_POSTS_PER_DAY = 10;
    uint256 public constant MAX_COMMENTS_PER_DAY = 50;
    uint256 public constant MAX_LIKES_PER_DAY = 100;
    uint256 public constant MAX_SHARES_PER_DAY = 20;
    uint256 public constant MAX_PREMIUM_INTERACTIONS_PER_DAY = 5;
    uint256 public constant MAX_REFERRALS_PER_DAY = 3;
    
    // Multiplicadores de nivel (porcentajes * 100 para precisión)
    // Nivel 1: 100% (10000), Nivel 2: 110% (11000), etc.
    uint256[10] public LEVEL_MULTIPLIERS = [
        10000, // Nivel 1: 100%
        11000, // Nivel 2: 110%
        12500, // Nivel 3: 125%
        15000, // Nivel 4: 150%
        17500, // Nivel 5: 175%
        20000, // Nivel 6: 200%
        22500, // Nivel 7: 225%
        25000, // Nivel 8: 250%
        27500, // Nivel 9: 275%
        30000  // Nivel 10: 300%
    ];
    
    // Bonos de racha de inicio de sesión (porcentajes * 100)
    uint256 public constant STREAK_7_BONUS = 500;    // +5%
    uint256 public constant STREAK_30_BONUS = 1000;  // +10%
    uint256 public constant STREAK_90_BONUS = 2000;  // +20%
    
    // Multiplicadores VIP (porcentajes * 100)
    uint256 public constant VIP_1_MULTIPLIER = 15000;  // VIP 1 mes: 150%
    uint256 public constant VIP_3_MULTIPLIER = 20000;  // VIP 3 meses: 200%
    uint256 public constant VIP_6_MULTIPLIER = 25000;  // VIP 6 meses: 250%
    uint256 public constant VIP_9_MULTIPLIER = 30000;  // VIP 9 meses: 300%
    
    // ============================================
    // ESTRUCTURAS DE DATOS
    // ============================================
    
    /**
     * @dev Estructura para las acciones diarias del usuario
     */
    struct DailyActions {
        uint256 posts;
        uint256 comments;
        uint256 likes;
        uint256 shares;
        uint256 premiumInteractions;
        uint256 referrals;
    }
    
    /**
     * @dev Estructura para datos del usuario
     */
    struct UserData {
        uint256 level;          // Nivel del usuario (1-10)
        uint256 loginStreak;    // Racha de inicio de sesión en días
        uint256 vipTier;        // Nivel VIP (0=sin VIP, 1=1mes, 3=3meses, 6=6meses, 9=9meses)
    }
    
    /**
     * @dev Estructura para resultados de recompensas
     */
    struct RewardsBreakdown {
        uint256 baseRewards;          // Recompensas base sin multiplicadores
        uint256 levelMultiplier;      // Multiplicador de nivel aplicado
        uint256 streakBonus;          // Bono de racha
        uint256 totalDaily;           // Total diario con todos los bonos
        uint256 vipMultiplier;        // Multiplicador VIP
        uint256 totalWithVIP;         // Total con VIP aplicado
    }
    
    // ============================================
    // EVENTOS
    // ============================================
    
    event RewardsCalculated(
        address indexed user,
        uint256 dailyRewards,
        uint256 level,
        uint256 vipTier
    );
    
    // ============================================
    // FUNCIONES PRINCIPALES
    // ============================================
    
    /**
     * @dev Calcula las recompensas diarias basadas en las acciones del usuario
     * @param actions Acciones diarias realizadas por el usuario
     * @param userData Datos del usuario (nivel, racha, VIP)
     * @return breakdown Desglose completo de las recompensas calculadas
     */
    function calculateDailyRewards(
        DailyActions calldata actions,
        UserData calldata userData
    ) public view returns (RewardsBreakdown memory breakdown) {
        
        // 1. Validar límites diarios
        require(actions.posts <= MAX_POSTS_PER_DAY, "Excede limite de posts");
        require(actions.comments <= MAX_COMMENTS_PER_DAY, "Excede limite de comentarios");
        require(actions.likes <= MAX_LIKES_PER_DAY, "Excede limite de likes");
        require(actions.shares <= MAX_SHARES_PER_DAY, "Excede limite de shares");
        require(actions.premiumInteractions <= MAX_PREMIUM_INTERACTIONS_PER_DAY, "Excede limite de interacciones premium");
        require(actions.referrals <= MAX_REFERRALS_PER_DAY, "Excede limite de referidos");
        require(userData.level >= 1 && userData.level <= 10, "Nivel invalido");
        
        // 2. Calcular recompensas base
        breakdown.baseRewards = _calculateBaseRewards(actions);
        
        // 3. Aplicar multiplicador de nivel
        breakdown.levelMultiplier = LEVEL_MULTIPLIERS[userData.level - 1];
        uint256 rewardsWithLevel = (breakdown.baseRewards * breakdown.levelMultiplier) / 10000;
        
        // 4. Aplicar bono de racha
        breakdown.streakBonus = _calculateStreakBonus(userData.loginStreak);
        uint256 streakBonusAmount = (rewardsWithLevel * breakdown.streakBonus) / 10000;
        breakdown.totalDaily = rewardsWithLevel + streakBonusAmount;
        
        // 5. Aplicar multiplicador VIP
        breakdown.vipMultiplier = _getVIPMultiplier(userData.vipTier);
        breakdown.totalWithVIP = (breakdown.totalDaily * breakdown.vipMultiplier) / 10000;
        
        return breakdown;
    }
    
    /**
     * @dev Calcula recompensas base sin multiplicadores
     * @param actions Acciones del usuario
     * @return baseRewards Total de recompensas base
     */
    function _calculateBaseRewards(DailyActions calldata actions) 
        private 
        pure 
        returns (uint256 baseRewards) 
    {
        baseRewards = 0;
        baseRewards += actions.posts * POST_VALUE;
        baseRewards += actions.comments * COMMENT_VALUE;
        baseRewards += actions.likes * LIKE_VALUE;
        baseRewards += actions.shares * SHARE_VALUE;
        baseRewards += actions.premiumInteractions * PREMIUM_INTERACTION_VALUE;
        baseRewards += actions.referrals * REFERRAL_VALUE;
        
        return baseRewards;
    }
    
    /**
     * @dev Calcula el bono de racha de inicio de sesión
     * @param loginStreak Días consecutivos de inicio de sesión
     * @return bonus Porcentaje de bono (* 100)
     */
    function _calculateStreakBonus(uint256 loginStreak) 
        private 
        pure 
        returns (uint256 bonus) 
    {
        if (loginStreak >= 90) {
            return STREAK_90_BONUS;  // 20%
        } else if (loginStreak >= 30) {
            return STREAK_30_BONUS;  // 10%
        } else if (loginStreak >= 7) {
            return STREAK_7_BONUS;   // 5%
        }
        return 0;
    }
    
    /**
     * @dev Obtiene el multiplicador VIP según el tier
     * @param vipTier Nivel VIP del usuario
     * @return multiplier Multiplicador VIP (* 100)
     */
    function _getVIPMultiplier(uint256 vipTier) 
        private 
        pure 
        returns (uint256 multiplier) 
    {
        if (vipTier == 9) {
            return VIP_9_MULTIPLIER;  // 300%
        } else if (vipTier == 6) {
            return VIP_6_MULTIPLIER;  // 250%
        } else if (vipTier == 3) {
            return VIP_3_MULTIPLIER;  // 200%
        } else if (vipTier == 1) {
            return VIP_1_MULTIPLIER;  // 150%
        }
        return 10000; // 100% (sin VIP)
    }
    
    /**
     * @dev Calcula ganancias trimestrales (90 días)
     * @param dailyRewards Recompensas diarias calculadas
     * @return quarterlyRewards Total de recompensas para 90 días
     */
    function calculateQuarterlyRewards(uint256 dailyRewards) 
        public 
        pure 
        returns (uint256 quarterlyRewards) 
    {
        return dailyRewards * 90;
    }
    
    /**
     * @dev Calcula ganancias anuales (365 días)
     * @param dailyRewards Recompensas diarias calculadas
     * @return yearlyRewards Total de recompensas para 365 días
     */
    function calculateYearlyRewards(uint256 dailyRewards) 
        public 
        pure 
        returns (uint256 yearlyRewards) 
    {
        return dailyRewards * 365;
    }
    
    /**
     * @dev Obtiene los límites diarios de la plataforma
     * @return limits Array con los límites diarios
     */
    function getDailyLimits() 
        public 
        pure 
        returns (uint256[6] memory limits) 
    {
        limits[0] = MAX_POSTS_PER_DAY;
        limits[1] = MAX_COMMENTS_PER_DAY;
        limits[2] = MAX_LIKES_PER_DAY;
        limits[3] = MAX_SHARES_PER_DAY;
        limits[4] = MAX_PREMIUM_INTERACTIONS_PER_DAY;
        limits[5] = MAX_REFERRALS_PER_DAY;
        return limits;
    }
    
    /**
     * @dev Obtiene los valores de token por acción
     * @return values Array con los valores de tokens
     */
    function getTokenValues() 
        public 
        pure 
        returns (uint256[6] memory values) 
    {
        values[0] = POST_VALUE;
        values[1] = COMMENT_VALUE;
        values[2] = LIKE_VALUE;
        values[3] = SHARE_VALUE;
        values[4] = PREMIUM_INTERACTION_VALUE;
        values[5] = REFERRAL_VALUE;
        return values;
    }
}
