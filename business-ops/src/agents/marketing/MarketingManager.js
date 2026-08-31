'use strict';

const DepartmentManager = require('../DepartmentManager');
const ContentPlannerAgent = require('./ContentPlannerAgent');
const CopywriterAgent = require('./CopywriterAgent');
const SeoAgent = require('./SeoAgent');
const SocialAgent = require('./SocialAgent');
const SocialSchedulerAgent = require('./SocialSchedulerAgent');
const CampaignAnalystAgent = require('./CampaignAnalystAgent');

/** MarketingManager — contenido, campañas, SEO y redes. Publicar pasa por aprobación. */
class MarketingManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'marketing.manager',
      name: 'Marketing Manager',
      department: 'marketing',
      modelTier: ctx.modelTier || 'frontier',
      systemPrompt: 'Eres el director de Marketing. Generas contenido y campañas que atraen demanda; lo público se aprueba antes de publicar.',
    });

    this.routing = {
      'marketing:request': 'marketing.content',
      'marketing:copy': 'marketing.copy',
      'marketing:seo': 'marketing.seo',
      'marketing:social': 'marketing.social',
      'marketing:publish-due': 'marketing.social-scheduler',
      'marketing:analyze-campaign': 'marketing.campaign-analyst',
    };

    const childCtx = { ...ctx, department: 'marketing' };
    this.registerSpecialist(new ContentPlannerAgent(childCtx));
    this.registerSpecialist(new CopywriterAgent(childCtx));
    this.registerSpecialist(new SeoAgent(childCtx));
    this.registerSpecialist(new SocialAgent(childCtx));
    this.registerSpecialist(new SocialSchedulerAgent(childCtx));
    this.registerSpecialist(new CampaignAnalystAgent(childCtx));
  }
}

module.exports = MarketingManager;
