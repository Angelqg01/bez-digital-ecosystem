'use strict';

/**
 * config/node-profiles.js — perfiles de nodo que un cliente puede levantar.
 *
 * Fuente única de lo que hace falta para correr un nodo de BeZhas, para que la
 * misma cifra la den la herramienta MCP, la pantalla alojada y la documentación.
 * Cuando el dimensionado cambie, cambia aquí y cambia en los tres sitios.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  LA CLAVE PRIVADA DEL NODO SE GENERA EN LA MÁQUINA DEL CLIENTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Es la decisión que no se puede equivocar en todo este flujo. El arranque del
 * contenedor genera el par, nos manda SOLO la pública junto al token de
 * registro, y damos de alta el nodo con eso.
 *
 * La alternativa cómoda —generar el par aquí y «entregárselo» al cliente por la
 * pantalla o, peor, por el chat— pondría la clave privada de todos los nodos de
 * todos los clientes en nuestros logs, en el historial de su IA y en el camino
 * entre ambos. Sería una puerta trasera aunque nadie la usara nunca, y no habría
 * forma de demostrar que no se ha usado.
 *
 * Por eso `provisionAsistido` describe pasos que ejecuta el cliente en su
 * infraestructura, y ninguna función de este módulo devuelve material
 * criptográfico.
 */

const PERFILES = [
    {
        id: 'edge',
        nombre: 'Edge Node',
        proposito: 'Captura de telemetría y firma local en planta, almacén o punto de medida. '
            + 'No sincroniza la cadena entera: firma y reenvía.',
        artefacto: 'bezhas-edge-node',
        imagen: 'bezhas/edge-node',
        requisitos: {
            cpu: '2 vCPU',
            ram: '2 GB',
            disco: '20 GB SSD',
            red: 'salida HTTPS a api.bez.digital; no requiere IP pública ni puerto abierto entrante',
            so: 'Linux con Docker 24+, o Windows con Docker Desktop',
        },
        puertos: [{ puerto: 4000, uso: 'API local del nodo', exposicion: 'solo red interna' }],
        planMinimo: 'business',
        tiempoEstimado: '15 minutos',
    },
    {
        id: 'enterprise',
        nombre: 'Enterprise Node',
        proposito: 'Nodo completo de la L2 de BeZhas (Chain ID 2708) con indexador propio. '
            + 'Da lectura de la cadena sin depender de nuestros RPC.',
        artefacto: 'enterprise-node',
        imagen: 'bezhas/enterprise-node',
        requisitos: {
            cpu: '4 vCPU',
            ram: '16 GB',
            disco: '500 GB SSD NVMe (crece con la cadena)',
            red: 'salida HTTPS y P2P; RPC 8545/8546 SOLO en red interna',
            so: 'Linux con Docker 24+ y Docker Compose',
        },
        // Tres contenedores: op-geth, la API/indexador y su Postgres.
        puertos: [
            { puerto: 8545, uso: 'RPC HTTP de op-geth', exposicion: 'NUNCA a internet — bind 127.0.0.1' },
            { puerto: 8546, uso: 'RPC WebSocket de op-geth', exposicion: 'NUNCA a internet — bind 127.0.0.1' },
            { puerto: 4100, uso: 'API REST e indexador', exposicion: 'solo red interna' },
        ],
        planMinimo: 'enterprise_vip',
        tiempoEstimado: '1-2 horas la primera sincronización',
    },
];

const POR_ID = new Map(PERFILES.map((p) => [p.id, p]));

/** Orden de planes, para comparar si el contratado alcanza el mínimo. */
const ORDEN_PLANES = ['starter', 'creator_pro', 'business', 'enterprise_vip'];

function getPerfil(id) {
    return POR_ID.get(id) || null;
}

/** ¿El plan contratado llega al mínimo de este perfil? */
function planPermite(perfilId, planId) {
    const perfil = getPerfil(perfilId);
    if (!perfil) return false;
    const tiene = ORDEN_PLANES.indexOf(planId);
    const exige = ORDEN_PLANES.indexOf(perfil.planMinimo);
    return tiene >= 0 && exige >= 0 && tiene >= exige;
}

/**
 * Pasos del provisionado, para que el agente los explique y la pantalla los
 * numere. Son pasos que ejecuta EL CLIENTE: aquí no se lanza nada.
 */
function provisionAsistido(perfilId) {
    const perfil = getPerfil(perfilId);
    if (!perfil) return null;
    return {
        perfil: perfil.id,
        nombre: perfil.nombre,
        requisitos: perfil.requisitos,
        puertos: perfil.puertos,
        pasos: [
            {
                n: 1,
                titulo: 'Comprobar la máquina',
                detalle: `Necesitas ${perfil.requisitos.cpu}, ${perfil.requisitos.ram} y ${perfil.requisitos.disco}. `
                    + 'Con menos arranca y luego se cae a mitad de sincronización.',
            },
            {
                n: 2,
                titulo: 'Recoger el token de registro',
                detalle: 'En la pantalla que se abre desde el chat. Es de un solo uso y caduca; '
                    + 'no se manda por el chat porque acabaría en el historial.',
            },
            {
                n: 3,
                titulo: 'Arrancar el contenedor',
                detalle: 'docker compose up -d con el token en el fichero de entorno. '
                    + 'El nodo genera SU PAR DE CLAVES al arrancar y la privada no sale de tu máquina.',
            },
            {
                n: 4,
                titulo: 'Confirmar el alta',
                detalle: 'El nodo nos envía su clave pública y queda registrado. '
                    + 'La pantalla lo refleja sola y el agente puede consultarlo.',
            },
        ],
        // Dicho explícitamente porque es la pregunta que hace todo responsable
        // de sistemas, y la respuesta es un argumento de venta.
        garantias: [
            'La clave privada del nodo se genera en tu máquina y nunca sale de ella.',
            'BeZhas no obtiene acceso a tu infraestructura: el nodo abre la conexión hacia fuera.',
            'Los puertos RPC se publican solo en tu red interna.',
        ],
    };
}

module.exports = { PERFILES, getPerfil, planPermite, provisionAsistido, ORDEN_PLANES };
