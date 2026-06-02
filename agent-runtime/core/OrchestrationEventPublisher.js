/**
 * BeZhas Agent Runtime — OrchestrationEventPublisher
 * Publishes normalized lifecycle events to Redis Streams so departments,
 * dashboards, feedback loops, and external workers can observe the platform.
 */

'use strict';

class OrchestrationEventPublisher {
  constructor(opts = {}) {
    this.memory = opts.memory || null;
    this.manifest = opts.manifest || null;
    this.allStream = opts.allStream || process.env.BEZHAS_ALL_EVENTS_STREAM || 'bezhas:events:all';
    this.enabled = opts.enabled !== false;
  }

  async publish(eventType, payload = {}) {
    if (!this.enabled) return { published: false, reason: 'disabled' };

    const mem = this.memory;
    if (!mem) return { published: false, reason: 'no_memory' };

    const taskType = payload.task?.type || payload.taskType || payload.type;
    const routeInfo = this.manifest?.getRouteInfo(taskType) || {};
    const stream = payload.eventStream || routeInfo.eventStream || this.allStream;
    const event = this._buildEvent(eventType, payload, routeInfo);
    const fields = this._toRedisFields(event);

    try {
      const ids = [];
      // Support both Redis client (xAdd) and in-memory MemoryManager (xadd)
      if (typeof mem.xadd === 'function') {
        ids.push(await mem.xadd(this.allStream, fields));
        if (stream && stream !== this.allStream) {
          ids.push(await mem.xadd(stream, fields));
        }
      } else if (mem.client?.isOpen && typeof mem.client.xAdd === 'function') {
        ids.push(await mem.client.xAdd(this.allStream, '*', fields));
        if (stream && stream !== this.allStream) {
          ids.push(await mem.client.xAdd(stream, '*', fields));
        }
      } else {
        return { published: false, reason: 'no_stream_backend' };
      }
      return { published: true, stream, ids };
    } catch (err) {
      console.warn(`[OrchestrationEventPublisher] No se pudo publicar ${eventType}: ${err.message}`);
      return { published: false, reason: err.message };
    }
  }

  async taskQueued(task) {
    return this.publish('task.queued', { task });
  }

  async taskStarted(task) {
    return this.publish('task.started', { task });
  }

  async taskCompleted(task, result) {
    return this.publish('task.completed', { task, result });
  }

  async taskFailed(task, error) {
    return this.publish('task.failed', {
      task,
      error: {
        message: error?.message || String(error),
        name: error?.name || 'Error',
      },
    });
  }

  async hitlRequested(taskId, context) {
    return this.publish('hitl.requested', {
      taskType: context?.taskType,
      taskId,
      context,
      eventStream: this.manifest?.manifest?.eventStreams?.approvals,
    });
  }

  async hitlResolved(taskId, approved, response = '') {
    return this.publish('hitl.resolved', {
      taskId,
      approved,
      response,
      eventStream: this.manifest?.manifest?.eventStreams?.approvals,
    });
  }

  _buildEvent(eventType, payload, routeInfo) {
    const task = payload.task || {};
    return {
      eventType,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      taskId: payload.taskId || task.id || null,
      taskType: payload.taskType || task.type || null,
      source: task.source || payload.source || 'agent-runtime',
      priority: task.priority || payload.priority || 'normal',
      departmentId: task.orchestration?.departmentId || routeInfo.departmentId || null,
      routeAgentId: task.orchestration?.routeAgentId || routeInfo.agentId || task.agentId || null,
      eventStream: task.orchestration?.eventStream || payload.eventStream || routeInfo.eventStream || null,
      kpis: task.orchestration?.kpis || routeInfo.kpis || [],
      payload,
    };
  }

  _toRedisFields(event) {
    return {
      eventType: event.eventType,
      eventId: event.eventId,
      timestamp: event.timestamp,
      taskId: event.taskId || '',
      taskType: event.taskType || '',
      source: event.source || '',
      priority: event.priority || 'normal',
      departmentId: event.departmentId || '',
      routeAgentId: event.routeAgentId || '',
      eventStream: event.eventStream || '',
      kpis: JSON.stringify(event.kpis || []),
      payload: JSON.stringify(event.payload || {}),
    };
  }
}

module.exports = OrchestrationEventPublisher;
