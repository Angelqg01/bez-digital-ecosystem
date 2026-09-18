'use strict';

/**
 * rpcQuorum — consultar varios RPC y exigir que coincidan.
 *
 * Un único RPC es un único punto de mentira: uno desactualizado da un nonce
 * viejo, uno comprometido da un saldo falso o una simulación que no ocurre en
 * la red real (§17 del documento de seguridad). Para lo que decide si se firma
 * —cadena, nonce, saldo, resultado de la llamada— se pregunta a todos y se
 * exige mayoría. Si discrepan, se bloquea: RPC_INCONSISTENT.
 *
 * Configuración: RPC_URLS_<chainId>=url1,url2,url3. Sin ella se cae a la
 * variable de un solo RPC que ya usaba el proyecto, y `redundante` queda en
 * false; el orquestador se niega a firmar así en producción.
 *
 * Lo que NO se exige por consenso: estimación de gas y precio del gas. Varían
 * legítimamente entre nodos; ahí se toma el máximo (gas) y la mediana (precio),
 * y el firmante aplica sus propios topes.
 */

const { ethers } = require('ethers');
const { stableStringify } = require('./txCanonical');

const UN_RPC_POR_CADENA = {
    56: ['BSC_RPC_URL'],
    97: ['BSC_TESTNET_RPC_URL'],
    137: ['POLYGON_RPC_URL'],
    80002: ['POLYGON_AMOY_RPC_URL'],
    2708: ['BEZHAS_L2_RPC_URL', 'RPC_URL'],
    31337: ['BEZHAS_L2_RPC_URL', 'RPC_URL'],
};

function urlsParaCadena(chainId, env = process.env) {
    const explicitas = env[`RPC_URLS_${chainId}`];
    const lista = explicitas
        ? String(explicitas).split(',')
        : (UN_RPC_POR_CADENA[chainId] || []).map((v) => env[v]).filter(Boolean).slice(0, 1);
    return [...new Set(lista.map((u) => u.trim()).filter(Boolean))];
}

function errorRpc(code, message, detalles) {
    const e = new Error(message);
    e.code = code;
    if (detalles) e.detalles = detalles;
    return e;
}

function conTimeout(promesa, ms) {
    let t;
    return Promise.race([
        promesa,
        new Promise((_, rej) => { t = setTimeout(() => rej(errorRpc('RPC_TIMEOUT', `RPC sin respuesta en ${ms} ms`)), ms); }),
    ]).finally(() => clearTimeout(t));
}

const canonico = (v) => (typeof v === 'bigint' ? `n:${v}` : stableStringify(v));

class Quorum {
    constructor({ chainId, urls, crearProveedor, timeoutMs = 4000, minimo } = {}) {
        this.chainId = Number(chainId);
        this.urls = urls || [];
        this.timeoutMs = timeoutMs;
        this.minimoFijo = minimo;
        const red = ethers.Network.from(this.chainId);
        const crear = crearProveedor || ((url) => new ethers.JsonRpcProvider(url, red, { staticNetwork: red }));
        this.proveedores = this.urls.map((url) => ({ url, p: crear(url) }));
    }

    get redundante() { return this.proveedores.length >= 2; }

    necesarios(respondieron) {
        if (this.minimoFijo) return this.minimoFijo;
        if (this.proveedores.length < 2) return 1;
        return Math.max(2, Math.floor(respondieron / 2) + 1);
    }

    async todos(fn) {
        if (!this.proveedores.length) throw errorRpc('RPC_NOT_CONFIGURED', `Sin RPC configurado para la cadena ${this.chainId}.`);
        const r = await Promise.allSettled(this.proveedores.map(({ p }) => conTimeout(fn(p), this.timeoutMs)));
        return r.map((x, i) => ({ url: this.proveedores[i].url, ...x }));
    }

