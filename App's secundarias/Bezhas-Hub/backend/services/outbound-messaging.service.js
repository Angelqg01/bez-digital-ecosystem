/**
 * OUTBOUND MESSAGING SERVICE (AIOps Nivel 5)
 * Agente orquestador para envío de pitches automáticos por Email, WhatsApp, LinkedIn y Telegram.
 */

const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const B2BLead = require('../models/B2BLead.model');
const feedbackLoopService = require('./feedback-loop.service');

dotenv.config();

class OutboundMessagingService {
    constructor() {
        this.status = 'Active';
        this.messagesSent = 0;

        // Mock Init
        this.sendgridApiKey = process.env.SENDGRID_API_KEY;
        this.twilioSid = process.env.TWILIO_ACCOUNT_SID;
        this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        this.smtpHost = process.env.SMTP_HOST;
        this.smtpUser = process.env.SMTP_USER;
        this.smtpPass = process.env.SMTP_PASS;
        this.smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER;

        // if (this.sendgridApiKey) sgMail.setApiKey(this.sendgridApiKey);
    }

    /**
     * Construye un Pitch de acuerdo al perfil del prospecto.
     */
    generatePitch(lead) {
        console.log(`[Outbound] 🧠 Generando Pitch personalizado para: ${lead.companyName} (${lead.type})`);

        let pitch = '';
        if (lead.type === 'B2G') {
            pitch = `Estimado director en ${lead.companyName},\n\nNos hemos percatado de áreas de oportunidad en la transparencia y automatización de procesos gubernamentales. En BeZhas hemos desarrollado protocolos de Inteligencia Artificial que operan de forma 100% autónoma auditables mediante Blockchain.\n\nLe ofrecemos un subsidio inicial de 500 BEZ-Coins para integrar nuestro SDK y realizar una prueba de concepto en su entidad sin coste.\n\nInstale nuestro SDK ahora.`;
        } else {
            pitch = `Hola equipo de ${lead.companyName},\n\nHe estado revisando su sitio web y veo gran potencial para automatizar sus flujos de adquisición y fidelización de clientes. Nuestro sistema BeZhas AIOps permite integrar una capa de pagos y herramientas web3 en 5 minutos.\n\nQuiero obsequiarles 100 BEZ-Coins de crédito fundacional para que sus desarrolladores inicien pruebas hoy mismo mediante nuestro SDK.\n\n¿Tienen un momento esta semana para una demostración?`;
        }

        return pitch;
    }

    generateSubject(lead) {
        const sector = lead.sector || 'operaciones';
        if (lead.type === 'B2G') return `BeZhas para transparencia y automatización en ${sector}`;
        return `BeZhas para automatizar ${sector} con APIs y blockchain`;
    }

    async createApprovalDrafts(leads, campaignId) {
        const drafts = [];

        for (const lead of leads) {
            const channel = lead.whatsappNumber ? 'whatsapp' : lead.linkedinProfile ? 'linkedin' : 'email';
            const message = this.generatePitch(lead);
            const subject = this.generateSubject(lead);

            const doc = await B2BLead.create({
                campaignId,
                sector: lead.sector,
                companyName: lead.companyName,
                url: lead.url,
                type: lead.type,
                contactEmail: lead.contactEmail,
                whatsappNumber: lead.whatsappNumber,
                linkedinProfile: lead.linkedinProfile,
                score: lead.score || 0,
                scoreReasons: lead.scoreReasons || [],
                status: 'needs_approval',
                metadata: {
                    estimatedValueToken: lead.estimatedValueToken,
                    sourceQualified: lead.isQualified
                },
                outreach: {
                    channel,
                    subject,
                    message,
                    status: 'needs_approval'
                }
            });

            drafts.push(doc);
        }

        await feedbackLoopService.log({
            type: 'campaigns',
            action: 'CREATE_APPROVAL_DRAFTS',
            status: 'success',
            result: `Created ${drafts.length} outreach drafts`,
            metadata: { campaignId }
        });

        return drafts;
    }

