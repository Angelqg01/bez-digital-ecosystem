// ═══════════════════════════════════════════════════════════════
//  BeZhas Sales Agency — Orquestador principal
//  Uso:
//    node index.js               → modo daemon (cron automático)
//    node index.js --mode=scout  → scout + emails ahora
//    node index.js --mode=followup → solo follow-ups
//    node index.js --mode=report   → solo reporte Telegram
//    node index.js --mode=status   → ver estado leads en consola
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import cron from 'node-cron';
import { runScout } from './modules/scout.js';
import { sendFirstEmails, processFollowUps } from './modules/mailer.js';
import * as telegram from './modules/telegram.js';
import * as db from './modules/db.js';
import { SECTORS } from './config/personas.js';

// ── Config ────────────────────────────────────────────────────────
const ACTIVE_SECTORS = ['logistica', 'alimentacion', 'energia', 'crypto'];
const MODE = process.argv.find(a => a.startsWith('--mode='))?.split('=')[1] || 'daemon';

// ── Emit handler (consola + log) ──────────────────────────────────
function emit(event) {
  const icons = {
    scout_start: '🔍', scout_found: '📋', scout_done: '✅', scout_error: '❌',
    lead_saved: '💾', scout_skip: '⏭️',
    email_sent: '📧', email_error: '❌', email_skip: '⏭️',
    followup_sent: '🔄', followup_error: '❌',
  };
  const icon = icons[event.type] || '•';
  const msg = event.empresa
    ? `${icon} [${event.type}] ${event.empresa}${event.score ? ` | Score: ${event.score} (${event.tier})` : ''}${event.step !== undefined ? ` | Step: ${event.step}` : ''}${event.error ? ` | ${event.error}` : ''}`
    : `${icon} [${event.type}] ${JSON.stringify(event)}`;
  console.log(msg);
}

// ── Ciclo principal ───────────────────────────────────────────────
async function runCycle() {
  console.log('\n══════════════════════════════════════════');
  console.log(`  BeZhas Sales Agency — ${new Date().toLocaleString('es-ES')}`);
  console.log('══════════════════════════════════════════\n');

  let scoutedToday = 0;
  let emailsSent = 0;
  let followupsSent = 0;

  try {
    // 1. Scout nuevos leads
    console.log('── FASE 1: Scout de leads ──────────────');
    const newLeads = await runScout(ACTIVE_SECTORS, emit);
    scoutedToday = newLeads.length;

    // 2. Alertas HOT via Telegram
    for (const lead of newLeads.filter(l => l.tier === 'HOT')) {
      await telegram.alertHotLead(lead);
    }

    await sleep(2000);

    // 3. Enviar primer email a leads nuevos con email
    console.log('\n── FASE 2: Emails a leads nuevos ───────');
    emailsSent = await sendFirstEmails(emit);

    await sleep(2000);

    // 4. Follow-ups pendientes
    console.log('\n── FASE 3: Follow-ups ──────────────────');
    followupsSent = await processFollowUps(emit);

    // 5. Reporte diario
    console.log('\n── FASE 4: Reporte Telegram ────────────');
    await telegram.sendDailyReport(scoutedToday, emailsSent, followupsSent);

    console.log('\n✅ Ciclo completado');
    console.log(`   Scouted: ${scoutedToday} | Emails: ${emailsSent} | Follow-ups: ${followupsSent}`);

  } catch (err) {
    console.error('❌ Error en ciclo:', err.message);
    await telegram.alertError('runCycle', err.message);
  }
}

