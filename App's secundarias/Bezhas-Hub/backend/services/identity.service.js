/**
 * identity.service — resuelve la identidad ÚNICA BeZhas_ID a partir de cualquier
 * método de acceso (email, wallet, OAuth/userId) y FUSIONA cuando una persona
 * que ya entró por un método entra por otro (p.ej. usuario de email que conecta
 * su wallet → se vincula a la MISMA identidad, no se crea otra).
 *
 * Construido con `createIdentityService({ Identity })` para testear sin BD.
 */
function createIdentityService({ Identity } = {}) {
  if (!Identity) Identity = require('../models/pg/Identity');

  /**
   * Resuelve o crea la identidad canónica.
   * @param {{email?:string, wallet?:string, userId?:string, displayName?:string}} input
   * @returns {Promise<{identity:object, bezhasId:string, created:boolean, merged:boolean}>}
   */
  async function resolveOrCreate(input = {}) {
    const { email, wallet, userId, displayName } = input;
    if (!email && !wallet && !userId) {
      const err = new Error('Se requiere email, wallet o userId para resolver la identidad.');
      err.code = 'NO_IDENTIFIER';
      throw err;
    }

    const emailHash = email ? Identity.hashEmail(email) : null;

    // 1) Por wallet (identificador fuerte y único).
    let found = wallet ? await Identity.findByWallet(wallet) : null;
    // 2) Por email.
    if (!found && emailHash) found = await Identity.findByEmailHash(emailHash);
    // 3) Por userId interno.
    if (!found && userId) found = await Identity.findByUserId(userId);

    if (found) {
      // Fusión/enriquecimiento: vincular datos que aún no tuviera.
      const linkFields = {};
      if (wallet && !found.wallet_address) linkFields.walletAddress = wallet;
      if (emailHash && !found.email_hash) linkFields.emailHash = emailHash;
      if (userId && !found.user_id) linkFields.userId = userId;
      if (displayName && !found.display_name) linkFields.displayName = displayName;

      const merged = Object.keys(linkFields).length > 0;
      const identity = merged ? await Identity.link(found.bezhas_id, linkFields) : found;
      return { identity, bezhasId: identity.bezhas_id, created: false, merged };
    }

    // 4) No existe → crear identidad nueva.
    const identity = await Identity.create({ emailHash, wallet, userId, displayName });
    return { identity, bezhasId: identity.bezhas_id, created: true, merged: false };
  }

  async function getByBezhasId(bezhasId) {
    return Identity.findByBezhasId(bezhasId);
  }

  return { resolveOrCreate, getByBezhasId };
}

const _default = createIdentityService();

module.exports = {
  createIdentityService,
  resolveOrCreate: _default.resolveOrCreate,
  getByBezhasId: _default.getByBezhasId,
};