    /**
     * Envía la campaña a una lista de leads por el canal disponible.
     */
    async blastCampaign(leads) {
        const results = [];

        for (const lead of leads) {
            const pitch = this.generatePitch(lead);
            let channel = 'Email';

            // Lógica de decisión de canal del Agente
            if (lead.whatsappNumber) channel = 'WhatsApp';
            else if (lead.linkedinProfile) channel = 'LinkedIn';

            const sent = await this.sendMessage(lead, pitch, channel);
            results.push(sent);

            if (sent.success) {
                this.messagesSent++;
            }
        }

        return {
            success: true,
            totalSent: this.messagesSent,
            details: results
        };
    }

    async approveAndSendLead(leadId, approver = 'human-admin') {
        const lead = await B2BLead.findById(leadId);
        if (!lead) {
            return { success: false, error: 'Lead not found' };
        }

        if (!lead.outreach || lead.outreach.status !== 'needs_approval') {
            return { success: false, error: `Lead is not pending approval (${lead.outreach?.status || lead.status})` };
        }

        lead.status = 'approved';
        lead.outreach.status = 'approved';
        lead.outreach.approvedBy = approver;
        lead.outreach.approvedAt = new Date();
        await lead.save();

        const sendResult = await this.sendMessage(lead, lead.outreach.message, lead.outreach.channel, lead.outreach.subject);

        if (sendResult.success) {
            lead.status = 'sent';
            lead.outreach.status = 'sent';
            lead.outreach.sentAt = new Date();
            lead.outreach.providerMessageId = sendResult.providerMessageId;
        } else {
            lead.status = sendResult.blocked ? 'blocked' : 'failed';
            lead.outreach.status = sendResult.blocked ? 'blocked' : 'failed';
            lead.outreach.error = sendResult.error;
        }

        await lead.save();

        await feedbackLoopService.log({
            type: 'campaigns',
            action: 'APPROVE_AND_SEND_LEAD',
            status: sendResult.success ? 'success' : 'failed',
            result: sendResult.success ? `Sent to ${lead.companyName}` : sendResult.error,
            metadata: { leadId, approver, channel: lead.outreach.channel }
        });

        return { ...sendResult, lead };
    }

    /**
     * Interfaz unificada de envío de mensajes.
     */
    async sendMessage(lead, message, channel, subject) {
        console.log(`[Outbound] 📤 Intentando envío a ${lead.contactEmail} vía ${channel}...`);

        try {
            if (channel === 'Email') {
                channel = 'email';
            }

            if (channel === 'email') {
                if (!this.smtpHost || !this.smtpFrom || !lead.contactEmail) {
                    return {
                        success: false,
                        blocked: true,
                        lead: lead.companyName,
                        channel,
                        error: 'SMTP no configurado o lead sin email. No se envió nada.'
                    };
                }
                const result = await this.sendEmail(lead.contactEmail, subject || this.generateSubject(lead), message);
                return { success: true, lead: lead.companyName, channel, providerMessageId: result.messageId };
            } else if (channel === 'WhatsApp') {
                channel = 'whatsapp';
            }

            if (channel === 'whatsapp' || channel === 'linkedin' || channel === 'telegram') {
                return {
                    success: false,
                    blocked: true,
                    lead: lead.companyName,
                    channel,
                    error: `${channel} requiere conector y consentimiento explícito. Envío bloqueado.`
                };
            }

            console.log(`[Outbound] ✅ Mensaje enviado exitosamente vía ${channel}`);
            return { success: true, lead: lead.companyName, channel };
        } catch (error) {
            console.error(`[Outbound] ❌ Fallo al enviar a ${lead.companyName}: ${error.message}`);
            return { success: false, lead: lead.companyName, error: error.message };
        }
    }

    async mockEmailSend(email, message) {
        return new Promise(resolve => {
            setTimeout(() => {
                // Simula latencia de red
                resolve(true);
            }, 500);
        });
    }

    async sendEmail(to, subject, text) {
        const transporter = nodemailer.createTransport({
            host: this.smtpHost,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: this.smtpUser && this.smtpPass ? {
                user: this.smtpUser,
                pass: this.smtpPass
            } : undefined
        });

        return transporter.sendMail({
            from: this.smtpFrom,
            to,
            subject,
            text
        });
    }

    async mockWhatsAppSend(phone, message) {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(true);
            }, 500);
        });
    }

    getStatus() {
        return {
            state: this.status,
            totalMessagesSent: this.messagesSent
        };
    }
}

module.exports = new OutboundMessagingService();
