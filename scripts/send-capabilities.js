import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = '812711473';

const bot = new TelegramBot(token, { polling: false });

const capabilities = `
🚀 *¡Plataforma BeZhas Activada y Optimizada!*

He analizado y resuelto los errores de conexión con los modelos de lenguaje. Ahora el sistema utiliza una **cascada inteligente con prioridad en Gemini 2.0 Flash**, lo que garantiza respuestas instantáneas y soporte completo para herramientas.

Aquí tienes un resumen de mis capacidades actuales en esta infraestructura:

🛡️ **Seguridad Aegis AI**
• Auditoría automática de smart contracts antes de interactuar.
• Detección de anomalías en transacciones y prevención de fraude.
• Verificación de cumplimiento regulatorio basada en telemetría.

⛓️ **Infraestructura Blockchain (L2)**
• Monitoreo en tiempo real de validadores y estado del Bridge.
• Análisis predictivo de estrategias de Gas para ahorrar costos.
• Gestión de staking y registro de nodos edge.

💼 **Operaciones Inteligentes**
• Smart Swaps: Cálculo de rutas óptimas en pools de liquidez.
• Scoring de proveedores y predicción de demanda por sectores.
• Gestión de activos comerciales con depósitos en escrow.

⚖️ **Control Humano (HITL)**
• Todas las operaciones críticas (pagos, deploys, trades) requieren tu aprobación vía Telegram.
• Los estados de confirmación son persistentes en Redis (sobreviven a reinicios).

🧠 **Cerebro Multi-Modelo**
• Ejecución en cascada: Si un modelo falla (ej: falta de cuota), salto automáticamente al siguiente (Claude → Gemini → Ollama).
• Memoria episódica y de trabajo persistente en Redis.

*Estoy listo para procesar cualquier comando o consulta.* ¿En qué puedo ayudarte hoy?
`;

async function main() {
    try {
        await bot.sendMessage(chatId, capabilities, { parse_mode: 'Markdown' });
        console.log('Mensaje enviado con éxito.');
    } catch (err) {
        console.error('Error enviando mensaje:', err.message);
    }
}

main();
