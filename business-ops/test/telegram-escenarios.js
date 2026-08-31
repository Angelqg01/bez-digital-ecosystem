'use strict';

/**
 * Batería de escenarios de aviso por Telegram.
 *
 *   node test/telegram-escenarios.js          → ensayo: imprime qué saldría
 *   node test/telegram-escenarios.js --enviar → envía de verdad
 *
 * Dos clases de aviso, que es la distinción que importa:
 *
 *   RESPONDER  el trabajo está DETENIDO esperando a un humano. Nada se ejecuta
 *              hasta que alguien decide. Son las líneas rojas: mover dinero o
 *              cripto, firmar, contratar, tocar un contrato, escribir en frío.
 *
 *   INFORMAR   ya está hecho. El aviso existe para que se sepa, no para pedir
 *              permiso. Si nadie lo lee, no se rompe nada.
 *
 * Destinos: los cinco `TELEGRAM_CHAT_*` del .env de la raíz, con
 * `HITL_TELEGRAM_CHAT_ID` de reserva. Hoy los seis bots escriben al mismo chat;
 * el día que cada departamento tenga su grupo, se cambia el suyo y ya.
 *
 * Si algún chat quedara vacío, ese aviso se construye pero NO sale: la
 * aprobación se queda esperando en el panel, que es lo correcto. Un bot no
 * puede escribir a quien no ha iniciado la conversación, así que un chat nuevo
 * exige que alguien escriba antes al bot.
 */

require('dotenv').config({ quiet: true });
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env'), quiet: true });

const HitlNotifier = require('../src/platform/HitlNotifier');

const ENVIAR = process.argv.includes('--enviar');

// ── Escenarios ──────────────────────────────────────────────────────────────

const RESPONDER = [
  {
    dep: 'treasury', bot: 'CFO',
    titulo: 'Dispersión de BEZ-Coin a contribuidores',
    lineas: [
      'Importe: 45.000 BEZ (~$4.500)',
      'Destino: 12 wallets de contribuidores del Q3',
      'Origen: Treasury DAO · Polygon',
      'Línea roja: crypto_asset_movement — NO se ejecuta sin aprobación',
    ],
  },
  {
    dep: 'legal', bot: 'Legal',
    titulo: 'Contrato de integración listo para firma',
    lineas: [
      'Contraparte: operador logístico (piloto de 21 días)',
      'Cláusulas señaladas: 3 (responsabilidad, resolución, RGPD art. 28)',
      'Línea roja: legal_commitment — firmar compromete a la empresa',
    ],
  },
  {
    dep: 'blockchain', bot: 'DevOps',
    titulo: 'Pausa de emergencia en QualityEscrow',
    lineas: [
      'Motivo: patrón anómalo en liberaciones (7 en 4 min)',
      'Acción propuesta: pause() sobre el contrato',
      'Línea roja: smart_contract_change — requiere multisig',
    ],
  },
  {
    dep: 'sales', bot: 'CEO',
    titulo: 'Primer contacto en frío pendiente de visto bueno',
    lineas: [
      'Destinatario: dirección de operaciones de una naviera',
      'Ángulo: validación de entregas, sin jerga cripto',
      'Línea roja: cold_outbound — todo primer contacto se aprueba antes',
    ],
  },
  {
    dep: 'finance', bot: 'CFO',
    titulo: 'Descuento por encima del umbral',
    lineas: [
      'Propuesta: 28% sobre el plan Enterprise',
      'Umbral aprobado: 20%',
      'Línea roja: pricing_concession — compromete margen',
    ],
  },
];

