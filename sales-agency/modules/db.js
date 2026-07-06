// CRM local — JSON file (sin Google Drive, sin base de datos)
// Todos los leads en: sales-agency/data/leads.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const LOG_FILE = path.join(DATA_DIR, 'activity.log');

// ── Init ──────────────────────────────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LEADS_FILE)) fs.writeFileSync(LEADS_FILE, '[]', 'utf8');

// ── Reads ─────────────────────────────────────────────────────────
export function getAllLeads() {
  try { return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8')); }
  catch { return []; }
}

export function getLead(id) {
  return getAllLeads().find(l => l.id === id) || null;
}

export function getLeadByEmail(email) {
  return getAllLeads().find(l => l.email === email) || null;
}

// ── Writes ────────────────────────────────────────────────────────
export function saveLead(lead) {
  const leads = getAllLeads();
  const existing = leads.findIndex(l => l.id === lead.id || l.email === lead.email);
  if (existing >= 0) {
    leads[existing] = { ...leads[existing], ...lead, updated_at: new Date().toISOString() };
  } else {
    leads.push({ ...lead, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
  return lead.id;
}

export function updateLead(id, patch) {
  const leads = getAllLeads();
  const idx = leads.findIndex(l => l.id === id);
  if (idx < 0) return false;
  leads[idx] = { ...leads[idx], ...patch, updated_at: new Date().toISOString() };
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
  return true;
}

// ── Stats ─────────────────────────────────────────────────────────
export function getStats() {
  const leads = getAllLeads();
  const byStatus = leads.reduce((acc, l) => {
    acc[l.status || 'new'] = (acc[l.status || 'new'] || 0) + 1;
    return acc;
  }, {});
  const bySector = leads.reduce((acc, l) => {
    acc[l.sector || 'unknown'] = (acc[l.sector || 'unknown'] || 0) + 1;
    return acc;
  }, {});
  const hot = leads.filter(l => l.score >= 70).length;
  const emailsSent = leads.reduce((sum, l) => sum + (l.steps_sent?.length || 0), 0);
  return { total: leads.length, byStatus, bySector, hot, emailsSent };
}

// ── Log ───────────────────────────────────────────────────────────
export function log(event) {
  const line = `[${new Date().toISOString()}] ${JSON.stringify(event)}\n`;
  fs.appendFileSync(LOG_FILE, line, 'utf8');
}

export function generateId() {
  return `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
