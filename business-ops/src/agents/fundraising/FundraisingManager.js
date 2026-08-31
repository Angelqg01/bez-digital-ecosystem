'use strict';

const DepartmentManager = require('../DepartmentManager');
const InvestorScorerAgent = require('./InvestorScorerAgent');
const InvestorOutreachAgent = require('./InvestorOutreachAgent');
const DataRoomAgent = require('./DataRoomAgent');
const CapTableAgent = require('./CapTableAgent');

/** FundraisingManager — relación con inversores institucionales. Mismas líneas rojas de outbound que Ventas. */
class FundraisingManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'fundraising.manager',
      name: 'Fundraising Manager',
      department: 'fundraising',
      modelTier: ctx.modelTier || 'mid',
      systemPrompt: 'Eres el director de Relación con Inversores: puntúas y contactas fondos/VC/family offices. Todo contacto en frío pasa por aprobación humana.',
    });

    this.routing = {
      'fundraising:score': 'fundraising.investor-scorer',
      'fundraising:inbound': 'fundraising.investor-outreach',
      'fundraising:outreach': 'fundraising.investor-outreach',
      'fundraising:data-room': 'fundraising.data-room',
      'fundraising:cap-table': 'fundraising.cap-table',
    };

    const childCtx = { ...ctx, department: 'fundraising' };
    this.registerSpecialist(new InvestorScorerAgent(childCtx));
    this.registerSpecialist(new InvestorOutreachAgent(childCtx));
    this.registerSpecialist(new DataRoomAgent(childCtx));
    this.registerSpecialist(new CapTableAgent(childCtx));
  }
}

module.exports = FundraisingManager;
