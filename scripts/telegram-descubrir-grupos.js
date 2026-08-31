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

/** Busca en las actualizaciones pendientes el grupo más reciente del bot. */
async function buscarGrupo(tok) {
  const up = await api(tok, 'getUpdates', '?limit=100');
  let hallado = null;
  for (const u of up.result || []) {
    const m = u.message || u.channel_post || u.my_chat_member;
    const c = m && m.chat;
    if (c && esGrupo(c.id)) hallado = { id: String(c.id), titulo: c.title || c.type };
  }
  return hallado;
}

function escribirEnv(encontrados) {
  let s = fs.readFileSync(ENV, 'utf8');
  let cambios = 0;
  for (const [variable, valor] of Object.entries(encontrados)) {
    const re = new RegExp(`^${variable}=.*$`, 'm');
    if (re.test(s)) {
      const antes = s;
      s = s.replace(re, `${variable}=${valor}`);
      if (s !== antes) cambios++;
    } else {
      s += `\n${variable}=${valor}`;
      cambios++;
    }
  }
  if (cambios) {
    fs.copyFileSync(ENV, `${ENV}.bak-grupos-${Date.now()}`);
    fs.writeFileSync(ENV, s);
  }
  return cambios;
}

/** Informe del reparto actual: quién va a un grupo y quién sigue en privado. */
async function estado() {
  console.log('\n  Reparto actual por departamento\n');
  let enGrupo = 0; let enPrivado = 0;
  for (const d of DEPARTAMENTOS) {
    const tok = process.env[d.token];
    const chat = process.env[d.chat] || process.env.HITL_TELEGRAM_CHAT_ID || '';
    const bot = tok ? await nombreBot(tok) : '(sin token)';
    let donde;
    if (!chat) { donde = 'SIN DESTINO — el aviso no saldría'; }
    else if (esGrupo(chat)) { donde = `grupo ${chat}`; enGrupo++; }
    else { donde = `privado ${chat} — pendiente de su grupo`; enPrivado++; }
    console.log(`  ${d.etiqueta.padEnd(24)} ${bot.padEnd(30)} ${donde}`);
  }
  console.log(`\n  ${enGrupo} en grupo · ${enPrivado} en chat privado`);
  if (enPrivado) console.log('  Para separarlos: node scripts/telegram-descubrir-grupos.js --escribir');
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

  const encontrados = {};
  const hasta = Date.now() + MINUTOS * 60_000;

  while (Date.now() < hasta && Object.keys(encontrados).length < activos.length) {
    for (const d of activos) {
      if (encontrados[d.chat]) continue;
      const g = await buscarGrupo(d.tok);
      if (g) {
        encontrados[d.chat] = g.id;
        console.log(`  ✓ ${d.etiqueta.padEnd(24)} ${g.id}  «${g.titulo}»`);
      }
    }
    if (Object.keys(encontrados).length < activos.length) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  const n = Object.keys(encontrados).length;
  console.log(`\n  ${n} de ${activos.length} departamentos con grupo.`);

  if (!n) {
    console.log('\n  Ninguno todavía. Recuerda: hay que ESCRIBIR en el grupo,');
    console.log('  no basta con crearlo y añadir el bot.');
    return;
  }

  if (ESCRIBIR) {
    const c = escribirEnv(encontrados);
    console.log(`  .env actualizado (${c} variables). Respaldo junto al fichero.`);
    console.log('\n  Comprobar el reparto:  node scripts/verify-all-bots.js');
  } else {
    console.log('\n  Para dejarlo escrito en el .env, repite con --escribir. Valores:');
    for (const [k, v] of Object.entries(encontrados)) console.log(`    ${k}=${v}`);
  }
}

main().catch((e) => { console.error('fallo:', e.message); process.exit(1); });
