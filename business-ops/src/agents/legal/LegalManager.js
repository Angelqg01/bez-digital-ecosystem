'use strict';

const DepartmentManager = require('../DepartmentManager');
const ContractReviewAgent = require('./ContractReviewAgent');
const RegulatoryAdvisorAgent = require('./RegulatoryAdvisorAgent');
const DPIAAgent = require('./DPIAAgent');

/** LegalManager — revisión de contratos y dudas normativas. Firmar/comprometer legalmente = aprobación humana. */
class LegalManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'legal.manager',
      name: 'Legal Manager',
      department: 'legal',
      modelTier: ctx.modelTier || 'mid',
      systemPrompt: 'Eres el director Legal/Fiscal: revisas contratos y resuelves dudas normativas, pero nunca firmas ni comprometes legalmente a la empresa sin aprobación humana.',
    });

    this.routing = {
      'legal:review': 'legal.contract-review',
      'legal:regulatory': 'legal.regulatory-advisor',
      'legal:dpia': 'legal.dpia',
    };

    const childCtx = { ...ctx, department: 'legal' };
    this.registerSpecialist(new ContractReviewAgent(childCtx));
    this.registerSpecialist(new RegulatoryAdvisorAgent(childCtx));
    this.registerSpecialist(new DPIAAgent(childCtx));
  }
}

module.exports = LegalManager;
