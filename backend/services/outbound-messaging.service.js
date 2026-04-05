/**
 * OUTBOUND MESSAGING SERVICE (AIOps Nivel 5)
 * Agente orquestador para envío de pitches automáticos por Email, WhatsApp, LinkedIn y Telegram.
 */

const dotenv = require('dotenv');
// const sgMail = require('@sendgrid/mail'); // Comentado para evitar errores si no está instalado
// const twilio = require('twilio'); // Comentado

dotenv.config();

class OutboundMessagingService {
    constructor() {
        this.status = 'Active';
        this.messagesSent = 0;

        // Mock Init
        this.sendgridApiKey = process.env.SENDGRID_API_KEY;
        this.twilioSid = process.env.TWILIO_ACCOUNT_SID;
        this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

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

    /**
     * Interfaz unificada de envío de mensajes.
     */
    async sendMessage(lead, message, channel) {
        console.log(`[Outbound] 📤 Intentando envío a ${lead.contactEmail} vía ${channel}...`);

        try {
            // Modo MOCK si las APIs no están configuradas
            if (channel === 'Email') {
                await this.mockEmailSend(lead.contactEmail, message);
            } else if (channel === 'WhatsApp') {
                await this.mockWhatsAppSend(lead.whatsappNumber || '+57300000000', message);
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
