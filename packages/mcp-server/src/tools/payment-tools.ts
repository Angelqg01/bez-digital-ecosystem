/**
 * ============================================================================
 * MCP SERVER - PAYMENT TOOLS
 * ============================================================================
 *
 * Herramientas que permiten a un modelo cotizar y arrancar pagos de BEZ.
 *
 * Todo lo que hay aquí acaba en una cifra que alguien paga, así que el fichero
 * se apoya en tres reglas:
 *
 *   1. UN SOLO PRECIO. El precio del BEZ sale de `config.token.priceUSD` y de
 *      ningún otro sitio. Antes este fichero declaraba su propia constante con
 *      un valor de reserva distinto al de `config`, así que el mismo servidor
 *      cotizaba el BEZ a 1,24 $ en `get_payment_quote` y a 0,50 $ en
 *      `calculate_smart_swap`, en la misma petición.
 *
 *   2. UNA SOLA TABLA DE CAMBIO. `get_payment_quote` e `initiate_crypto_payment`
 *      convierten con `TASAS_USD`. Antes la segunda daba por hecho que todo
 *      valía 1:1 con el dólar «por ser stablecoin», pero su enum acepta MATIC,
 *      que no lo es: 100 MATIC se cotizaban como 100 $ en una herramienta y
 *      como 80 $ en la otra, un 25 % de diferencia sobre lo mismo.
 *
 *   3. LOS PRECIOS FIJOS SE DECLARAN COMO TALES. `TASAS_USD` son constantes,
 *      no un mercado. La respuesta lo dice en `rateSource` para que el modelo
 *      no presente una cotización de hace meses como si fuera de ahora.
 */

import { z } from 'zod';
import axios from 'axios';
import { ethers } from 'ethers';
import { config } from '../config.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/** Ninguna llamada a la red puede quedarse colgada indefinidamente. */
const TIMEOUT_MS = 10_000;

/**
 * Cambio a dólares de cada divisa aceptada.
 *
 * Son constantes, no un mercado: quien las lea debe tratarlas como una
 * referencia aproximada. Están aquí para que la conversión sea la misma en
 * todas las herramientas, no para dar un precio real.
 */
const TASAS_USD: Record<string, number> = {
    USD: 1,
    EUR: 1.08,
    ETH: 2400,
    USDT: 1,
    USDC: 1,
    BTC: 45000,
    MATIC: 0.8,
};

/** Cómo se obtuvo el cambio, para que la respuesta no aparente ser un mercado. */
const ORIGEN_TASAS = {
    rateSource: 'constantes-del-servidor',
    rateDisclaimer:
        'Las tasas de cambio y el precio del BEZ son constantes de configuración, ' +
        'no cotizaciones de mercado. No sirven para liquidar una operación real ' +
        'sin contrastarlas con un oráculo de precios.',
} as const;

interface Fallo {
    success: false;
    error: string;
}

function fallo(error: string): Fallo {
    return { success: false, error };
}

/**
 * Precio del BEZ, o un fallo explícito.
 *
 * `config` ya rechaza un `BEZ_PRICE_USD` que no sea un número positivo, pero
 * este fichero divide por el precio en cuatro sitios y un denominador inválido
 * no revienta: sale `NaN` o `Infinity`, `JSON.stringify` lo convierte en `null`
 * y la herramienta responde `success: true` con una cantidad vacía al lado.
 * Más vale comprobarlo una vez aquí.
 */
function precioBez(): number | null {
    const precio = config.token.priceUSD;
    return Number.isFinite(precio) && precio > 0 ? precio : null;
}

const ERROR_PRECIO =
    'El precio del BEZ no está configurado con un número positivo (BEZ_PRICE_USD). ' +
    'Sin él no se puede cotizar nada.';

/** Convierte a dólares, o `null` si la divisa no está en la tabla. */
function aDolares(cantidad: number, divisa: string): number | null {
    const tasa = TASAS_USD[divisa];
    if (!Number.isFinite(tasa)) return null;
    return cantidad * tasa;
}

