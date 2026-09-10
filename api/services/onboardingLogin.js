'use strict';

/**
 * services/onboardingLogin.js — identificación en la pantalla del flujo `connect`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  QUÉ PROBLEMA RESUELVE Y POR QUÉ NO LO RESUELVE UN JWT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `sdk_install` y `node_provision` los abre una herramienta MCP autenticada: la
 * sesión ya trae `app_id` y la titularidad viene heredada. `connect` es el caso
 * inverso —quien lo usa no tiene clave, viene a pedir una— así que aquí la
 * titularidad hay que DEMOSTRARLA.
 *
 * La tentación es hacer login y devolver un JWT, como en /auth/fiat/login. No:
 * eso dejaría en ese navegador una segunda credencial, de vida más larga que la
 * sesión, que nadie ha pedido y que nadie va a revocar. El token de la URL sigue
 * siendo la única credencial del flujo; identificarse sólo escribe `user_id` en
 * la sesión, y la sesión caduca en quince minutos.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ESTE FORMULARIO ESTÁ EN INTERNET
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Acepta correo y contraseña sin credencial previa, así que se trata como lo
 * que es:
 *
 *  · Cinco intentos por sesión. El limitador por IP no basta —una botnet
 *    reparte los intentos—, y como los enlaces los crea una herramienta con su
 *    propio techo por IP y hora, conseguir más enlaces también está acotado.
 *  · Respuesta idéntica para «no existe» y «contraseña mala». Distinguirlas
 *    convierte el formulario en un comprobador de qué correos son clientes.
 *  · Y se compara SIEMPRE contra un hash, aunque el usuario no exista: sin ese
 *    bcrypt de mentira, el tiempo de respuesta contesta la pregunta que el
 *    mensaje se niega a contestar.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db/pool');
const logger = require('../utils/logger');

const MAX_INTENTOS = parseInt(process.env.ONBOARDING_MAX_INTENTOS_LOGIN || '5', 10);

/**
 * Hash de descarte para igualar el tiempo cuando el correo no existe.
 * Se calcula una vez al cargar el módulo: generarlo en cada intento fallido
 * costaría más que la comparación y volvería a delatar el caso por el tiempo.
 */
const HASH_SEÑUELO = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);

/** Papeles que pueden crear una integración. Un auditor mira; no conecta agentes. */
const ROLES_QUE_CONECTAN = ['owner', 'admin', 'developer'];

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

class LoginError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'LoginError';
        this.code = code;
    }
}

/** Trae la sesión de conexión abierta, o explica por qué no se puede usar. */
async function _sesionConnect(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) {
        throw new LoginError('Enlace no válido.', 'LOGIN_TOKEN_INVALIDO');
    }
    const { rows } = await query(
        `SELECT id, kind, status, prefill, user_id, intentos_login, expires_at
           FROM onboarding_sessions WHERE token_hash = $1 LIMIT 1`,
        [sha256(token)]
    );
    if (rows.length === 0) throw new LoginError('Enlace no válido.', 'LOGIN_TOKEN_INVALIDO');

    const s = rows[0];
    if (s.kind !== 'connect') {
        throw new LoginError('Esta pantalla no pide identificación.', 'LOGIN_TIPO_NO_APLICA');
    }
    if (new Date(s.expires_at).getTime() <= Date.now() || !['pendiente', 'en_curso'].includes(s.status)) {
        throw new LoginError(
            'El enlace ya no está activo. Pide otro a tu asistente: se genera al momento.',
            'LOGIN_SESION_CERRADA'
        );
    }
    return s;
}

/**
 * Identifica a la persona y devuelve SUS organizaciones.
 *
 * No devuelve token ninguno. Lo único que cambia es que la sesión pasa a saber
 * quién es, y sólo durante los minutos que le quedan de vida.
 */
