/**
 * BeZhas API — Routes: Tokenomics · Staking · Farming · Bridge · Compliance · Governance
 * Base: /api/tokenomics
 */

'use strict';

const { Router } = require('express');

module.exports = function tokenomicsRouter(manager, engine, bridgeMgr, wss) {
  const r = Router();

  // ─── SNAPSHOT COMPLETO ────────────────────────────────────────────────────

  /** GET /api/tokenomics/snapshot — estado completo del ecosistema */
  r.get('/snapshot', async (req, res) => {
    try {
      const snap = engine
        ? await engine.getEcosystemSnapshot()
        : manager._tokenomicsConnector?.getState() || {};
      res.json(snap);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/tokenomics/events — eventos recientes on-chain */
  r.get('/events', async (req, res) => {
    try {
      const limit  = parseInt(req.query.limit || '30');
      const events = manager._tokenomicsConnector?.getRecentEvents(limit) || [];
      res.json({ events, count: events.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── STAKING ─────────────────────────────────────────────────────────────

  /** GET /api/tokenomics/staking — stats globales del staking */
  r.get('/staking', async (req, res) => {
    try {
      const stats = engine ? await engine.getStakingStats() : null;
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/tokenomics/staking/:address — posición del usuario */
  r.get('/staking/:address', async (req, res) => {
    try {
      const info = engine ? await engine.getUserStake(req.params.address) : null;
      res.json({ address: req.params.address, staking: info });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/staking/stake */
  r.post('/staking/stake', async (req, res) => {
    try {
      const { amount, userAddress } = req.body;
      if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'amount requerido' });

      // Si no hay signer en el engine, delegar a AgentManager (HITL)
      if (!engine?.signer) {
        const taskId = await manager.dispatch({
          type:     'trade:execute',
          priority: 'high',
          source:   'api',
          agentId:  'trading-agent',
          payload:  { action: 'stake', amount, userAddress },
        });
        return res.json({ ok: true, taskId, status: 'queued', note: 'HITL requerido' });
      }

      const receipt = await engine.stake(amount);
      if (wss) wss._broadcast('/tokenomics', 'staking:update', { userAddress, amount, action: 'stake' });
      res.json({ ok: true, txHash: receipt.hash });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/staking/unstake */
  r.post('/staking/unstake', async (req, res) => {
    try {
      const { amount, userAddress } = req.body;
      if (!amount) return res.status(400).json({ error: 'amount requerido' });

      if (!engine?.signer) {
        const taskId = await manager.dispatch({
          type: 'trade:execute', priority: 'high', source: 'api',
          payload: { action: 'unstake', amount, userAddress },
        });
        return res.json({ ok: true, taskId, status: 'queued' });
      }

      const receipt = await engine.unstake(amount);
      res.json({ ok: true, txHash: receipt.hash });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/staking/claim */
  r.post('/staking/claim', async (req, res) => {
    try {
      const { userAddress } = req.body;
      if (!engine?.signer) {
        const taskId = await manager.dispatch({
          type: 'trade:execute', priority: 'normal', source: 'api',
          payload: { action: 'claimRewards', userAddress },
        });
        return res.json({ ok: true, taskId, status: 'queued' });
      }
      const receipt = await engine.claimStakingRewards();
      res.json({ ok: true, txHash: receipt.hash });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── FARMING ─────────────────────────────────────────────────────────────

  /** GET /api/tokenomics/farming/pools — todos los pools */
  r.get('/farming/pools', async (req, res) => {
    try {
      const pools = engine ? await engine.getFarmingPools() : [];
      res.json({ pools, count: pools.length });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/tokenomics/farming/:address — posiciones del usuario */
  r.get('/farming/:address', async (req, res) => {
    try {
      const positions = engine ? await engine.getUserFarmPositions(req.params.address) : [];
      res.json({ address: req.params.address, positions });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/farming/deposit */
  r.post('/farming/deposit', async (req, res) => {
    try {
      const { poolId, amount, userAddress } = req.body;
      if (poolId === undefined || !amount) return res.status(400).json({ error: 'poolId y amount requeridos' });

      if (!engine?.signer) {
        const taskId = await manager.dispatch({
          type: 'workflow:execute', priority: 'normal', source: 'api',
          payload: { action: 'farmDeposit', poolId, amount, userAddress },
        });
        return res.json({ ok: true, taskId, status: 'queued' });
      }

      const receipt = await engine.farmDeposit(poolId, amount);
      res.json({ ok: true, txHash: receipt.hash });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/farming/withdraw */
  r.post('/farming/withdraw', async (req, res) => {
    try {
      const { poolId, amount, userAddress } = req.body;
      if (!engine?.signer) {
        const taskId = await manager.dispatch({
          type: 'workflow:execute', priority: 'normal', source: 'api',
          payload: { action: 'farmWithdraw', poolId, amount, userAddress },
        });
        return res.json({ ok: true, taskId, status: 'queued' });
      }
      const receipt = await engine.farmWithdraw(poolId, amount);
      res.json({ ok: true, txHash: receipt.hash });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/farming/harvest */
  r.post('/farming/harvest', async (req, res) => {
    try {
      const { poolId, userAddress } = req.body;
      if (poolId === undefined) return res.status(400).json({ error: 'poolId requerido' });

      if (!engine?.signer) {
        const taskId = await manager.dispatch({
          type: 'workflow:execute', priority: 'normal', source: 'api',
          payload: { action: 'farmHarvest', poolId, userAddress },
        });
        return res.json({ ok: true, taskId, status: 'queued' });
      }

      const receipt = await engine.farmHarvest(poolId);
      res.json({ ok: true, txHash: receipt.hash });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── BRIDGE ──────────────────────────────────────────────────────────────

  /** GET /api/tokenomics/bridge/routes — rutas de bridge disponibles */
  r.get('/bridge/routes', async (req, res) => {
    try {
      const routes = bridgeMgr ? await bridgeMgr.getAllRoutesStats() : [];
      res.json({ routes });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/bridge/estimate — estimar fee */
  r.post('/bridge/estimate', async (req, res) => {
    try {
      const { routeId, amount } = req.body;
      if (!routeId || !amount) return res.status(400).json({ error: 'routeId y amount requeridos' });
      const estimate = bridgeMgr ? await bridgeMgr.estimateBridgeFee(routeId, amount) : null;
      res.json({ estimate });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/bridge/deposit — iniciar bridge */
  r.post('/bridge/deposit', async (req, res) => {
    try {
      const { routeId, amount, recipient } = req.body;
      if (!routeId || !amount || !recipient) {
        return res.status(400).json({ error: 'routeId, amount y recipient requeridos' });
      }

      if (!bridgeMgr) {
        // Sin BridgeManager, encolar como tarea con HITL
        const taskId = await manager.dispatch({
          type: 'workflow:execute', priority: 'high', source: 'api',
          payload: { action: 'bridgeDeposit', routeId, amount, recipient },
        });
        return res.json({ ok: true, taskId, status: 'queued', note: 'HITL requerido' });
      }

      const result = await bridgeMgr.bridgeDeposit(routeId, amount, recipient);
      if (wss) wss._broadcast('/tokenomics', 'tokenomics:event', { type: 'bridge_deposit', ...result });
      res.json({ ok: true, ...result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/tokenomics/bridge/history — historial de bridges */
  r.get('/bridge/history', (req, res) => {
    try {
      const history = bridgeMgr?.getTxHistory(parseInt(req.query.limit || '20')) || [];
      res.json({ history });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── USER OVERVIEW ────────────────────────────────────────────────────────

  /** GET /api/tokenomics/user/:address — posición completa del usuario */
  r.get('/user/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const [staking, farming, votingPower, bezBalance] = await Promise.allSettled([
        engine ? engine.getUserStake(address)          : Promise.resolve(null),
        engine ? engine.getUserFarmPositions(address)  : Promise.resolve([]),
        engine ? engine.getUserVotingPower(address)    : Promise.resolve('0'),
        engine ? engine.getBEZBalance(address)         : Promise.resolve('0'),
      ]);

      res.json({
        address,
        bezBalance:  bezBalance.status  === 'fulfilled' ? bezBalance.value  : '0',
        staking:     staking.status     === 'fulfilled' ? staking.value     : null,
        farming:     farming.status     === 'fulfilled' ? farming.value     : [],
        votingPower: votingPower.status === 'fulfilled' ? votingPower.value : '0',
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── COMPLIANCE ──────────────────────────────────────────────────────────

  /** POST /api/tokenomics/compliance/check */
  r.post('/compliance/check', async (req, res) => {
    try {
      const taskId = await manager.dispatch({
        type:     'compliance:check',
        priority: 'normal',
        source:   'api',
        payload:  req.body,
      });
      res.json({ ok: true, taskId, status: 'queued' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** POST /api/tokenomics/compliance/aeat */
  r.post('/compliance/aeat', async (req, res) => {
    try {
      const taskId = await manager.dispatch({
        type:     'compliance:aeat',
        priority: 'normal',
        source:   'api',
        payload:  req.body,
      });
      res.json({ ok: true, taskId, status: 'queued' });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/tokenomics/compliance/report — último informe */
  r.get('/compliance/report', async (req, res) => {
    try {
      const agent  = manager.getAgent('compliance-agent');
      const report = await manager.memory?.recall('compliance-agent', 'last_report').catch(() => null);
      res.json({ report: report || null, agent: agent?.getStats() || null });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── GOVERNANCE ──────────────────────────────────────────────────────────

  /** GET /api/tokenomics/governance/stats */
  r.get('/governance/stats', async (req, res) => {
    try {
      const stats = engine ? await engine.getGovernanceStats() : null;
      res.json({ stats });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  /** GET /api/tokenomics/governance/power/:address */
  r.get('/governance/power/:address', async (req, res) => {
    try {
      const power = engine ? await engine.getUserVotingPower(req.params.address) : '0';
      res.json({ address: req.params.address, votingPower: power });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  return r;
};
