/**
 * requiredSecret — un secreto que falta en producción detiene el arranque.
 *
 * Varios módulos del Hub hacían `process.env.X || 'literal'`. El literal está
 * en el repositorio, así que si la variable no llegaba al contenedor el
 * servicio arrancaba igualmente, pero con una clave que conoce cualquiera:
 * la del firmante del motor de riesgo, la del panel de administración, la de
 * diagnóstico. Un despliegue mal configurado no daba ningún error.
 *
 * Misma política que config/authSecrets.js para JWT_SECRET:
 *   · producción  → sin valor, con un valor de desarrollo conocido o demasiado
 *                   corto, se lanza un error (el proceso no arranca);
 *   · resto       → se usa el valor de desarrollo que pase quien llama.
 */

const IS_PRODUCTION = () => process.env.NODE_ENV === 'production';

/**
 * @param {string} nombre            variable de entorno principal
 * @param {object} [opciones]
 * @param {string[]} [opciones.alternativas]  otras variables válidas, en orden
 * @param {string[]} [opciones.prohibidos]    valores públicos que producción rechaza
 * @param {number}   [opciones.minLength]     longitud mínima en producción
 * @param {string|function():string} [opciones.dev]  valor fuera de producción
 * @returns {string}
 */
function secretoObligatorio(nombre, { alternativas = [], prohibidos = [], minLength = 0, dev } = {}) {
    const nombres = [nombre, ...alternativas];
    const valor = nombres.map((n) => process.env[n]).find((v) => typeof v === 'string' && v.length > 0);

    if (!IS_PRODUCTION()) {
        if (valor) return valor;
        return typeof dev === 'function' ? dev() : (dev || '');
    }

    const etiqueta = nombres.join(' / ');
    if (!valor) {
        throw new Error(`FATAL: falta ${etiqueta} en producción. Debe inyectarse desde Secret Manager; ` +
            'el servicio no arranca con un valor por defecto.');
    }
    if (prohibidos.includes(valor)) {
        throw new Error(`FATAL: ${etiqueta} tiene en producción un valor de desarrollo que es público. Rótalo.`);
    }
    if (valor.length < minLength) {
        throw new Error(`FATAL: ${etiqueta} debe tener al menos ${minLength} caracteres en producción.`);
    }
    return valor;
}

module.exports = { secretoObligatorio };