const MONEDAS_FIAT_Y_CRIPTO = ['USD', 'EUR', 'ETH', 'USDT', 'USDC', 'BTC', 'MATIC'] as const;
const MONEDAS_CRIPTO = ['USDT', 'USDC', 'MATIC'] as const;

/**
 * Tool: get_payment_quote
 * Calcula cuántos BEZ se obtienen por una cantidad dada.
 */
export const getPaymentQuoteTool = {
    name: 'get_payment_quote',
    description:
        'Calcula cuántos BEZ-Coins se obtienen por una cantidad de Fiat o Crypto. ' +
        'Usa tasas de cambio constantes del servidor, no un mercado en vivo: la respuesta ' +
        'incluye el campo rateSource, que hay que trasladar a quien reciba la cotización.',
    inputSchema: z.object({
        amount: z.number().positive().finite().describe('Cantidad a convertir'),
        fromCurrency: z.enum(MONEDAS_FIAT_Y_CRIPTO).describe('Moneda de origen'),
        toCurrency: z.literal('BEZ').describe('Moneda de destino (siempre BEZ)'),
    }),
    handler: async (args: { amount: number; fromCurrency: string; toCurrency?: string }) => {
        try {
            const { amount, fromCurrency } = args;

            const precio = precioBez();
            if (precio === null) return fallo(ERROR_PRECIO);

            const amountInUSD = aDolares(amount, fromCurrency);
            if (amountInUSD === null) {
                return fallo(
                    `Moneda no soportada: ${fromCurrency}. Admitidas: ${Object.keys(TASAS_USD).join(', ')}.`,
                );
            }

            const bezCoins = amountInUSD / precio;

            return {
                success: true,
                quote: {
                    fromAmount: amount,
                    fromCurrency,
                    toAmount: bezCoins,
                    toCurrency: 'BEZ',
                    amountInUSD,
                    exchangeRate: TASAS_USD[fromCurrency] / precio,
                    pricePerBEZ: precio,
                    estimatedGasFee: fromCurrency === 'ETH' || fromCurrency === 'MATIC' ? 0.001 : 0,
                    ...ORIGEN_TASAS,
                },
            };
        } catch (error: any) {
            return fallo(error.message);
        }
    },
};

/**
 * Tool: process_stripe_payment
 * Crea una sesión de pago de Stripe para comprar BEZ.
 *
 * El backend exige sesión iniciada (`verifyTokenMiddleware`), así que hace
 * falta el token del usuario. Sin él la llamada se iba en un 401 que llegaba
 * al modelo como «Request failed with status code 401», sin decir por qué.
 *
 * La wallet de destino NO es un parámetro: el backend la toma de
 * `req.user.walletAddress`, es decir, del usuario autenticado. Antes esta
 * herramienta pedía una `walletAddress`, no la enviaba, y la devolvía en la
 * respuesta —con lo que aparentaba haber dirigido los tokens a una wallet que
 * el backend jamás llegó a ver—.
 */
