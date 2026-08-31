'use strict';

/**
 * RedLines — las acciones que un agente NUNCA ejecuta sin aprobación humana.
 * Esta es la pieza que protege legalmente al producto y al cliente.
 *
 * Cada regla evalúa una acción y devuelve true si cruza una línea roja.
 */

// El umbral de descuento vive en el catálogo de precios: es la misma cifra que
// usa `priceCatalog.quote()` para marcar `requiresApproval`, y tenerla en dos
// sitios acabaría con las dos versiones desalineadas.
const { DISCOUNT_HITL_PCT } = require('../platform/priceCatalog');

const RED_LINES = [
  {
    id: 'money_movement',
    label: 'Mover dinero',
    test: (a) => a.category === 'payment' || a.category === 'transfer' || a.tool === 'payment' || a.category === 'finance_disbursement' || a.action === 'FINANCE_DISBURSEMENT' || a.method === 'FINANCE_DISBURSEMENT',
  },
  {
    id: 'legal_commitment',
    label: 'Comprometer legalmente a la empresa',
    test: (a) => a.category === 'contract' || a.category === 'signature' || a.tool === 'esign',
  },
  {
    id: 'crypto_asset_movement',
    label: 'Mover activos on-chain (BEZ-Coin, treasury, staking, wallets)',
    // Cubre lo que 'money_movement' no ve: transferencias de tokens, operaciones
    // de tesorería/DAO, staking/unstaking, y cualquier acción sobre una wallet
    // (hot wallet, multisig, smart wallet). Ningún agente mueve cripto solo.
    test: (a) => a.category === 'crypto_transfer'
      || a.category === 'treasury_movement'
      || a.category === 'wallet_operation'
      || a.action === 'TREASURY_DISBURSEMENT'
      || a.method === 'TREASURY_DISBURSEMENT'
      || ['transfer', 'stake', 'unstake', 'withdraw', 'bridge'].includes(a.method) && a.tool === 'blockchain',
  },
  {
    id: 'smart_contract_change',
    label: 'Desplegar, actualizar o pausar un smart contract',
    // Deploys, upgrades (proxies), pausas de emergencia o cambios de rol/admin
    // en los contratos (BEZCoinV2, QualityEscrow, Governance, Staking...).
    test: (a) => a.category === 'contract_deploy'
      || a.category === 'contract_admin'
      || ['deploy', 'upgrade', 'pause', 'unpause', 'grantRole', 'revokeRole'].includes(a.method) && a.tool === 'blockchain',
  },
  {
    id: 'pricing_concession',
    label: 'Descuento comercial por encima del umbral aprobado',
    // Un descuento fuerte compromete el margen de la empresa igual que un
    // contrato la compromete legalmente. Se evalúa aquí y no en el agente
    // porque el agente que propone el descuento no puede ser quien decida
    // si le hace falta permiso.
    test: (a) => Number(a.discountPct || 0) > DISCOUNT_HITL_PCT,
  },
  {
    id: 'employment_decision',
    label: 'Decisión de empleo (contratar/despedir/evaluar)',
    test: (a) => a.category === 'employment' || ['hire', 'fire', 'performance_review'].includes(a.method) || a.action === 'HR_EMPLOYMENT_DECISION' || a.category === 'HR_EMPLOYMENT_DECISION',
  },
  {
    id: 'public_communication',
    label: 'Comunicación pública vinculante',
    test: (a) => a.category === 'public_post' || a.audience === 'public',
  },
  {
    id: 'mass_outbound',
    label: 'Envío masivo (riesgo de spam/daño reputacional)',
    test: (a) => a.category === 'outbound' && (a.recipientCount || 0) > 50,
  },
  {
    id: 'cold_outbound',
    label: 'Primer contacto en frío (requiere aprobación antes de enviar)',
    // COMMUNICATION_OUTBOUND_COLD: el outreach en frío SIEMPRE pasa por HITL,
    // sea a 1 o a varios. Protege la reputación del dominio y cumple normativa.
    test: (a) => a.category === 'outbound' && a.cold === true,
  },
  {
    id: 'destructive_file_op',
    label: 'Operación destructiva de archivos (mover/borrar del disco)',
    // El FileAgent puede leer y generar archivos nuevos solo, pero mover o borrar
    // archivos existentes es irreversible → aprobación humana obligatoria.
    test: (a) => a.category === 'filesystem' && ['move', 'remove'].includes(a.method),
  },
];

function crossesRedLine(action) {
  for (const rule of RED_LINES) {
    if (rule.test(action)) return rule;
  }
  return null;
}

module.exports = { RED_LINES, crossesRedLine };
