# BeZhas Subscription System - Blueprint de Implementación

> **Estado:** 📋 Pendiente de Revisión  
> **Fecha:** 27 de Enero, 2026  
> **Versión:** 1.0

---

## Índice

1. [Resumen del Sistema](#1-resumen-del-sistema)
2. [Archivos a Crear](#2-archivos-a-crear)
3. [Código Fuente Propuesto](#3-código-fuente-propuesto)
4. [Modificaciones a Archivos Existentes](#4-modificaciones-a-archivos-existentes)
5. [Variables de Entorno Requeridas](#5-variables-de-entorno-requeridas)
6. [Dependencias NPM](#6-dependencias-npm)
7. [Checklist de Implementación](#7-checklist-de-implementación)

---

## 1. Resumen del Sistema

### 1.1 Objetivo

Implementar un sistema completo de suscripciones de 3 niveles que:

- Controle acceso a features según tier
- Aplique límites de uso (posts, AI queries, etc.)
- Calcule descuentos en BEZ-Coin y Gas
- Integre pagos con Stripe
- Relacione uso de AI con consumo de tokens BEZ

### 1.2 Estructura de Precios

| Tier | Mensual | Anual | Ahorro Anual |
|------|---------|-------|--------------|
| **Starter** | Gratis | Gratis | - |
| **Pro** | $14.99 | $149.99 | $30 (17%) |
| **Enterprise** | $99.99 | $999.99 | $200 (17%) |

### 1.3 Arquitectura

```
backend/
├── config/
│   └── subscriptions.config.js      # Configuración de tiers
├── services/
│   ├── subscription.service.js      # Lógica de suscripciones
│   └── tokenomics.service.js        # Relación AI ↔ BEZ-Coin
├── middleware/
│   └── subscription.middleware.js   # Verificación de acceso
├── controllers/
│   └── subscription.controller.js   # Endpoints API
├── routes/
│   └── subscription.routes.js       # Rutas
└── models/
    └── Subscription.js              # Modelo MongoDB (si no existe)
```

---

## 2. Archivos a Crear

| Archivo | Propósito | Prioridad |
|---------|-----------|-----------|
| `config/subscriptions.config.js` | Definición de tiers, límites y precios | 🔴 Alta |
| `services/subscription.service.js` | Lógica de negocio de suscripciones | 🔴 Alta |
| `services/tokenomics.service.js` | Cálculo de costos AI → BEZ | 🔴 Alta |
| `middleware/subscription.middleware.js` | Guards de acceso | 🔴 Alta |
| `controllers/subscription.controller.js` | Handlers de API | 🟡 Media |
| `routes/subscription.routes.js` | Definición de rutas | 🟡 Media |

---

## 3. Código Fuente Propuesto

### 3.1 Configuración de Tiers

```javascript
// ============================================
// filepath: backend/config/subscriptions.config.js
// ============================================

/**
 * Configuración del sistema de suscripciones BeZhas
 * 
 * NOTAS DE PRECIOS:
 * - Starter: Gratuito, funcionalidad básica limitada
 * - Pro: $14.99/mes - Para creadores activos
 * - Enterprise: $99.99/mes - Para organizaciones y power users
 */

const SUBSCRIPTION_TIERS = {
  STARTER: {
    id: 'starter',
    name: 'Starter',
    description: 'Plan gratuito con funcionalidades básicas',
    
    // === PRECIOS ===
    price: {
      monthly: 0,
      yearly: 0,
      currency: 'USD',
      stripePriceId: {
        monthly: null,
        yearly: null
      }
    },
    
    // === LÍMITES DE USO ===
    limits: {
      // Contenido
      postsPerMonth: 10,
      postsWithMediaPerMonth: 5,
      commentsPerMonth: 50,
      storageGB: 0.1,  // 100 MB
      
      // AI/ML
      aiQueriesPerDay: 5,
      aiModels: ['gpt-3.5-turbo'],
      maxTokensPerQuery: 1000,
      
      // Blockchain
      oracleValidationsPerMonth: 0,
      daoProposalsPerMonth: 0,
      daoVotesPerMonth: Infinity,  // Votar siempre gratis
      
      // Social
      followsPerDay: 20,
      directMessagesPerDay: 10
    },
    
    // === DESCUENTOS ===
    discounts: {
      bezCoin: 0,      // 0% descuento
      gas: 0,          // 0% descuento
      platformFee: 0   // 0% descuento
    },
    
    // === FEATURES ===
    features: {
      // Blockchain
      canCreateProposals: false,
      qualityOracleAccess: false,
      priorityValidation: false,
      
      // AI
      advancedAIModels: false,
      customPrompts: false,
      aiPersonality: false,
      
      // Platform
      apiAccess: false,
      webhooks: false,
      analytics: false,
      exportData: false,
      
      // Support
      prioritySupport: false,
      dedicatedManager: false,
      
      // Social
      verifiedBadge: false,
      customProfile: false,
      scheduledPosts: false
    },
    
    // === UI/BRANDING ===
    badge: null,
    color: '#6B7280',  // gray-500
    icon: 'user'
  },

  PRO: {
    id: 'pro',
    name: 'Pro',
    description: 'Para creadores activos que quieren destacar',
    
    // === PRECIOS ===
    price: {
      monthly: 14.99,
      yearly: 149.99,  // 17% ahorro (~$30/año)
      currency: 'USD',
      stripePriceId: {
        monthly: 'price_pro_monthly',   // Reemplazar con ID real de Stripe
        yearly: 'price_pro_yearly'
      }
    },
    
    // === LÍMITES DE USO ===
    limits: {
      // Contenido
      postsPerMonth: 100,
      postsWithMediaPerMonth: 50,
      commentsPerMonth: Infinity,
      storageGB: 5,
      
      // AI/ML
      aiQueriesPerDay: 50,
      aiModels: ['gpt-3.5-turbo', 'gpt-4', 'gemini-pro'],
      maxTokensPerQuery: 4000,
      
      // Blockchain
      oracleValidationsPerMonth: 20,
      daoProposalsPerMonth: 5,
      daoVotesPerMonth: Infinity,
      
      // Social
      followsPerDay: 100,
      directMessagesPerDay: 100
    },
    
    // === DESCUENTOS ===
    discounts: {
      bezCoin: 0.25,     // 25% descuento
      gas: 0.25,         // 25% descuento
      platformFee: 0.10  // 10% descuento
    },
    
    // === FEATURES ===
    features: {
      // Blockchain
      canCreateProposals: true,
      qualityOracleAccess: true,
      priorityValidation: false,
      
      // AI
      advancedAIModels: true,
      customPrompts: true,
      aiPersonality: false,
      
      // Platform
      apiAccess: false,
      webhooks: false,
      analytics: true,
      exportData: true,
      
      // Support
      prioritySupport: true,
      dedicatedManager: false,
      
      // Social
      verifiedBadge: true,
      customProfile: true,
      scheduledPosts: true
    },
    
    // === UI/BRANDING ===
    badge: 'verified',
    color: '#8B5CF6',  // violet-500
    icon: 'star'
  },

  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Acceso completo para organizaciones y power users',
    
    // === PRECIOS ===
    price: {
      monthly: 99.99,
      yearly: 999.99,  // 17% ahorro (~$200/año)
      currency: 'USD',
      stripePriceId: {
        monthly: 'price_enterprise_monthly',
        yearly: 'price_enterprise_yearly'
      }
    },
    
    // === LÍMITES DE USO ===
    limits: {
      // Contenido
      postsPerMonth: Infinity,
      postsWithMediaPerMonth: Infinity,
      commentsPerMonth: Infinity,
      storageGB: 100,
      
      // AI/ML
      aiQueriesPerDay: Infinity,
      aiModels: ['all'],  // Acceso a todos los modelos
      maxTokensPerQuery: 8000,
      
      // Blockchain
      oracleValidationsPerMonth: Infinity,
      daoProposalsPerMonth: Infinity,
      daoVotesPerMonth: Infinity,
      
      // Social
      followsPerDay: Infinity,
      directMessagesPerDay: Infinity
    },
    
    // === DESCUENTOS ===
    discounts: {
      bezCoin: 0.50,     // 50% descuento
      gas: 0.50,         // 50% descuento
      platformFee: 0.25  // 25% descuento
    },
    
    // === FEATURES ===
    features: {
      // Blockchain
      canCreateProposals: true,
      qualityOracleAccess: true,
      priorityValidation: true,
      
      // AI
      advancedAIModels: true,
      customPrompts: true,
      aiPersonality: true,
      
      // Platform
      apiAccess: true,
      webhooks: true,
      analytics: true,
      exportData: true,
      
      // Support
      prioritySupport: true,
      dedicatedManager: true,
      
      // Social
      verifiedBadge: true,
      customProfile: true,
      scheduledPosts: true
    },
    
    // === UI/BRANDING ===
    badge: 'enterprise',
    color: '#F59E0B',  // amber-500
    icon: 'building'
  }
};

/**
 * Jerarquía de tiers (para comparaciones)
 */
const TIER_HIERARCHY = ['STARTER', 'PRO', 'ENTERPRISE'];

/**
 * Tier por defecto para nuevos usuarios
 */
const DEFAULT_TIER = 'STARTER';

/**
 * Período de prueba gratuito (días)
 */
const TRIAL_PERIOD_DAYS = 14;

/**
 * Obtener configuración de un tier
 */
const getTierConfig = (tierName) => {
  const tier = tierName?.toUpperCase() || DEFAULT_TIER;
  return SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS[DEFAULT_TIER];
};

/**
 * Verificar si un tier tiene acceso a otro
 */
const tierHasAccess = (userTier, requiredTier) => {
  const userIndex = TIER_HIERARCHY.indexOf(userTier?.toUpperCase() || DEFAULT_TIER);
  const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier?.toUpperCase() || DEFAULT_TIER);
  return userIndex >= requiredIndex;
};

/**
 * Obtener todos los tiers para mostrar en UI
 */
const getAllTiersForDisplay = () => {
  return TIER_HIERARCHY.map(tier => ({
    ...SUBSCRIPTION_TIERS[tier],
    tierKey: tier
  }));
};

module.exports = {
  SUBSCRIPTION_TIERS,
  TIER_HIERARCHY,
  DEFAULT_TIER,
  TRIAL_PERIOD_DAYS,
  getTierConfig,
  tierHasAccess,
  getAllTiersForDisplay
};
```

---

### 3.2 Servicio de Tokenomics (AI ↔ BEZ-Coin)

```javascript
// ============================================
// filepath: backend/services/tokenomics.service.js
// ============================================

const { getTierConfig } = require('../config/subscriptions.config');

/**
 * Matriz de costos: Modelo AI → BEZ-Coin
 * 
 * Cálculo basado en:
 * - Costo real de API externa (OpenAI, Google, etc.)
 * - Conversión a USD
 * - Conversión a BEZ (asumiendo $0.10 USD = 1 BEZ)
 * - Margen de plataforma incluido
 */
const AI_COST_MATRIX = {
  // OpenAI Models
  'gpt-4': {
    provider: 'openai',
    inputRate: 0.30,      // BEZ por 1K tokens input ($0.03 USD)
    outputRate: 0.60,     // BEZ por 1K tokens output ($0.06 USD)
    minCharge: 5,         // Mínimo por consulta
    description: 'Modelo más avanzado, mejor razonamiento'
  },
  'gpt-4-turbo': {
    provider: 'openai',
    inputRate: 0.10,
    outputRate: 0.30,
    minCharge: 3,
    description: 'GPT-4 optimizado para velocidad'
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    inputRate: 0.01,
    outputRate: 0.02,
    minCharge: 1,
    description: 'Modelo rápido y económico'
  },
  
  // Google Models
  'gemini-pro': {
    provider: 'google',
    inputRate: 0.0025,
    outputRate: 0.005,
    minCharge: 1,
    description: 'Modelo multimodal de Google'
  },
  'gemini-pro-vision': {
    provider: 'google',
    inputRate: 0.005,
    outputRate: 0.01,
    minCharge: 2,
    description: 'Gemini con capacidad de visión'
  },
  
  // Modelos Locales (TensorFlow.js)
  'tensorflow-sentiment': {
    provider: 'local',
    inferenceRate: 0.01,  // BEZ por inferencia
    minCharge: 1,
    description: 'Análisis de sentimiento local'
  },
  'tensorflow-toxicity': {
    provider: 'local',
    inferenceRate: 0.02,
    minCharge: 1,
    description: 'Detección de toxicidad'
  },
  'tensorflow-moderation': {
    provider: 'local',
    inferenceRate: 0.01,
    minCharge: 1,
    description: 'Moderación de contenido'
  },
  
  // OpenAI Utilities
  'text-embedding-ada-002': {
    provider: 'openai',
    inputRate: 0.001,
    outputRate: 0,
    minCharge: 0.5,
    description: 'Generación de embeddings'
  },
  'whisper-1': {
    provider: 'openai',
    minuteRate: 0.06,     // BEZ por minuto de audio
    minCharge: 1,
    description: 'Transcripción de audio'
  },
  'dall-e-3': {
    provider: 'openai',
    imageRate: 0.40,      // BEZ por imagen estándar
    imageRateHD: 0.80,    // BEZ por imagen HD
    minCharge: 5,
    description: 'Generación de imágenes'
  }
};

/**
 * Tasa de conversión BEZ ↔ USD
 */
const BEZ_TO_USD_RATE = parseFloat(process.env.BEZ_TO_USD_RATE) || 0.10;

/**
 * Fee de plataforma base
 */
const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT) || 2.5;

class TokenomicsService {
  
  /**
   * Calcular costo en BEZ para uso de AI
   * 
   * @param {string} model - Nombre del modelo AI
   * @param {Object} usage - Uso { inputTokens, outputTokens, inferences, minutes, images }
   * @param {string} userTier - Tier del usuario (STARTER, PRO, ENTERPRISE)
   * @returns {Object} { baseCost, discount, finalCost, breakdown }
   */
  calculateAICost(model, usage, userTier = 'STARTER') {
    const rates = AI_COST_MATRIX[model];
    
    if (!rates) {
      console.warn(`[Tokenomics] Modelo desconocido: ${model}, usando tarifa por defecto`);
      return this._defaultCost(userTier);
    }
    
    let baseCost = 0;
    const breakdown = {};
    
    // Calcular según tipo de modelo
    if (rates.inferenceRate && usage.inferences) {
      // Modelos locales (por inferencia)
      baseCost = usage.inferences * rates.inferenceRate;
      breakdown.inferences = usage.inferences;
      breakdown.ratePerInference = rates.inferenceRate;
      
    } else if (rates.minuteRate && usage.minutes) {
      // Modelos de audio (por minuto)
      baseCost = usage.minutes * rates.minuteRate;
      breakdown.minutes = usage.minutes;
      breakdown.ratePerMinute = rates.minuteRate;
      
    } else if (rates.imageRate && usage.images) {
      // Modelos de imagen
      const isHD = usage.quality === 'hd';
      const rate = isHD ? rates.imageRateHD : rates.imageRate;
      baseCost = usage.images * rate;
      breakdown.images = usage.images;
      breakdown.quality = isHD ? 'HD' : 'Standard';
      breakdown.ratePerImage = rate;
      
    } else {
      // Modelos de texto (por tokens)
      const inputCost = ((usage.inputTokens || 0) / 1000) * rates.inputRate;
      const outputCost = ((usage.outputTokens || 0) / 1000) * rates.outputRate;
      baseCost = inputCost + outputCost;
      
      breakdown.inputTokens = usage.inputTokens || 0;
      breakdown.outputTokens = usage.outputTokens || 0;
      breakdown.inputCost = inputCost;
      breakdown.outputCost = outputCost;
    }
    
    // Aplicar mínimo
    baseCost = Math.max(baseCost, rates.minCharge || 0);
    
    // Obtener descuento del tier
    const tierConfig = getTierConfig(userTier);
    const discountPercent = tierConfig.discounts.bezCoin || 0;
    const discount = baseCost * discountPercent;
    const finalCost = baseCost - discount;
    
    return {
      model,
      provider: rates.provider,
      baseCost: this._round(baseCost),
      discountPercent: discountPercent * 100,
      discount: this._round(discount),
      finalCost: this._round(finalCost),
      tier: userTier,
      breakdown,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Calcular costo de Gas en BEZ
   * 
   * @param {number} gasUsed - Gas consumido
   * @param {number} gasPrice - Precio del gas en gwei
   * @param {number} maticPrice - Precio de MATIC en USD
   * @param {string} userTier - Tier del usuario
   * @returns {Object} Desglose de costo
   */
  calculateGasCost(gasUsed, gasPrice, maticPrice, userTier = 'STARTER') {
    // Gas en MATIC
    const gasCostMatic = gasUsed * gasPrice * 1e-9;
    
    // MATIC a USD
    const gasCostUSD = gasCostMatic * maticPrice;
    
    // USD a BEZ
    const baseCostBEZ = gasCostUSD / BEZ_TO_USD_RATE;
    
    // Aplicar descuento del tier
    const tierConfig = getTierConfig(userTier);
    const discountPercent = tierConfig.discounts.gas || 0;
    const discount = baseCostBEZ * discountPercent;
    const finalCost = baseCostBEZ - discount;
    
    return {
      gasUsed,
      gasPrice,
      maticPrice,
      gasCostMatic: this._round(gasCostMatic, 6),
      gasCostUSD: this._round(gasCostUSD, 4),
      baseCostBEZ: this._round(baseCostBEZ),
      discountPercent: discountPercent * 100,
      discount: this._round(discount),
      finalCostBEZ: this._round(finalCost),
      tier: userTier
    };
  }
  
  /**
   * Calcular costo total de una operación híbrida (AI + Blockchain)
   * 
   * @param {Object} aiUsage - { model, inputTokens, outputTokens, ... }
   * @param {Object} gasUsage - { gasUsed, gasPrice, maticPrice }
   * @param {string} userTier - Tier del usuario
   * @returns {Object} Costo total combinado
   */
  calculateTotalCost(aiUsage, gasUsage, userTier = 'STARTER') {
    const aiCost = aiUsage ? this.calculateAICost(
      aiUsage.model,
      aiUsage,
      userTier
    ) : null;
    
    const gasCost = gasUsage ? this.calculateGasCost(
      gasUsage.gasUsed,
      gasUsage.gasPrice,
      gasUsage.maticPrice,
      userTier
    ) : null;
    
    // Fee de plataforma
    const subtotal = (aiCost?.finalCost || 0) + (gasCost?.finalCostBEZ || 0);
    const tierConfig = getTierConfig(userTier);
    const platformFeePercent = PLATFORM_FEE_PERCENT * (1 - (tierConfig.discounts.platformFee || 0));
    const platformFee = subtotal * (platformFeePercent / 100);
    
    const totalCost = subtotal + platformFee;
    
    return {
      ai: aiCost,
      gas: gasCost,
      subtotal: this._round(subtotal),
      platformFeePercent: this._round(platformFeePercent, 2),
      platformFee: this._round(platformFee),
      totalCostBEZ: this._round(totalCost),
      tier: userTier,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Estimar costo antes de ejecutar operación
   * 
   * @param {string} operationType - Tipo de operación
   * @param {Object} params - Parámetros de la operación
   * @param {string} userTier - Tier del usuario
   * @returns {Object} Estimación de costo
   */
  estimateCost(operationType, params, userTier = 'STARTER') {
    const estimates = {
      // Posts
      'post-simple': { ai: null, gas: { gasUsed: 0 } },
      'post-with-media': { ai: { model: 'tensorflow-moderation', inferences: 1 }, gas: null },
      'post-validated': { 
        ai: { model: 'gpt-3.5-turbo', inputTokens: 500, outputTokens: 200 },
        gas: { gasUsed: 120000, gasPrice: 30, maticPrice: 1.0 }
      },
      
      // AI Chat
      'ai-chat-basic': { ai: { model: 'gpt-3.5-turbo', inputTokens: 1000, outputTokens: 500 }, gas: null },
      'ai-chat-premium': { ai: { model: 'gpt-4', inputTokens: 1000, outputTokens: 500 }, gas: null },
      
      // DAO
      'dao-proposal': { ai: null, gas: { gasUsed: 150000, gasPrice: 30, maticPrice: 1.0 } },
      'dao-vote': { ai: null, gas: { gasUsed: 80000, gasPrice: 30, maticPrice: 1.0 } },
      
      // Content Analysis
      'content-analysis': { 
        ai: { model: 'tensorflow-sentiment', inferences: 1 },
        gas: null
      }
    };
    
    const estimate = estimates[operationType];
    if (!estimate) {
      return { error: `Tipo de operación desconocido: ${operationType}` };
    }
    
    // Merge con params si existen
    const aiUsage = estimate.ai ? { ...estimate.ai, ...params?.ai } : null;
    const gasUsage = estimate.gas ? { ...estimate.gas, ...params?.gas } : null;
    
    return {
      operationType,
      ...this.calculateTotalCost(aiUsage, gasUsage, userTier),
      isEstimate: true
    };
  }
  
  /**
   * Obtener lista de modelos disponibles para un tier
   */
  getAvailableModels(userTier = 'STARTER') {
    const tierConfig = getTierConfig(userTier);
    const allowedModels = tierConfig.limits.aiModels;
    
    if (allowedModels.includes('all')) {
      return Object.entries(AI_COST_MATRIX).map(([name, config]) => ({
        name,
        ...config
      }));
    }
    
    return allowedModels.map(modelName => ({
      name: modelName,
      ...AI_COST_MATRIX[modelName]
    })).filter(m => m.provider); // Filtrar modelos válidos
  }
  
  /**
   * Convertir BEZ a USD
   */
  bezToUSD(bezAmount) {
    return this._round(bezAmount * BEZ_TO_USD_RATE, 4);
  }
  
  /**
   * Convertir USD a BEZ
   */
  usdToBEZ(usdAmount) {
    return this._round(usdAmount / BEZ_TO_USD_RATE);
  }
  
  // === Helpers Privados ===
  
  _defaultCost(userTier) {
    const tierConfig = getTierConfig(userTier);
    const baseCost = 2; // BEZ por defecto
    const discount = baseCost * (tierConfig.discounts.bezCoin || 0);
    
    return {
      model: 'unknown',
      provider: 'unknown',
      baseCost,
      discountPercent: (tierConfig.discounts.bezCoin || 0) * 100,
      discount: this._round(discount),
      finalCost: this._round(baseCost - discount),
      tier: userTier,
      breakdown: {},
      warning: 'Modelo desconocido, tarifa por defecto aplicada'
    };
  }
  
  _round(value, decimals = 2) {
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}

module.exports = new TokenomicsService();
module.exports.AI_COST_MATRIX = AI_COST_MATRIX;
module.exports.BEZ_TO_USD_RATE = BEZ_TO_USD_RATE;
```

---

### 3.3 Servicio de Suscripciones

```javascript
// ============================================
// filepath: backend/services/subscription.service.js
// ============================================

const mongoose = require('mongoose');
const User = require('../models/User');
const { 
  SUBSCRIPTION_TIERS, 
  TIER_HIERARCHY,
  DEFAULT_TIER,
  TRIAL_PERIOD_DAYS,
  getTierConfig,
  tierHasAccess 
} = require('../config/subscriptions.config');

// Stripe (lazy load para evitar error si no está configurado)
let stripe = null;
const getStripe = () => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

class SubscriptionService {
  
  // =============================================
  // VERIFICACIÓN DE ACCESO
  // =============================================
  
  /**
   * Verificar si usuario tiene acceso a un feature
   * 
   * @param {string} userId - ID del usuario
   * @param {string} feature - Nombre del feature
   * @returns {Object} { hasAccess, tier, upgradeRequired, featureInfo }
   */
  async checkFeatureAccess(userId, feature) {
    const user = await this._getUser(userId);
    const tier = user?.subscriptionTier || DEFAULT_TIER;
    const config = getTierConfig(tier);
    
    const hasAccess = config.features[feature] === true;
    
    // Encontrar tier mínimo para este feature
    let minTierRequired = null;
    for (const tierName of TIER_HIERARCHY) {
      if (SUBSCRIPTION_TIERS[tierName].features[feature]) {
        minTierRequired = tierName;
        break;
      }
    }
    
    return {
      hasAccess,
      currentTier: tier,
      tierConfig: config,
      upgradeRequired: !hasAccess,
      minimumTierRequired: minTierRequired,
      featureInfo: {
        name: feature,
        description: this._getFeatureDescription(feature)
      }
    };
  }
  
  /**
   * Verificar límite de uso
   * 
   * @param {string} userId - ID del usuario
   * @param {string} limitType - Tipo de límite (postsPerMonth, aiQueriesPerDay, etc.)
   * @returns {Object} { allowed, current, limit, remaining, resetAt }
   */
  async checkLimit(userId, limitType) {
    const user = await this._getUser(userId);
    const tier = user?.subscriptionTier || DEFAULT_TIER;
    const config = getTierConfig(tier);
    const limit = config.limits[limitType];
    
    // Obtener uso actual
    const currentUsage = await this._getCurrentUsage(userId, limitType);
    
    // Calcular reset time
    const resetAt = this._getResetTime(limitType);
    
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - currentUsage);
    
    return {
      allowed: limit === Infinity || currentUsage < limit,
      current: currentUsage,
      limit: limit === Infinity ? 'unlimited' : limit,
      remaining: limit === Infinity ? 'unlimited' : remaining,
      percentUsed: limit === Infinity ? 0 : Math.round((currentUsage / limit) * 100),
      resetAt,
      limitType,
      tier
    };
  }
  
  /**
   * Incrementar uso de un límite
   * 
   * @param {string} userId - ID del usuario
   * @param {string} limitType - Tipo de límite
   * @param {number} amount - Cantidad a incrementar (default: 1)
   * @returns {Object} Nuevo estado del límite
   */
  async incrementUsage(userId, limitType, amount = 1) {
    // Verificar límite primero
    const limitCheck = await this.checkLimit(userId, limitType);
    
    if (!limitCheck.allowed) {
      throw new Error(`Límite excedido: ${limitType}`);
    }
    
    // Incrementar en Redis o MongoDB
    const usageKey = this._getUsageKey(userId, limitType);
    
    // TODO: Implementar con Redis para mejor performance
    // Por ahora usar MongoDB
    await User.findByIdAndUpdate(userId, {
      $inc: { [`usage.${usageKey}`]: amount }
    });
    
    return this.checkLimit(userId, limitType);
  }
  
  // =============================================
  // DESCUENTOS
  // =============================================
  
  /**
   * Aplicar descuento según tier
   * 
   * @param {string} userId - ID del usuario
   * @param {string} discountType - Tipo de descuento (bezCoin, gas, platformFee)
   * @param {number} amount - Cantidad base
   * @returns {Object} { originalAmount, discount, finalAmount, discountPercent }
   */
  async applyDiscount(userId, discountType, amount) {
    const user = await this._getUser(userId);
    const tier = user?.subscriptionTier || DEFAULT_TIER;
    const config = getTierConfig(tier);
    
    const discountPercent = config.discounts[discountType] || 0;
    const discount = amount * discountPercent;
    const finalAmount = amount - discount;
    
    return {
      originalAmount: amount,
      discountPercent: discountPercent * 100,
      discount: Math.round(discount * 100) / 100,
      finalAmount: Math.round(finalAmount * 100) / 100,
      tier,
      discountType
    };
  }
  
  // =============================================
  // GESTIÓN DE SUSCRIPCIONES
  // =============================================
  
  /**
   * Obtener información de suscripción del usuario
   */
  async getUserSubscription(userId) {
    const user = await this._getUser(userId);
    const tier = user?.subscriptionTier || DEFAULT_TIER;
    const config = getTierConfig(tier);
    
    return {
      tier,
      tierName: config.name,
      tierDescription: config.description,
      price: config.price,
      limits: config.limits,
      features: config.features,
      discounts: config.discounts,
      badge: config.badge,
      color: config.color,
      expiresAt: user?.subscriptionExpiresAt,
      isActive: this._isSubscriptionActive(user),
      isTrial: user?.isTrialActive,
      trialEndsAt: user?.trialEndsAt
    };
  }
  
  /**
   * Iniciar período de prueba
   */
  async startTrial(userId, tier = 'PRO') {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_PERIOD_DAYS);
    
    await User.findByIdAndUpdate(userId, {
      subscriptionTier: tier,
      isTrialActive: true,
      trialEndsAt,
      trialStartedAt: new Date()
    });
    
    return {
      success: true,
      tier,
      trialEndsAt,
      daysRemaining: TRIAL_PERIOD_DAYS
    };
  }
  
  /**
   * Crear sesión de checkout en Stripe
   */
  async createCheckoutSession(userId, tier, billingPeriod = 'monthly') {
    const stripeClient = getStripe();
    if (!stripeClient) {
      throw new Error('Stripe no está configurado');
    }
    
    const config = getTierConfig(tier);
    if (!config || tier === 'STARTER') {
      throw new Error('Tier inválido para upgrade');
    }
    
    const priceId = config.price.stripePriceId[billingPeriod];
    if (!priceId) {
      throw new Error(`Precio no configurado para ${tier} ${billingPeriod}`);
    }
    
    const user = await this._getUser(userId);
    
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId: userId.toString(),
        tier,
        billingPeriod
      }
    });
    
    return {
      checkoutUrl: session.url,
      sessionId: session.id
    };
  }
  
  /**
   * Procesar webhook de Stripe
   */
  async handleStripeWebhook(event) {
    switch (event.type) {
      case 'checkout.session.completed':
        return this._handleCheckoutComplete(event.data.object);
        
      case 'customer.subscription.updated':
        return this._handleSubscriptionUpdate(event.data.object);
        
      case 'customer.subscription.deleted':
        return this._handleSubscriptionCanceled(event.data.object);
        
      case 'invoice.payment_failed':
        return this._handlePaymentFailed(event.data.object);
        
      default:
        console.log(`[Subscription] Evento no manejado: ${event.type}`);
    }
  }
  
  /**
   * Cancelar suscripción
   */
  async cancelSubscription(userId, reason = null) {
    const user = await this._getUser(userId);
    
    if (user.stripeSubscriptionId) {
      const stripeClient = getStripe();
      await stripeClient.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    }
    
    await User.findByIdAndUpdate(userId, {
      subscriptionCancelReason: reason,
      subscriptionCancelRequestedAt: new Date()
    });
    
    return {
      success: true,
      message: 'Suscripción será cancelada al final del período actual'
    };
  }
  
  /**
   * Obtener todos los tiers para mostrar en UI
   */
  getAllTiers() {
    return TIER_HIERARCHY.map(tierKey => ({
      ...SUBSCRIPTION_TIERS[tierKey],
      tierKey,
      isPopular: tierKey === 'PRO'  // Marcar PRO como popular
    }));
  }
  
  // =============================================
  // MÉTODOS PRIVADOS
  // =============================================
  
  async _getUser(userId) {
    return await User.findById(userId).lean();
  }
  
  async _getCurrentUsage(userId, limitType) {
    // Determinar período de reset
    const period = this._getUsagePeriod(limitType);
    const user = await User.findById(userId).lean();
    
    if (!user?.usage) return 0;
    
    const usageKey = this._getUsageKey(userId, limitType);
    return user.usage[usageKey] || 0;
  }
  
  _getUsageKey(userId, limitType) {
    const period = this._getUsagePeriod(limitType);
    const periodKey = this._getPeriodKey(period);
    return `${limitType}_${periodKey}`;
  }
  
  _getUsagePeriod(limitType) {
    if (limitType.includes('PerDay')) return 'day';
    if (limitType.includes('PerMonth')) return 'month';
    if (limitType.includes('PerYear')) return 'year';
    return 'month'; // Default
  }
  
  _getPeriodKey(period) {
    const now = new Date();
    switch (period) {
      case 'day':
        return now.toISOString().split('T')[0]; // YYYY-MM-DD
      case 'month':
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      case 'year':
        return now.getFullYear().toString();
      default:
        return now.toISOString().split('T')[0];
    }
  }
  
  _getResetTime(limitType) {
    const period = this._getUsagePeriod(limitType);
    const now = new Date();
    
    switch (period) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case 'year':
        return new Date(now.getFullYear() + 1, 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }
  }
  
  _isSubscriptionActive(user) {
    if (!user) return false;
    if (user.subscriptionTier === 'STARTER') return true;
    if (user.isTrialActive && new Date(user.trialEndsAt) > new Date()) return true;
    if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > new Date()) return true;
    return false;
  }
  
  async _handleCheckoutComplete(session) {
    const { userId, tier, billingPeriod } = session.metadata;
    
    const expiresAt = new Date();
    if (billingPeriod === 'yearly') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
    
    await User.findByIdAndUpdate(userId, {
      subscriptionTier: tier,
      subscriptionExpiresAt: expiresAt,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      isTrialActive: false,
      subscriptionStartedAt: new Date()
    });
    
    console.log(`[Subscription] Usuario ${userId} actualizado a ${tier}`);
  }
  
  async _handleSubscriptionCanceled(subscription) {
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });
    if (!user) return;
    
    await User.findByIdAndUpdate(user._id, {
      subscriptionTier: DEFAULT_TIER,
      subscriptionExpiresAt: null,
      stripeSubscriptionId: null
    });
    
    console.log(`[Subscription] Suscripción cancelada para usuario ${user._id}`);
  }
  
  async _handlePaymentFailed(invoice) {
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    if (!user) return;
    
    // Notificar al usuario
    console.log(`[Subscription] Pago fallido para usuario ${user._id}`);
    // TODO: Enviar email de notificación
  }
  
  _getFeatureDescription(feature) {
    const descriptions = {
      canCreateProposals: 'Crear propuestas en el DAO',
      qualityOracleAccess: 'Validación de contenido en blockchain',
      priorityValidation: 'Validación prioritaria en la cola',
      advancedAIModels: 'Acceso a GPT-4 y modelos avanzados',
      customPrompts: 'Prompts personalizados para AI',
      aiPersonality: 'Personalidad de AI personalizable',
      apiAccess: 'Acceso a la API de BeZhas',
      webhooks: 'Webhooks personalizados',
      analytics: 'Analytics avanzados',
      exportData: 'Exportar tus datos',
      prioritySupport: 'Soporte prioritario',
      dedicatedManager: 'Account manager dedicado',
      verifiedBadge: 'Badge de verificado',
      customProfile: 'Perfil personalizable',
      scheduledPosts: 'Programar publicaciones'
    };
    
    return descriptions[feature] || feature;
  }
}

module.exports = new SubscriptionService();
```

---

### 3.4 Middleware de Suscripción

```javascript
// ============================================
// filepath: backend/middleware/subscription.middleware.js
// ============================================

const SubscriptionService = require('../services/subscription.service');

/**
 * Middleware para verificar acceso a un feature
 * 
 * Uso:
 *   router.post('/proposals', requireFeature('canCreateProposals'), controller.create)
 */
const requireFeature = (feature) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Debes iniciar sesión para acceder a esta función'
        });
      }
      
      const result = await SubscriptionService.checkFeatureAccess(req.user.id, feature);
      
      if (!result.hasAccess) {
        return res.status(403).json({
          error: 'FeatureNotAvailable',
          message: `Esta función requiere suscripción ${result.minimumTierRequired}`,
          currentTier: result.currentTier,
          requiredTier: result.minimumTierRequired,
          feature: result.featureInfo,
          upgradeUrl: '/subscription/upgrade'
        });
      }
      
      // Adjuntar info del tier al request para uso posterior
      req.subscription = {
        tier: result.currentTier,
        config: result.tierConfig
      };
      
      next();
    } catch (error) {
      console.error('[Subscription Middleware] Error:', error);
      next(error);
    }
  };
};

/**
 * Middleware para verificar límite de uso
 * 
 * Uso:
 *   router.post('/posts', checkLimit('postsPerMonth'), controller.create)
 */
const checkLimit = (limitType, options = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Debes iniciar sesión'
        });
      }
      
      const result = await SubscriptionService.checkLimit(req.user.id, limitType);
      
      if (!result.allowed) {
        return res.status(429).json({
          error: 'LimitExceeded',
          message: `Has alcanzado tu límite de ${limitType}`,
          current: result.current,
          limit: result.limit,
          resetAt: result.resetAt,
          percentUsed: result.percentUsed,
          upgradeUrl: '/subscription/upgrade',
          tip: 'Actualiza tu plan para obtener más capacidad'
        });
      }
      
      // Adjuntar info del límite al request
      req.usageInfo = result;
      
      // Auto-incrementar si está habilitado
      if (options.autoIncrement !== false) {
        req.incrementUsage = async (amount = 1) => {
          await SubscriptionService.incrementUsage(req.user.id, limitType, amount);
        };
      }
      
      next();
    } catch (error) {
      console.error('[Limit Middleware] Error:', error);
      next(error);
    }
  };
};

/**
 * Middleware para verificar tier mínimo
 * 
 * Uso:
 *   router.get('/api/data', requireTier('PRO'), controller.getData)
 */
const requireTier = (minimumTier) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Debes iniciar sesión'
        });
      }
      
      const subscription = await SubscriptionService.getUserSubscription(req.user.id);
      const { tierHasAccess } = require('../config/subscriptions.config');
      
      if (!tierHasAccess(subscription.tier, minimumTier)) {
        return res.status(403).json({
          error: 'TierRequired',
          message: `Esta función requiere suscripción ${minimumTier} o superior`,
          currentTier: subscription.tier,
          requiredTier: minimumTier,
          upgradeUrl: '/subscription/upgrade'
        });
      }
      
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('[Tier Middleware] Error:', error);
      next(error);
    }
  };
};

/**
 * Middleware para adjuntar info de suscripción sin bloquear
 * 
 * Uso:
 *   router.get('/profile', attachSubscription, controller.getProfile)
 */
const attachSubscription = async (req, res, next) => {
  try {
    if (req.user?.id) {
      req.subscription = await SubscriptionService.getUserSubscription(req.user.id);
    }
    next();
  } catch (error) {
    // No bloquear, solo log
    console.warn('[Subscription] Error adjuntando suscripción:', error.message);
    next();
  }
};

/**
 * Middleware para verificar modelo AI permitido
 * 
 * Uso:
 *   router.post('/ai/chat', checkAIModel(), controller.chat)
 */
const checkAIModel = () => {
  return async (req, res, next) => {
    try {
      const requestedModel = req.body.model || 'gpt-3.5-turbo';
      const subscription = await SubscriptionService.getUserSubscription(req.user.id);
      const allowedModels = subscription.limits.aiModels;
      
      if (!allowedModels.includes('all') && !allowedModels.includes(requestedModel)) {
        return res.status(403).json({
          error: 'ModelNotAllowed',
          message: `El modelo ${requestedModel} no está disponible en tu plan`,
          requestedModel,
          allowedModels,
          currentTier: subscription.tier,
          upgradeUrl: '/subscription/upgrade'
        });
      }
      
      req.aiModel = requestedModel;
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('[AI Model Middleware] Error:', error);
      next(error);
    }
  };
};

module.exports = {
  requireFeature,
  checkLimit,
  requireTier,
  attachSubscription,
  checkAIModel
};
```

---

### 3.5 Controlador de Suscripciones

```javascript
// ============================================
// filepath: backend/controllers/subscription.controller.js
// ============================================

const SubscriptionService = require('../services/subscription.service');
const TokenomicsService = require('../services/tokenomics.service');

class SubscriptionController {
  
  /**
   * GET /api/subscriptions/tiers
   * Obtener todos los planes disponibles
   */
  async getTiers(req, res) {
    try {
      const tiers = SubscriptionService.getAllTiers();
      res.json({
        success: true,
        tiers
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * GET /api/subscriptions/me
   * Obtener suscripción del usuario actual
   */
  async getMySubscription(req, res) {
    try {
      const subscription = await SubscriptionService.getUserSubscription(req.user.id);
      res.json({
        success: true,
        subscription
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * GET /api/subscriptions/usage
   * Obtener uso actual del usuario
   */
  async getUsage(req, res) {
    try {
      const limitTypes = [
        'postsPerMonth',
        'aiQueriesPerDay',
        'oracleValidationsPerMonth',
        'daoProposalsPerMonth'
      ];
      
      const usage = {};
      for (const limitType of limitTypes) {
        usage[limitType] = await SubscriptionService.checkLimit(req.user.id, limitType);
      }
      
      res.json({
        success: true,
        usage
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * POST /api/subscriptions/checkout
   * Crear sesión de pago
   */
  async createCheckout(req, res) {
    try {
      const { tier, billingPeriod = 'monthly' } = req.body;
      
      if (!tier || tier === 'STARTER') {
        return res.status(400).json({ 
          error: 'Tier inválido para checkout' 
        });
      }
      
      const result = await SubscriptionService.createCheckoutSession(
        req.user.id, 
        tier, 
        billingPeriod
      );
      
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * POST /api/subscriptions/trial
   * Iniciar período de prueba
   */
  async startTrial(req, res) {
    try {
      const result = await SubscriptionService.startTrial(req.user.id, 'PRO');
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * POST /api/subscriptions/cancel
   * Cancelar suscripción
   */
  async cancel(req, res) {
    try {
      const { reason } = req.body;
      const result = await SubscriptionService.cancelSubscription(req.user.id, reason);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * POST /api/subscriptions/webhook
   * Webhook de Stripe
   */
  async handleWebhook(req, res) {
    try {
      const sig = req.headers['stripe-signature'];
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.rawBody,
          sig,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
      
      await SubscriptionService.handleStripeWebhook(event);
      
      res.json({ received: true });
    } catch (error) {
      console.error('[Webhook Error]', error);
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * GET /api/subscriptions/estimate
   * Estimar costo de una operación
   */
  async estimateCost(req, res) {
    try {
      const { operationType, params } = req.query;
      const subscription = await SubscriptionService.getUserSubscription(req.user.id);
      
      const estimate = TokenomicsService.estimateCost(
        operationType,
        params ? JSON.parse(params) : {},
        subscription.tier
      );
      
      res.json({
        success: true,
        estimate,
        userTier: subscription.tier
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  
  /**
   * GET /api/subscriptions/models
   * Obtener modelos AI disponibles para el usuario
   */
  async getAvailableModels(req, res) {
    try {
      const subscription = await SubscriptionService.getUserSubscription(req.user.id);
      const models = TokenomicsService.getAvailableModels(subscription.tier);
      
      res.json({
        success: true,
        models,
        tier: subscription.tier
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new SubscriptionController();
```

---

### 3.6 Rutas de Suscripciones

```javascript
// ============================================
// filepath: backend/routes/subscription.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const SubscriptionController = require('../controllers/subscription.controller');
const { auth } = require('../middleware/auth.middleware');

// === Rutas Públicas ===

// Obtener planes disponibles
router.get('/tiers', SubscriptionController.getTiers);

// Webhook de Stripe (sin auth, pero con verificación de firma)
router.post('/webhook', 
  express.raw({ type: 'application/json' }),
  SubscriptionController.handleWebhook
);

// === Rutas Autenticadas ===

// Mi suscripción actual
router.get('/me', auth, SubscriptionController.getMySubscription);

// Mi uso actual
router.get('/usage', auth, SubscriptionController.getUsage);

// Modelos AI disponibles
router.get('/models', auth, SubscriptionController.getAvailableModels);

// Estimar costo de operación
router.get('/estimate', auth, SubscriptionController.estimateCost);

// Crear checkout para upgrade
router.post('/checkout', auth, SubscriptionController.createCheckout);

// Iniciar trial
router.post('/trial', auth, SubscriptionController.startTrial);

// Cancelar suscripción
router.post('/cancel', auth, SubscriptionController.cancel);

module.exports = router;
```

---

## 4. Modificaciones a Archivos Existentes

### 4.1 Modelo de Usuario

```javascript
// filepath: backend/models/User.js
// AGREGAR estos campos al schema existente:

{
  // ... campos existentes ...
  
  // === Suscripción ===
  subscriptionTier: {
    type: String,
    enum: ['STARTER', 'PRO', 'ENTERPRISE'],
    default: 'STARTER'
  },
  subscriptionExpiresAt: Date,
  subscriptionStartedAt: Date,
  subscriptionCancelRequestedAt: Date,
  subscriptionCancelReason: String,
  
  // === Trial ===
  isTrialActive: {
    type: Boolean,
    default: false
  },
  trialStartedAt: Date,
  trialEndsAt: Date,
  
  // === Stripe ===
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  
  // === Uso (para límites) ===
  usage: {
    type: Map,
    of: Number,
    default: {}
  }
}
```

### 4.2 Server.js (Registrar rutas)

```javascript
// filepath: backend/server.js
// AGREGAR:

const subscriptionRoutes = require('./routes/subscription.routes');
app.use('/api/v1/subscriptions', subscriptionRoutes);
```

### 4.3 Ejemplo de uso en rutas existentes

```javascript
// filepath: backend/routes/posts.routes.js
// MODIFICAR para usar middleware de suscripción:

const { requireFeature, checkLimit } = require('../middleware/subscription.middleware');

// Post simple - con límite
router.post('/',
  auth,
  checkLimit('postsPerMonth'),
  async (req, res, next) => {
    // ... crear post ...
    await req.incrementUsage(); // Incrementar contador
    // ...
  }
);

// Post con validación Oracle - requiere PRO
router.post('/validated',
  auth,
  requireFeature('qualityOracleAccess'),
  checkLimit('oracleValidationsPerMonth'),
  // ... controller ...
);
```

---

## 5. Variables de Entorno Requeridas

```bash
# filepath: backend/.env
# AGREGAR estas variables:

# === Stripe ===
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# === Tokenomics ===
BEZ_TO_USD_RATE=0.10
PLATFORM_FEE_PERCENT=2.5

# === Frontend URL (para redirects de Stripe) ===
FRONTEND_URL=http://localhost:3000
```

---

## 6. Dependencias NPM

```bash
# Instalar Stripe
cd backend
pnpm add stripe
```

---

## 7. Checklist de Implementación

### Fase 1: Configuración Base
- [ ] Crear `config/subscriptions.config.js`
- [ ] Crear `services/tokenomics.service.js`
- [ ] Agregar campos al modelo User
- [ ] Configurar variables de entorno

### Fase 2: Servicios Core
- [ ] Crear `services/subscription.service.js`
- [ ] Crear `middleware/subscription.middleware.js`
- [ ] Tests unitarios para servicios

### Fase 3: API
- [ ] Crear `controllers/subscription.controller.js`
- [ ] Crear `routes/subscription.routes.js`
- [ ] Registrar rutas en server.js
- [ ] Tests de integración

### Fase 4: Integración Stripe
- [ ] Configurar productos en Stripe Dashboard
- [ ] Obtener Price IDs reales
- [ ] Configurar webhook en Stripe
- [ ] Probar flujo completo de pago

### Fase 5: Integración en Features Existentes
- [ ] Agregar middleware a rutas de posts
- [ ] Agregar middleware a rutas de AI
- [ ] Agregar middleware a rutas de DAO
- [ ] Probar límites y restricciones

### Fase 6: Frontend
- [ ] Crear página de pricing
- [ ] Crear página de checkout
- [ ] Mostrar límites en UI
- [ ] Mostrar badges de tier

---

## Notas de Revisión

> **Para el desarrollador:** Revisar cuidadosamente:
> 
> 1. **Precios**: ¿Los precios propuestos ($14.99 y $99.99) son competitivos?
> 2. **Límites**: ¿Los límites por tier son razonables?
> 3. **Descuentos**: ¿25% y 50% son apropiados?
> 4. **Features**: ¿Falta algún feature importante?
> 5. **Modelos AI**: ¿Se deben agregar más modelos?

---

*Documento generado: 27 de Enero, 2026*
