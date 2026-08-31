'use strict';

/**
 * capTableMath — dilución y porcentajes de propiedad tras una ronda,
 * calculados con la fórmula estándar de cap table, no con la prosa de un
 * modelo "estimando" quién se diluye cuánto.
 *
 * Mismo motivo que `priceCatalog`: es un número que un inversor va a
 * contrastar con su propia calculadora, y un error aquí no es un matiz de
 * redacción, es un desacuerdo contractual.
 *
 * Modelo simple sin pool de opciones (option pool shuffle): pre-money +
 * inversión = post-money; el nuevo inversor recibe `inversión / post-money`
 * de la empresa, y todos los accionistas existentes se diluyen en la misma
 * proporción entre sí (su reparto RELATIVO entre ellos no cambia).
 */

/**
 * @param {Array<{holder:string, shares:number}>} capTable  - tabla actual
 * @param {number} preMoneyValuation
 * @param {number} raiseAmount
 * @returns {{
 *   postMoneyValuation, pricePerShare, newSharesIssued, newInvestorPct,
 *   totalSharesBefore, totalSharesAfter,
 *   holders: Array<{holder, sharesBefore, pctBefore, sharesAfter, pctAfter, dilutionPct}>
 * }}
 */
function simulateRound(capTable = [], { preMoneyValuation, raiseAmount, newInvestorName = 'Nuevo inversor' } = {}) {
  if (!capTable.length) throw new RangeError('capTable vacía');
  if (!(preMoneyValuation > 0)) throw new RangeError('preMoneyValuation debe ser > 0');
  if (!(raiseAmount > 0)) throw new RangeError('raiseAmount debe ser > 0');

  const totalSharesBefore = capTable.reduce((a, h) => a + h.shares, 0);
  if (!(totalSharesBefore > 0)) throw new RangeError('la cap table no tiene acciones');

  const postMoneyValuation = preMoneyValuation + raiseAmount;
  const pricePerShare = preMoneyValuation / totalSharesBefore;
  const newSharesIssued = raiseAmount / pricePerShare;
  const totalSharesAfter = totalSharesBefore + newSharesIssued;
  const newInvestorPct = Number((newSharesIssued / totalSharesAfter).toFixed(6));

  const holders = capTable.map((h) => {
    const pctBefore = h.shares / totalSharesBefore;
    const pctAfter = h.shares / totalSharesAfter;
    return {
      holder: h.holder,
      sharesBefore: h.shares,
      pctBefore: Number(pctBefore.toFixed(6)),
      sharesAfter: h.shares,   // no emite ni recompra acciones propias
      pctAfter: Number(pctAfter.toFixed(6)),
      dilutionPct: Number((pctBefore - pctAfter).toFixed(6)),
    };
  });
  holders.push({
    holder: newInvestorName,
    sharesBefore: 0, pctBefore: 0,
    sharesAfter: Number(newSharesIssued.toFixed(6)), pctAfter: newInvestorPct,
    dilutionPct: 0,
  });

  return {
    postMoneyValuation,
    pricePerShare: Number(pricePerShare.toFixed(6)),
    newSharesIssued: Number(newSharesIssued.toFixed(6)),
    newInvestorPct,
    totalSharesBefore,
    totalSharesAfter: Number(totalSharesAfter.toFixed(6)),
    holders,
  };
}

module.exports = { simulateRound };
