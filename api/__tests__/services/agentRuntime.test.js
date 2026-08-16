'use strict';

/**
 * agentRuntime — cableado único del AgentManager dentro del proceso de la API.
 *
 * Lo que se protege aquí es la propiedad que hizo aceptable meter cinco agentes
 * en el proceso que sirve pagos, cadena y energía: **si el runtime no levanta,
 * la API no se cae**. Antes de esto el cableado estaba duplicado en dos sitios
 * y ausente en el arranque real, y las rutas devolvían 500 sin decir por qué.
 */

const path = require('path');

const RUTA = '../../services/agentRuntime';

describe('agentRuntime', () => {
  let agentRuntime;

  beforeEach(() => {
    jest.resetModules();
    agentRuntime = require(RUTA);
    agentRuntime._reset();
  });

  afterEach(() => {
    delete process.env.AGENT_RUNTIME_ENABLED;
  });

  it('arranca sin manager y lo dice', () => {
    expect(agentRuntime.getManager()).toBeNull();
    expect(agentRuntime.status().estado).toBe('no_iniciado');
  });

  it('se puede dejar sin cablear a propósito', async () => {
    process.env.AGENT_RUNTIME_ENABLED = 'false';
    const m = await agentRuntime.init();
    expect(m).toBeNull();
    expect(agentRuntime.status()).toMatchObject({ estado: 'fallido' });
    expect(agentRuntime.status().motivo).toMatch(/deshabilitado/);
  });

  // ── La propiedad crítica ───────────────────────────────────────────────────

  it('si el runtime revienta al cargar, NO propaga: devuelve null y anota el motivo', async () => {
    jest.resetModules();
    jest.doMock(
      path.resolve(__dirname, '..', '..', '..', 'agent-lib', 'AgentManager'),
      () => { throw new Error('RPC inalcanzable'); },
      { virtual: true }
    );
    const runtime = require(RUTA);
    runtime._reset();

    await expect(runtime.init()).resolves.toBeNull();
    expect(runtime.status().estado).toBe('fallido');
    expect(runtime.status().motivo).toBeTruthy();
  });

  it('un fallo al arrancar deja el manager en null, nunca a medias', async () => {
    jest.resetModules();
    const raiz = path.resolve(__dirname, '..', '..', '..', 'agent-lib');
    jest.doMock(path.join(raiz, 'AgentManager'), () => (
      class { registerAgent() {} async start() { throw new Error('arranque fallido'); } }
    ), { virtual: true });
    for (const a of ['SecurityAgent', 'TradingAgent', 'WorkflowAgent', 'ComplianceAgent', 'TokenomicsAgent']) {
      jest.doMock(path.join(raiz, 'agents', a), () => class {}, { virtual: true });
    }
    jest.doMock(path.join(raiz, 'connectors', 'TokenomicsConnector'), () => (
      class { async connect() {} }
    ), { virtual: true });

    const runtime = require(RUTA);
    runtime._reset();
    await runtime.init();

    expect(runtime.getManager()).toBeNull();
    expect(runtime.status().estado).toBe('fallido');
  });

  it('registra los cinco agentes y expone el manager', async () => {
    jest.resetModules();
    const registrados = [];
    const raiz = path.resolve(__dirname, '..', '..', '..', 'agent-lib');
    jest.doMock(path.join(raiz, 'AgentManager'), () => (
      class {
        registerAgent(A) { registrados.push(A.name || 'anon'); }
        async start() {}
        listAgents() { return registrados; }
      }
    ), { virtual: true });
    for (const a of ['SecurityAgent', 'TradingAgent', 'WorkflowAgent', 'ComplianceAgent', 'TokenomicsAgent']) {
      jest.doMock(path.join(raiz, 'agents', a), () => ({ [a]: class {} })[a], { virtual: true });
    }
    jest.doMock(path.join(raiz, 'connectors', 'TokenomicsConnector'), () => (
      class { async connect() {} }
    ), { virtual: true });

    const runtime = require(RUTA);
    runtime._reset();
    const m = await runtime.init();

    expect(m).not.toBeNull();
    expect(registrados).toHaveLength(5);
    expect(runtime.status()).toMatchObject({ estado: 'listo', agentes: 5 });
  });

  it('es idempotente: dos llamadas no duplican agentes', async () => {
    jest.resetModules();
    let construidos = 0;
    const raiz = path.resolve(__dirname, '..', '..', '..', 'agent-lib');
    jest.doMock(path.join(raiz, 'AgentManager'), () => (
      class {
        constructor() { construidos++; }
        registerAgent() {} async start() {} listAgents() { return []; }
      }
    ), { virtual: true });
    for (const a of ['SecurityAgent', 'TradingAgent', 'WorkflowAgent', 'ComplianceAgent', 'TokenomicsAgent']) {
      jest.doMock(path.join(raiz, 'agents', a), () => class {}, { virtual: true });
    }
    jest.doMock(path.join(raiz, 'connectors', 'TokenomicsConnector'), () => (
      class { async connect() {} }
    ), { virtual: true });

    const runtime = require(RUTA);
    runtime._reset();
    await runtime.init();
    await runtime.init();

    expect(construidos).toBe(1);
  });

  it('un conector de tokenomics caído no impide el cableado', async () => {
    jest.resetModules();
    const raiz = path.resolve(__dirname, '..', '..', '..', 'agent-lib');
    jest.doMock(path.join(raiz, 'AgentManager'), () => (
      class { registerAgent() {} async start() {} listAgents() { return [1, 2, 3, 4, 5]; } }
    ), { virtual: true });
    for (const a of ['SecurityAgent', 'TradingAgent', 'WorkflowAgent', 'ComplianceAgent', 'TokenomicsAgent']) {
      jest.doMock(path.join(raiz, 'agents', a), () => class {}, { virtual: true });
    }
    jest.doMock(path.join(raiz, 'connectors', 'TokenomicsConnector'), () => (
      class { async connect() { throw new Error('sin cadena'); } }
    ), { virtual: true });

    const runtime = require(RUTA);
    runtime._reset();
    const m = await runtime.init();

    expect(m).not.toBeNull();
    expect(runtime.status().estado).toBe('listo');
  });
});
