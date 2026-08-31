'use strict';

const DepartmentManager = require('../DepartmentManager');
const FinanceAdvisorAgent = require('./FinanceAdvisorAgent');
const InvoiceAgent = require('./InvoiceAgent');
const CollectionsAgent = require('./CollectionsAgent');
const ForecastAgent = require('./ForecastAgent');
const InvoiceBot = require('./InvoiceBot');
const TokenDisbursementAgent = require('./TokenDisbursementAgent');
const ExpenseCategorizerAgent = require('./ExpenseCategorizerAgent');
const ReconciliationAgent = require('./ReconciliationAgent');

/** FinanceManager — facturación y caja. Mover dinero SIEMPRE pasa por aprobación humana. */
class FinanceManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'finance.manager',
      name: 'Finance Manager',
      department: 'finance',
      modelTier: ctx.modelTier || 'mid',
      systemPrompt: 'Eres el director financiero asistente: concilias, facturas y reportas, pero NUNCA mueves fondos sin aprobación humana.',
    });

    this.routing = {
      'finance:request': 'finance.advisor',
      'finance:invoice': 'finance.invoice-bot', // Enrutado al nuevo InvoiceBot
      // Documento de factura con desglose (base/IVA) para archivar y enviar al
      // cliente — distinto de 'finance:invoice', que genera el enlace de cobro
      // de Stripe sobre un deal ganado. Antes 'finance.invoice' no tenía RUTA
      // propia: quedaba registrado como especialista pero ninguna tarea real
      // podía llegarle (bug encontrado en julio 2026, ver PLAN-DESARROLLO §4.E).
      'finance:invoice-draft': 'finance.invoice',
      'finance:collect': 'finance.collections',
      'finance:forecast': 'finance.forecast',
      'finance:token-purchase': 'finance.token-disbursement',
      'finance:categorize-expense': 'finance.expense-categorizer',
      'finance:reconcile': 'finance.reconciliation',
    };

    const childCtx = { ...ctx, department: 'finance' };
    this.registerSpecialist(new FinanceAdvisorAgent(childCtx));
    this.registerSpecialist(new InvoiceAgent(childCtx));
    this.registerSpecialist(new CollectionsAgent(childCtx));
    this.registerSpecialist(new ForecastAgent(childCtx));
    this.registerSpecialist(new InvoiceBot(childCtx));
    this.registerSpecialist(new TokenDisbursementAgent(childCtx));
    this.registerSpecialist(new ExpenseCategorizerAgent(childCtx));
    this.registerSpecialist(new ReconciliationAgent(childCtx));
  }
}

module.exports = FinanceManager;
