'use strict';

/**
 * Comprobación de cifras: una cifra con unidad (importe en € o $, porcentaje) que el modelo escribe tiene que constar
 * en lo que se le dio (documentos recuperados) o en el propio mensaje del usuario. Si no, se retira la frase que la
 * contiene y se avisa. No juzga si el modelo «tiene razón»: sólo impide que presente como dato de BeZhas un importe que
 * no salió de su documentación (caso real: «19,99 € al mes por entidad», con un precio de lista de 499 €).
 *
 * Sólo se comprueban cifras CON unidad (€, $, USD, EUR, euros, %, por ciento). Recuentos («8 sociedades»), años y
 * versiones no se tocan. Los importes de precios y límites del chat los redacta el servidor (facts.js), no el modelo.
 */

const NUM = '\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?';
const UNIDAD = '(?:€|\\$|usd|eur\\b|euros?\\b|d[oó]lares?\\b|%|por\\s+ciento\\b)';
// «99 €», «19,99$», «12 %», «$19,99», «€ 99»
const FIGURA = new RegExp(`(?:(?:€|\\$)\\s*(${NUM}))|(?:(${NUM})\\s*${UNIDAD})`, 'gi');
const CUALQUIER_NUMERO = new RegExp(NUM, 'g');

/** Todas las lecturas numéricas posibles de «1.500», «1,5», «2.499,90», «15 000». */
function valores(token) {
    const t = String(token).trim();
    const out = new Set();
    const compacto = t.replace(/\s/g, '');
    if (/^\d{1,3}([.]\d{3})+(,\d+)?$/.test(compacto)) out.add(Number(compacto.replace(/\./g, '').replace(',', '.')));
    if (/^\d+,\d+$/.test(compacto)) out.add(Number(compacto.replace(',', '.')));
    if (/^\d+\.\d+$/.test(compacto)) {
        out.add(Number(compacto));                                   // 1.5 como decimal
        if (/^\d{1,3}\.\d{3}$/.test(compacto)) out.add(Number(compacto.replace('.', ''))); // 1.500 como millar
    }
    if (/^\d+$/.test(compacto)) out.add(Number(compacto));
    return [...out].filter(Number.isFinite);
}

function numerosDe(texto) {
    const set = new Set();
    for (const m of String(texto || '').matchAll(CUALQUIER_NUMERO)) for (const v of valores(m[0])) set.add(v);
    return set;
}

/** Cifras con unidad del texto: [{ crudo, valores:[...] }] */
function cifrasDe(texto) {
    const out = [];
    for (const m of String(texto || '').matchAll(FIGURA)) {
        const crudo = m[1] || m[2];
        out.push({ crudo, valores: valores(crudo), fragmento: m[0] });
    }
    return out;
}

const AVISO = '\n\n_He retirado de esta respuesta una o más cifras que no constan en la documentación de BeZhas. Para precios y límites vigentes abre «Suscribirme a un plan» o pregunta «¿cuánto cuestan los planes?»._';

/**
 * @param {string} respuesta  texto del modelo (ya saneado)
 * @param {{contexto?:string, mensaje?:string}} fuentes  lo que el modelo tenía delante
 * @returns {{text:string, retiradas:string[]}}
 */
function comprobarCifras(respuesta, { contexto = '', mensaje = '' } = {}) {
    const texto = String(respuesta || '');
    if (!texto) return { text: '', retiradas: [] };
    const permitidos = numerosDe(`${contexto}\n${mensaje}`);
    const retiradas = [];

    const infundada = (frase) => cifrasDe(frase).filter((c) => c.valores.length && !c.valores.some((v) => permitidos.has(v)));

    const lineas = texto.split('\n').map((linea) => {
        if (!infundada(linea).length) return linea;
        // Línea con cifra infundada: se conservan sólo las frases limpias (en una viñeta corta, ninguna).
        const frases = linea.split(/(?<=[.!?])\s+/);
        const buenas = frases.filter((f) => {
            const malas = infundada(f);
            malas.forEach((c) => retiradas.push(c.fragmento.trim()));
            return !malas.length;
        });
        return buenas.join(' ');
    });

    if (!retiradas.length) return { text: texto, retiradas: [] };
    const limpio = lineas.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\s*(?:[-*•]|\d+[.)])\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    return { text: limpio + AVISO, retiradas };
}

module.exports = { comprobarCifras, cifrasDe, numerosDe, valores, AVISO };
