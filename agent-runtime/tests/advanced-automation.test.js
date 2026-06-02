/**
 * Unit tests for Advanced Automation features:
 *  1. Dynamic Workflow Orchestration (State Machine)
 *  2. L2 network resilience and rollbacks
 *  3. Multi-Agent DAO consensus (HITL bypass)
 *  4. Smart Model Switching
 */

'use strict';

const AdvancedAutomation = require('../core/AdvancedAutomation');

describe('BeZhas Advanced Automation — Integration & Unit Tests', () => {
  let automation;

  beforeEach(() => {
    automation = new AdvancedAutomation();
  });

  // ── 1. Dynamic Workflow Orchestration (State Machine) ──────────────────

  describe('1. Dynamic Workflow Orchestration', () => {
    const workflowDefinition = {
      initial: 'idle',
      states: {
        idle: {
          on: { SUCCESS: 'processing', FAIL: 'rollback' }
        },
        processing: {
          on: { COMPLETE: 'completed', FAIL: 'rollback' }
        },
        completed: {},
        rollback: {}
      }
    };

    test('should execute a successful multi-step state machine workflow', async () => {
      const result = await automation.runWorkflow(workflowDefinition, { triggerFailure: false });
      expect(result.success).toBe(true);
      expect(result.finalState).toBe('completed');
      expect(result.history).toEqual(['idle', 'processing', 'completed']);
    });

    test('should trigger automatic rollback if workflow step fails', async () => {
      const result = await automation.runWorkflow(workflowDefinition, { triggerFailure: true });
      expect(result.success).toBe(false);
      expect(result.finalState).toBe('rollback');
      expect(result.history).toEqual(['idle', 'rollback']);
    });
  });

  // ── 2. L2 Network Resilience & Rollbacks ───────────────────────────────

  describe('2. L2 Network Resilience & Rollbacks', () => {
    const rpcUrl = 'http://localhost:8545';

    test('should continue executing standard procedures when L2 network is healthy', async () => {
      const check = await automation.evaluateL2Resilience(rpcUrl, false);
      expect(check.healthy).toBe(true);
      expect(check.status).toBe('ACTIVE');
      expect(check.action).toBe('CONTINUE');
      expect(check.rollbackExecuted).toBe(false);
    });

    test('should trigger automatic rollback and pause financial agents if L2 RPC goes offline', async () => {
      const check = await automation.evaluateL2Resilience(rpcUrl, true);
      expect(check.healthy).toBe(false);
      expect(check.status).toBe('PAUSED');
      expect(check.action).toBe('ROLLBACK_TRIGGERED');
      expect(check.rollbackExecuted).toBe(true);
      expect(check.reason).toContain('L2 RPC connection timeout');
    });
  });

  // ── 3. Multi-Agent Consensus (DAO Style) ───────────────────────────────

  describe('3. Multi-Agent Consensus (DAO Style)', () => {
    const action = 'rebalance_staking_pool';

    test('should approve action and bypass manual HITL if 2/3 agents approve (Threshold Met)', () => {
      const votes = [
        { agentId: 'trading-agent', approved: true },
        { agentId: 'compliance-agent', approved: true },
        { agentId: 'devops-agent', approved: false }
      ];

      const consensus = automation.resolveConsensus(action, votes, 2);
      expect(consensus.approved).toBe(true);
      expect(consensus.bypassHITL).toBe(true);
      expect(consensus.approvedAgents).toContain('trading-agent');
      expect(consensus.approvedAgents).toContain('compliance-agent');
    });

    test('should deny action and require manual HITL if consensus threshold is not met', () => {
      const votes = [
        { agentId: 'trading-agent', approved: true },
        { agentId: 'compliance-agent', approved: false },
        { agentId: 'devops-agent', approved: false }
      ];

      const consensus = automation.resolveConsensus(action, votes, 2);
      expect(consensus.approved).toBe(false);
      expect(consensus.bypassHITL).toBe(false);
      expect(consensus.approvals).toBe(1);
    });
  });

  // ── 4. Smart Model Switching (Model Swapping) ─────────────────────────

  describe('4. Smart Model Switching', () => {
    test('should select qwen3.6:8b for low complexity tasks (DevOps monitoring / Alerts)', () => {
      const decision = automation.selectModelForTask(2);
      expect(decision.model).toBe('qwen3.6:8b');
      expect(decision.tier).toBe('fast-devops');
    });

    test('should select qwen3.6:35b-a3b for medium complexity tasks (Solidity contract interaction)', () => {
      const decision = automation.selectModelForTask(6);
      expect(decision.model).toBe('qwen3.6:35b-a3b');
      expect(decision.tier).toBe('medium');
    });

    test('should select kimi-k2 for high complexity tasks (Compliance / Deep Audit)', () => {
      const decision = automation.selectModelForTask(9);
      expect(decision.model).toBe('kimi-k2');
      expect(decision.tier).toBe('high-context');
    });
  });
});