// ── Status en consola ─────────────────────────────────────────────
function printStatus() {
  const stats = db.getStats();
  const leads = db.getAllLeads();

  console.log('\n══════════════════════════════════════════');
  console.log('  BeZhas Sales Agency — STATUS');
  console.log('══════════════════════════════════════════\n');
  console.log(`Total leads:      ${stats.total}`);
  console.log(`HOT leads:        ${stats.hot}`);
  console.log(`Emails enviados:  ${stats.emailsSent}`);
  console.log(`\nPor estado:`);
  Object.entries(stats.byStatus).forEach(([s, n]) => console.log(`  ${s}: ${n}`));
  console.log(`\nPor sector:`);
  Object.entries(stats.bySector).forEach(([s, n]) => console.log(`  ${s}: ${n}`));

  console.log('\n── Leads HOT activos ───────────────────');
  leads
    .filter(l => l.tier === 'HOT' && l.status !== 'disqualified')
    .forEach(l => console.log(`  • [${l.score}] ${l.empresa} (${l.ubicacion}) | ${l.email || 'sin email'} | Steps: ${(l.steps_sent || []).join(',') || 'ninguno'}`));

  console.log('\n── Próximos follow-ups ─────────────────');
  const now = Date.now();
  leads
    .filter(l => l.status === 'contacted' && l.contacted_at)
    .map(l => {
      const daysSince = Math.round((now - new Date(l.contacted_at).getTime()) / 86400000);
      return { ...l, daysSince };
    })
    .sort((a, b) => a.daysSince - b.daysSince)
    .slice(0, 10)
    .forEach(l => console.log(`  • ${l.empresa} | Día ${l.daysSince} | Steps enviados: ${(l.steps_sent || []).join(',')}`));

  console.log('');
}

// ── Revenue estimado ──────────────────────────────────────────────
function printRevenue() {
  const stats = db.getStats();
  const t = stats.total;
  console.log('\n── Proyección de revenue ───────────────');
  console.log(`  Leads en pipeline: ${t}`);
  console.log(`  Conversión 5% Starter ($100):    $${Math.round(t * 0.05 * 100)}`);
  console.log(`  Conversión 2% Pro ($550):         $${Math.round(t * 0.02 * 550)}`);
  console.log(`  Conversión 1% Enterprise ($2000): $${Math.round(t * 0.01 * 2000)}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  TOTAL ESTIMADO:                   $${Math.round(t * 0.05 * 100 + t * 0.02 * 550 + t * 0.01 * 2000)}`);
}

// ── Entry point ───────────────────────────────────────────────────
async function main() {
  console.log('🤖 BeZhas Sales Agency v1.0');
  console.log(`   Modo: ${MODE}`);
  console.log(`   Sectores: ${ACTIVE_SECTORS.join(', ')}`);
  console.log(`   Precio BEZ: $${process.env.BEZ_PRICE_USD}`);

  switch (MODE) {
    case 'scout':
      console.log('\n🔍 Ejecutando scout manual...');
      const leads = await runScout(ACTIVE_SECTORS, emit);
      const emailsSent = await sendFirstEmails(emit);
      console.log(`\n✅ Scout completo: ${leads.length} leads | ${emailsSent} emails`);
      printRevenue();
      break;

    case 'followup':
      console.log('\n🔄 Procesando follow-ups...');
      const fired = await processFollowUps(emit);
      console.log(`\n✅ Follow-ups enviados: ${fired}`);
      break;

    case 'report':
      const stats = db.getStats();
      await telegram.sendDailyReport(0, 0, 0);
      console.log('✅ Reporte enviado a Telegram');
      break;

    case 'status':
      printStatus();
      printRevenue();
      break;

    case 'daemon':
    default:
      await telegram.sendStartupMessage(ACTIVE_SECTORS);

      // Ejecutar inmediatamente al arrancar
      await runCycle();

      // Cron: scout + emails a las 9:00 AM cada día
      cron.schedule('0 9 * * 1-5', async () => {
        console.log('\n⏰ Cron 9:00 AM — Ciclo completo');
        await runCycle();
      }, { timezone: 'Europe/Madrid' });

      // Cron: solo follow-ups a las 3:00 PM cada día
      cron.schedule('0 15 * * 1-5', async () => {
        console.log('\n⏰ Cron 3:00 PM — Solo follow-ups');
        const fired = await processFollowUps(emit);
        if (fired > 0) console.log(`  ✅ ${fired} follow-ups enviados`);
      }, { timezone: 'Europe/Madrid' });

      console.log('\n✅ Daemon activo. Próxima ejecución: 9:00 AM (L-V)');
      console.log('   Ctrl+C para detener\n');
      break;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => {
  console.error('❌ Fatal:', err.message);
  process.exit(1);
});
