'use strict';

const SalesManager = require('./sales/SalesManager');
const SupportManager = require('./support/SupportManager');
const MarketingManager = require('./marketing/MarketingManager');
const HRManager = require('./hr/HRManager');
const FinanceManager = require('./finance/FinanceManager');
const OperationsManager = require('./operations/OperationsManager');
const BlockchainOpsManager = require('./blockchain/BlockchainOpsManager');
const LegalManager = require('./legal/LegalManager');
const TreasuryManager = require('./treasury/TreasuryManager');
const FundraisingManager = require('./fundraising/FundraisingManager');

const DEPARTMENT_REGISTRY = {
  sales: SalesManager,
  support: SupportManager,
  marketing: MarketingManager,
  hr: HRManager,
  finance: FinanceManager,
  operations: OperationsManager,
  blockchain: BlockchainOpsManager,
  legal: LegalManager,
  treasury: TreasuryManager,
  fundraising: FundraisingManager,
};

/**
 * buildDepartments — instancia los managers de los departamentos habilitados
 * para un tenant, inyectando el contexto compartido (modelo, memoria, etc.).
 */
function buildDepartments({ tenantId, enabled, model, memory, guardrails, hitl, knowledgeBase, bus, tools, business, store, doNotContact }) {
  const ctx = { tenantId, model, memory, guardrails, hitl, knowledgeBase, bus, tools, business, store, doNotContact };
  return enabled
    .filter(dep => DEPARTMENT_REGISTRY[dep])
    .map(dep => new DEPARTMENT_REGISTRY[dep](ctx));
}

module.exports = { DEPARTMENT_REGISTRY, buildDepartments };
