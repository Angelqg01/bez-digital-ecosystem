/** Tipos y validación de enlaces del chat. Los destinos reales los decide el servidor; esto es defensa en profundidad. */

export type ChatActionKind = "navigate" | "docs" | "plans";

export type ChatAction = {
    id: string;
    category: string;
    categoryLabel?: string;
    kind: ChatActionKind;
    title: string;
    description: string;
    sensitive: boolean;
    locked: boolean;
    lockReason?: "plan" | "role";
    upgradeActionId?: string;
};

export type OpenResult = { id: string; kind: ChatActionKind; href: string; sensitive: boolean };

export type Plan = { id: string; name: string; description?: string; priceMonthly?: number; currency?: string };
export type KnowledgeDoc = { id: string; title: string; classification?: string };

/** Dominios propios cuyos enlaces https pueden abrirse en una pestaña nueva (mismo criterio que el servidor). */
export const TRUSTED_HOSTS = ["bezhas.com", "www.bezhas.com"];

/** Ruta interna segura: empieza por "/", sin "//", barras invertidas, "..", codificaciones peligrosas ni caracteres raros. */
export function isSafeInternalPath(href: unknown): href is string {
    if (typeof href !== "string" || href.length === 0 || href.length > 200) return false;
    if (!/^\/[A-Za-z0-9\-._~/?#=&%]*$/.test(href)) return false;
    if (href.startsWith("//") || href.includes("\\") || href.includes("..")) return false;
    if (/%(2f|5c|00|0d|0a|2e)/i.test(href)) return false;
    return true;
}

export type LinkDecision = { type: "internal"; href: string } | { type: "external"; href: string } | { type: "blocked" };

/** Decide cómo pintar un enlace Markdown del modelo: interno, externo de confianza o bloqueado (texto plano). */
export function classifyLink(href: unknown): LinkDecision {
    if (isSafeInternalPath(href)) return { type: "internal", href };
    if (typeof href === "string") {
        try {
            const u = new URL(href);
            if (u.protocol === "https:" && !u.username && !u.password && !u.port && TRUSTED_HOSTS.includes(u.hostname.toLowerCase())) {
                return { type: "external", href: u.toString() };
            }
        } catch { /* URL inválida → bloqueado */ }
    }
    return { type: "blocked" };
}

export function formatPrice(p: Plan): string {
    if (p.priceMonthly === undefined || p.priceMonthly === null) return "";
    if (p.priceMonthly === 0) return "Gratis";
    return `${p.priceMonthly} ${p.currency || ""}/mes`.trim();
}
