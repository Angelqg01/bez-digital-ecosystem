import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/adminGuard';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const dynamic = 'force-dynamic';

// control-center/frontend is two levels below the repo root.
const REPO_ROOT = path.resolve(process.cwd(), '../..');
const CONFIG_PATH = path.join(REPO_ROOT, 'scripts', 'config', 'native-apps.json');
const SNAPSHOT_PATH = path.join(REPO_ROOT, 'scripts', 'status', 'native-app-status.json');
const WATCHDOG_SCRIPT = path.join(REPO_ROOT, 'scripts', 'native-app-watchdog.cjs');
const SYNC_SCRIPT = path.join(REPO_ROOT, 'scripts', 'sync-daemon.cjs');
const SYNC_REPORT_PATH = path.join(REPO_ROOT, 'SKILL', 'sync-report.json');

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

async function readJson(filePath: string) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function loadConfig() {
  const config = await readJson(CONFIG_PATH);
  return {
    project: config?.project || 'totemic-bonus-479312-c6',
    region: config?.region || 'europe-west1',
    apps: (config?.apps || []) as { name: string; url: string; service?: string; healthPath?: string }[],
  };
}

// Cloud Run "start/stop": Cloud Run has no native power switch, so this toggles
// maxInstances between 0 (no instance may ever run — effectively off) and a
// normal ceiling (matches --max-instances 5 in scripts/deploy-native-app.sh).
const RUNNING_MAX_INSTANCES = 5;

// Tried in order — the machine has had its system gcloud installation get
// corrupted before (see memory), so a plain `gcloud` on PATH isn't reliable.
const HOME = process.env.USERPROFILE || process.env.HOME || 'C:/Users/yoela';
const LOCALAPPDATA = process.env.LOCALAPPDATA || `${HOME}/AppData/Local`;
const GCLOUD_CANDIDATES = [
  'gcloud',
  `${LOCALAPPDATA}/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd`, // official installer default
  `${HOME}/google-cloud-sdk/bin/gcloud.cmd`,
  'C:/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd',
  'C:/Program Files/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd',
];

/** Runs `gcloud <args>`, trying each known install path until one actually spawns. */
function runGcloud(args: string[], timeoutMs = 30_000) {
  return new Promise<{ code: number | null; stdout: string; stderr: string; bin: string | null }>((resolve) => {
    const tryNext = (i: number) => {
      if (i >= GCLOUD_CANDIDATES.length) {
        resolve({ code: -1, stdout: '', stderr: 'gcloud CLI no encontrado en PATH ni en las rutas conocidas de instalación.', bin: null });
        return;
      }
      const bin = GCLOUD_CANDIDATES[i];
      // shell:true is required on Windows to exec a .cmd wrapper. Safe here because
      // every arg we pass is either a fixed flag or a value pre-validated against
      // the native-apps.json service whitelist — never raw request input.
      const child = spawn(bin, args, { windowsHide: true, timeout: timeoutMs, shell: true });
      let stdout = '';
      let stderr = '';
      let spawnFailed = false;
      child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
      child.on('error', () => { spawnFailed = true; tryNext(i + 1); });
      child.on('close', (code) => {
        if (spawnFailed) return;
        resolve({ code, stdout: stdout.trim(), stderr: stderr.trim(), bin });
      });
    };
    tryNext(0);
  });
}

async function cloudRunDescribe(service: string, project: string, region: string) {
  const result = await runGcloud([
    'run', 'services', 'describe', service,
    '--project', project, '--region', region, '--format', 'json',
  ]);
  if (result.code !== 0) {
    return { service, ok: false, error: (result.stderr || result.stdout || 'gcloud error').slice(0, 500) };
  }
  try {
    const data = JSON.parse(result.stdout);
    const annotations = data?.spec?.template?.metadata?.annotations || {};
    const maxInstancesRaw = annotations['autoscaling.knative.dev/maxScale'];
    const maxInstances = maxInstancesRaw != null ? Number(maxInstancesRaw) : null;
    const url = data?.status?.url || null;
    return {
      service,
      ok: true,
      maxInstances,
      running: maxInstances === null || maxInstances > 0,
      url,
      latestReadyRevision: data?.status?.latestReadyRevisionName || null,
    };
  } catch {
    return { service, ok: false, error: 'No se pudo parsear la respuesta de gcloud.' };
  }
}

