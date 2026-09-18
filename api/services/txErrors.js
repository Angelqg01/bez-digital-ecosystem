'use strict';

/**
 * Error de la capa transaccional: lleva el código estable que ve el cliente y
 * el estado HTTP. El mensaje es para una persona; el código, para un programa.
 */
class TxError extends Error {
    constructor(code, status, message, detalles) {
        super(message);
        this.name = 'TxError';
        this.code = code;
        this.status = status;
        if (detalles !== undefined) this.detalles = detalles;
    }
}

module.exports = { TxError };
