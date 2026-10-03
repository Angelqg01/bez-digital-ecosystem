"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import api from "../lib/api";
import { apiError } from "../lib/apiError";
import { isSafeInternalPath, type ChatAction, type KnowledgeDoc, type OpenResult, type Plan } from "../lib/chatActions";

export type DialogState =
    | { type: "confirm"; action: ChatAction; result: OpenResult }
    | { type: "plans"; action: ChatAction; result: OpenResult }
    | { type: "docs"; action: ChatAction; result: OpenResult }
    | { type: "locked"; action: ChatAction; message: string; upgradeActionId?: string }
    | { type: "error"; message: string };

/**
 * Acciones del chat: catálogo, apertura (siempre validada en servidor) y ventanas emergentes.
 * El cliente nunca navega a un destino que no venga del servidor Y pase `isSafeInternalPath`.
 */
export function useChatActions() {
    const router = useRouter();
    const [catalog, setCatalog] = useState<ChatAction[]>([]);
    const [dialog, setDialog] = useState<DialogState | null>(null);
    const [busy, setBusy] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [currentPlan, setCurrentPlan] = useState("");
    const [docs, setDocs] = useState<KnowledgeDoc[]>([]);

    const loadCatalog = useCallback(async (): Promise<ChatAction[]> => {
        try {
            const res = await api.get("/api/ai-workspace/actions");
            const list: ChatAction[] = Array.isArray(res.data?.actions) ? res.data.actions : [];
            setCatalog(list);
            return list;
        } catch { setCatalog([]); return []; }
    }, []);

    const close = useCallback(() => setDialog(null), []);

    /** Navega a una ruta interna validada. Devuelve false si el destino no es seguro. */
    const go = useCallback((href: string): boolean => {
        if (!isSafeInternalPath(href)) { setDialog({ type: "error", message: "Destino no permitido." }); return false; }
        setDialog(null);
        router.push(href);
        return true;
    }, [router]);

    /** Pide al servidor abrir una acción y muestra la ventana que corresponda. */
    const request = useCallback(async (action: ChatAction) => {
        setBusy(true);
        try {
            const res = await api.post(`/api/ai-workspace/actions/${encodeURIComponent(action.id)}/open`);
            const result = res.data as OpenResult;
            if (!isSafeInternalPath(result?.href)) { setDialog({ type: "error", message: "El servidor devolvió un destino no permitido." }); return; }
            if (action.kind === "plans") {
                const p = await api.get("/api/ai-workspace/plans");
                setPlans(Array.isArray(p.data?.plans) ? p.data.plans : []);
                setCurrentPlan(String(p.data?.current || ""));
                setDialog({ type: "plans", action, result });
            } else if (action.kind === "docs") {
                const d = await api.get("/api/ai-workspace/knowledge");
                setDocs(Array.isArray(d.data?.documents) ? d.data.documents : []);
                setDialog({ type: "docs", action, result });
            } else {
                setDialog({ type: "confirm", action, result });
            }
        } catch (e) {
            const status = (e as { response?: { status?: number; data?: { upgradeActionId?: string } } })?.response?.status;
            if (status === 403) {
                setDialog({ type: "locked", action, message: apiError(e, "Esta función no está disponible en tu plan."), upgradeActionId: (e as { response?: { data?: { upgradeActionId?: string } } }).response?.data?.upgradeActionId });
            } else {
                setDialog({ type: "error", message: apiError(e, "No se pudo abrir la acción.") });
            }
        } finally { setBusy(false); }
    }, []);

    /** Abre una acción por id (p. ej. el botón «Ver planes» de una función bloqueada). */
    const requestById = useCallback(async (id: string) => {
        // El catálogo puede no estar cargado todavía (las tarjetas llegan por el stream): se pide al servidor.
        const action = catalog.find((a) => a.id === id) || (await loadCatalog()).find((a) => a.id === id);
        if (action) await request(action);
        else setDialog({ type: "error", message: "La acción no está disponible." });
    }, [catalog, loadCatalog, request]);

    return { catalog, dialog, busy, plans, currentPlan, docs, loadCatalog, request, requestById, go, close };
}
