"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, useDisconnect, useSignMessage } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { SiweMessage } from "siwe";
import api from "../lib/api";
import { apiError } from "../lib/apiError";

export type WalletSession = { user: unknown; token: string };

/**
 * Login/registro con wallet (SIWE → JWT real).
 * 1) nonce del servidor (un solo uso, ligado a la dirección)
 * 2) el usuario firma un mensaje EIP-4361 (sin gas, sin mover fondos)
 * 3) el servidor verifica y devuelve el mismo JWT que email+contraseña
 */
export function useWalletLogin() {
    const { address, isConnected } = useAccount();
    const chainId = useChainId();
    const { signMessageAsync } = useSignMessage();
    const { disconnect } = useDisconnect();
    const { open } = useWeb3Modal();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    /** Si no hay wallet conectada abre el modal y devuelve null; si la hay, firma y devuelve la sesión. */
    const loginWithWallet = useCallback(async (): Promise<WalletSession | null> => {
        setError("");
        if (!isConnected || !address) { open(); return null; }
        setBusy(true);
        try {
            const { data: n } = await api.post("/api/wallet-auth/nonce", { address });
            const message = new SiweMessage({
                domain: window.location.host,
                address,
                // SIWE (EIP-4361) solo admite ASCII en el statement: sin tildes ni ñ.
                statement: "Iniciar sesion en BeZhas. Esta firma no mueve fondos ni cuesta gas.",
                uri: window.location.origin,
                version: "1",
                chainId: chainId || 137,
                nonce: n.nonce,
                issuedAt: new Date().toISOString(),
                expirationTime: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            }).prepareMessage();
            const signature = await signMessageAsync({ message });
            const res = await api.post("/api/wallet-auth/verify", { message, signature });
            return { user: res.data.user, token: res.data.token };
        } catch (err) {
            const rejected = /reject|denied|cancel/i.test((err as Error)?.message || "");
            setError(rejected ? "Firma cancelada." : apiError(err, "No se pudo iniciar sesión con la wallet"));
            return null;
        } finally {
            setBusy(false);
        }
    }, [isConnected, address, chainId, signMessageAsync, open]);

    const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
    return { loginWithWallet, busy, error, setError, isConnected, address, short, disconnect };
}