export const processStripePaymentTool = {
    name: 'process_stripe_payment',
    description:
        'Genera un Checkout Session de Stripe para comprar BEZ-Coin con tarjeta. ' +
        'Requiere el token de sesión del usuario; los tokens se acreditan en la wallet ' +
        'asociada a esa cuenta, no en una wallet que se pase por parámetro.',
    inputSchema: z.object({
        userToken: z
            .string()
            .min(1)
            .describe('Token de sesión del usuario que compra. El backend lo exige.'),
        amountFiat: z.number().positive().finite().describe('Cantidad en USD a pagar'),
        email: z.string().email().optional().describe('Email para el recibo (opcional)'),
    }),
    handler: async (args: { userToken: string; amountFiat: number; email?: string }) => {
        try {
            const { userToken, amountFiat, email } = args;

            const precio = precioBez();
            if (precio === null) return fallo(ERROR_PRECIO);

            const tokenAmount = amountFiat / precio;

            // El backend rechaza por debajo de 1 BEZ; avisar aquí ahorra el viaje
            // y da un motivo entendible en vez de un 400 escueto.
            if (tokenAmount < 1) {
                return fallo(
                    `${amountFiat} USD son ${tokenAmount.toFixed(6)} BEZ y el mínimo de compra es 1 BEZ ` +
                        `(a ${precio} USD/BEZ hacen falta al menos ${precio} USD).`,
                );
            }

            const response = await axios.post(
                `${BACKEND_URL}/api/stripe/create-token-purchase-session`,
                { tokenAmount, ...(email ? { email } : {}) },
                {
                    timeout: TIMEOUT_MS,
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${userToken}`,
                    },
                },
            );

            if (!response.data?.success) {
                return fallo(response.data?.error || 'Failed to create checkout session');
            }

            return {
                success: true,
                checkoutUrl: response.data.url,
                sessionId: response.data.sessionId,
                tokenAmount,
                amountFiat,
                pricePerBEZ: precio,
                ...ORIGEN_TASAS,
            };
        } catch (error: any) {
            return fallo(mensajeHttp(error));
        }
    },
};

/**
 * Tool: check_payment_status
 * Consulta el estado de una sesión de Stripe.
 */
export const checkPaymentStatusTool = {
    name: 'check_payment_status',
    description:
        'Verifica el estado de un pago de Stripe usando el Session ID. ' +
        'Requiere el token de sesión del usuario dueño del pago.',
    inputSchema: z.object({
        sessionId: z.string().min(1).describe('ID de la sesión de Stripe'),
        userToken: z
            .string()
            .min(1)
            .describe('Token de sesión del usuario. El backend lo exige.'),
    }),
    handler: async (args: { sessionId: string; userToken: string }) => {
        try {
            const { sessionId, userToken } = args;

            const response = await axios.get(`${BACKEND_URL}/api/stripe/session/${encodeURIComponent(sessionId)}`, {
                timeout: TIMEOUT_MS,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userToken}`,
                },
            });

            if (!response.data?.success) {
                return fallo(response.data?.error || 'Failed to get session status');
            }

            const sesion = response.data.session ?? {};
            return {
                success: true,
                status: sesion.status,
                amount: sesion.amountTotal,
                currency: sesion.currency,
                metadata: sesion.metadata,
            };
        } catch (error: any) {
            return fallo(mensajeHttp(error));
        }
    },
};

/**
 * Tool: get_wallet_balance
 * Consulta el saldo de BEZ de una wallet.
 *
 * La red que se informa sale del `chainId` que devuelve el nodo, no de una
 * cadena escrita a mano. Antes respondía «Polygon Mainnet» pasara lo que
 * pasara, aunque `POLYGON_RPC_URL` apuntase a Amoy: el saldo era de una red y
 * la etiqueta decía otra.
 */
export const getWalletBalanceTool = {
    name: 'get_wallet_balance',
    description:
        'Consulta el saldo de BEZ-Coins de una wallet en la blockchain. ' +
        'La respuesta indica la red y el chainId reales del nodo consultado.',
    inputSchema: z.object({
        walletAddress: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/)
            .describe('Dirección de wallet'),
    }),
    handler: async (args: { walletAddress: string }) => {
        try {
            const { walletAddress } = args;

            const provider = new ethers.JsonRpcProvider(config.network.activeRpc);
            const contract = new ethers.Contract(
                config.token.address,
                ['function balanceOf(address owner) view returns (uint256)', 'function decimals() view returns (uint8)'],
                provider,
            );

            const [balance, decimals, red] = await Promise.all([
                contract.balanceOf(walletAddress),
                contract.decimals(),
                provider.getNetwork(),
            ]);

            return {
                success: true,
                walletAddress,
                balance: ethers.formatUnits(balance, decimals),
                balanceRaw: balance.toString(),
                decimals: Number(decimals),
                contractAddress: config.token.address,
                network: red.name,
                chainId: Number(red.chainId),
                rpcUrl: config.network.activeRpc,
            };
        } catch (error: any) {
            return fallo(error.message);
        }
    },
};

