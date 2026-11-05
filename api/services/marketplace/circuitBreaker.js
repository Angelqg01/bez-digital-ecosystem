'use strict';

/**
 * Circuit breaker por listing, en memoria del proceso.
 *
 *   cerrado   → pasan todas las llamadas.
 *   abierto   → tras UMBRAL fallos SEGUIDOS (red, timeout o 5xx) no se llama al
 *               proveedor durante ENFRIAMIENTO_MS: el consumidor recibe un 503
 *               inmediato en vez de esperar 10 s a un upstream caído.
 *   semiabierto → pasado el enfriamiento entra UNA sonda. Si va bien se cierra;
 *               si falla se vuelve a abrir.
 *
 * Es por instancia de Cloud Run, no global: con varias instancias el umbral
 * efectivo es mayor, lo que basta para proteger al proveedor y a la API.
 */

const UMBRAL = 5;
const ENFRIAMIENTO_MS = 30_000;
const estados = new Map(); // listingId → { fallos, abiertoHasta, sonda }

function permitir(id, ahora = Date.now()) {
    const e = estados.get(id);
    if (!e || !e.abiertoHasta) return true;
    if (e.abiertoHasta > ahora) return false;
    // Semiabierto: deja pasar esta sonda y bloquea a las demás hasta que vuelva.
    e.abiertoHasta = ahora + ENFRIAMIENTO_MS;
    e.sonda = true;
    return true;
}

function exito(id) {
    estados.delete(id);
}

function fallo(id, ahora = Date.now()) {
    const e = estados.get(id) || { fallos: 0, abiertoHasta: 0, sonda: false };
    e.fallos += 1;
    if (e.sonda || e.fallos >= UMBRAL) {
        e.abiertoHasta = ahora + ENFRIAMIENTO_MS;
        e.sonda = false;
    }
    estados.set(id, e);
}

module.exports = { permitir, exito, fallo, UMBRAL, ENFRIAMIENTO_MS, _estados: estados };
