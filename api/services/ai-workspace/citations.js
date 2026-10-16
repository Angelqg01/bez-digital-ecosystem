'use strict';

/**
 * Validación de citas [n] de la respuesta del modelo contra las fuentes realmente recuperadas.
 * Una cita a una fuente que no existe (`[7]` con 3 fuentes, `[0]`) es una referencia inventada: se quita. No se toca
 * nada que parezca un enlace Markdown `[texto](url)`, una definición `[id]:` ni un bloque de código.
 */
function validarCitas(texto, numFuentes) {
    if (typeof texto !== 'string' || !texto) return { text: '', eliminadas: [] };
    const eliminadas = [];
    const partes = texto.split(/(```[\s\S]*?```|`[^`\n]*`)/g); // los bloques de código quedan intactos
    const text = partes.map((p, i) => (i % 2 ? p : p.replace(/[ \t]?\[(\d{1,3})\](?![(:\[])/g, (m, n) => {
        const k = Number(n);
        if (k >= 1 && k <= numFuentes) return m;
        eliminadas.push(k);
        return '';
    }))).join('');
    return { text, eliminadas };
}

module.exports = { validarCitas };
