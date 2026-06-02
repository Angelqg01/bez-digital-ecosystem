/**
 * BeZhas Pay Engine - Orchestrator for Crypto and Fiat payments
 * Simulates integration with Stripe, PayPal and internal BeZhas logic
 */

const rndHex = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const rndInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const ENDPOINTS = {
    explorer: {
        polygon: 'https://polygonscan.com',
    }
};

export interface FiatSession {
    sessionId: string;
    provider: string;
    amount: number;
    currency: string;
    walletAddress: string;
    clientSecret: string | null;
    redirectUrl: string | null;
    status: 'pending' | 'completed' | 'failed';
}

export interface Transaction {
    id: string;
    type: string;
    payWith: string;
    amount: number;
    usdValue: number;
    bezAmount: number;
    walletAddress: string;
    status: string;
    txHash: string;
    blockNumber: number;
    created: number;
    completed: number;
    explorerUrl: string;
    provider?: string;
}

class BeZhasPayEngine {
    private _fiatSessions: FiatSession[] = [];
    public txHistory: Transaction[] = [];
    public wallet: any = null;
    public prices: Record<string, number> = {
        'BEZ': 1.24,
        'USD': 1.0,
        'EUR': 1.09,
    };

    private _wsListeners: ((event: string, type: string) => void)[] = [];

    onEvent(callback: (event: string, type: string) => void) {
        this._wsListeners.push(callback);
    }

    private _addWsEvent(event: string, type: string) {
        this._wsListeners.forEach(cb => cb(event, type));
    }

    async processPayment(params: any) {
        // Existing payment logic (simulated)
        console.log('Processing crypto payment...', params);
        return { success: true, txHash: `0x${rndHex(64)}` };
    }

    // ── FIAT PAYMENT SIMULATION ─────────────────────────────────────────────
    async initiateFiatPayment({ amount, currency, provider, walletAddress }: { amount: number, currency: string, provider: string, walletAddress: string }) {
        // Simula llamada a backend BeZhas Pay → Stripe/PayPal
        const session: FiatSession = {
            sessionId: `sess_${Date.now()}_${rndHex(8)}`,
            provider,
            amount,
            currency,
            walletAddress,
            clientSecret: provider === 'stripe' ? `pi_${rndHex(24)}_secret_${rndHex(16)}` : null,
            redirectUrl: provider === 'paypal' ? `https://www.paypal.com/checkoutnow?token=EC-${rndHex(17)}` : null,
            status: 'pending',
        };

        this._fiatSessions.push(session);

        // Simulamos que después de unos segundos el pago se completa (webhook)
        setTimeout(() => {
            const s = this._fiatSessions.find(sess => sess.sessionId === session.sessionId);
            if (s && s.status === 'pending') {
                s.status = 'completed';
                // Convertir fiat a BEZ y añadir a la wallet (simulación)
                const bezAmount = (amount * (this.prices[currency] || 1)) / (this.prices['BEZ'] || 1.24);
                const tx: Transaction = {
                    id: `fiat_${session.sessionId}`,
                    type: 'token_purchase',
                    payWith: currency,
                    amount: amount,
                    usdValue: amount * (currency === 'EUR' ? 1.09 : 1),
                    bezAmount: +bezAmount.toFixed(4),
                    walletAddress,
                    status: 'completed',
                    txHash: `0x${rndHex(64)}`,
                    blockNumber: rndInt(12000000, 13000000),
                    created: Date.now(),
                    completed: Date.now(),
                    explorerUrl: `${ENDPOINTS.explorer.polygon}/tx/0x${rndHex(64)}`,
                    provider,
                };
                this.txHistory.unshift(tx);
                if (this.wallet) {
                    if (!this.wallet.balances) this.wallet.balances = {};
                    this.wallet.balances.BEZ = (this.wallet.balances.BEZ || 0) + tx.bezAmount;
                }
                this._addWsEvent(`💳 Pago fiat ${provider} completado → +${tx.bezAmount} BEZ`, 'payment_completed');
            }
        }, 2500); // Simula tiempo de procesamiento

        return session;
    }

    getFiatSession(sessionId: string) {
        return this._fiatSessions.find(s => s.sessionId === sessionId);
    }
}

export const ENG = new BeZhasPayEngine();
export default ENG;
