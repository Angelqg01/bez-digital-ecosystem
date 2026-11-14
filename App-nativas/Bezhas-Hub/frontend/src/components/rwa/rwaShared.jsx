/**
 * Piezas comunes de los paneles RWA del Hub (venta primaria y rentas).
 */
import React, { useCallback, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useSendTransaction, useSwitchChain } from 'wagmi';
import { AlertCircle, CheckCircle, ExternalLink, Loader2 } from 'lucide-react';
import { runTransactions, urlTx } from '../../lib/rwaOps';

export const FABRICAS = [
    { id: 'activos', nombre: 'Activos' },
    { id: 'industrial', nombre: 'Industrial' },
];

export const INPUT = 'mt-1 block w-full rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-white';
export const BTN = 'rounded-lg bg-amber-500 px-4 py-2 font-medium text-gray-900 hover:bg-amber-400 disabled:opacity-50';

export const fecha = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export function Aviso({ tipo = 'info', children }) {
    const color = tipo === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-200'
        : tipo === 'ok' ? 'border-green-500/40 bg-green-500/10 text-green-200'
            : 'border-amber-500/40 bg-amber-500/10 text-amber-100';
    const Icono = tipo === 'ok' ? CheckCircle : AlertCircle;
    return (
        <div role={tipo === 'error' ? 'alert' : 'status'} className={`flex gap-2 rounded-lg border p-3 text-sm ${color}`}>
            <Icono className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div>{children}</div>
        </div>
    );
}

/** Progreso de la firma: un renglón por paso. */
export function Progreso({ pasos }) {
    if (!pasos.length) return null;
    return (
        <ol className="space-y-1 text-sm" aria-label="Progreso de la firma">
            {pasos.map((p) => (
                <li key={p.paso} className="flex items-center gap-2 text-gray-300">
                    {p.estado === 'hecho'
                        ? <CheckCircle className="w-4 h-4 text-green-400" aria-hidden="true" />
                        : <Loader2 className="w-4 h-4 animate-spin text-amber-400" aria-hidden="true" />}
                    <span>Paso {p.paso}/{p.total}: {p.estado === 'firmando' ? 'firma en tu wallet' : p.estado === 'confirmando' ? 'confirmando en Polygon' : 'hecho'}</span>
                    {p.hash && (
                        <a className="text-amber-400 hover:underline inline-flex items-center gap-1" href={urlTx(p.hash)} target="_blank" rel="noopener noreferrer">
                            ver <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                    )}
                </li>
            ))}
        </ol>
    );
}

/**
 * Firma con la wallet conectada exigiendo la cuenta de la sesión (la que usa el
 * Gateway), con progreso y un único estado «ocupado». `firmar` devuelve
 * `{ hashes, recibos }` (recibos por número de paso): el estado de React no sirve
 * para leerlos justo después de firmar.
 */
export function useFirma() {
    const { address } = useAccount();
    const chainId = useChainId();
    const { switchChainAsync } = useSwitchChain();
    const { sendTransactionAsync } = useSendTransaction();
    const publicClient = usePublicClient();
    const [pasos, setPasos] = useState([]);
    const [ocupado, setOcupado] = useState(false);

    const firmar = useCallback(async (transacciones, cuentaSesion) => {
        setOcupado(true);
        setPasos([]);
        const recibos = {};
        try {
            const hashes = await runTransactions(transacciones, {
                cuentaWallet: address,
                cuentaSesion,
                chainId,
                switchChain: (id) => switchChainAsync({ chainId: id }),
                sendTransaction: (tx) => sendTransactionAsync(tx),
                waitForReceipt: (hash) => publicClient.waitForTransactionReceipt({ hash }),
                onProgress: (e) => {
                    const { recibo, ...resto } = e;
                    if (recibo) recibos[e.paso] = recibo;
                    setPasos((prev) => [...prev.filter((p) => p.paso !== e.paso), resto].sort((a, b) => a.paso - b.paso));
                },
            });
            return { hashes, recibos };
        } finally {
            setOcupado(false);
        }
    }, [address, chainId, switchChainAsync, sendTransactionAsync, publicClient]);

    return { firmar, pasos, ocupado };
}
