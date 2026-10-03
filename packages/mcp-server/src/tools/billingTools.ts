/**
 * Planes y pagos con Stripe desde el MCP público.
 *
 * Las herramientas solo piden al backend un enlace de pago: la persona paga en la página
 * alojada por Stripe y el plan/BEZ se activa por webhook. El precio, la identidad y la URL de
 * retorno los fija el backend; aquí no se decide ninguno de los tres.
 */
import { z } from 'zod';
import axios from 'axios';
import { currentCaller } from '../callerContext.js';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const TIMEOUT_MS = 10_000;
const STRIPE_HOSTS = new Set(['checkout.stripe.com', 'billing.stripe.com']);

function esUrlDeStripe(raw: unknown): raw is string {
    if (typeof raw !== 'string') return false;
    try {
        const u = new URL(raw);
        return u.protocol === 'https:' && !u.username && !u.password && !u.port && STRIPE_HOSTS.has(u.hostname.toLowerCase());
    } catch {
        return false;
    }
}

const ok = (data: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] });
const ko = (error: string, code?: string) => ({
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error, ...(code ? { code } : {}) }, null, 2) }],
});

async function backend(method: 'get' | 'post', path: string, body?: unknown) {
    const caller = currentCaller();
    const headers = caller ? { Authorization: `Bearer ${caller.bearer}` } : {};
    try {
        const r = await axios.request({ method, url: `${BACKEND_URL}/api/checkout${path}`, data: body, headers, timeout: TIMEOUT_MS });
        return { status: r.status, data: r.data as Record<string, any> };
    } catch (e: any) {
        const status = e?.response?.status as number | undefined;
        const data = (e?.response?.data || {}) as Record<string, any>;
        // Solo pasan mensajes pensados para el usuario (4xx); un fallo interno no se detalla.
        if (status && status >= 400 && status < 500) throw Object.assign(new Error(String(data.message || 'Solicitud rechazada')), { code: data.code });
        throw new Error('El servicio de pagos no está disponible ahora mismo.');
    }
}

const AVISO = 'Abre el enlace para pagar en la página segura de Stripe. No se cobra nada hasta que confirmes allí; BeZhas no recibe los datos de tu tarjeta.';

export function registerBillingTools(server: any): void {
    server.tool(
        'list_plans',
        'Lista los planes de BeZhas (Starter, Creator, Business, Enterprise) con precio mensual y anual en EUR.',
        {},
        async () => {
            try {
                const { data } = await backend('get', '/plans');
                return ok({ success: true, plans: data.plans });
            } catch (e: any) { return ko(e.message, e.code); }
        },
    );

    server.tool(
        'create_plan_checkout',
        'Genera el enlace de pago de Stripe para suscribir a la persona autenticada a un plan de pago. No cobra nada por sí misma.',
        {
            planId: z.enum(['creator', 'business', 'enterprise']).describe('Plan de pago'),
            cycle: z.enum(['monthly', 'yearly']).default('monthly'),
        },
        async ({ planId, cycle }: { planId: string; cycle: string }) => {
            try {
                const { data } = await backend('post', '/plan', { planId, cycle });
                if (!esUrlDeStripe(data.url)) return ko('El servicio de pagos devolvió una URL no válida.');
                return ok({ success: true, checkoutUrl: data.url, plan: data.plan, cycle: data.cycle, amount: data.amount, currency: data.currency, notice: AVISO });
            } catch (e: any) { return ko(e.message, e.code); }
        },
    );

    server.tool(
        'create_bez_checkout',
        'Genera el enlace de pago de Stripe para comprar BEZ con tarjeta (importe en EUR). El BEZ se entrega a la wallet vinculada de la cuenta tras confirmarse el pago.',
        {
            amountFiat: z.number().positive().describe('Importe en EUR (el servidor aplica mínimo y máximo)'),
            currency: z.literal('EUR').default('EUR'),
        },
        async ({ amountFiat }: { amountFiat: number }) => {
            try {
                const { data } = await backend('post', '/bez', { amountEur: amountFiat });
                if (!esUrlDeStripe(data.url)) return ko('El servicio de pagos devolvió una URL no válida.');
                return ok({ success: true, checkoutUrl: data.url, amount: data.amount, currency: data.currency, notice: AVISO });
            } catch (e: any) { return ko(e.message, e.code); }
        },
    );
}
