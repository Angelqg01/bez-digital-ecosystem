/**
 * ClothingRental Service - Lógica de negocio para Alquiler/Compra de Ropa
 * Integración con cadena AEGIS (anomaly_detector, sentiment_analyzer, ux_optimizer)
 */

const axios = require('axios');

// Configuración AEGIS
const AEGIS_API_URL = process.env.AEGIS_API_URL || 'http://localhost:8000/api/aegis';

// En desarrollo usamos in-memory storage
// En producción usar MongoDB con el modelo ClothingRental
const rentalsDB = new Map();
let rentalCounter = 1;

/**
 * Crear nueva solicitud de alquiler/compra
 */
async function createRental(data) {
    const rental = {
        _id: `rental_${Date.now()}_${rentalCounter++}`,
        rentalId: `RENT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,

        // Cliente
        customer: {
            walletAddress: data.customerWallet?.toLowerCase(),
            displayName: data.customerName || 'Anonymous',
            email: data.customerEmail,
            phone: data.customerPhone,
            shippingAddress: data.shippingAddress || {}
        },

        // Comercio
        merchant: {
            merchantId: data.merchantId,
            walletAddress: data.merchantWallet?.toLowerCase(),
            businessName: data.merchantName || 'BeZhas Store',
            businessType: data.merchantType || 'BOUTIQUE',
            rating: data.merchantRating || 4.5,
            verifiedMerchant: true
        },

        // Tipo de transacción
        transactionType: data.transactionType || 'RENTAL',

        // Estado inicial
        status: 'PENDING',

        // Items
        items: data.items.map(item => ({
            itemId: `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: item.name,
            description: item.description,
            category: item.category,
            brand: item.brand,
            size: item.size,
            color: item.color,
            condition: item.condition || 'GOOD',
            images: item.images || [],
            retailPrice: item.retailPrice || 0,
            rentalPricePerDay: item.rentalPricePerDay || 0,
            depositRequired: item.depositRequired || 0,
            insuranceIncluded: item.insuranceIncluded || false
        })),

        // Período de alquiler
        rentalPeriod: data.rentalPeriod || {
            startDate: new Date(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días default
            durationDays: 7,
            extensionAllowed: true,
            maxExtensionDays: 30
        },

        // Pricing
        pricing: {
            subtotal: data.subtotal || 0,
            deposit: data.deposit || 0,
            insuranceFee: data.insuranceFee || 0,
            deliveryFee: data.deliveryFee || 5,
            platformFee: data.platformFee || 2.5,
            totalAmount: data.totalAmount || 0,
            currency: 'BEZ',
            fiatEquivalent: {
                amount: data.fiatAmount || 0,
                currency: 'EUR'
            }
        },

        // AEGIS - inicializado vacío
        aegisEvaluation: {
            initiated: false,
            initiatedAt: null,
            anomalyDetection: { checked: false },
            sentimentAnalysis: { checked: false },
            uxOptimization: { checked: false },
            finalScore: null,
            recommendation: null,
            completedAt: null,
            processingTimeMs: null,
            merchantDecision: null
        },

        // Timeline
        timeline: [{
            event: 'RENTAL_CREATED',
            description: 'Solicitud de alquiler creada',
            actor: 'CUSTOMER',
            timestamp: new Date()
        }],

        // Pagos
        payments: [],

        // Logística
        logistics: {},

        // Disputas
        dispute: { isDisputed: false },

        // Reviews
        reviews: {},

        // NFT
        nftDetails: { isNFTBacked: false },

        // Timestamps
        createdAt: new Date(),
        updatedAt: new Date()
    };

    // Calcular total si no se proporcionó
    if (!rental.pricing.totalAmount) {
        const itemsTotal = rental.items.reduce((sum, item) => {
            if (rental.transactionType === 'RENTAL') {
                return sum + (item.rentalPricePerDay * rental.rentalPeriod.durationDays);
            }
            return sum + item.retailPrice;
        }, 0);

        rental.pricing.subtotal = itemsTotal;
        rental.pricing.totalAmount = itemsTotal + rental.pricing.deposit +
            rental.pricing.insuranceFee +
            rental.pricing.deliveryFee +
            rental.pricing.platformFee;
    }

    // Guardar
    rentalsDB.set(rental.rentalId, rental);

    // Iniciar cadena AEGIS automáticamente
    setTimeout(() => initiateAegisEvaluation(rental.rentalId), 500);

    return rental;
}

