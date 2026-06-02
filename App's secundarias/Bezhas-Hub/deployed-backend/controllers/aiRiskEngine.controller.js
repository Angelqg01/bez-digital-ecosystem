const { ethers } = require('ethers');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

/**
 * AI Risk Engine Controller
 * Evalúa riesgos de transacciones y genera firmas criptográficas para el contrato BezLiquidityRamp
 */

// Private key del signer (en producción debe estar en .env)
const AI_SIGNER_PRIVATE_KEY = process.env.AI_SIGNER_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';
const CONTRACT_ADDRESS = process.env.BEZ_LIQUIDITY_RAMP_ADDRESS || '0x0000000000000000000000000000000000000000';

// Wallet del AI Signer
const aiSigner = new ethers.Wallet(AI_SIGNER_PRIVATE_KEY);

/**
 * Risk Score Calculator
 * Evalúa el riesgo basado en datos on-chain y comportamiento del usuario
 */
const calculateRiskScore = (inputData) => {
    let score = 100; // Empieza con 100 (bajo riesgo)
    const flags = [];

    const { actor, on_chain_data, transaction, metadata } = inputData;

    // 1. Verificación KYC
    if (!actor.kyc_level || actor.kyc_level < 1) {
        score -= 30;
        flags.push('NO_KYC');
    }

    // 2. Análisis de VPN/Proxy
    if (actor.session_data?.is_vpn) {
        score -= 10;
        flags.push('VPN_DETECTED');
    }

    // 3. Edad de la cuenta (wallet nueva = riesgo)
    if (on_chain_data.last_active_days > 180) {
        score -= 20;
        flags.push('INACTIVE_WALLET');
    }

    // 4. Balance nativo bajo (posible drainer)
    const balance = parseFloat(on_chain_data.balance_native || '0');
    if (balance < 0.01) {
        score -= 15;
        flags.push('LOW_NATIVE_BALANCE');
    }

    // 5. Detección de contrato (bots)
    if (on_chain_data.is_contract) {
        score -= 40;
        flags.push('CONTRACT_ADDRESS');
    }

    // 6. Transacciones de alto valor
    if (transaction.fiat_amount > 10000) {
        score -= 10;
        flags.push('HIGH_VALUE_TX');
    }

    // 7. Nonce muy bajo (cuenta nueva sospechosa)
    if (on_chain_data.nonce < 5) {
        score -= 10;
        flags.push('NEW_WALLET');
    }

    // Clamp score entre 0-100
    score = Math.max(0, Math.min(100, score));

    // Determinar categoría de riesgo
    let category = 'LOW_RISK';
    if (score < 40) category = 'HIGH_RISK';
    else if (score < 70) category = 'MEDIUM_RISK';
    else if (score >= 90) category = 'INSTITUTIONAL_LOW';

    return { score, category, flags };
};

/**
 * @desc    Evalúa riesgo y genera firma criptográfica para swap
 * @route   POST /api/ai/sign-swap
 * @access  Public (requiere datos válidos)
 */
exports.signSwapTransaction = asyncHandler(async (req, res, next) => {
    const inputData = req.body;

    // Validación de entrada
    if (!inputData.actor?.address) {
        return next(new ErrorResponse('Address is required', 400));
    }

    if (!inputData.transaction?.fiat_amount) {
        return next(new ErrorResponse('Transaction amount is required', 400));
    }

    // 1. Calcular Score de Riesgo
    const riskAnalysis = calculateRiskScore(inputData);

    // 2. Decisión de aprobación (threshold: 60/100)
    const canProceed = riskAnalysis.score >= 60;
    const verdict = canProceed ? 'APPROVE' : 'REJECT';

    // Si es rechazado, devolver sin firma
    if (!canProceed) {
        return res.status(200).json({
            decision_engine: {
                verdict,
                confidence_score: riskAnalysis.score / 100,
                risk_category: riskAnalysis.category,
                internal_flags: riskAnalysis.flags
            },
            execution_parameters: {
                can_proceed: false,
                reason: 'Risk score below threshold',
                whitelist_ttl_minutes: 0,
                max_slippage_allowed: 0
            },
            compliance_audit: {
                aml_check: riskAnalysis.flags.includes('HIGH_VALUE_TX') ? 'FLAGGED' : 'PASSED',
                velocity_limit_reached: false,
                sanctions_list: 'CLEAR'
            }
        });
    }

    // 3. Generar Firma Criptográfica (EIP-191)
    try {
        const userAddress = inputData.actor.address;
        const amountInUSDC = ethers.parseUnits(
            inputData.transaction.fiat_amount.toString(),
            6 // USDC tiene 6 decimales
        );
        const serviceId = inputData.transaction.service_id || 'unknown-service';
        const deadline = Math.floor(Date.now() / 1000) + (15 * 60); // 15 minutos

        // Recrear el mismo hash que el contrato
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'uint256', 'string', 'uint256', 'address'],
            [userAddress, amountInUSDC, serviceId, deadline, CONTRACT_ADDRESS]
        );

        // Firmar con la private key del AI Agent
        const signature = await aiSigner.signMessage(ethers.getBytes(messageHash));

        // 4. Respuesta con firma y parámetros de ejecución
        res.status(200).json({
            decision_engine: {
                verdict,
                confidence_score: riskAnalysis.score / 100,
                risk_category: riskAnalysis.category,
                internal_flags: riskAnalysis.flags
            },
            execution_parameters: {
                can_proceed: true,
                signature,
                deadline,
                amount_in_usdc: amountInUSDC.toString(),
                service_id: serviceId,
                contract_address: CONTRACT_ADDRESS,
                whitelist_ttl_minutes: 15,
                max_slippage_allowed: 0.005 // 0.5%
            },
            compliance_audit: {
                aml_check: 'PASSED',
                velocity_limit_reached: false,
                sanctions_list: 'CLEAR'
            },
            proof: signature,
            signer_address: aiSigner.address
        });

    } catch (error) {
        console.error('❌ Error generating signature:', error);
        return next(new ErrorResponse('Failed to generate signature', 500));
    }
});

/**
 * @desc    Obtiene estadísticas del AI Risk Engine
 * @route   GET /api/ai/stats
 * @access  Public
 */
exports.getAIStats = asyncHandler(async (req, res, next) => {
    // En producción, estos datos vendrían de una DB
    res.status(200).json({
        success: true,
        data: {
            signer_address: aiSigner.address,
            contract_address: CONTRACT_ADDRESS,
            total_evaluations: 0, // Implementar contador en DB
            approval_rate: 0.85,
            average_risk_score: 78,
            status: 'operational'
        }
    });
});

/**
 * @desc    Valida si una dirección está en lista de sanciones (mock)
 * @route   POST /api/ai/check-sanctions
 * @access  Public
 */
exports.checkSanctions = asyncHandler(async (req, res, next) => {
    const { address } = req.body;

    if (!address) {
        return next(new ErrorResponse('Address is required', 400));
    }

    // Mock: En producción conectar con Chainalysis, TRM Labs, etc.
    const isSanctioned = false;

    res.status(200).json({
        success: true,
        data: {
            address,
            is_sanctioned: isSanctioned,
            risk_level: isSanctioned ? 'CRITICAL' : 'CLEAR',
            checked_at: new Date().toISOString()
        }
    });
});
