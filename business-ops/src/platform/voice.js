'use strict';

/**
 * Voz de OPERANT para Telegram, sin coste por uso.
 *
 *  · Hablar: Edge TTS (msedge-tts) → MP3, que Telegram acepta como nota de voz.
 *  · Escuchar: un servidor Whisper con API compatible con OpenAI
 *    (POST {WHISPER_URL}/v1/audio/transcriptions). Sin WHISPER_URL no se
 *    transcribe: el canal avisa en texto en vez de fingir que entendió.
 *
 * Todo se inyecta desde fuera (superadmin.js lo recibe como `voice`), así los
 * tests no tocan la red.
 */

const DEFAULT_VOICE = 'es-ES-AlvaroNeural';
const MAX_SPEECH_CHARS = 900; // una nota de voz larga no se escucha: se recorta

async function synthesize(text, { voice = process.env.VOICE_NAME || DEFAULT_VOICE } = {}) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const clean = String(text || '').replace(/[📋•·]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_SPEECH_CHARS);
  if (!clean) throw new Error('voz: texto vacío');
  const r = tts.toStream(clean);
  const stream = r.audioStream || r;
  const chunks = [];
  await new Promise((resolve, reject) => {
    stream.on('data', (d) => chunks.push(d));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return Buffer.concat(chunks);
}

/** Transcribe con un servidor Whisper compatible con OpenAI. null si no está configurado. */
async function transcribe(buffer, { url = process.env.WHISPER_URL, filename = 'nota.ogg', language = 'es' } = {}) {
  if (!url) return null;
  const form = new FormData();
  form.append('file', new Blob([buffer]), filename);
  form.append('model', process.env.WHISPER_MODEL || 'small');
  form.append('language', language);
  const r = await fetch(`${url.replace(/\/$/, '')}/v1/audio/transcriptions`, { method: 'POST', body: form });
  if (!r.ok) throw new Error(`whisper ${r.status}`);
  const j = await r.json();
  return String(j.text || '').trim();
}

/** Descarga un archivo de Telegram (nota de voz) con el token del bot. */
async function downloadTelegramFile(token, fileId) {
  const info = await (await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`)).json();
  if (!info.ok) throw new Error(`telegram getFile: ${info.description || 'error'}`);
  const r = await fetch(`https://api.telegram.org/file/bot${token}/${info.result.file_path}`);
  if (!r.ok) throw new Error(`telegram file ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Sender de notas de voz: async ({ to, audio, caption }) => { sent }. Sin token → simulado. */
function telegramVoiceSender(token) {
  if (!token) return async ({ to }) => { console.log(`[telegram:voz] (simulado) → ${to}`); return { sent: true, simulated: true }; };
  return async ({ to, audio, caption }) => {
    const form = new FormData();
    form.append('chat_id', String(to));
    form.append('voice', new Blob([audio], { type: 'audio/mpeg' }), 'direccion.mp3');
    if (caption) form.append('caption', caption);
    const r = await fetch(`https://api.telegram.org/bot${token}/sendVoice`, { method: 'POST', body: form });
    if (!r.ok) throw new Error(`telegram sendVoice ${r.status}`);
    return { sent: true };
  };
}

/** Paquete de voz para el canal del SuperAdmin según el entorno. */
function fromEnv(env = process.env) {
  const token = env.TELEGRAM_CEO_BOT_TOKEN || env.TELEGRAM_TOKEN_DIRECTOR || null;
  return {
    repliesEnabled: env.VOICE_REPLIES === 'true',
    canTranscribe: Boolean(env.WHISPER_URL),
    synthesize: (text) => synthesize(text),
    transcribe: (buf) => transcribe(buf, { url: env.WHISPER_URL }),
    download: (fileId) => downloadTelegramFile(token, fileId),
    sendVoice: telegramVoiceSender(token),
  };
}

module.exports = { synthesize, transcribe, downloadTelegramFile, telegramVoiceSender, fromEnv, DEFAULT_VOICE };