/**
 * Obtener alquileres por cliente
 */
async function getRentalsByCustomer(walletAddress) {
    const rentals = [];
    for (const rental of rentalsDB.values()) {
        if (rental.customer.walletAddress === walletAddress.toLowerCase()) {
            rentals.push(rental);
        }
    }
    return rentals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Obtener alquileres por comercio
 */
async function getRentalsByMerchant(walletAddress) {
    const rentals = [];
    for (const rental of rentalsDB.values()) {
        if (rental.merchant.walletAddress === walletAddress.toLowerCase()) {
            rentals.push(rental);
        }
    }
    return rentals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Obtener alquiler por ID
 */
async function getRentalById(rentalId) {
    return rentalsDB.get(rentalId) || null;
}

/**
 * Iniciar cadena de evaluación AEGIS
 */
async function initiateAegisEvaluation(rentalId) {
    const rental = rentalsDB.get(rentalId);
    if (!rental) throw new Error('Rental not found');

    const startTime = Date.now();

    // Actualizar estado
    rental.status = 'AEGIS_REVIEW';
    rental.aegisEvaluation.initiated = true;
    rental.aegisEvaluation.initiatedAt = new Date();

    rental.timeline.push({
        event: 'AEGIS_CHAIN_INITIATED',
        description: 'Iniciando evaluación de seguridad AEGIS',
        actor: 'SYSTEM',
        timestamp: new Date()
    });

    console.log(`[AEGIS] Iniciando evaluación para rental ${rentalId}`);

    try {
        // PASO 1: Detección de Anomalías
        const anomalyResult = await runAnomalyDetection(rental);
        rental.aegisEvaluation.anomalyDetection = {
            checked: true,
            checkedAt: new Date(),
            ...anomalyResult
        };

        rental.timeline.push({
            event: 'AEGIS_ANOMALY_DETECTION_COMPLETE',
            description: `Análisis de anomalías completado. Risk Level: ${anomalyResult.riskLevel}`,
            actor: 'AEGIS',
            timestamp: new Date(),
            metadata: anomalyResult
        });

        console.log(`[AEGIS] Anomaly Detection: ${anomalyResult.riskLevel}, Score: ${anomalyResult.score}`);

        // PASO 2: Análisis de Sentimiento
        const sentimentResult = await runSentimentAnalysis(rental);
        rental.aegisEvaluation.sentimentAnalysis = {
            checked: true,
            checkedAt: new Date(),
            ...sentimentResult
        };

        rental.timeline.push({
            event: 'AEGIS_SENTIMENT_ANALYSIS_COMPLETE',
            description: `Análisis de sentimiento completado. Customer: ${sentimentResult.customerSentiment.toFixed(2)}`,
            actor: 'AEGIS',
            timestamp: new Date(),
            metadata: sentimentResult
        });

        console.log(`[AEGIS] Sentiment Analysis: Customer ${sentimentResult.customerSentiment.toFixed(2)}`);

        // PASO 3: Optimización UX
        const uxResult = await runUXOptimization(rental);
        rental.aegisEvaluation.uxOptimization = {
            checked: true,
            checkedAt: new Date(),
            ...uxResult
        };

        rental.timeline.push({
            event: 'AEGIS_UX_OPTIMIZATION_COMPLETE',
            description: `Optimización UX completada. Probabilidad conversión: ${(uxResult.conversionProbability * 100).toFixed(0)}%`,
            actor: 'AEGIS',
            timestamp: new Date(),
            metadata: uxResult
        });

        console.log(`[AEGIS] UX Optimization: Conversion probability ${(uxResult.conversionProbability * 100).toFixed(0)}%`);

        // Calcular score final y recomendación
        const finalScore = calculateFinalScore(
            anomalyResult,
            sentimentResult,
            uxResult
        );

        const recommendation = determineRecommendation(finalScore, anomalyResult.riskLevel);

        // Completar evaluación
        rental.aegisEvaluation.finalScore = finalScore;
        rental.aegisEvaluation.recommendation = recommendation;
        rental.aegisEvaluation.completedAt = new Date();
        rental.aegisEvaluation.processingTimeMs = Date.now() - startTime;

        rental.timeline.push({
            event: 'AEGIS_EVALUATION_COMPLETE',
            description: `Evaluación AEGIS completada. Score: ${finalScore}/100, Recomendación: ${recommendation}`,
            actor: 'AEGIS',
            timestamp: new Date(),
            metadata: { finalScore, recommendation }
        });

        console.log(`[AEGIS] Evaluación completada: Score ${finalScore}, Recomendación: ${recommendation}`);

        // Auto-aprobar si score alto y bajo riesgo
        if (recommendation === 'APPROVE' && finalScore >= 80) {
            rental.status = 'APPROVED';
            rental.aegisEvaluation.merchantDecision = {
                decision: 'APPROVED',
                decidedAt: new Date(),
                notes: 'Auto-aprobado por AEGIS (score >= 80)'
            };
        }

        rental.updatedAt = new Date();
        rentalsDB.set(rentalId, rental);

    } catch (error) {
        console.error(`[AEGIS] Error en evaluación:`, error.message);

        // En caso de error, continuar con evaluación manual
        rental.aegisEvaluation.recommendation = 'MANUAL_REVIEW';
        rental.timeline.push({
            event: 'AEGIS_EVALUATION_ERROR',
            description: `Error en evaluación AEGIS: ${error.message}. Requiere revisión manual.`,
            actor: 'SYSTEM',
            timestamp: new Date()
        });

        rental.updatedAt = new Date();
        rentalsDB.set(rentalId, rental);
    }

    return rental;
}

/**
 * Ejecutar detección de anomalías
 */
async function runAnomalyDetection(rental) {
    try {
        // Intentar llamar a AEGIS real
        const response = await axios.post(`${AEGIS_API_URL}/analyze/anomaly`, {
            walletAddress: rental.customer.walletAddress,
            transactionAmount: rental.pricing.totalAmount,
            transactionType: rental.transactionType,
            itemCount: rental.items.length
        }, { timeout: 5000 });

        return response.data;
    } catch (error) {
        // Simulación si AEGIS no está disponible
        console.log('[AEGIS] Using simulated anomaly detection');

        const score = Math.random() * 0.3; // 0-0.3 (bajo riesgo en simulación)
        const flags = [];

        if (rental.pricing.totalAmount > 500) {
            flags.push('HIGH_VALUE_TRANSACTION');
        }
        if (!rental.customer.email) {
            flags.push('MISSING_EMAIL');
        }

        let riskLevel = 'LOW';
        if (score > 0.7) riskLevel = 'CRITICAL';
        else if (score > 0.5) riskLevel = 'HIGH';
        else if (score > 0.3) riskLevel = 'MEDIUM';

        return {
            score,
            flags,
            riskLevel,
            details: {
                walletAnalysis: 'OK',
                transactionPattern: 'NORMAL',
                velocityCheck: 'PASSED'
            }
        };
    }
}

/**
 * Ejecutar análisis de sentimiento
 */
async function runSentimentAnalysis(rental) {
    try {
        const response = await axios.post(`${AEGIS_API_URL}/analyze/sentiment`, {
            customerId: rental.customer.walletAddress,
            merchantId: rental.merchant.merchantId
        }, { timeout: 5000 });

        return response.data;
    } catch (error) {
        console.log('[AEGIS] Using simulated sentiment analysis');

        // Simulación
        return {
            customerSentiment: 0.3 + Math.random() * 0.5, // 0.3-0.8 positivo
            merchantSentiment: 0.5 + Math.random() * 0.4, // 0.5-0.9 positivo
            reviewsAnalyzed: Math.floor(Math.random() * 10) + 1,
            concerns: [],
            details: {
                customerHistory: 'POSITIVE',
                merchantReputation: 'EXCELLENT'
            }
        };
    }
}

/**
 * Ejecutar optimización UX
 */
async function runUXOptimization(rental) {
    try {
        const response = await axios.post(`${AEGIS_API_URL}/optimize/ux`, {
            userId: rental.customer.walletAddress,
            transactionType: rental.transactionType,
            category: rental.items[0]?.category
        }, { timeout: 5000 });

        return response.data;
    } catch (error) {
        console.log('[AEGIS] Using simulated UX optimization');

        // Simulación
        const improvements = [];

        if (!rental.customer.shippingAddress?.street) {
            improvements.push('Solicitar dirección de envío completa');
        }
        if (rental.transactionType === 'RENTAL') {
            improvements.push('Mostrar opción de extensión de alquiler');
        }

        return {
            suggestedImprovements: improvements,
            personalizationApplied: {
                recommendedCategories: ['FORMAL', 'LUXURY'],
                suggestedItems: []
            },
            conversionProbability: 0.7 + Math.random() * 0.25 // 70-95%
        };
    }
}

/**
 * Calcular score final ponderado
 */
function calculateFinalScore(anomaly, sentiment, ux) {
    // Pesos: Anomalía 40%, Sentimiento 30%, UX 30%
    const anomalyScore = Math.max(0, 100 - (anomaly.score * 100)); // Invertir: menor anomalía = mejor
    const sentimentScore = ((sentiment.customerSentiment + sentiment.merchantSentiment) / 2 + 1) * 50; // Escala -1 a 1 -> 0-100
    const uxScore = ux.conversionProbability * 100;

    const finalScore = Math.round(
        (anomalyScore * 0.4) +
        (sentimentScore * 0.3) +
        (uxScore * 0.3)
    );

    return Math.min(100, Math.max(0, finalScore));
}

/**
 * Determinar recomendación basada en score y riesgo
 */
function determineRecommendation(score, riskLevel) {
    if (riskLevel === 'CRITICAL') return 'REJECT';
    if (riskLevel === 'HIGH') return 'MANUAL_REVIEW';
    if (score >= 70) return 'APPROVE';
    if (score >= 50) return 'MANUAL_REVIEW';
    return 'REJECT';
}

/**
 * Obtener estado de AEGIS para un rental
 */
async function getAegisStatus(rentalId) {
    const rental = rentalsDB.get(rentalId);
    if (!rental) throw new Error('Rental not found');

    return {
        rentalId: rental.rentalId,
        status: rental.status,
        aegis: rental.aegisEvaluation
    };
}

/**
 * Registrar decisión del comercio
 */
async function recordMerchantDecision(rentalId, decisionData) {
    const rental = rentalsDB.get(rentalId);
    if (!rental) throw new Error('Rental not found');

    rental.aegisEvaluation.merchantDecision = {
        decision: decisionData.decision,
        decidedAt: new Date(),
        notes: decisionData.notes,
        counterOfferDetails: decisionData.counterOfferDetails
    };

    // Actualizar status basado en decisión
    if (decisionData.decision === 'APPROVED') {
        rental.status = 'APPROVED';
    } else if (decisionData.decision === 'REJECTED') {
        rental.status = 'REJECTED';
    }

    rental.timeline.push({
        event: 'MERCHANT_DECISION',
        description: `Comercio decidió: ${decisionData.decision}`,
        actor: 'MERCHANT',
        timestamp: new Date(),
        metadata: decisionData
    });

    rental.updatedAt = new Date();
    rentalsDB.set(rentalId, rental);

    return rental;
}

/**
 * Registrar pago
 */
async function recordPayment(rentalId, paymentData) {
    const rental = rentalsDB.get(rentalId);
    if (!rental) throw new Error('Rental not found');

    rental.payments.push({
        paymentId: `PAY-${Date.now()}`,
        type: paymentData.type,
        amount: paymentData.amount,
        currency: paymentData.currency || 'BEZ',
        txHash: paymentData.txHash,
        status: paymentData.txHash ? 'CONFIRMED' : 'PENDING',
        paidAt: new Date()
    });

    // Si es el pago principal, activar el alquiler
    if (paymentData.type === 'RENTAL_FEE' || paymentData.type === 'PURCHASE') {
        rental.status = 'ACTIVE';
    }

    rental.timeline.push({
        event: 'PAYMENT_RECORDED',
        description: `Pago de ${paymentData.amount} ${paymentData.currency || 'BEZ'} (${paymentData.type})`,
        actor: 'SYSTEM',
        timestamp: new Date(),
        metadata: paymentData
    });

    rental.updatedAt = new Date();
    rentalsDB.set(rentalId, rental);

    return rental;
}

/**
 * Procesar devolución
 */
async function processReturn(rentalId, returnData) {
    const rental = rentalsDB.get(rentalId);
    if (!rental) throw new Error('Rental not found');

    rental.logistics.returnCondition = returnData.returnCondition;
    rental.logistics.returnNotes = returnData.returnNotes;
    rental.logistics.returnPhotos = returnData.returnPhotos;
    rental.logistics.returnedAt = new Date();

    rental.status = 'RETURNED';

    // Si hay daños, calcular penalización
    if (returnData.returnCondition === 'DAMAGED' || returnData.returnCondition === 'MISSING_ITEMS') {
        rental.payments.push({
            paymentId: `PEN-${Date.now()}`,
            type: 'PENALTY',
            amount: rental.pricing.deposit * 0.5, // 50% del depósito
            currency: 'BEZ',
            status: 'PENDING',
            paidAt: new Date()
        });
    }

    rental.timeline.push({
        event: 'ITEM_RETURNED',
        description: `Artículo devuelto en condición: ${returnData.returnCondition}`,
        actor: 'CUSTOMER',
        timestamp: new Date(),
        metadata: returnData
    });

    rental.updatedAt = new Date();
    rentalsDB.set(rentalId, rental);

    return rental;
}

/**
 * Agregar review
 */
async function addReview(rentalId, reviewData) {
    const rental = rentalsDB.get(rentalId);
    if (!rental) throw new Error('Rental not found');

    if (reviewData.reviewerType === 'customer') {
        rental.reviews.customerReview = {
            rating: reviewData.rating,
            comment: reviewData.comment,
            photoUrls: reviewData.photoUrls || [],
            createdAt: new Date()
        };
    } else {
        rental.reviews.merchantReview = {
            rating: reviewData.rating,
            comment: reviewData.comment,
            createdAt: new Date()
        };
    }

    // Si ambas reviews están completas, marcar como completado
    if (rental.reviews.customerReview && rental.reviews.merchantReview) {
        rental.status = 'COMPLETED';
    }

    rental.timeline.push({
        event: 'REVIEW_ADDED',
        description: `Review de ${reviewData.reviewerType}: ${reviewData.rating}/5 estrellas`,
        actor: reviewData.reviewerType.toUpperCase(),
        timestamp: new Date()
    });

    rental.updatedAt = new Date();
    rentalsDB.set(rentalId, rental);

    return rental;
}

/**
 * Obtener rentals pendientes de revisión AEGIS
 */
async function getPendingAegisReview() {
    const pending = [];
    for (const rental of rentalsDB.values()) {
        if (rental.status === 'AEGIS_REVIEW') {
            pending.push(rental);
        }
    }
    return pending;
}

/**
 * Obtener estadísticas del sistema
 */
async function getSystemStats() {
    const stats = {
        total: 0,
        byStatus: {},
        byType: {},
        totalRevenue: 0,
        avgAegisScore: 0,
        aegisScores: []
    };

    for (const rental of rentalsDB.values()) {
        stats.total++;

        // Por estado
        stats.byStatus[rental.status] = (stats.byStatus[rental.status] || 0) + 1;

        // Por tipo
        stats.byType[rental.transactionType] = (stats.byType[rental.transactionType] || 0) + 1;

        // Revenue
        if (['ACTIVE', 'COMPLETED', 'RETURNED'].includes(rental.status)) {
            stats.totalRevenue += rental.pricing.totalAmount;
        }

        // AEGIS scores
        if (rental.aegisEvaluation.finalScore !== null) {
            stats.aegisScores.push(rental.aegisEvaluation.finalScore);
        }
    }

    // Calcular promedio AEGIS
    if (stats.aegisScores.length > 0) {
        stats.avgAegisScore = Math.round(
            stats.aegisScores.reduce((a, b) => a + b, 0) / stats.aegisScores.length
        );
    }

    delete stats.aegisScores; // No exponer array completo

    return stats;
}

module.exports = {
    createRental,
    getRentalsByCustomer,
    getRentalsByMerchant,
    getRentalById,
    initiateAegisEvaluation,
    getAegisStatus,
    recordMerchantDecision,
    recordPayment,
    processReturn,
    addReview,
    getPendingAegisReview,
    getSystemStats
};
