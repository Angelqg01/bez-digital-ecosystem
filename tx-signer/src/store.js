'use strict';

/**
 * Estado persistente del firmante: gasto del día por cartera y activo, e
 * intenciones ya firmadas.
 *
 * En disco y no en memoria a propósito. Un tope diario que vive en memoria se
 * salta reiniciando el contenedor; una intención firmada que se olvida al
 * reiniciar se puede volver a firmar con OTRO nonce, y eso es un segundo pago
 * con la misma aprobación. Escritura atómica (fichero temporal + rename) para
 * que un corte a mitad no deje el estado corrupto.
 */

const fs = require('fs');
const path = require('path');

const DIAS_A_CONSERVAR = 3;

function crearAlmacen(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const fichero = path.join(dir, 'estado.json');
    let estado = { gasto: {}, firmadas: {} };
    if (fs.existsSync(fichero)) estado = JSON.parse(fs.readFileSync(fichero, 'utf8'));

    const dia = (fecha = new Date()) => fecha.toISOString().slice(0, 10);

    function guardar() {
        const dias = Object.keys(estado.gasto).sort();
        for (const d of dias.slice(0, Math.max(0, dias.length - DIAS_A_CONSERVAR))) delete estado.gasto[d];
        const tmp = `${fichero}.${process.pid}.tmp`;
        const fd = fs.openSync(tmp, 'w', 0o600);
        fs.writeSync(fd, JSON.stringify(estado));
        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fs.renameSync(tmp, fichero);
    }

    return {
        gastadoHoy(carteraId, activo, fecha) {
            return BigInt(estado.gasto[dia(fecha)]?.[carteraId]?.[activo] || '0');
        },
        firmada(intentHash) {
            return estado.firmadas[intentHash] || null;
        },
        /** Se registra ANTES de devolver la firma: si falla el disco, no hay firma. */
        registrar({ intentHash, nonce, txHash, carteraId, activo, cantidad, fecha }) {
            const d = dia(fecha);
            if (!estado.firmadas[intentHash]) {
                estado.gasto[d] = estado.gasto[d] || {};
                estado.gasto[d][carteraId] = estado.gasto[d][carteraId] || {};
                const previo = BigInt(estado.gasto[d][carteraId][activo] || '0');
                estado.gasto[d][carteraId][activo] = (previo + BigInt(cantidad)).toString();
            }
            estado.firmadas[intentHash] = { nonce, txHash, en: new Date().toISOString() };
            guardar();
        },
    };
}

module.exports = { crearAlmacen };
