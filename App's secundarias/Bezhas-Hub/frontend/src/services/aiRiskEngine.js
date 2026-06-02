import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

/**
 * AI Risk Engine Service
 * Cliente para interactuar con el backend de evaluación de riesgo
 */

/**
 * Recopila datos de telemetría del usuario para evaluación de riesgo
 * @param {string} address - Dirección del wallet
 * @param {object} web3Provider - Provider de ethers.js
 * @returns {object} Datos formateados para el AI Risk Engine
 */
export const gatherUserTelemetry = async (address, web3Provider) => {
    try {
        // 1. Datos on-chain
        const balance = await web3Provider.getBalance(address);
        const nonce = await web3Provider.getTransactionCount(address);
        const code = await web3Provider.getCode(address);
        const isContract = code !== '0x';

        // 2. Datos de sesión (navegador)
        const sessionData = {
            ip: 'hidden', // El backend puede obtenerlo del header
            user_agent: navigator.userAgent,
            is_vpn: false, // Requiere servicio externo (IPQualityScore, etc.)
            screen_resolution: `${window.screen.width}x${window.screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };

        // 3. Mock KYC (en producción vendría de tu backend)
        const kycLevel = localStorage.getItem(`kyc_level_${address}`) || 0;

        return {
            metadata: {
                version: '2.0',
                network_id: (await web3Provider.getNetwork()).chainId,
                correlation_id: `bez-tx-${Date.now()}`,
                timestamp: new Date().toISOString()
            },
            actor: {
                address,
                kyc_level: parseInt(kycLevel),
                session_data: sessionData
            },
            on_chain_data: {
                balance_native: parseFloat(balance) / 1e18,
                nonce,
                last_active_days: 0, // Requiere indexador
                is_contract: isContract
            }
        };
    } catch (error) {
        console.error('Error gathering telemetry:', error);
        // Fallback con datos mínimos
        return {
            metadata: { version: '2.0', network_id: 137, correlation_id: `bez-tx-${Date.now()}` },
            actor: { address, kyc_level: 0, session_data: {} },
            on_chain_data: { balance_native: 0, nonce: 0, last_active_days: 999, is_contract: false }
        };
    }
};

/**
 * Solicita firma criptográfica al AI Risk Engine
 * @param {object} telemetryData - Datos del usuario recopilados
 * @param {number} fiatAmount - Cantidad en USD/USDC
 * @param {string} serviceId - ID del servicio/producto
 * @returns {object} Respuesta con firma o rechazo
 */
export const requestSwapSignature = async (telemetryData, fiatAmount, serviceId = 'marketplace-purchase') => {
    try {
        const payload = {
            ...telemetryData,
            transaction: {
                fiat_amount: fiatAmount,
                fiat_currency: 'USD',
                target_token: 'BEZ',
                estimated_gas: 150000,
                service_id: serviceId
            }
        };

        const response = await axios.post(`${API_BASE}/api/ai/sign-swap`, payload, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
        });

        return {
            success: response.data.execution_parameters?.can_proceed || false,
            data: response.data
        };
    } catch (error) {
        console.error('❌ AI Risk Engine request failed:', error);

        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
            throw new Error('Backend no disponible. Por favor contacta al administrador.');
        }

        throw new Error(error.response?.data?.message || 'Error evaluando riesgo de transacción');
    }
};

/**
 * Verifica si una dirección está en lista de sanciones
 * @param {string} address - Dirección a verificar
 * @returns {object} Estado de sanciones
 */
export const checkAddressSanctions = async (address) => {
    try {
        const response = await axios.post(`${API_BASE}/api/ai/check-sanctions`, { address });
        return response.data.data;
    } catch (error) {
        console.error('Error checking sanctions:', error);
        return { is_sanctioned: false, risk_level: 'UNKNOWN' };
    }
};

/**
 * Obtiene estadísticas del AI Risk Engine
 * @returns {object} Estadísticas
 */
export const getAIEngineStats = async () => {
    try {
        const response = await axios.get(`${API_BASE}/api/ai/stats`);
        return response.data.data;
    } catch (error) {
        console.error('Error fetching AI stats:', error);
        return null;
    }
};

/**
 * Calcula el monto neto que recibirá el usuario después de fees
 * @param {number} amountUSDC - Cantidad en USDC
 * @param {number} platformFeeBps - Fee de plataforma en basis points (default 50 = 0.5%)
 * @returns {object} Desglose de montos
 */
export const calculateNetAmount = (amountUSDC, platformFeeBps = 50) => {
    const feeAmount = (amountUSDC * platformFeeBps) / 10000;
    const swapAmount = amountUSDC - feeAmount;
    const feePercentage = (platformFeeBps / 100).toFixed(2);

    return {
        total: amountUSDC,
        fee: feeAmount,
        net: swapAmount,
        feePercentage: `${feePercentage}%`
    };
};
