/**
 * BeZhas Agent Runtime — TokenomicsAgent Tests
 * Verifica la respuesta del agente ante anomalías, reportes y análisis.
 */

'use strict';

const TokenomicsAgent = require('../agents/TokenomicsAgent');
const EventEmitter = require('events');

describe('TokenomicsAgent', () => {
  let agent;
  let mockConnector;
  let mockMemory;
  let mockOpenClaw;
  let mockManager;

  beforeEach(() => {
    // 1. Mocks de dependencias
    mockConnector = new EventEmitter();
    mockConnector.takeSnapshot = jest.fn().mockResolvedValue({
      supply: { total: '1000000000', staked: '300000000', circulating: '700000000', stakedPercent: '30.00' },
      staking: { totalStaked: '300000000', apy: 15.5, epoch: 50 },
      validators: { total: 15, totalSlashed: '0' },
      payments: { totalVolume: '500000', txCount: 1200 },
      timestamp: new Date().toISOString(),
    });

    mockMemory = {
      remember: jest.fn().mockResolvedValue(true),
      recall: jest.fn().mockResolvedValue(null),
      recallAll: jest.fn().mockResolvedValue({}),
    };

    mockOpenClaw = {
      complete: jest.fn().mockResolvedValue({ text: 'Analizado correctamente por la IA de BeZhas.' }),
      sendNotification: jest.fn().mockResolvedValue(true),
    };

    mockManager = {
      dispatch: jest.fn().mockResolvedValue('task_id_123'),
      requestHumanApproval: jest.fn().mockResolvedValue({ approved: true, response: 'ok' }),
    };

    // 2. Instanciar agente
    agent = new TokenomicsAgent({
      connector: mockConnector,
      memory: mockMemory,
      openclaw: mockOpenClaw,
      manager: mockManager,
    });
  });

  test('debe inicializarse correctamente y suscribirse a eventos', async () => {
    await agent.initialize();
    
    // Verificar que hay listeners para los eventos clave
    expect(mockConnector.listenerCount('anomaly:detected')).toBe(1);
    expect(mockConnector.listenerCount('validator:slashed')).toBe(1);
    expect(mockConnector.listenerCount('large:transfer')).toBe(1);
    expect(mockConnector.listenerCount('snapshot')).toBe(1);
  });

  test('debe manejar anomalías críticas escalando al SecurityAgent', async () => {
    await agent.initialize();

    const criticalAnomaly = {
      type: 'staking_mass_exit',
      severity: 'critical',
      detail: { dropPercent: 25 },
    };

    // Simular evento de anomalía
    mockConnector.emit('anomaly:detected', criticalAnomaly);

    // Esperar a que se procese la tarea asíncrona
    await new Promise(resolve => setTimeout(resolve, 50));

    // 1. Debe haber llamado a la IA para analizar
    expect(mockOpenClaw.complete).toHaveBeenCalled();

    // 2. Debe haber notificado (nivel critical)
    expect(mockOpenClaw.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      level: 'critical',
      message: expect.stringContaining('Anomalía Tokenómica'),
    }));

    // 3. Debe haber despachado tarea al SecurityAgent via manager
    expect(mockManager.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'security:check',
      priority: 'high',
      payload: expect.objectContaining({
        checkType: 'tokenomics-anomaly'
      })
    }));
  });

  test('debe generar reportes ejecutivos usando LLM', async () => {
    const task = {
      id: 'task_report_001',
      type: 'tokenomics:report',
      payload: {},
    };

    const result = await agent.execute(task);

    expect(result).toHaveProperty('report');
    expect(result).toHaveProperty('snapshot');
    expect(mockOpenClaw.complete).toHaveBeenCalled();
    expect(mockOpenClaw.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      level: 'info',
      message: expect.stringContaining('Reporte Diario'),
    }));
  });

  test('debe analizar el ecosistema y calcular Health Score', async () => {
    const task = {
      type: 'tokenomics:analyze',
      payload: {},
    };

    const result = await agent.execute(task);

    expect(result.healthScore).toBeGreaterThanOrEqual(1);
    expect(result.healthScore).toBeLessThanOrEqual(10);
    expect(result.snapshot).toBeDefined();
    expect(mockOpenClaw.complete).toHaveBeenCalled();
  });

  test('debe detectar transferencias grandes y notificar', async () => {
    await agent.initialize();

    const largeTx = {
      from: '0xAddressA',
      to: '0xAddressB',
      amount: '500000', // 500K BEZ > 100K threshold
    };

    mockConnector.emit('large:transfer', largeTx);

    // Esperar procesamiento
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockOpenClaw.sendNotification).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Transferencia Grande'),
    }));
  });

  test('debe calcular health score bajo si hay poco staking', () => {
    const lowStakingSnapshot = {
      supply: { stakedPercent: '5.00' }, // < 10% penaliza -3
      validators: { totalSlashed: '0' },
    };

    const score = agent._calculateHealthScore(lowStakingSnapshot);
    // Base 10 - 3 = 7
    expect(score).toBe(7);
  });

  test('debe calcular health score bajo si hay slashing masivo', () => {
    const slashingSnapshot = {
      supply: { stakedPercent: '25.00' },
      validators: { totalSlashed: '2000000' }, // > 1M penaliza -2
    };

    const score = agent._calculateHealthScore(slashingSnapshot);
    // Base 10 - 2 = 8
    expect(score).toBe(8);
  });
});