async function identificar(token, { email, password }) {
    const sesion = await _sesionConnect(token);

    if (sesion.intentos_login >= MAX_INTENTOS) {
        throw new LoginError(
            'Demasiados intentos con este enlace. Pide otro a tu asistente.',
            'LOGIN_INTENTOS_AGOTADOS'
        );
    }
    if (typeof email !== 'string' || typeof password !== 'string' || !email.includes('@')) {
        throw new LoginError('Correo o contraseña no válidos.', 'LOGIN_CREDENCIALES');
    }

    const { rows } = await query(
        `SELECT id, email, username, role, password_hash
           FROM users WHERE LOWER(email) = $1 LIMIT 1`,
        [email.trim().toLowerCase()]
    );

    // Se compara siempre, exista o no el usuario. Ver la cabecera: sin esto el
    // tiempo de respuesta delata qué correos son clientes.
    const hash = rows[0]?.password_hash || HASH_SEÑUELO;
    const correcta = await bcrypt.compare(password, hash);

    if (rows.length === 0 || !rows[0].password_hash || !correcta) {
        const { rows: tras } = await query(
            `UPDATE onboarding_sessions
                SET intentos_login = intentos_login + 1, updated_at = NOW()
              WHERE id = $1
          RETURNING intentos_login`,
            [sesion.id]
        );
        const gastados = tras[0]?.intentos_login ?? MAX_INTENTOS;

        // Al agotarlos se CANCELA la sesión: si sólo se bloqueara el login, el
        // enlace seguiría vivo para reintentar desde otra IP.
        if (gastados >= MAX_INTENTOS) {
            await query(
                `UPDATE onboarding_sessions SET status = 'cancelado', updated_at = NOW() WHERE id = $1`,
                [sesion.id]
            );
        }
        // Nunca se registra el correo probado: este log se llenaría de las
        // direcciones que alguien está tanteando.
        logger.warn({ onboardingId: sesion.id, intentos: gastados }, 'Identificación fallida en onboarding');

        throw new LoginError(
            gastados >= MAX_INTENTOS
                ? 'Demasiados intentos. Este enlace ya no sirve: pide otro a tu asistente.'
                : `Correo o contraseña incorrectos. Te quedan ${MAX_INTENTOS - gastados} intentos.`,
            'LOGIN_CREDENCIALES'
        );
    }

    const usuario = rows[0];
    await query(
        `UPDATE onboarding_sessions
            SET user_id = $2, status = 'en_curso', step = 'Elegir organización',
                intentos_login = 0, updated_at = NOW()
          WHERE id = $1`,
        [sesion.id, usuario.id]
    );
    logger.info({ onboardingId: sesion.id, userId: usuario.id }, 'Identificación correcta en onboarding');

    return {
        usuario: { id: usuario.id, nombre: usuario.username || usuario.email },
        organizaciones: await organizacionesDe(usuario.id),
    };
}

/**
 * Organizaciones del usuario, con si puede o no conectar una IA en cada una.
 *
 * Se devuelven TODAS, marcando cuáles no puede usar, en vez de esconder las que
 * no. Ocultarlas haría que alguien con papel de auditor viera una lista vacía y
 * concluyera que su alta está mal, cuando lo que pasa es que su papel no llega.
 */
async function organizacionesDe(userId) {
    const { rows } = await query(
        `SELECT o.id, o.name, o.verification_status, o.legacy_enterprise_id, m.role
           FROM organizations o
           JOIN organization_members m ON m.organization_id = o.id
          WHERE m.user_id = $1 AND m.status = 'active'
          ORDER BY o.created_at ASC`,
        [userId]
    );
    return rows.map((o) => ({
        id: o.id,
        nombre: o.name,
        papel: o.role,
        verificacion: o.verification_status,
        puedeConectar: ROLES_QUE_CONECTAN.includes(o.role),
        motivo: ROLES_QUE_CONECTAN.includes(o.role)
            ? null
            : `Tu papel en esta organización es «${o.role}» y no permite conectar integraciones. `
              + 'Pídeselo a quien sea owner o admin.',
    }));
}

/**
 * Comprueba que la persona identificada puede conectar una IA a esa
 * organización. Devuelve el enterprise heredado, que es lo que ata la clave
 * nueva al titular correcto.
 */
async function verificarMembresia(userId, organizationId) {
    const { rows } = await query(
        `SELECT o.id, o.name, o.legacy_enterprise_id, m.role
           FROM organizations o
           JOIN organization_members m ON m.organization_id = o.id
          WHERE m.user_id = $1 AND o.id = $2 AND m.status = 'active'
          LIMIT 1`,
        [userId, organizationId]
    );
    if (rows.length === 0) {
        // Mismo mensaje que si la organización no existiera: quien no es miembro
        // tampoco tiene por qué saber que existe.
        throw new LoginError('No perteneces a esa organización.', 'LOGIN_NO_MIEMBRO');
    }
    if (!ROLES_QUE_CONECTAN.includes(rows[0].role)) {
        throw new LoginError(
            `Tu papel es «${rows[0].role}» y no permite conectar integraciones.`,
            'LOGIN_ROL_INSUFICIENTE'
        );
    }
    return rows[0];
}

module.exports = {
    identificar, organizacionesDe, verificarMembresia,
    LoginError, MAX_INTENTOS, ROLES_QUE_CONECTAN,
};
