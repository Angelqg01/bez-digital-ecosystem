/**
 * telegram-descubrir-grupos.js
 *
 * Escucha a los bots y, en cuanto añades cada uno a su grupo, recoge el chat id
 * y lo escribe en el .env de la raíz.
 *
 *   node scripts/telegram-descubrir-grupos.js --estado   qué hay configurado ahora
 *   node scripts/telegram-descubrir-grupos.js            escucha 10 min
 *   node scripts/telegram-descubrir-grupos.js --escribir escribe el .env al acabar
 *   node scripts/telegram-descubrir-grupos.js --minutos 3
 *   node scripts/telegram-descubrir-grupos.js --forzar   pisa grupos ya asignados
 *
 * Por qué hace falta este paso a mano
 * -----------------------------------
 * Un bot NO puede crear un grupo: la API de bots solo permite operar en grupos
 * a los que una persona lo ha añadido. Así que el reparto por departamento
 * empieza contigo creando los grupos; a partir de ahí esto es automático.
 *
 * Qué hacer en Telegram, por cada departamento:
 *   1. Nuevo grupo (p. ej. «BeZhas · Tesorería»).
 *   2. Añadir SOLO el bot de ese departamento.
 *   3. Escribir cualquier cosa en el grupo (un «hola» basta).
 *
 * El id de un grupo es NEGATIVO (-100…), a diferencia del chat privado. Esa es
 * la señal de que el reparto está bien hecho: si un departamento sigue con un
 * id positivo, es que apunta a un chat personal y no a su grupo.
 *
 * Lo del «SOLO» del paso 2 va en serio
 * ------------------------------------
 * Un bot metido en un grupo ajeno hace que ese grupo aparezca en SU getUpdates,
 * y el script se lo atribuía a su departamento. Pasó de verdad: los bots de
 * Dirección y Finanzas estaban en el grupo de ventas, y ambos departamentos
 * quedaron repuntados allí. Por eso ahora, por defecto, esto NO pisa un grupo
 * que ya estaba asignado ni resuelve un empate entre departamentos: avisa y te
 * deja arreglarlo en Telegram, que es donde está el problema.
 */

import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV = resolve(RAIZ, '.env');
dotenv.config({ path: ENV, quiet: true });

const ESCRIBIR = process.argv.includes('--escribir');
const ESTADO = process.argv.includes('--estado');
// Deja pisar un grupo ya asignado, o elegir el más reciente cuando el bot está
// en varios. Explícito y a mano: es justo el paso que salió mal solo.
const FORZAR = process.argv.includes('--forzar');
const MINUTOS = Number(process.argv[process.argv.indexOf('--minutos') + 1]) || 10;

// Departamento → { token, variable de chat en el .env }
const DEPARTAMENTOS = [
  { id: 'CEO', etiqueta: 'Dirección', token: 'TELEGRAM_TOKEN_DIRECTOR', chat: 'TELEGRAM_CHAT_CEO' },
  { id: 'CFO', etiqueta: 'Finanzas y tesorería', token: 'TELEGRAM_TOKEN_FINANCE', chat: 'TELEGRAM_CHAT_CFO' },
  { id: 'CMO', etiqueta: 'Marketing', token: 'TELEGRAM_TOKEN_MARKETING', chat: 'TELEGRAM_CHAT_CMO' },
  { id: 'DevOps', etiqueta: 'Cadena y operaciones', token: 'TELEGRAM_TOKEN_DEVOPS', chat: 'TELEGRAM_CHAT_DEVOPS' },
  { id: 'Legal', etiqueta: 'Legal y fiscal', token: 'TELEGRAM_TOKEN_LEGAL', chat: 'TELEGRAM_CHAT_LEGAL' },
  // Bot genérico de la casa: ventas y soporte, lo que da la cara ante el cliente.
  { id: 'General', etiqueta: 'Ventas y soporte', token: 'TELEGRAM_BOT_TOKEN', chat: 'TELEGRAM_CHAT_GENERAL' },
];

const api = (tok, met, q = '') =>
  fetch(`https://api.telegram.org/bot${tok}/${met}${q}`).then((r) => r.json()).catch((e) => ({ error: e.message }));

/** Un grupo tiene id negativo; un chat privado, positivo. */
const esGrupo = (id) => String(id).startsWith('-');

async function nombreBot(tok) {
  const me = await api(tok, 'getMe');
  return me.ok ? '@' + me.result.username : '(token inválido)';
}

/**
 * Todos los grupos que ha visto este bot, no solo el último.
 *
 * Antes esto devolvía únicamente el más reciente, y esa era la raíz del fallo:
 * si un bot anda metido en un grupo que no es el suyo, el «más reciente» puede
 * ser perfectamente el grupo ajeno, y el departamento acababa repuntado ahí sin
 * que nada lo delatara. Devolviendo la lista entera se puede detectar.
 */
