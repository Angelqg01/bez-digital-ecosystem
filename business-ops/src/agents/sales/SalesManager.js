'use strict';

const DepartmentManager = require('../DepartmentManager');
const LeadHunterAgent = require('./LeadHunterAgent');
const LeadScorerAgent = require('./LeadScorerAgent');
const OutreachAgent = require('./OutreachAgent');
const NegotiatorAgent = require('./NegotiatorAgent');
const PitchMatcherAgent = require('./PitchMatcherAgent');
const ProposalGeneratorAgent = require('./ProposalGeneratorAgent');
const FollowUpAgent = require('./FollowUpAgent');
const MeetingBookerAgent = require('./MeetingBookerAgent');
const CRMSyncAgent = require('./CRMSyncAgent');
const ChurnPredictorAgent = require('./ChurnPredictorAgent');

/** SalesManager — dirige el escuadrón de Ventas. */
class SalesManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'sales.manager',
      name: 'Sales Manager',
      department: 'sales',
      systemPrompt: 'Eres el director de Ventas. Descompones la solicitud y la repartes entre tus especialistas.',
    });

    // Routing tarea → especialista dentro del departamento.
    this.routing = {
      'sales:inbound': 'sales.outreach',
      // Sin esta línea, una tarea `sales:outreach` caía en el especialista por
      // defecto (lead-hunter): en vez de redactar y pasar por HITL, se ponía a
      // buscar más prospectos. El fallback existe a propósito, pero para un
      // tipo que nombra a un especialista concreto es un desvío silencioso.
      'sales:outreach': 'sales.outreach',
      'sales:hunt': 'sales.lead-hunter',
      'sales:score': 'sales.lead-scorer',
      'sales:negotiate': 'sales.negotiator',
      'sales:match-pitch': 'sales.pitch-matcher',
      'sales:proposal': 'sales.proposal',
      'sales:followup': 'sales.followup',
      'sales:book-meeting': 'sales.meeting-booker',
      'sales:crm-sync': 'sales.crm-sync',
      'sales:churn': 'sales.churn-predictor',
    };

    const childCtx = { ...ctx, department: 'sales' };
    this.registerSpecialist(new LeadHunterAgent(childCtx));
    this.registerSpecialist(new LeadScorerAgent(childCtx));
    this.registerSpecialist(new OutreachAgent(childCtx));
    this.registerSpecialist(new NegotiatorAgent(childCtx));
    this.registerSpecialist(new PitchMatcherAgent(childCtx));
    this.registerSpecialist(new ProposalGeneratorAgent(childCtx));
    this.registerSpecialist(new FollowUpAgent(childCtx));
    this.registerSpecialist(new MeetingBookerAgent(childCtx));
    this.registerSpecialist(new CRMSyncAgent(childCtx));
    this.registerSpecialist(new ChurnPredictorAgent(childCtx));
  }
}
module.exports = SalesManager;
