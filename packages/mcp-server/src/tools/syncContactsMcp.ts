/**
 * ============================================================================
 * MCP SERVER - SINCRONIZACIÓN DE CONTACTOS
 * ============================================================================
 *
 * Cruza una agenda contra los usuarios de BeZhas para ver quién ya está en la
 * plataforma. La libreta de direcciones de alguien es dato personal, así que
 * los identificadores se convierten en hash AQUÍ, antes de salir del proceso:
 * el backend recibe hashes y nunca los correos ni los teléfonos en claro.
 *
 * El hash es SHA-256 sin sal, que es lo que permite cruzarlo contra el índice
 * del backend. Conviene tener presente lo que eso significa: un espacio de
 * entradas pequeño —los teléfonos de un país, por ejemplo— es enumerable, así
 * que el hash impide leer la agenda de un vistazo, no resiste a quien se
 * proponga romperla. Para lo segundo haría falta un cruce privado de conjuntos
 * y un cambio en el backend.
 */

import axios from 'axios';
import 'dotenv/config';
import { createHash } from 'crypto';
import { z } from 'zod';

const TIMEOUT_MS = 15_000;

/** Un lote demasiado grande es una descarga de agenda, no una sincronización. */
const MAX_CONTACTOS = 1000;

function respuesta(text: string, isError = false) {
    return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
}

/** Normaliza antes de resumir: el mismo correo en mayúsculas ha de dar el mismo hash. */
function hash(valor: string): string {
    return createHash('sha256').update(valor.toLowerCase().trim()).digest('hex');
}

export interface ContactoEntrada {
    name?: string;
    email?: string;
    phone?: string;
}

export async function syncContacts(contacts: ContactoEntrada[], userToken: string) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
        return respuesta('Error: no se ha pasado ningún contacto que sincronizar.', true);
    }

    if (contacts.length > MAX_CONTACTOS) {
        return respuesta(
            `Error: ${contacts.length} contactos superan el máximo de ${MAX_CONTACTOS} por llamada. ` +
                'Divide la agenda en lotes.',
            true,
        );
    }

    if (!userToken) {
        return respuesta('Error: falta el userToken del usuario que sincroniza.', true);
    }

    try {
        const formattedContacts = contacts
            .map((c) => ({
                name: c?.name || 'Unknown',
                emailHash: c?.email ? hash(c.email) : null,
                phoneHash: c?.phone ? hash(c.phone) : null,
            }))
            .filter((c) => c.emailHash || c.phoneHash);

        if (formattedContacts.length === 0) {
            return respuesta(
                'Error: ninguno de los contactos traía un email o un teléfono utilizable.',
                true,
            );
        }

        const API_URL = process.env.BEZHAS_API_URL || 'https://api.bez.digital/api';

        const response = await axios.post(
            `${API_URL}/contacts/sync`,
            { contacts: formattedContacts },
            {
                timeout: TIMEOUT_MS,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${userToken}`,
                },
                // Los 4xx se tratan abajo con su motivo; sin esto axios los
                // convierte en excepción y todos acaban en el mismo saco.
                validateStatus: (status) => status < 500,
            },
        );

        if (response.status === 200 || response.status === 202) {
            const descartados = contacts.length - formattedContacts.length;
            return respuesta(
                `Se han encolado ${formattedContacts.length} contactos para sincronizar` +
                    (descartados > 0 ? ` (${descartados} descartados por no tener email ni teléfono)` : '') +
                    '.',
            );
        }

        if (response.status === 401 || response.status === 403) {
            return respuesta(
                `El backend rechazó la autenticación (HTTP ${response.status}). ` +
                    'El userToken falta, ha caducado o no tiene permiso.',
                true,
            );
        }

        const detalle = response.data?.error || response.data?.message;
        return respuesta(
            `El backend no aceptó la sincronización (HTTP ${response.status})${detalle ? `: ${detalle}` : ''}.`,
            true,
        );
    } catch (error: any) {
        if (error?.code === 'ECONNABORTED') {
            return respuesta(`El backend no respondió en ${TIMEOUT_MS} ms. No se ha sincronizado nada.`, true);
        }
        return respuesta(
            `Error de red sincronizando contactos: ${error?.message || 'desconocido'}. No se ha sincronizado nada.`,
            true,
        );
    }
}

/** Un contacto trae correo, teléfono o ambos; al menos uno hace falta. */
const contactSchema = z
    .object({
        name: z.string().optional().describe('Name of the contact'),
        email: z.string().optional().describe('Email address of the contact (optional if phone is provided)'),
        phone: z.string().optional().describe('Phone number of the contact (optional if email is provided)'),
    })
    .refine((c) => Boolean(c.email || c.phone), {
        message: 'Cada contacto necesita al menos email o phone',
    });

export function registerSyncContactsMcp(server: any) {
    server.tool(
        'sync_contacts',
        'Synchronize a list of contacts (email or phone) to the BeZhas network. ' +
            'Emails and phone numbers are SHA-256 hashed locally before leaving this process; ' +
            'the backend never receives them in clear.',
        {
            contacts: z
                .array(contactSchema)
                .min(1)
                .max(MAX_CONTACTOS)
                .describe('List of contacts to sync.'),
            userToken: z
                .string()
                .min(1)
                .describe('The authentication token of the BeZhas user executing the sync.'),
        },
        async (args: any) => syncContacts(args.contacts, args.userToken),
    );
}