async function buscarGrupos(tok) {
  const up = await api(tok, 'getUpdates', '?limit=100');
  const vistos = new Map();
  for (const u of up.result || []) {
    const m = u.message || u.channel_post || u.my_chat_member;
    const c = m && m.chat;
    if (c && esGrupo(c.id)) vistos.set(String(c.id), c.title || c.type);
  }
  // El orden de inserción del Map deja el más reciente al final.
  return [...vistos].map(([id, titulo]) => ({ id, titulo }));
}

const escaparRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Aplica los cambios al .env y devuelve SOLO lo que se puede confirmar releyendo
 * el fichero. El contador anterior se fiaba de su propia aritmética y llegó a
 * anunciar «0 variables» mientras reescribía dos; aquí no se informa de nada que
 * no esté en disco.
 */
function escribirEnv(cambios) {
  if (!cambios.length) return { aplicados: [], bak: null };
  const original = fs.readFileSync(ENV, 'utf8');
  let s = original;
  for (const c of cambios) {
    const re = new RegExp(`^${escaparRe(c.variable)}=.*$`, 'm');
    s = re.test(s) ? s.replace(re, `${c.variable}=${c.valor}`) : `${s}\n${c.variable}=${c.valor}`;
  }
  if (s === original) return { aplicados: [], bak: null };

  const bak = `${ENV}.bak-grupos-${Date.now()}`;
  fs.copyFileSync(ENV, bak);
  fs.writeFileSync(ENV, s);

  const enDisco = fs.readFileSync(ENV, 'utf8');
  const aplicados = cambios.filter((c) =>
    new RegExp(`^${escaparRe(c.variable)}=${escaparRe(c.valor)}$`, 'm').test(enDisco));
  return { aplicados, bak };
}

/** Informe del reparto actual: quién va a un grupo y quién sigue en privado. */
async function estado() {
  console.log('\n  Reparto actual por departamento\n');
  let enGrupo = 0; let enPrivado = 0;
  const porChat = new Map();
  for (const d of DEPARTAMENTOS) {
    const tok = process.env[d.token];
    const chat = process.env[d.chat] || process.env.HITL_TELEGRAM_CHAT_ID || '';
    const bot = tok ? await nombreBot(tok) : '(sin token)';
    let donde;
    if (!chat) { donde = 'SIN DESTINO — el aviso no saldría'; }
    else if (esGrupo(chat)) { donde = `grupo ${chat}`; enGrupo++; }
    else { donde = `privado ${chat} — pendiente de su grupo`; enPrivado++; }
    if (chat) porChat.set(chat, [...(porChat.get(chat) || []), d.etiqueta]);
    console.log(`  ${d.etiqueta.padEnd(24)} ${bot.padEnd(30)} ${donde}`);
  }
  console.log(`\n  ${enGrupo} en grupo · ${enPrivado} en chat privado`);

  // Dos departamentos en el mismo chat significa que sus avisos se mezclan.
  for (const [chat, dptos] of porChat) {
    if (dptos.length > 1) console.log(`  ⚠ ${chat} lo comparten: ${dptos.join(', ')}`);
  }
  if (enPrivado) console.log('  Para separarlos: node scripts/telegram-descubrir-grupos.js --escribir');
}

/**
 * Decide qué se escribe y qué no. Adoptar un grupo nuevo cuando el departamento
 * no tenía ninguno es seguro; pisar un grupo que ya funcionaba no lo es, porque
 * el aviso deja de llegar donde llegaba y nadie se entera hasta que hace falta.
 */