/**
 * Tool: initiate_crypto_payment
 * Prepara —no ejecuta— un pago con criptomonedas.
 */
export const initiateCryptoPaymentTool = {
    name: 'initiate_crypto_payment',
    description:
        'Prepara las instrucciones de un pago con criptomonedas (USDT, USDC, MATIC) para comprar BEZ-Coins. ' +
        'NO ejecuta ninguna transacción: devuelve los pasos que el usuario debe firmar desde su wallet.',
    inputSchema: z.object({
        walletAddress: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/)
            .describe('Dirección de wallet del usuario que pagará'),
        amount: z.number().positive().finite().describe('Cantidad de crypto a pagar'),
        currency: z.enum(MONEDAS_CRIPTO).describe('Criptomoneda a usar'),
    }),
    handler: async (args: { walletAddress: string; amount: number; currency: string }) => {
        try {
            const { walletAddress, amount, currency } = args;

            const precio = precioBez();
            if (precio === null) return fallo(ERROR_PRECIO);

            // La misma conversión que `get_payment_quote`. MATIC no es una
            // stablecoin: tratarlo 1:1 con el dólar acreditaba de más.
            const amountInUSD = aDolares(amount, currency);
            if (amountInUSD === null) {
                return fallo(`Moneda no soportada: ${currency}. Admitidas: ${MONEDAS_CRIPTO.join(', ')}.`);
            }

            const tokenAmount = amountInUSD / precio;

            return {
                success: true,
                executed: false,
                paymentType: 'crypto',
                currency,
                amount,
                amountInUSD,
                tokenAmount,
                pricePerBEZ: precio,
                walletAddress,
                instructions: {
                    step1: `Aprobar ${amount} ${currency} para el contrato de BeZhas`,
                    step2: 'Ejecutar transacción de compra desde la wallet del usuario',
                    step3: 'Esperar confirmación en blockchain',
                    estimatedGas: '0.001 MATIC',
                },
                contractAddress: config.token.address,
                rpcUrl: config.network.activeRpc,
                ...ORIGEN_TASAS,
            };
        } catch (error: any) {
            return fallo(error.message);
        }
    },
};

/**
 * Traduce un error de axios a algo que el modelo pueda explicar.
 *
 * Un «Request failed with status code 401» no dice si falta el token, si ha
 * caducado o si el backend está caído, y sin eso el modelo reintenta a ciegas.
 * La URL no se incluye: lleva el identificador de sesión.
 */
function mensajeHttp(error: any): string {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
        return `El backend rechazó la autenticación (HTTP ${status}). El userToken falta, ha caducado o no tiene permiso sobre este recurso.`;
    }
    if (status === 404) {
        return 'El backend no encontró el recurso (HTTP 404). Revisa el sessionId.';
    }
    if (status) {
        const detalle = error?.response?.data?.error || error?.response?.data?.message;
        return `El backend respondió HTTP ${status}${detalle ? `: ${detalle}` : ''}.`;
    }
    if (error?.code === 'ECONNABORTED') {
        return `El backend no respondió en ${TIMEOUT_MS} ms.`;
    }
    return error?.message || 'Error desconocido llamando al backend.';
}

export const paymentTools = [
    getPaymentQuoteTool,
    processStripePaymentTool,
    checkPaymentStatusTool,
    getWalletBalanceTool,
    initiateCryptoPaymentTool,
];

/** Registra todas las herramientas de pago en el servidor MCP. */
export function registerPaymentTools(server: any): void {
    paymentTools.forEach((tool) => {
        server.tool(tool.name, tool.description, tool.inputSchema.shape, async (args: any) => {
            const result = await tool.handler(args);
            return {
                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            };
        });
    });
}