const INFORMAR = [
  {
    dep: 'blockchain', bot: 'DevOps',
    titulo: 'Vigilancia on-chain — sin novedad',
    lineas: ['Validadores activos: 0/0', 'Gas: 1,00 gwei', 'Tesorería accesible', 'Próxima ronda en 30 min'],
  },
  {
    dep: 'treasury', bot: 'CFO',
    titulo: 'Runway recalculado',
    lineas: ['Balance: $41.200', 'Gasto mensual: $19.600', 'Runway: 2,1 meses', 'Umbral crítico: 3 meses — POR DEBAJO'],
  },
  {
    dep: 'marketing', bot: 'CMO',
    titulo: 'Publicaciones programadas emitidas',
    lineas: ['3 piezas publicadas con aprobación vigente', '1 congelada: el freno de marketing está puesto'],
  },
  {
    dep: 'operations', bot: 'DevOps',
    titulo: 'Playbooks destilados',
    lineas: ['6 agentes han actualizado su playbook', 'Autonomía media: 71% (+4 pts respecto a ayer)'],
  },
  {
    dep: 'finance', bot: 'CFO',
    titulo: 'Digest ejecutivo generado',
    lineas: ['Leads puntuados: 0', 'Aprobaciones pendientes: 5', 'Sin incidencias de cobro'],
  },
];

// ── Ejecución ───────────────────────────────────────────────────────────────

async function main() {
  const enviados = [];
  const notifier = HitlNotifier.fromEnv(process.env);

  // En ensayo se sustituye el emisor por uno que captura; en real se deja el suyo.
  if (!ENVIAR) {
    for (const r of Object.values(notifier.routes || {})) {
      const bot = r.token;
      r.send = async (p = {}) => { enviados.push({ bot, chatId: p.to, texto: p.text }); };
      r.chatId = r.chatId || '<CHAT_ID_PENDIENTE>';
    }
    if (notifier.fallback) {
      notifier.fallback.send = async (p = {}) => { enviados.push({ bot: 'fallback', chatId: p.to, texto: p.text }); };
      notifier.fallback.chatId = notifier.fallback.chatId || '<CHAT_ID_PENDIENTE>';
    }
  }

  const marca = (clase, e) =>
    (clase === 'RESPONDER' ? '🛑 REQUIERE TU RESPUESTA' : 'ℹ️ SOLO INFORMATIVO') + `\n${e.titulo}`;

  let ok = 0; let fallo = 0;
  for (const [clase, lista] of [['RESPONDER', RESPONDER], ['INFORMAR', INFORMAR]]) {
    console.log(`\n${'═'.repeat(66)}\n  ${clase}  (${lista.length})\n${'═'.repeat(66)}`);
    for (const e of lista) {
      try {
        await notifier.alert({
          tenantId: 'bezhas',
          department: e.dep,
          title: marca(clase, e),
          lines: e.lineas,
        });
        ok++;
        console.log(`  ✓ ${e.bot.padEnd(7)} ${e.dep.padEnd(11)} ${e.titulo}`);
      } catch (err) {
        fallo++;
        console.log(`  ✗ ${e.bot.padEnd(7)} ${e.dep.padEnd(11)} ${e.titulo}  → ${err.message}`);
      }
    }
  }

  console.log(`\n${'─'.repeat(66)}`);
  if (ENVIAR) {
    console.log(`  ENVÍO REAL · ${ok} entregados · ${fallo} fallidos`);
  } else {
    console.log(`  ENSAYO · ${enviados.length} avisos construidos, ninguno enviado`);
    const sinDestino = enviados.filter((e) => String(e.chatId).includes('PENDIENTE')).length;
    if (sinDestino) {
      console.log(`\n  ${sinDestino} sin destinatario. Para enviar de verdad:`);
      console.log('   1) Abre cada bot en Telegram y pulsa Start (un bot no puede escribir primero).');
      console.log('   2) Recoge su chat id:  curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates"');
      console.log('   3) Declara TELEGRAM_CHAT_CFO / _DEVOPS / _LEGAL / _CMO / _CEO (o HITL_TELEGRAM_CHAT_ID).');
      console.log('   4) node test/telegram-escenarios.js --enviar');
    }
    console.log('\n  Muestra del primer aviso de cada clase:');
    for (const i of [0, RESPONDER.length]) {
      if (enviados[i]) console.log('\n' + enviados[i].texto.split('\n').map((l) => '    │ ' + l).join('\n'));
    }
  }
}

main().catch((err) => { console.error('fallo:', err.message); process.exit(1); });