    /** Valor en el que coincide la mayoría. */
    async consenso(nombre, fn) {
        const r = await this.todos(fn);
        const ok = r.filter((x) => x.status === 'fulfilled');
        const grupos = new Map();
        for (const x of ok) {
            const k = canonico(x.value);
            const g = grupos.get(k) || { valor: x.value, n: 0 };
            g.n += 1;
            grupos.set(k, g);
        }
        const mejor = [...grupos.values()].sort((a, b) => b.n - a.n)[0];
        const hacen = this.necesarios(ok.length);
        if (!mejor || ok.length < hacen) {
            throw errorRpc('RPC_UNAVAILABLE', `${nombre}: responden ${ok.length} de ${this.proveedores.length} RPC.`);
        }
        if (mejor.n < hacen) {
            throw errorRpc('RPC_INCONSISTENT', `${nombre}: los RPC no coinciden.`, { respuestas: grupos.size });
        }
        return mejor.valor;
    }

    async comprobarCadena() {
        const id = await this.consenso('eth_chainId', (p) => p.send('eth_chainId', []));
        if (Number(BigInt(id)) !== this.chainId) {
            throw errorRpc('RPC_WRONG_CHAIN', `El RPC responde la cadena ${Number(BigInt(id))}, se esperaba ${this.chainId}.`);
        }
        return this.chainId;
    }

    nonce(direccion) {
        return this.consenso('nonce', (p) => p.getTransactionCount(direccion, 'pending'));
    }

    llamar(tx) {
        return this.consenso('eth_call', (p) => p.call(tx));
    }

    async estimarGas(tx) {
        const r = await this.todos((p) => p.estimateGas(tx));
        const ok = r.filter((x) => x.status === 'fulfilled').map((x) => BigInt(x.value));
        if (!ok.length) {
            const motivo = r.find((x) => x.status === 'rejected')?.reason?.shortMessage || 'estimación fallida';
            throw errorRpc('SIMULATION_REVERTED', `La estimación de gas revierte: ${motivo}`);
        }
        return ok.reduce((a, b) => (a > b ? a : b));
    }

    async comisiones() {
        const r = await this.todos((p) => p.getFeeData());
        const ok = r.filter((x) => x.status === 'fulfilled' && x.value.maxFeePerGas).map((x) => x.value);
        if (!ok.length) throw errorRpc('RPC_UNAVAILABLE', 'Ningún RPC devuelve comisiones EIP-1559.');
        const mediana = (vals) => { const s = vals.map(BigInt).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)); return s[Math.floor(s.length / 2)]; };
        return {
            maxFeePerGas: mediana(ok.map((f) => f.maxFeePerGas)),
            maxPriorityFeePerGas: mediana(ok.map((f) => f.maxPriorityFeePerGas || 0n)),
        };
    }

    /**
     * Difunde por todos. Basta con que uno la acepte: la transacción ya está
     * firmada y su hash es fijo, así que difundirla varias veces no la duplica.
     */
    async difundir(firmada, hashEsperado) {
        const r = await this.todos((p) => p.broadcastTransaction(firmada));
        const aceptadas = r.filter((x) => x.status === 'fulfilled' && x.value?.hash === hashEsperado);
        const yaConocida = r.filter((x) => x.status === 'rejected'
            && /already known|known transaction|nonce too low/i.test(String(x.reason?.message || '')));
        if (!aceptadas.length && !yaConocida.length) {
            throw errorRpc('RPC_BROADCAST_FAILED', 'Ningún RPC aceptó la transacción.',
                { errores: r.map((x) => x.reason?.shortMessage || x.reason?.message).filter(Boolean) });
        }
        return { hash: hashEsperado, aceptadaPor: aceptadas.length, yaConocida: yaConocida.length };
    }
}

const cache = new Map();
function quorumPara(chainId, env = process.env) {
    const urls = urlsParaCadena(chainId, env);
    const clave = `${chainId}|${urls.join(',')}`;
    if (!cache.has(clave)) cache.set(clave, new Quorum({ chainId, urls }));
    return cache.get(clave);
}

module.exports = { Quorum, quorumPara, urlsParaCadena };
