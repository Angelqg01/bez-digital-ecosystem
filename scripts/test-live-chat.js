/**
 * test-live-chat.js
 * 
 * Runs a live dialogue simulation through the OpenClawOrchestrator
 * to test prompt load, intent routing, and real LLM response quality.
 */
import 'dotenv/config';
import { OpenClawOrchestrator } from '../core/OpenClawOrchestrator.js';

// Mock dependencies to run lightweight without Redis/Postgres/Ollama background servers
const localHistory = [];

const mockMemory = {
  addMessage: async (sessionId, role, text, meta) => {
    localHistory.push({ role, content: text });
  },
  getHistoryForLLM: async (sessionId, limit) => {
    return localHistory;
  },
  getAllWorkingMemory: async (agentId) => {
    return {
      fit_score: 95,
      fondos: "SoftBank Vision Fund"
    };
  },
  getPendingTasks: async (agentId) => {
    return [];
  },
  setWorkingMemory: async (agentId, key, val) => {
    // console.log(`[Memory] Working memory updated: ${key} = ${JSON.stringify(val)}`);
  }
};

const mockHIL = {
  requiresConfirmation: (tool, input) => ({ required: false }),
  guard: async (tool, agentId, input, fn) => {
    return { executed: true, result: await fn() };
  }
};

const mockOllama = {
  isAvailable: async () => false
};

const mockTelegram = {
  sendMessage: async (chatId, text, opts) => {
    console.log(`[Telegram Bot mock] Message sent to ${chatId}: "${text}"`);
    return { message_id: 12345 };
  }
};

async function main() {
  console.log('\n======================================================');
  console.log('  BeZhas Blockchain — Live Conversational Chat Test');
  console.log('======================================================');

  console.log('\n🤖 Inicializando OpenClawOrchestrator con prompts dinámicos...');
  const orchestrator = new OpenClawOrchestrator({
    memory: mockMemory,
    hil: mockHIL,
    ollama: mockOllama,
    telegram: mockTelegram
  });

  const userPrompt = "Hola, soy director de inversiones de SoftBank. Tenemos 15M de asignación libre para coinversión. Quiero ver el deck de BeZhas y saber cómo es el mecanismo de adquisición de BEZ-Coin.";
  
  console.log(`\n💬 Pregunta del Inversor:\n"${userPrompt}"`);
  console.log('\n🧠 Pensando, cargando prompt dinámico y enrutando...');

  try {
    const result = await orchestrator.process({
      sessionId: "smoke:live-test",
      text: userPrompt,
      userId: "softbank_investor",
      isAuthorized: false
    });

    console.log('\n======================================================');
    console.log(`🤖 Respuesta Real de [${result.agentId}] via Cascade LLM:`);
    console.log('======================================================\n');
    console.log(result.text);
    console.log('\n======================================================');
    console.log('   🎉 TEST CONVERSACIONAL FINALIZADO CON ÉXITO');
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR durante la ejecución conversacional:');
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
