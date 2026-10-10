import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiError, isSafeInternalPath, isStripeCheckoutUrl, isStripePaymentLink, normalizePlan } from "../lib/chatActions";
/**
 * Acciones del chat: catálogo, apertura (siempre validada en servidor) y ventanas emergentes.
 * El cliente nunca navega a un destino que no venga del servidor Y pase `isSafeInternalPath`.
 */
export function useChatActions(api) {
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [dialog, setDialog] = useState(null);
    const [busy, setBusy] = useState(false);
    const [plans, setPlans] = useState([]);
    const [currentPlan, setCurrentPlan] = useState("");
    const [docs, setDocs] = useState([]);
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState("");
    const loadCatalog = useCallback(async () => {
        try {
            const res = await api.get("/api/ai-workspace/actions");
            const list = Array.isArray(res.data?.actions) ? res.data.actions : [];
            setCatalog(list);
            return list;
        }
        catch {
            setCatalog([]);
            return [];
        }
    }, [api]);
    const close = useCallback(() => { setDialog(null); setPayError(""); }, []);
    /**
     * Navega al destino devuelto por el servidor, siempre validado. Rutas de la SPA → router;
     * apps secundarias (`external`, mismo dominio, fuera del router) → navegación completa.
     */
    const go = useCallback((result) => {
        const href = result && result.href;
        if (!isSafeInternalPath(href)) { setDialog({ type: "error", message: "Destino no permitido." }); return false; }
        setDialog(null);
        if (result.external) window.location.assign(href);
        else navigate(href);
        return true;
    }, [navigate]);

    /** Pide al servidor abrir una acción y muestra la ventana que corresponda. */
    const request = useCallback(async (action) => {
        setBusy(true);
        try {
            const res = await api.post(`/api/ai-workspace/actions/${encodeURIComponent(action.id)}/open`);
            const result = res.data;
            if (!isSafeInternalPath(result?.href)) {
                setDialog({ type: "error", message: "El servidor devolvió un destino no permitido." });
                return;
            }
            if (action.kind === "plans") {
                const p = await api.get("/api/ai-workspace/plans");
                setPlans(Array.isArray(p.data?.plans) ? p.data.plans.map(normalizePlan).filter(Boolean) : []);
                setCurrentPlan(String(p.data?.current || ""));
                setDialog({ type: "plans", action, result });
            }
            else if (action.kind === "docs") {
                const d = await api.get("/api/ai-workspace/knowledge");
                setDocs(Array.isArray(d.data?.documents) ? d.data.documents : []);
                setDialog({ type: "docs", action, result });
            }
            else if (action.id === "buy_bez") {
                setDialog({ type: "bez", action, result });
            }
            else {
                setDialog({ type: "confirm", action, result });
            }
        }
        catch (e) {
            const status = e?.response?.status;
            if (status === 403) {
                setDialog({ type: "locked", action, message: apiError(e, "Esta función no está disponible en tu plan."), upgradeActionId: e.response?.data?.upgradeActionId });
            }
            else {
                setDialog({ type: "error", message: apiError(e, "No se pudo abrir la acción.") });
            }
        }
        finally {
            setBusy(false);
        }
    }, [api]);
    /** Abre una acción por id (p. ej. el botón «Ver planes» de una función bloqueada). */
    const requestById = useCallback(async (id) => {
        // El catálogo puede no estar cargado todavía (las tarjetas llegan por el stream): se pide al servidor.
        const action = catalog.find((a) => a.id === id) || (await loadCatalog()).find((a) => a.id === id);
        if (action)
            await request(action);
        else
            setDialog({ type: "error", message: "La acción no está disponible." });
    }, [catalog, loadCatalog, request]);
    /** Pago real con Stripe: el servidor fija precio, identidad y retorno; aquí solo se redirige a una URL de Stripe validada. */
    const pay = useCallback(async (path, body) => {
        setPaying(true);
        setPayError("");
        try {
            const res = await api.post(path, body);
            const url = res.data?.url;
            if (!isStripeCheckoutUrl(url)) { setPayError("El servidor devolvió una URL de pago no válida."); return false; }
            window.location.assign(url);
            return true;
        }
        catch (e) {
            setPayError(apiError(e, "No se pudo iniciar el pago."));
            return false;
        }
        finally {
            setPaying(false);
        }
    }, [api]);
    /**
     * Los planes se contratan con los Payment Links del catálogo del servidor (el webhook registra la compra y el plan
     * sigue a Stripe). Sólo se abre un enlace que venga de ese catálogo y sea de buy.stripe.com.
     */
    const checkoutPlan = useCallback(async (planId, cycle) => {
        const plan = plans.find((p) => p.id === planId);
        const url = plan ? (cycle === "yearly" ? plan.annualUrl : plan.monthlyUrl) : null;
        if (!isStripePaymentLink(url)) { setPayError("Ese plan no se puede contratar desde el chat todavía."); return false; }
        setPayError("");
        window.location.assign(url);
        return true;
    }, [plans]);
    const buyBez = useCallback((amountEur) => pay("/api/checkout/bez", { amountEur }), [pay]);
    return { paying, payError, checkoutPlan, buyBez, catalog, dialog, busy, plans, currentPlan, docs, loadCatalog, request, requestById, go, close };
}