/**
 * Full operational parameters of a single Cloud Run service, for the detail
 * modal. Secrets are never returned as values — only the names of the env vars
 * that resolve from Secret Manager, so the panel can show *what* is wired
 * without ever exposing the secret itself.
 */
async function cloudRunDetail(service: string, project: string, region: string) {
  const result = await runGcloud([
    'run', 'services', 'describe', service,
    '--project', project, '--region', region, '--format', 'json',
  ]);
  if (result.code !== 0) {
    return { service, ok: false, error: (result.stderr || result.stdout || 'gcloud error').slice(0, 800) };
  }
  try {
    const data = JSON.parse(result.stdout);
    const tmpl = data?.spec?.template || {};
    const annotations = tmpl?.metadata?.annotations || {};
    const container = tmpl?.spec?.containers?.[0] || {};
    const resources = container?.resources || {};
    const maxScaleRaw = annotations['autoscaling.knative.dev/maxScale'];
    const minScaleRaw = annotations['autoscaling.knative.dev/minScale'];

    const envPlain: { name: string; value: string }[] = [];
    const envSecret: string[] = [];
    for (const e of container?.env || []) {
      if (e?.valueFrom?.secretKeyRef) envSecret.push(e.name);
      else if (typeof e?.value === 'string') envPlain.push({ name: e.name, value: e.value });
      else if (e?.name) envSecret.push(e.name);
    }

    const maxInstances = maxScaleRaw != null ? Number(maxScaleRaw) : null;

    return {
      service,
      ok: true,
      running: maxInstances === null || maxInstances > 0,
      url: data?.status?.url || null,
      project,
      region,
      image: container?.image || null,
      port: container?.ports?.[0]?.containerPort || null,
      containerConcurrency: tmpl?.spec?.containerConcurrency ?? null,
      timeoutSeconds: tmpl?.spec?.timeoutSeconds ?? null,
      serviceAccount: tmpl?.spec?.serviceAccountName || null,
      cpu: resources?.limits?.cpu || null,
      memory: resources?.limits?.memory || null,
      minInstances: minScaleRaw != null ? Number(minScaleRaw) : null,
      maxInstances,
      cpuThrottling: annotations['run.googleapis.com/cpu-throttling'] ?? null,
      executionEnvironment: annotations['run.googleapis.com/execution-environment'] ?? null,
      latestReadyRevision: data?.status?.latestReadyRevisionName || null,
      latestCreatedRevision: data?.status?.latestCreatedRevisionName || null,
      lastModifier: annotations['serving.knative.dev/lastModifier'] || null,
      creationTimestamp: data?.metadata?.creationTimestamp || null,
      traffic: (data?.status?.traffic || []).map((t: { revisionName?: string; percent?: number; latestRevision?: boolean }) => ({
        revision: t.revisionName || (t.latestRevision ? 'LATEST' : '—'),
        percent: t.percent ?? 0,
      })),
      conditions: (data?.status?.conditions || []).map((c: { type?: string; status?: string; message?: string }) => ({
        type: c.type, status: c.status, message: c.message || null,
      })),
      env: envPlain,
      secretEnv: envSecret,
    };
  } catch {
    return { service, ok: false, error: 'No se pudo parsear la respuesta de gcloud.' };
  }
}

async function cloudRunSetMaxInstances(service: string, project: string, region: string, maxInstances: number) {
  const result = await runGcloud([
    'run', 'services', 'update', service,
    '--project', project, '--region', region,
    `--max-instances=${maxInstances}`, '--quiet',
  ], 60_000);
  return {
    service,
    ok: result.code === 0,
    exitCode: result.code,
    log: (result.stdout || result.stderr || '').slice(0, 2000),
  };
}

