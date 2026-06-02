'use strict';

const OrchestrationManifest = require('../core/OrchestrationManifest');
const OrchestrationEventPublisher = require('../core/OrchestrationEventPublisher');
const WorkflowAgent = require('../agents/WorkflowAgent');

describe('Orchestration Manifest', () => {
  let manifest;

  beforeEach(() => {
    manifest = new OrchestrationManifest();
  });

  test('loads canonical orchestration manifest', () => {
    const status = manifest.getStatus();

    expect(status.loaded).toBe(true);
    expect(status.version).toBe('1.0.0');
    expect(status.departments).toBeGreaterThanOrEqual(8);
    expect(status.routes).toBeGreaterThanOrEqual(20);
    expect(status.mcps).toBeGreaterThanOrEqual(4);
  });

  test('resolves growth tasks to department, stream, agent, and KPIs', () => {
    const route = manifest.getRouteInfo('growth:qualify');

    expect(route.agentId).toBe('workflow-agent');
    expect(route.departmentId).toBe('growth');
    expect(route.eventStream).toBe('bezhas:events:growth');
    expect(route.kpis).toContain('qualified_opportunities');
    expect(route.approvalRequired).toContain('send_outreach');
  });

  test('resolves SDK expansion to blockchain department', () => {
    const route = manifest.getRouteInfo('sdk:expand');

    expect(route.agentId).toBe('workflow-agent');
    expect(route.departmentId).toBe('blockchain');
    expect(route.eventStream).toBe('bezhas:events:blockchain');
    expect(route.kpis).toContain('sdk_methods_available');
  });

  test('detects human approval actions from policy', () => {
    expect(manifest.requiresHumanApproval('send_outreach')).toBe(true);
    expect(manifest.requiresHumanApproval('deploy_contract')).toBe(true);
    expect(manifest.requiresHumanApproval('system_health')).toBe(false);
  });
});

describe('Orchestration Event Publisher', () => {
  test('returns redis_unavailable without throwing when Redis is absent', async () => {
    const publisher = new OrchestrationEventPublisher({
      memory: { client: null },
      manifest: new OrchestrationManifest(),
    });

    const result = await publisher.taskQueued({ id: 'task_1', type: 'growth:qualify' });

    expect(result).toEqual({ published: false, reason: 'redis_unavailable' });
  });

  test('publishes to all stream and department stream', async () => {
    const xAdd = jest.fn().mockResolvedValueOnce('1-0').mockResolvedValueOnce('1-1');
    const publisher = new OrchestrationEventPublisher({
      memory: { client: { isOpen: true, xAdd } },
      manifest: new OrchestrationManifest(),
    });

    const result = await publisher.taskQueued({
      id: 'task_2',
      type: 'growth:qualify',
      priority: 'high',
      orchestration: {
        departmentId: 'growth',
        routeAgentId: 'workflow-agent',
        eventStream: 'bezhas:events:growth',
        kpis: ['qualified_opportunities'],
      },
    });

    expect(result.published).toBe(true);
    expect(xAdd).toHaveBeenCalledTimes(2);
    expect(xAdd.mock.calls[0][0]).toBe('bezhas:events:all');
    expect(xAdd.mock.calls[1][0]).toBe('bezhas:events:growth');
    expect(xAdd.mock.calls[0][2]).toEqual(expect.objectContaining({
      eventType: 'task.queued',
      taskType: 'growth:qualify',
      departmentId: 'growth',
      routeAgentId: 'workflow-agent',
    }));
  });
});

describe('WorkflowAgent manifest coordination', () => {
  test('coordinates growth qualification tasks', async () => {
    const agent = new WorkflowAgent();
    const result = await agent.execute({
      id: 'dry_growth',
      type: 'growth:qualify',
      priority: 'normal',
      payload: { account: 'TransLogistica SA' },
      orchestration: {
        departmentId: 'growth',
        kpis: ['qualified_opportunities'],
      },
    });

    expect(result.coordinated).toBe(true);
    expect(result.departmentId).toBe('growth');
    expect(result.actionPlan.objective).toContain('TransLogistica SA');
    expect(result.kpis).toContain('qualified_opportunities');
  });

  test('coordinates skill evaluation tasks', async () => {
    const agent = new WorkflowAgent();
    const result = await agent.execute({
      id: 'dry_skill',
      type: 'skill:evaluate',
      priority: 'normal',
      payload: { skill: 'bezhas-sdr' },
      orchestration: {
        departmentId: 'skills',
        kpis: ['skill_success_rate'],
      },
    });

    expect(result.coordinated).toBe(true);
    expect(result.departmentId).toBe('skills');
    expect(result.actionPlan.nextStep).toContain('failure cases');
  });
});
