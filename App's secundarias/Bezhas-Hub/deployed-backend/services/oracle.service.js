/**
 * ============================================================================
 * AI ORACLE SERVICE
 * ============================================================================
 * 
 * Conecta análisis de IA con validación en blockchain
 * Flujo: Usuario crea contenido → AI analiza → Blockchain valida → Recompensa
 */

const { ethers } = require('ethers');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const Post = require('../models/post.model');
const User = require('../models/user.model');

class AIOracle {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.qualityEscrowContract = null;
        this.contentValidatorContract = null;
        this.geminiAI = null;
        this.isInitialized = false;
        this.processingQueue = new Set();

        this.initialize();
    }

    /**
     * Inicializar Oracle
     */
    async initialize() {
        try {
            console.log('🔮 Initializing AI Oracle Service...');

            // 1. Conectar a Polygon
            const rpcUrl = process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // 2. Wallet del Oráculo (necesita permisos de validador)
            const privateKey = process.env.PRIVATE_KEY || process.env.HOT_WALLET_PRIVATE_KEY;
            if (!privateKey) {
                throw new Error('PRIVATE_KEY o HOT_WALLET_PRIVATE_KEY no configurada');
            }
            this.wallet = new ethers.Wallet(privateKey, this.provider);

            console.log(`   Oracle Wallet: ${this.wallet.address}`);

            // 3. Cargar contrato Quality Escrow
            const qualityEscrowAddress = process.env.QUALITY_ESCROW_ADDRESS;
            if (qualityEscrowAddress && qualityEscrowAddress !== 'PENDING') {
                try {
                    const escrowABI = require('../contracts/BeZhasQualityEscrow.json').abi;
                    this.qualityEscrowContract = new ethers.Contract(
                        qualityEscrowAddress,
                        escrowABI,
                        this.wallet
                    );
                    console.log(`   ✅ Quality Escrow loaded: ${qualityEscrowAddress}`);
                } catch (err) {
                    console.warn(`   ⚠️  Quality Escrow ABI not found, skipping...`);
                }
            }

            // 4. Inicializar Gemini AI
            const geminiKey = process.env.GEMINI_API_KEY;
            if (!geminiKey) {
                throw new Error('GEMINI_API_KEY no configurada');
            }
            this.geminiAI = new GoogleGenerativeAI(geminiKey);
            console.log('   ✅ Gemini AI initialized');

            this.isInitialized = true;
            console.log('✅ AI Oracle Service initialized successfully\n');

        } catch (error) {
            console.error('❌ Error initializing AI Oracle:', error.message);
            this.isInitialized = false;
        }
    }

    /**
     * Analizar contenido con IA (Gemini)
     */
    async analyzeContent(content, contentType = 'post') {
        try {
            if (!this.geminiAI) {
                throw new Error('Gemini AI not initialized');
            }

            const model = this.geminiAI.getGenerativeModel({ model: 'gemini-pro' });

            // Prompt optimizado para análisis de calidad
            const prompt = `
Analiza la calidad del siguiente ${contentType} basándote en estos criterios:

1. Relevancia y valor informativo (0-25 puntos)
2. Originalidad y creatividad (0-25 puntos)
3. Claridad y coherencia (0-25 puntos)
4. Engagement potencial (0-25 puntos)

Contenido a analizar:
"${content}"

Responde ÚNICAMENTE con un número del 0 al 100 representando la puntuación total.
Si el contenido es spam, ofensivo o de muy baja calidad, responde con 0.
No incluyas explicaciones, solo el número.
`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const scoreText = response.text().trim();

            // Extraer número
            const score = parseInt(scoreText.match(/\d+/)?.[0] || '0');

            // Validar rango
            const validatedScore = Math.max(0, Math.min(100, score));

            console.log(`📊 AI Analysis: Score = ${validatedScore}/100`);

            return {
                score: validatedScore,
                timestamp: Date.now(),
                rawResponse: scoreText
            };

        } catch (error) {
            console.error('Error analyzing content with AI:', error.message);
            // En caso de error, retornar puntuación neutral
            return {
                score: 50,
                timestamp: Date.now(),
                error: error.message
            };
        }
    }

    /**
     * Validar contenido en blockchain
     */
    async validateContentOnChain(contentId, score) {
        try {
            if (!this.qualityEscrowContract) {
                console.warn('Quality Escrow contract not loaded, skipping blockchain validation');
                return { success: false, reason: 'Contract not available' };
            }

            // Verificar que el wallet tenga permisos de validador
            const isValidator = await this.qualityEscrowContract.authorizedValidators(this.wallet.address);
            if (!isValidator) {
                throw new Error(`Wallet ${this.wallet.address} is not an authorized validator`);
            }

            console.log(`📝 Validating content ${contentId} on-chain with score ${score}...`);

            // Convertir contentId a bytes32 si es necesario
            const contentIdBytes32 = ethers.id(contentId.toString());

            // Llamar a la función de validación
            const tx = await this.qualityEscrowContract.verifyContent(
                contentIdBytes32,
                score,
                {
                    gasLimit: 200000
                }
            );

            console.log(`   TX Hash: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`   ✅ Validated in block ${receipt.blockNumber}`);

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            console.error('Error validating on-chain:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Proceso completo: Analizar con IA y Validar en Blockchain
     */
    async processContent(postId, content, userId) {
        try {
            // Evitar procesamiento duplicado
            if (this.processingQueue.has(postId)) {
                console.log(`⏭️  Content ${postId} already being processed, skipping...`);
                return { success: false, reason: 'Already processing' };
            }

            this.processingQueue.add(postId);
            console.log(`\n🔮 Processing content ${postId}...`);

            // 1. Analizar con IA
            const analysis = await this.analyzeContent(content, 'post');

            // 2. Actualizar en base de datos
            await Post.findByIdAndUpdate(postId, {
                qualityScore: analysis.score,
                aiAnalyzedAt: new Date(),
                aiAnalysisData: {
                    score: analysis.score,
                    analyzedAt: analysis.timestamp,
                    model: 'gemini-pro'
                }
            });

            // 3. Validar en blockchain (solo si el score es alto)
            let blockchainValidation = null;
            if (analysis.score >= 60 && this.qualityEscrowContract) {
                blockchainValidation = await this.validateContentOnChain(postId, analysis.score);

                if (blockchainValidation.success) {
                    await Post.findByIdAndUpdate(postId, {
                        blockchainValidated: true,
                        validationTxHash: blockchainValidation.txHash
                    });
                }
            }

            // 4. Calcular y distribuir recompensas
            if (analysis.score >= 70) {
                await this.distributeRewards(userId, postId, analysis.score);
            }

            this.processingQueue.delete(postId);

            console.log(`✅ Content ${postId} processed successfully\n`);

            return {
                success: true,
                aiAnalysis: analysis,
                blockchainValidation,
                rewardsDistributed: analysis.score >= 70
            };

        } catch (error) {
            this.processingQueue.delete(postId);
            console.error(`Error processing content ${postId}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Distribuir recompensas basadas en calidad
     */
    async distributeRewards(userId, postId, qualityScore) {
        try {
            console.log(`💰 Distributing rewards for user ${userId}...`);

            // Calcular recompensa basada en el score
            // Score 70-79: 10 BEZ
            // Score 80-89: 20 BEZ
            // Score 90-100: 50 BEZ
            let rewardAmount = 0;
            if (qualityScore >= 90) rewardAmount = 50;
            else if (qualityScore >= 80) rewardAmount = 20;
            else if (qualityScore >= 70) rewardAmount = 10;

            // Actualizar balance del usuario en DB
            await User.findByIdAndUpdate(userId, {
                $inc: { bezBalance: rewardAmount, totalEarned: rewardAmount }
            });

            // Registrar en historial
            await Post.findByIdAndUpdate(postId, {
                $set: {
                    rewardAmount,
                    rewardDistributed: true,
                    rewardDistributedAt: new Date()
                }
            });

            console.log(`   ✅ ${rewardAmount} BEZ rewarded to user ${userId}`);

            return { success: true, amount: rewardAmount };

        } catch (error) {
            console.error('Error distributing rewards:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Escuchar nuevos posts y procesarlos automáticamente
     */
    startAutoProcessing() {
        console.log('🤖 Starting auto-processing of new content...\n');

        // Polling cada 30 segundos
        setInterval(async () => {
            try {
                // Buscar posts no analizados
                const unanalyzedPosts = await Post.find({
                    qualityScore: { $exists: false },
                    content: { $exists: true, $ne: '' }
                }).limit(10);

                for (const post of unanalyzedPosts) {
                    await this.processContent(post._id, post.content, post.userId);
                    // Pequeña pausa entre procesamiento
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                console.error('Error in auto-processing:', error.message);
            }
        }, 30000); // Cada 30 segundos
    }
}

// Singleton instance
let oracleInstance = null;

function getOracle() {
    if (!oracleInstance) {
        oracleInstance = new AIOracle();
    }
    return oracleInstance;
}

module.exports = {
    AIOracle,
    getOracle
};
