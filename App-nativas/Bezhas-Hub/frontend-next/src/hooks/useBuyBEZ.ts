/* eslint-disable */
/**
 * useBuyBEZ.ts â€” Full BEZ Purchase Flow Hook
 *
 * Orchestrates the complete "Buy BEZ" payment flow:
 *   1. GET quote from backend  (/api/crypto/quote)
 *   2. If USDT/USDC: trigger ERC-20 approve() on-chain via wagmi
 *   3. POST initiate to backend  (/api/crypto/initiate) â†’ gets BEZ dispensed
 *   4. Poll /api/crypto/status/:txHash until confirmed
 *
 * For MATIC: just calls initiate (native token, no ERC20 approve needed).
 */

'use client';

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { toast } from 'react-hot-toast';
import { getCryptoQuote, initiateCryptoPayment, checkTxStatus } from '../lib/api';

// â”€â”€â”€ Contract Addresses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const USDT_POLYGON = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as const;
const USDC_POLYGON = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as const;
const HOT_WALLET   = process.env.NEXT_PUBLIC_HOT_WALLET_ADDRESS as `0x${string}` | undefined;

const ERC20_APPROVE_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount',  type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export type PayCurrency = 'USDT' | 'USDC' | 'MATIC';

export type BuyStep =
    | 'idle'
    | 'quoting'
    | 'approving'
    | 'waiting_approval'
    | 'initiating'
    | 'confirming'
    | 'success'
    | 'error';

export interface BuyQuote {
    fromAmount: number;
    fromCurrency: string;
    toAmount: number;   // BEZ you'll receive
    pricePerBEZ: number;
    estimatedGasFee: number;
}

export interface UseBuyBEZResult {
    step: BuyStep;
    quote: BuyQuote | null;
    txHash: string | null;
    bezReceived: number | null;
    errorMsg: string | null;
    /** Step 1: fetch a price quote */
    fetchQuote: (amount: number, currency: PayCurrency) => Promise<BuyQuote | null>;
    /** Step 2: execute the full purchase */
    executePurchase: (amount: number, currency: PayCurrency) => Promise<void>;
    reset: () => void;
}

// â”€â”€â”€ Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function useBuyBEZ(): UseBuyBEZResult {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();

    const [step, setStep]           = useState<BuyStep>('idle');
    const [quote, setQuote]         = useState<BuyQuote | null>(null);
    const [txHash, setTxHash]       = useState<string | null>(null);
    const [bezReceived, setBezReceived] = useState<number | null>(null);
    const [errorMsg, setErrorMsg]   = useState<string | null>(null);

    const reset = useCallback(() => {
        setStep('idle');
        setQuote(null);
        setTxHash(null);
        setBezReceived(null);
        setErrorMsg(null);
    }, []);

    // â”€â”€ 1. Get Quote â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchQuote = useCallback(async (
        amount: number,
        currency: PayCurrency
    ): Promise<BuyQuote | null> => {
        setStep('quoting');
        setErrorMsg(null);
        try {
            const data = await getCryptoQuote(amount, currency);
            if (!data.success) throw new Error('Quote failed');
            const q: BuyQuote = {
                fromAmount:    data.quote.fromAmount,
                fromCurrency:  data.quote.fromCurrency,
                toAmount:      data.quote.toAmount,
                pricePerBEZ:   data.quote.pricePerBEZ,
                estimatedGasFee: data.quote.estimatedGasFee,
            };
            setQuote(q);
            setStep('idle');
            return q;
        } catch (err: any) {
            setErrorMsg(err.message || 'Failed to fetch quote');
            setStep('error');
            return null;
        }
    }, []);

    // â”€â”€ 2. Execute Full Purchase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const executePurchase = useCallback(async (
        amount: number,
        currency: PayCurrency
    ): Promise<void> => {
        if (!address) {
            toast.error('Conecta tu wallet primero');
            return;
        }
        if (!HOT_WALLET) {
            toast.error('Hot wallet no configurada en .env');
            return;
        }

        setErrorMsg(null);

        try {
            // â”€â”€ Step A: ERC-20 Approve (USDT/USDC only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            if (currency === 'USDT' || currency === 'USDC') {
                setStep('approving');
                toast.loading('Aprobando gasto de ' + currency + 'â€¦', { id: 'approve' });

                const tokenAddress = currency === 'USDT' ? USDT_POLYGON : USDC_POLYGON;
                const decimals     = 6; // USDT/USDC on Polygon use 6 decimals
                const amountRaw    = parseUnits(amount.toString(), decimals);

                const approveTx = await writeContractAsync({
                    address: tokenAddress,
                    abi: ERC20_APPROVE_ABI,
                    functionName: 'approve',
                    args: [HOT_WALLET, amountRaw],
                });

                toast.dismiss('approve');
                setStep('waiting_approval');
                toast.loading('Esperando confirmaciÃ³n on-chainâ€¦', { id: 'wait-approve' });
                setTxHash(approveTx);

                // Poll until approval is mined (simple: wait 4 Polygon blocks ~8s)
                await new Promise((res) => setTimeout(res, 8000));
                toast.dismiss('wait-approve');
                toast.success(currency + ' aprobado âœ”', { id: 'approved' });
            }

            // â”€â”€ Step B: Call Backend to Dispense BEZ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            setStep('initiating');
            toast.loading('Procesando pago BEZâ€¦', { id: 'initiating' });

            const result = await initiateCryptoPayment(address, amount, currency);
            toast.dismiss('initiating');

            if (!result.success) {
                if (result.requiresApproval) {
                    throw new Error(
                        `Necesitas aprobar ${amount} ${currency} antes de comprar BEZ.`
                    );
                }
                throw new Error(result.error || 'Error procesando el pago');
            }

            setTxHash(result.transactionHash || null);
            setStep('confirming');
            toast.loading('Confirmando transacciÃ³n en Polygonâ€¦', { id: 'confirm' });

            // â”€â”€ Step C: Poll Until Confirmed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            if (result.transactionHash) {
                let retries = 0;
                while (retries < 20) {
                    await new Promise((res) => setTimeout(res, 3000));
                    const status = await checkTxStatus(result.transactionHash!);
                    if (status.status === 'success') break;
                    if (status.status === 'failed') {
                        throw new Error('La transacciÃ³n fallÃ³ en la blockchain');
                    }
                    retries++;
                }
            }

            toast.dismiss('confirm');
            setBezReceived(result.bezAmount || null);
            setStep('success');
            toast.success(
                `ðŸŽ‰ Â¡Recibiste ${result.bezAmount?.toFixed(2)} BEZ en tu wallet!`,
                { duration: 6000 }
            );

        } catch (err: any) {
            const msg = err?.shortMessage || err?.message || 'Error desconocido';
            setErrorMsg(msg);
            setStep('error');
            toast.dismiss();
            toast.error(msg);
        }
    }, [address, writeContractAsync]);

    return { step, quote, txHash, bezReceived, errorMsg, fetchQuote, executePurchase, reset };
}

