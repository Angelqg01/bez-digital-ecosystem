/**
 * Email Service
 * 
 * Handles transactional emails via SMTP (SendGrid, Mailgun, AWS SES, or custom SMTP).
 * Required for production deployment on GCP (bez.digital).
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER || 'apikey', // Default SendGrid username
                pass: process.env.SMTP_PASS || process.env.SENDGRID_API_KEY
            }
        });

        this.senderEmail = process.env.EMAIL_FROM || 'info.bezcoin@bez.digital';
    }

    /**
     * Send a standard email
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} html - HTML body content
     */
    async sendEmail(to, subject, html) {
        if (!process.env.SMTP_PASS && !process.env.SENDGRID_API_KEY) {
            console.warn(`[Mock Email] To: ${to} | Subject: ${subject}`);
            return true;
        }

        try {
            const mailOptions = {
                from: `BeZhas Network <${this.senderEmail}>`,
                to,
                subject,
                html
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✉️ Email sent perfectly to ${to} (Message-ID: ${info.messageId})`);
            return info;
        } catch (error) {
            console.error('❌ Failed to send email:', error);
            throw new Error(`Email sending failed: ${error.message}`);
        }
    }

    /**
     * Send OTP / Verification Code for Login or Registration
     * @param {string} email - User's email
     * @param {string} code - 6-digit OTP code
     */
    async sendVerificationCode(email, code) {
        const subject = 'Tu Código de Verificación BeZhas';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaec; border-radius: 10px;">
                <h2 style="color: #0ea5e9; text-align: center;">BeZhas Network</h2>
                <p>Hola,</p>
                <p>Tu código de seguridad de 6 dígitos para continuar con tu proceso es:</p>
                <div style="background-color: #f3f4f6; text-align: center; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <h1 style="letter-spacing: 5px; color: #1f2937; margin: 0;">${code}</h1>
                </div>
                <p>Este código espirará en 10 minutos. Si no solicitaste este código, puedes ignorar este correo de forma segura.</p>
                <hr style="border: none; border-top: 1px solid #eaeaec; margin: 30px 0;" />
                <p style="font-size: 12px; color: #6b7280; text-align: center;">© ${new Date().getFullYear()} BeZhas. Todos los derechos reservados.</p>
            </div>
        `;
        return this.sendEmail(email, subject, html);
    }

    /**
     * Send login notification alert
     * @param {string} email - User's email
     * @param {Object} deviceInfo - Info about the login origin
     */
    async sendLoginAlert(email, deviceInfo = {}) {
        const subject = 'Nuevo inicio de sesión en BeZhas';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaec; border-radius: 10px;">
                <h2 style="color: #0ea5e9;">Aviso de Seguridad</h2>
                <p>Se ha detectado un nuevo inicio de sesión en tu cuenta BeZhas.</p>
                <ul>
                    <li><strong>Fecha:</strong> ${new Date().toLocaleString()}</li>
                    <li><strong>IP:</strong> ${deviceInfo.ip || 'Desconocida'}</li>
                    <li><strong>Dispositivo:</strong> ${deviceInfo.browser || 'Desconocido'}</li>
                </ul>
                <p>Si fuiste tú, no tienes que hacer nada. Si no reconoces esta actividad, por favor cambia tu contraseña inmediatamente.</p>
            </div>
        `;
        return this.sendEmail(email, subject, html);
    }
}

module.exports = new EmailService();
