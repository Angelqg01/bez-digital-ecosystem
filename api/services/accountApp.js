'use strict';

/**
 * accountApp — la «app de cuenta» de un usuario: donde cuelga su plan.
 *
 * Los planes se asignan a una app (gateway_subscriptions.app_id, ver planSubscriptions.js). Quien se registra
 * con usuario/email/contraseña no tiene ninguna, así que, al contratar o empezar gratis, se le crea una
 * organización (él, titular), su empresa legada y una app. La app no entrega ninguna api-key (el hash es
 * aleatorio y nadie conoce la clave): las claves reales se crean luego desde la consola del Hub.
 * Idempotente: si ya tiene una app activa, se reutiliza.
 */
const crypto = require('crypto');
const { query } = require('../db/pool');
const { getPlan } = require('../config/plans');

async function findAccountApp(userId) {
    const { rows } = await query(
        `SELECT a.id
           FROM organization_members m
           JOIN organizations o ON o.id = m.organization_id
           JOIN app_registry a ON a.enterprise_id = o.legacy_enterprise_id
          WHERE m.user_id = $1 AND a.is_active = TRUE
          ORDER BY a.created_at ASC
          LIMIT 1`,
        [userId]
    );
    return rows[0]?.id || null;
}

async function ensureAccountApp(user) {
    const existing = await findAccountApp(user.id);
    if (existing) return existing;

    const label = `Cuenta ${user.bezhas_id || user.id}`;
    const org = (await query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [label])).rows[0];
    const ent = (await query("INSERT INTO enterprises (name, sector) VALUES ($1, 'cuenta') RETURNING id", [label])).rows[0].id;
    await query('UPDATE organizations SET legacy_enterprise_id = $1 WHERE id = $2', [ent, org.id]);
    await query("INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner')", [org.id, user.id]);
    const app = (await query(
        `INSERT INTO app_registry (app_name, api_key_hash, enterprise_id, is_active)
         VALUES ($1, $2, $3, TRUE) RETURNING id`,
        [`cuenta-${String(user.bezhas_id || user.id).toLowerCase()}`, crypto.randomBytes(32).toString('hex'), ent]
    )).rows[0];
    return app.id;
}

/** Plan vigente de la cuenta (el más reciente de su app), o null. */
async function currentPlan(userId) {
    const { rows } = await query(
        `SELECT s.plan_id, s.status, s.renews_at
           FROM organization_members m
           JOIN organizations o ON o.id = m.organization_id
           JOIN app_registry a ON a.enterprise_id = o.legacy_enterprise_id
           JOIN gateway_subscriptions s ON s.app_id = a.id
          WHERE m.user_id = $1
          ORDER BY s.updated_at DESC NULLS LAST
          LIMIT 1`,
        [userId]
    );
    if (!rows.length) return null;
    return { id: rows[0].plan_id, name: getPlan(rows[0].plan_id)?.name || rows[0].plan_id, status: rows[0].status, renewsAt: rows[0].renews_at };
}

/** Starter no se paga por adelantado: se activa al confirmar el email. Idempotente y sin pisar un plan de pago. */
async function startFree(user) {
    const appId = await ensureAccountApp(user);
    await query(
        `INSERT INTO gateway_subscriptions (app_id, plan_id, status) VALUES ($1, 'starter', 'active')
         ON CONFLICT (app_id) DO NOTHING`,
        [appId]
    );
    return appId;
}

module.exports = { ensureAccountApp, findAccountApp, currentPlan, startFree };
