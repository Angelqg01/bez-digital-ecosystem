'use strict';

const DepartmentManager = require('../DepartmentManager');
const OpsCoordinatorAgent = require('./OpsCoordinatorAgent');
const ProcurementAgent = require('./ProcurementAgent');
const InventoryAgent = require('./InventoryAgent');
const ReportAgent = require('./ReportAgent');
const OpsMonitorAgent = require('./OpsMonitorAgent');
const ExecutiveReporterAgent = require('./ExecutiveReporterAgent');
const SLAMonitorAgent = require('./SLAMonitorAgent');
const VendorCommsAgent = require('./VendorCommsAgent');

/** OperationsManager — workflows internos, compras, inventario y reporte. Pagar = aprobación humana. */
class OperationsManager extends DepartmentManager {
  constructor(ctx) {
    super({
      ...ctx,
      id: 'operations.manager',
      name: 'Operations Manager',
      department: 'operations',
      modelTier: ctx.modelTier || 'mid',
      systemPrompt: 'Eres el director de Operaciones: coordinas tareas, compras e inventario y generas informes; pagar a proveedores lo aprueba un humano.',
    });

    this.routing = {
      'operations:request': 'operations.coordinator',
      'operations:procure': 'operations.procurement',
      'operations:inventory': 'operations.inventory',
      'operations:report': 'operations.report',
      'operations:monitor': 'operations.ops-monitor',
      'operations:executive-report': 'operations.executive-reporter',
      'operations:sla': 'operations.sla-monitor',
      'operations:vendor-comms': 'operations.vendor-comms',
    };

    const childCtx = { ...ctx, department: 'operations' };
    this.registerSpecialist(new OpsCoordinatorAgent(childCtx));
    this.registerSpecialist(new ProcurementAgent(childCtx));
    this.registerSpecialist(new InventoryAgent(childCtx));
    this.registerSpecialist(new ReportAgent(childCtx));
    this.registerSpecialist(new OpsMonitorAgent(childCtx));
    this.registerSpecialist(new ExecutiveReporterAgent(childCtx));
    this.registerSpecialist(new SLAMonitorAgent(childCtx));
    this.registerSpecialist(new VendorCommsAgent(childCtx));
  }
}

module.exports = OperationsManager;
