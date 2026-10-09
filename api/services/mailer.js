'use strict';

/**
 * services/mailer.js — envío de correo transaccional (recuperación de contraseña).
 *
 * Con SMTP_HOST configurado envía de verdad (nodemailer). Sin él NO envía: deja un
 * aviso en el log y, sólo fuera de producción, el cuerpo del mensaje para poder
 * probar el flujo en local. En producción el cuerpo (que lleva un código) nunca se loguea.
 */

const logger = require('../utils/logger');

let transporter = null;
function getTransporter() {
    if (transporter) return transporter;
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 587,
        secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT, 10) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return transporter;
}

async function sendMail({ to, subject, text }) {
    if (!process.env.SMTP_HOST) {
        logger.warn({ to }, 'SMTP_HOST sin configurar: correo NO enviado');
        if (process.env.NODE_ENV !== 'production') logger.warn({ subject, text }, '[mailer] contenido (sólo fuera de producción)');
        return { sent: false, reason: 'smtp_not_configured' };
    }
    await getTransporter().sendMail({
        from: process.env.SMTP_FROM || 'BeZhas <support@bezhas.com>', to, subject, text,
    });
    return { sent: true };
}

module.exports = { sendMail };