function decidir(hallazgos) {
  const cambios = []; const avisos = [];

  // Si dos departamentos ven el mismo grupo es que hay un bot donde no debe.
  const porGrupo = new Map();
  for (const [dep, g] of Object.entries(hallazgos)) {
    porGrupo.set(g.elegido.id, [...(porGrupo.get(g.elegido.id) || []), dep]);
  }

  // Grupos que YA tiene asignados otro departamento en el .env. Sin esto, un
  // departamento que aún estaba en chat privado se llevaría por delante el
  // grupo de un compañero solo porque su bot anda metido allí: es adopción,
  // que parece inocente, pero el destino es de otro.
  const yaAsignados = new Map();
  for (const d of DEPARTAMENTOS) {
    const v = process.env[d.chat] || '';
    if (esGrupo(v)) yaAsignados.set(v, d.id);
  }

  for (const d of DEPARTAMENTOS) {
    const h = hallazgos[d.id];
    if (!h) continue;
    const actual = process.env[d.chat] || '';
    const nuevo = h.elegido;

    const colision = porGrupo.get(nuevo.id) || [];
    if (colision.length > 1) {
      avisos.push(`${d.etiqueta}: «${nuevo.titulo}» (${nuevo.id}) lo reclaman también ${colision.filter((x) => x !== d.id).join(', ')}.`
        + ' Saca de ese grupo los bots que no sean el suyo. No toco el .env.');
      continue;
    }
    if (h.grupos.length > 1 && !FORZAR) {
      avisos.push(`${d.etiqueta}: su bot está en ${h.grupos.length} grupos `
        + `(${h.grupos.map((g) => `«${g.titulo}»`).join(', ')}). No adivino cuál es el suyo; con --forzar cojo el más reciente.`);
      continue;
    }
    if (actual === nuevo.id) continue;

    const dueno = yaAsignados.get(nuevo.id);
    if (dueno && dueno !== d.id) {
      avisos.push(`${d.etiqueta}: «${nuevo.titulo}» (${nuevo.id}) ya es el grupo de ${dueno}.`
        + ` Su bot está donde no le toca; sácalo de ahí. No toco el .env.`);
      continue;
    }

    if (esGrupo(actual) && !FORZAR) {
      avisos.push(`${d.etiqueta}: ya apuntaba al grupo ${actual} y ahora veo ${nuevo.id} «${nuevo.titulo}».`
        + ' No lo piso sin --forzar.');
      continue;
    }
    cambios.push({ variable: d.chat, valor: nuevo.id, antes: actual || '(vacío)', etiqueta: d.etiqueta, titulo: nuevo.titulo });
  }
  return { cambios, avisos };
}

async function main() {
  if (ESTADO) return estado();
  console.log('\n  Descubrimiento de grupos por departamento\n');

  const activos = [];
  for (const d of DEPARTAMENTOS) {
    const tok = process.env[d.token];
    if (!tok) { console.log(`  ${d.id.padEnd(8)} sin token (${d.token})`); continue; }
    activos.push({ ...d, tok, bot: await nombreBot(tok) });
  }

  console.log('  Crea un grupo por departamento y añade SOLO su bot:\n');
  for (const d of activos) console.log(`    ${d.etiqueta.padEnd(24)} ${d.bot}`);
  console.log(`\n  Luego escribe algo en cada grupo. Escuchando ${MINUTOS} min...\n`);

  const hallazgos = {};
  const hasta = Date.now() + MINUTOS * 60_000;

  while (Date.now() < hasta && Object.keys(hallazgos).length < activos.length) {
    for (const d of activos) {
      if (hallazgos[d.id]) continue;
      const grupos = await buscarGrupos(d.tok);
      if (!grupos.length) continue;
      const elegido = grupos[grupos.length - 1];
      hallazgos[d.id] = { grupos, elegido };
      const extra = grupos.length > 1 ? `  (¡en ${grupos.length} grupos!)` : '';
      console.log(`  ✓ ${d.etiqueta.padEnd(24)} ${elegido.id}  «${elegido.titulo}»${extra}`);
    }
    if (Object.keys(hallazgos).length < activos.length) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  const n = Object.keys(hallazgos).length;
  console.log(`\n  ${n} de ${activos.length} departamentos con grupo.`);

  if (!n) {
    console.log('\n  Ninguno todavía. Recuerda: hay que ESCRIBIR en el grupo,');
    console.log('  no basta con crearlo y añadir el bot.');
    return;
  }

  const { cambios, avisos } = decidir(hallazgos);

  if (avisos.length) {
    console.log('\n  Sin tocar:');
    for (const a of avisos) console.log(`    ⚠ ${a}`);
  }

  if (!cambios.length) {
    console.log('\n  Nada que escribir: el .env ya está como debe, o lo de arriba hay que resolverlo en Telegram.');
    return;
  }

  console.log('\n  A escribir:');
  for (const c of cambios) console.log(`    ${c.variable}: ${c.antes} → ${c.valor}  «${c.titulo}»`);

  if (!ESCRIBIR) {
    console.log('\n  Esto ha sido en seco. Para dejarlo en el .env, repite con --escribir.');
    return;
  }

  const { aplicados, bak } = escribirEnv(cambios);
  const fallidos = cambios.filter((c) => !aplicados.includes(c));
  console.log(`\n  .env: ${aplicados.length} de ${cambios.length} confirmadas releyendo el fichero.`);
  if (bak) console.log(`  Respaldo: ${bak.split('/').pop()}`);
  for (const f of fallidos) console.log(`    ✗ ${f.variable} NO quedó escrita`);
  console.log('\n  Comprobar el reparto:  node scripts/telegram-descubrir-grupos.js --estado');
}

main().catch((e) => { console.error('fallo:', e.message); process.exit(1); });
