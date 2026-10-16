'use strict';

/**
 * Validación de archivos que se suben para convertirlos en NFT. NO interpreta el contenido: sólo mira la cabecera
 * (firma de bytes) y busca marcas de ejecutables. El archivo nunca se decodifica como texto, nunca se parsea y nunca
 * llega al RAG ni a un modelo.
 *
 * Política: lista BLANCA por firma real (no se fía del Content-Type ni de la extensión que declara el cliente).
 * Permitido: imagen (PNG, JPEG, GIF, WebP), vídeo (MP4/MOV, WebM), audio (MP3, WAV, OGG, FLAC) y PDF.
 * Todo lo demás se rechaza; los ejecutables, scripts, archivos comprimidos y documentos de Office con un motivo explícito.
 */

const MB = 1024 * 1024;
const LIMITES = { image: 10 * MB, audio: 20 * MB, video: 30 * MB, pdf: 10 * MB }; // 30 MB: tope de petición de Cloud Run (32 MB)
const MAX_BYTES = Math.max(...Object.values(LIMITES));

const ascii = (b, from, to) => b.toString('latin1', from, to);
const empieza = (b, ...bytes) => bytes.every((v, i) => b[i] === v);

/** Firmas de lo que NUNCA se acepta, con el motivo que se devuelve al usuario. */
const PROHIBIDOS = [
    ['ejecutable de Windows (PE)', (b) => empieza(b, 0x4d, 0x5a)],
    ['ejecutable de Linux (ELF)', (b) => empieza(b, 0x7f, 0x45, 0x4c, 0x46)],
    ['ejecutable de macOS (Mach-O)', (b) => [[0xfe, 0xed, 0xfa, 0xce], [0xfe, 0xed, 0xfa, 0xcf], [0xce, 0xfa, 0xed, 0xfe], [0xcf, 0xfa, 0xed, 0xfe]].some((s) => empieza(b, ...s))],
    ['clase o binario universal de Java/macOS', (b) => empieza(b, 0xca, 0xfe, 0xba, 0xbe)],
    ['script (#!)', (b) => empieza(b, 0x23, 0x21)],
    ['archivo comprimido o paquete (ZIP/JAR/APK/Office moderno)', (b) => empieza(b, 0x50, 0x4b, 0x03, 0x04) || empieza(b, 0x50, 0x4b, 0x05, 0x06)],
    ['documento de Office antiguo o instalador MSI (OLE)', (b) => empieza(b, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)],
    ['archivo comprimido (RAR/7z/CAB/gzip/bzip2/xz)', (b) => ascii(b, 0, 4) === 'Rar!' || empieza(b, 0x37, 0x7a, 0xbc, 0xaf) || ascii(b, 0, 4) === 'MSCF' || empieza(b, 0x1f, 0x8b) || ascii(b, 0, 3) === 'BZh' || empieza(b, 0xfd, 0x37, 0x7a, 0x58, 0x5a)],
    ['imagen de disco o paquete de instalación (ISO/DMG/DEB/RPM)', (b) => ascii(b, 0x8001, 0x8006) === 'CD001' || ascii(b, 0, 7) === '!<arch>' || empieza(b, 0xed, 0xab, 0xee, 0xdb)],
    ['texto con código (HTML, script o PHP)', (b) => /<\s*(?:script|html|\?php|svg|iframe)\b/i.test(ascii(b, 0, 1024)) || /^\s*(?:#!|@echo\s+off|powershell\b)/i.test(ascii(b, 0, 64))],
];

// Un ejecutable de Windows pegado detrás de una cabecera válida (políglota).
const STUB_PE = 'This program cannot be run in DOS mode';

/** Tipos permitidos por firma: devuelve { kind, mimes } o null. */
function detectar(b) {
    if (b.length < 12) return null;
    if (empieza(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { kind: 'image', mimes: ['image/png'] };
    if (empieza(b, 0xff, 0xd8, 0xff)) return { kind: 'image', mimes: ['image/jpeg'] };
    if (['GIF87a', 'GIF89a'].includes(ascii(b, 0, 6))) return { kind: 'image', mimes: ['image/gif'] };
    if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { kind: 'image', mimes: ['image/webp'] };
    if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { kind: 'audio', mimes: ['audio/wav', 'audio/x-wav', 'audio/wave'] };
    if (ascii(b, 4, 8) === 'ftyp') return { kind: 'video', mimes: ['video/mp4', 'video/quicktime'] };
    if (empieza(b, 0x1a, 0x45, 0xdf, 0xa3)) return { kind: 'video', mimes: ['video/webm', 'audio/webm'] };
    if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { kind: 'audio', mimes: ['audio/mpeg', 'audio/mp3'] };
    if (ascii(b, 0, 4) === 'OggS') return { kind: 'audio', mimes: ['audio/ogg'] };
    if (ascii(b, 0, 4) === 'fLaC') return { kind: 'audio', mimes: ['audio/flac'] };
    if (ascii(b, 0, 1024).includes('%PDF-')) return { kind: 'pdf', mimes: ['application/pdf'] };
    return null;
}

/** Marcas de contenido activo en un PDF (búsqueda de bytes; el PDF no se abre ni se interpreta). */
const PDF_ACTIVO = /\/(?:JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA|SubmitForm|ImportData)\b/;

const error = (status, code, message) => Object.assign(new Error(message), { status, code });

/**
 * @param {Buffer} buffer
 * @param {string} mimeDeclarado Content-Type que envía el cliente (se contrasta con la firma real)
 * @returns {{ kind: 'image'|'video'|'audio'|'pdf', mime: string, size: number }}
 */
function inspeccionarArchivo(buffer, mimeDeclarado) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw error(400, 'EMPTY_FILE', 'El archivo está vacío.');
    if (buffer.length > MAX_BYTES) throw error(413, 'TOO_LARGE', `El archivo supera el máximo permitido (${MAX_BYTES / MB} MB).`);

    for (const [motivo, test] of PROHIBIDOS) {
        if (test(buffer)) throw error(415, 'FORBIDDEN_TYPE', `Tipo de archivo prohibido: ${motivo}. Sólo se aceptan imágenes, vídeo, audio y PDF.`);
    }
    const tipo = detectar(buffer);
    if (!tipo) throw error(415, 'UNSUPPORTED_TYPE', 'Formato no soportado. Sólo se aceptan imágenes (PNG, JPEG, GIF, WebP), vídeo (MP4, MOV, WebM), audio (MP3, WAV, OGG, FLAC) y PDF.');

    const declarado = String(mimeDeclarado || '').split(';')[0].trim().toLowerCase();
    if (!tipo.mimes.includes(declarado)) throw error(415, 'MIME_MISMATCH', 'El tipo declarado no coincide con el contenido real del archivo.');

    if (buffer.length > LIMITES[tipo.kind]) throw error(413, 'TOO_LARGE', `Un archivo de tipo ${tipo.kind} no puede superar ${LIMITES[tipo.kind] / MB} MB.`);

    const texto = buffer.toString('latin1');
    if (texto.includes(STUB_PE)) throw error(415, 'FORBIDDEN_TYPE', 'El archivo contiene un ejecutable incrustado.');
    if (tipo.kind === 'pdf' && PDF_ACTIVO.test(texto)) throw error(415, 'ACTIVE_CONTENT', 'El PDF contiene contenido activo (JavaScript, lanzadores o archivos adjuntos).');

    return { kind: tipo.kind, mime: declarado, size: buffer.length };
}

/** Nombre sólo para la etiqueta del pin: sin rutas ni caracteres raros, y sin extensiones ejecutables. */
function nombreSeguro(raw) {
    const base = String(raw || 'archivo').split(/[\\/]/).pop().normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^\.+/, '').slice(0, 80);
    return base || 'archivo';
}

const MIMES_PERMITIDOS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'audio/webm',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/flac', 'application/pdf'];

module.exports = { inspeccionarArchivo, nombreSeguro, MIMES_PERMITIDOS, MAX_BYTES, LIMITES };
