'use strict';

const DepartmentManager = require('../DepartmentManager');
const HRPolicyAgent = require('./HRPolicyAgent');
const CVScreenerAgent = require('./CVScreenerAgent');
const InterviewSchedulerAgent = require('./InterviewSchedulerAgent');
const OnboardingAgent = require('./OnboardingAgent');
const RecruiterScreenAgent = require('./RecruiterScreenAgent');
const OnboardingAssistant = require('./OnboardingAssistant');

/** HRManager — selección, onboarding y dudas internas. Contratar/despedir = aprobación humana. */
class HRManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'hr.manager',
      name: 'HR Manager',
      department: 'hr',
      modelTier: ctx.modelTier || 'mid',
      systemPrompt: 'Eres el director de RR.HH. asistente: cribas, coordinas y resuelves dudas, pero las decisiones de empleo (contratar/despedir/evaluar) las aprueba un humano.',
    });

    this.routing = {
      'hr:request': 'hr.advisor',
      'hr:screen': 'hr.cv-screener',
      'hr:schedule': 'hr.scheduler',
      'hr:onboard': 'hr.onboarding',
      'hr:recruiter-screen': 'hr.recruiter-screen',
      'hr:onboarding-assistant': 'hr.onboarding-assistant',
    };

    const childCtx = { ...ctx, department: 'hr' };
    this.registerSpecialist(new HRPolicyAgent(childCtx));
    this.registerSpecialist(new CVScreenerAgent(childCtx));
    this.registerSpecialist(new InterviewSchedulerAgent(childCtx));
    this.registerSpecialist(new OnboardingAgent(childCtx));
    this.registerSpecialist(new RecruiterScreenAgent(childCtx));
    this.registerSpecialist(new OnboardingAssistant(childCtx));
  }
}

module.exports = HRManager;
