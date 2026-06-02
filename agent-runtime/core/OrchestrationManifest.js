/**
 * BeZhas Agent Runtime — OrchestrationManifest
 * Reads the platform-wide orchestration manifest used to align departments,
 * task routing, approval policy, KPIs, MCPs, and feedback-loop metadata.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MANIFEST_PATH = path.resolve(__dirname, '..', '..', 'orchestration', 'orchestration-manifest.json');

class OrchestrationManifest {
  constructor(opts = {}) {
    this.path = opts.path || process.env.BEZHAS_ORCHESTRATION_MANIFEST || DEFAULT_MANIFEST_PATH;
    this._manifest = null;
    this._loadedAt = null;
    this._error = null;
  }

  load() {
    try {
      const raw = fs.readFileSync(this.path, 'utf8');
      const manifest = JSON.parse(raw);
      this._validate(manifest);
      this._manifest = manifest;
      this._loadedAt = new Date().toISOString();
      this._error = null;
      return manifest;
    } catch (err) {
      this._manifest = null;
      this._loadedAt = null;
      this._error = err;
      return null;
    }
  }

  get manifest() {
    return this._manifest || this.load();
  }

  get error() {
    return this._error;
  }

  get loadedAt() {
    return this._loadedAt;
  }

  getRouting(taskType) {
    const manifest = this.manifest;
    if (!manifest || !taskType) return null;
    return manifest.routing?.[taskType] || null;
  }

  getDepartment(departmentId) {
    const manifest = this.manifest;
    if (!manifest || !departmentId) return null;
    return manifest.departments?.[departmentId] || null;
  }

  getDepartmentForTask(taskType) {
    const manifest = this.manifest;
    if (!manifest?.departments || !taskType) return null;

    for (const [id, department] of Object.entries(manifest.departments)) {
      if (department.eventTypes?.includes(taskType)) {
        return { id, ...department };
      }
    }

    const routedAgentId = this.getRouting(taskType);
    if (!routedAgentId) return null;

    for (const [id, department] of Object.entries(manifest.departments)) {
      if (department.runtimeAgentId === routedAgentId || department.agentId === routedAgentId) {
        return { id, ...department };
      }
    }

    return null;
  }

  getEventStreamForDepartment(departmentId) {
    const manifest = this.manifest;
    if (!manifest?.eventStreams || !departmentId) return null;

    const direct = manifest.eventStreams[departmentId];
    if (direct) return direct;

    const aliases = {
      director: 'risk',
      solutions: 'growth',
      blockchain: 'blockchain',
      devops: 'risk',
      legal: 'risk',
      finance: 'risk',
      skills: 'skills',
    };

    return manifest.eventStreams[aliases[departmentId]] || null;
  }

  getRouteInfo(taskType) {
    const department = this.getDepartmentForTask(taskType);
    return {
      taskType,
      agentId: this.getRouting(taskType),
      departmentId: department?.id || null,
      department,
      eventStream: department ? this.getEventStreamForDepartment(department.id) : null,
      kpis: department?.kpis || [],
      approvalRequired: department?.approvalRequired || [],
    };
  }

  listDepartments() {
    const manifest = this.manifest;
    if (!manifest?.departments) return [];
    return Object.entries(manifest.departments).map(([id, department]) => ({
      id,
      ...department,
    }));
  }

  requiresHumanApproval(actionName) {
    const manifest = this.manifest;
    if (!manifest || !actionName) return false;
    return Boolean(manifest.approvalPolicy?.requireHumanApproval?.includes(actionName));
  }

  getStatus() {
    const manifest = this.manifest;
    return {
      path: this.path,
      loaded: Boolean(manifest),
      version: manifest?.version || null,
      loadedAt: this._loadedAt,
      error: this._error?.message || null,
      departments: manifest?.departments ? Object.keys(manifest.departments).length : 0,
      routes: manifest?.routing ? Object.keys(manifest.routing).length : 0,
      mcps: manifest?.mcps ? Object.keys(manifest.mcps).length : 0,
    };
  }

  _validate(manifest) {
    if (!manifest || typeof manifest !== 'object') {
      throw new Error('Orchestration manifest must be a JSON object');
    }
    if (!manifest.version) {
      throw new Error('Orchestration manifest missing "version"');
    }
    if (!manifest.departments || typeof manifest.departments !== 'object') {
      throw new Error('Orchestration manifest missing "departments"');
    }
    if (!manifest.routing || typeof manifest.routing !== 'object') {
      throw new Error('Orchestration manifest missing "routing"');
    }
  }
}

module.exports = OrchestrationManifest;
module.exports.DEFAULT_MANIFEST_PATH = DEFAULT_MANIFEST_PATH;
