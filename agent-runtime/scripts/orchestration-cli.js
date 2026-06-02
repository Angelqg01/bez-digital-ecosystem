#!/usr/bin/env node
/**
 * BeZhas Orchestration CLI
 *
 * Usage:
 *   npm run orchestration -- status
 *   npm run orchestration -- departments
 *   npm run orchestration -- route growth:qualify
 *   npm run orchestration -- dry-run growth:qualify "{\"account\":\"TransLogistica SA\"}"
 */

'use strict';

const OrchestrationManifest = require('../core/OrchestrationManifest');
const WorkflowAgent = require('../agents/WorkflowAgent');

const manifest = new OrchestrationManifest();

async function main() {
  const [, , command = 'status', ...args] = process.argv;

  switch (command) {
    case 'status':
      printJson(manifest.getStatus());
      return;

    case 'departments':
      printJson(manifest.listDepartments().map((department) => ({
        id: department.id,
        agentId: department.agentId,
        runtimeAgentId: department.runtimeAgentId,
        mandate: department.mandate,
        kpis: department.kpis || [],
      })));
      return;

    case 'route': {
      const taskType = requireArg(args[0], 'task type');
      printJson(manifest.getRouteInfo(taskType));
      return;
    }

    case 'dry-run': {
      const taskType = requireArg(args[0], 'task type');
      const payload = args[1] ? JSON.parse(args[1]) : {};
      const routeInfo = manifest.getRouteInfo(taskType);
      const agent = new WorkflowAgent();
      const result = await agent.execute({
        id: `dry_${Date.now()}`,
        type: taskType,
        priority: payload.priority || 'normal',
        source: 'orchestration-cli',
        payload,
        orchestration: {
          departmentId: routeInfo.departmentId,
          routeAgentId: routeInfo.agentId,
          eventStream: routeInfo.eventStream,
          kpis: routeInfo.kpis,
        },
      });
      printJson(result);
      return;
    }

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return;

    default:
      throw new Error(`Unknown command "${command}". Use "help" for usage.`);
  }
}

function requireArg(value, label) {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log([
    'BeZhas Orchestration CLI',
    '',
    'Commands:',
    '  status',
    '  departments',
    '  route <taskType>',
    '  dry-run <taskType> [jsonPayload]',
  ].join('\n'));
}

main().catch((err) => {
  console.error(`[orchestration-cli] ${err.message}`);
  process.exit(1);
});
