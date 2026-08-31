'use strict';
const BaseAgent = require('../BaseAgent');

/**
 * TokenomicsAgent — sintetiza el estado del token BEZ-Coin (precio semilla,
 * estado de cadena, gas) en un informe de salud de tokenomics. Solo lee y
 * analiza: cualquier acción sobre el token (transferir, listar, quemar)
 * la ejecuta otro agente y siempre pasa por las líneas rojas on-chain.
 */
class TokenomicsAgent extends BaseAgent {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'treasury.tokenomics',
      name: 'Tokenomics',
      department: 'treasury',
      modelTier: 'fast',
      capabilities: ['treasury:tokenomics'],
      systemPrompt:
        'Eres el analista de tokenomics de BeZhas. Con el precio semilla, el estado de la cadena y el gas, ' +
        'das un informe conciso de salud del token. Nunca dices nada como asesoría de inversión.',
    });
  }

  async run(task) {
    const core = this.tools['bezhas-core'];
    if (!core) throw new Error('bezhas-core: conector no disponible');

    const [overview, gas] = await Promise.all([
      core.execute('chainOverview'),
      core.execute('gasStatus'),
    ]);
    const seedPriceUsd = Number(process.env.BEZ_SEED_PRICE_USD || 0.0075);

    const report = await this.think(
      `Precio semilla de BEZ-Coin: $${seedPriceUsd}. Estado de la cadena: ${JSON.stringify(overview)}. ` +
      `Gas: ${JSON.stringify(gas)}. Da un informe de salud de tokenomics en 3-4 frases, sin dar asesoría de inversión, ` +
      `solo estado operativo del token y la red.`,
      { useMemory: false, maxTokens: 350 },
    );

    return { seedPriceUsd, overview, gas, report, status: 'ok' };
  }
}
module.exports = TokenomicsAgent;