/** Runs a .cjs script with `node` and resolves with its combined output. Never rejects on a non-zero exit — the caller inspects `code`. */
function runScript(scriptPath: string, args: string[], timeoutMs = 45_000) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: REPO_ROOT,
      windowsHide: true,
      timeout: timeoutMs,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: err.message }));
    child.on('close', (code) => resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

async function buildStatus() {
  const [config, snapshot] = await Promise.all([readJson(CONFIG_PATH), readJson(SNAPSHOT_PATH)]);
  const apps: { name: string; url: string; service?: string }[] = config?.apps || [];
  const serviceByName = new Map(apps.map((a) => [a.name, a.service || null]));

  if (!snapshot) {
    return {
      status: 'never_run',
      apps: apps.map((a) => ({ name: a.name, url: a.url, service: a.service || null, status: 'unknown' })),
      summary: { total: apps.length, up: 0, down: 0, flaky: 0, unknown: apps.length },
      message: 'El watchdog nunca se ha ejecutado en este entorno. Usa "Comprobar ahora" o corre `pnpm watchdog:native-apps`.',
    };
  }

  // The ping snapshot (written by scripts/native-app-watchdog.cjs) doesn't know
  // about Cloud Run service names — merge them in from the config so the
  // client can wire up start/stop without a second round trip.
  const enrichedApps = (snapshot.apps || []).map((a: { name: string }) => ({
    ...a,
    service: serviceByName.get(a.name) || null,
  }));

  return { status: 'ok', ...snapshot, apps: enrichedApps };
}

export async function GET() {
  // proxy.ts no cubre /api/admin/*, así que la guarda va aquí: esta ruta lista
  // el estado de los servicios de Cloud Run y la de abajo puede apagarlos.
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    return json(await buildStatus());
  } catch (error) {
    return json({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === 'run_watchdog_once') {
      const result = await runScript(WATCHDOG_SCRIPT, ['--once']);
      const status = await buildStatus();
      return json({ status: 'ok', exitCode: result.code, log: result.stdout || result.stderr, ...status });
    }

    if (action === 'run_sync_once') {
      const result = await runScript(SYNC_SCRIPT, ['--once']);
      const report = await readJson(SYNC_REPORT_PATH);
      return json({ status: 'ok', exitCode: result.code, log: result.stdout || result.stderr, report });
    }

    if (action === 'cloud_run_status_all') {
      const { project, region, apps } = await loadConfig();
      const targets = apps.filter((a) => a.service);
      if (targets.length === 0) return json({ status: 'error', error: 'No hay servicios Cloud Run configurados en native-apps.json' }, { status: 400 });

      // Preflight: one cheap call first. If gcloud itself is broken (e.g. the
      // corrupted local install), every one of the 13 calls fails identically —
      // don't spend 13x the timeout finding that out.
      const probe = await cloudRunDescribe(targets[0].service as string, project, region);
      if (!probe.ok && /gcloud (CLI no encontrado|failed to load)|ModuleNotFoundError/i.test(probe.error || '')) {
        return json({ status: 'error', error: `gcloud no disponible: ${probe.error}`, services: [] });
      }

      const rest = await Promise.all(
        targets.slice(1).map((a) => cloudRunDescribe(a.service as string, project, region))
      );
      return json({ status: 'ok', services: [probe, ...rest] });
    }

    if (action === 'cloud_run_detail') {
      const { project, region, apps } = await loadConfig();
      const service = body?.service;
      const target = apps.find((a) => a.service === service);
      if (!target) {
        return json({ status: 'error', error: `Servicio desconocido: ${String(service)}` }, { status: 400 });
      }
      // Merge the live ping row (from the last watchdog run) with the Cloud Run
      // config, so the modal shows both "is it answering right now" and "how is
      // it deployed" in one payload.
      const snapshot = await readJson(SNAPSHOT_PATH);
      const ping = (snapshot?.apps || []).find((a: { name: string }) => a.name === target.name) || null;
      const detail = await cloudRunDetail(target.service as string, project, region);
      return json({
        status: 'ok',
        app: { name: target.name, url: target.url, healthPath: target.healthPath || null, service: target.service },
        ping,
        cloudRun: detail,
      });
    }

    if (action === 'cloud_run_start' || action === 'cloud_run_stop') {
      const { project, region, apps } = await loadConfig();
      const service = body?.service;
      const target = apps.find((a) => a.service === service);
      if (!target) {
        return json({ status: 'error', error: `Servicio desconocido: ${String(service)}` }, { status: 400 });
      }
      const maxInstances = action === 'cloud_run_start' ? RUNNING_MAX_INSTANCES : 0;
      const result = await cloudRunSetMaxInstances(target.service as string, project, region, maxInstances);
      return json({ status: result.ok ? 'ok' : 'error', ...result });
    }

    return json({ status: 'error', error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return json({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
