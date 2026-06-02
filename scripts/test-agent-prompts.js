/**
 * test-agent-prompts.js
 * 
 * Smoke test script to verify prompt integration, dynamic loading,
 * and routing for BeZhas autonomous agents.
 */
import 'dotenv/config';
import { agentRegistry } from '../core/AgentToolRegistry.js';

console.log('\n======================================================');
console.log('  BeZhas Blockchain — Smoke Test: Prompts & Agents');
console.log('======================================================\n');

try {
  // 1. Verificar agentes cargados en el registro
  const agents = agentRegistry.listAgents();
  console.log('🤖 Agentes registrados en la plataforma:');
  console.log(agents.map(a => `   - ${a}`).join('\n'));
  
  if (!agents.includes('investor-agent')) {
    throw new Error('❌ Fallo: "investor-agent" no está registrado.');
  }
  console.log('\n✅ investor-agent registrado correctamente.');

  // 2. Verificar carga dinámica de los prompts desde docs/prompts/
  console.log('\n📚 Validando carga de prompts desde docs/prompts/:');
  const targetPrompts = ['director-agent', 'marketing-agent', 'blockchain-agent', 'investor-agent'];
  
  for (const agentId of targetPrompts) {
    const agent = agentRegistry.getAgent(agentId);
    if (!agent.systemPrompt) {
      throw new Error(`❌ Fallo: systemPrompt está vacío para ${agentId}`);
    }
    
    // Obtener los primeros 120 caracteres para previsualización
    const snippet = agent.systemPrompt.slice(0, 120).replace(/\r?\n/g, ' ') + '...';
    console.log(`   [+] ${agentId}:`);
    console.log(`       - Longitud: ${agent.systemPrompt.length} caracteres`);
    console.log(`       - Fragmento: "${snippet}"`);
  }
  console.log('\n✅ Carga dinámica de prompts desde archivos de texto funcionando al 100%.');

  // 3. Verificar enrutamiento de intenciones (routeIntent)
  console.log('\n🎯 Probando enrutamiento de intenciones (Intent Routing):');
  
  const testCases = [
    {
      intent: 'Hola, quiero contactar a un inversor institucional para enviarle nuestro deck de inversión por Stripe',
      expected: 'investor-agent'
    },
    {
      intent: 'Necesito prospectar 5 empresas logísticas en España que usen SAP y subir los leads al CRM',
      expected: 'marketing-agent'
    },
    {
      intent: 'Haz un deploy del contrato inteligente BeZhasPayment.sol usando Foundry en localhost',
      expected: 'blockchain-agent'
    },
    {
      intent: 'Muéstrame el reporte de OKRs de la semana y el resumen ejecutivo general de estrategia',
      expected: 'director-agent'
    }
  ];

  for (const { intent, expected } of testCases) {
    const routed = agentRegistry.routeIntent(intent);
    console.log(`   - Input: "${intent}"`);
    console.log(`     -> Routed to: [${routed}] (Esperado: [${expected}])`);
    if (routed !== expected) {
      throw new Error(`❌ Fallo: Enrutamiento incorrecto. Esperado [${expected}], obtenido [${routed}].`);
    }
  }
  console.log('\n✅ Enrutamiento de intenciones validado perfectamente.');

  console.log('\n======================================================');
  console.log('   🎉 TODO CORRECTO - Smoke Test Exitoso');
  console.log('======================================================\n');
  process.exit(0);

} catch (err) {
  console.error('\n❌ ERROR CRÍTICO durante el Smoke Test:');
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
}
