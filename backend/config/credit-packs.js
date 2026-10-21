/**
 * Packs de créditos de chat que se pueden comprar con Stripe (EUR).
 * Precio y cantidad salen SIEMPRE de aquí: el cliente solo elige un `id`.
 */
const CREDIT_PACKS = Object.freeze([
    Object.freeze({ id: 'chat_100', credits: 100, priceEur: 5, name: '100 créditos de chat' }),
    Object.freeze({ id: 'chat_500', credits: 500, priceEur: 20, name: '500 créditos de chat' }),
    Object.freeze({ id: 'chat_2000', credits: 2000, priceEur: 60, name: '2000 créditos de chat' }),
]);

const getPack = (id) => CREDIT_PACKS.find((p) => p.id === id) || null;
const publicPacks = () => CREDIT_PACKS.map(({ id, credits, priceEur, name }) => ({ id, credits, priceEur, name, currency: 'EUR' }));

module.exports = { CREDIT_PACKS, getPack, publicPacks };
