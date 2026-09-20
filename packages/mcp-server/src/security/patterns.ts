/**
 * BeZhas Watchdog — catálogos de patrones
 *
 * Todo lo que entra o sale del MCP se contrasta contra estos catálogos.
 * Son deterministas a propósito: el vigilante no puede depender de un modelo
 * para decidir si algo es un ataque, porque el modelo es justo lo que se
 * intenta manipular.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface Pattern {
    id: string;
    severity: Severity;
    description: string;
    regex: RegExp;
}

/**
 * Inyección de prompt: texto que intenta que el modelo ignore sus
 * instrucciones, cambie de rol o ejecute órdenes incrustadas en datos.
 *
 * Estos patrones se aplican a CONTENIDO (parámetros de entrada y respuestas de
 * herramientas), nunca a las instrucciones legítimas del sistema.
 */
export const INJECTION_PATTERNS: Pattern[] = [
    {
        id: 'INJ_IGNORE_INSTRUCTIONS',
        severity: 'critical',
        description: 'Intento de anular las instrucciones previas',
        regex: /\b(ignor[ae]|olvida|descarta|disregard|forget|override)\b[^.\n]{0,40}\b(instruc\w*|prompt|reglas?|rules?|system|sistema|anterior\w*|previous|above)\b/i,
    },
    {
        id: 'INJ_ROLE_OVERRIDE',
        severity: 'critical',
        description: 'Intento de reasignar el rol o el modo del agente',
        regex: /\b(you are now|act as|actúa como|a partir de ahora eres|from now on you are|new instructions?|nuevas instrucciones|developer mode|modo desarrollador|jailbreak|DAN mode)\b/i,
    },
    {
        id: 'INJ_SYSTEM_IMPERSONATION',
        severity: 'critical',
        description: 'Texto que se hace pasar por mensaje de sistema o del operador',
        regex: /(\[\s*(system|assistant|developer)\s*\]|<\s*\/?\s*(system|assistant|im_start|im_end)\s*>|^\s*(system|sistema)\s*:)/im,
    },
    {
        id: 'INJ_EXFILTRATE_SECRETS',
        severity: 'critical',
        description: 'Petición de revelar credenciales, claves o variables de entorno',
        regex: /\b(reveal|show|print|dump|envía|manda|send|leak|exfiltra\w*|muestra|dime)\b[^.\n]{0,60}\b(api[_\s-]?key|secret|token|password|contraseña|private[_\s-]?key|clave privada|seed|mnemonic|env|environment|\.env|credential\w*|credencial\w*)\b/i,
    },
    {
        id: 'INJ_TOOL_COERCION',
        severity: 'high',
        description: 'Instrucción incrustada para invocar herramientas o transferir fondos',
        regex: /\b(call|invoke|ejecuta|llama a|usa la herramienta|use the tool|transfer|transfiere|withdraw|retira|refund|reembolsa|payout)\b[^.\n]{0,60}\b(tool|herramienta|all funds|todos los fondos|balance|wallet|saldo|stripe|treasury|tesorería)\b/i,
    },
    {
        id: 'INJ_HIDDEN_CHANNEL',
        severity: 'high',
        description: 'Texto oculto mediante caracteres invisibles o de control de dirección',
        // El patrón ES la lista de caracteres bidireccionales e invisibles que
        // busca: para detectarlos hay que nombrarlos. Quitarlos desactivaría
        // INJ_HIDDEN_CHANNEL, que es la defensa contra Trojan Source.
        // eslint-disable-next-line security/detect-bidi-characters
        regex: /[​-‏‪-‮⁠-⁯﻿]/,
    },
    {
        id: 'INJ_DATA_URI_PAYLOAD',
        severity: 'medium',
        description: 'Carga embebida en data URI o base64 extenso',
        regex: /data:(?:text|application)\/[\w.+-]+;base64,[A-Za-z0-9+/=]{120,}/i,
    },
    {
        id: 'INJ_PROMPT_DELIMITER',
        severity: 'medium',
        description: 'Delimitadores usados para simular el fin del contexto',
        regex: /(-{3,}\s*(end|fin)\s+of\s+(prompt|context|instructions)\s*-{3,}|```\s*system)/i,
    },
    {
        id: 'INJ_URL_EXFIL',
        severity: 'high',
        description: 'URL que parece destinada a sacar datos fuera del ecosistema',
        regex: /https?:\/\/[^\s"']*[?&](?:q|data|payload|token|key|secret|body)=[^\s"'&]{16,}/i,
    },
];

/**
 * Secretos: si alguno de estos aparece en una respuesta, el dato ya está
 * fuera de su sitio. Se redacta siempre, y se bloquea si la severidad es
 * crítica.
 */
export const SECRET_PATTERNS: Pattern[] = [
    {
        id: 'SEC_STRIPE_LIVE',
        severity: 'critical',
        description: 'Clave secreta o restringida de Stripe en producción',
        regex: /\b(sk|rk)_live_[A-Za-z0-9]{16,}/g,
    },
    {
        id: 'SEC_STRIPE_TEST',
        severity: 'high',
        description: 'Clave secreta de Stripe de pruebas',
        regex: /\b(sk|rk)_test_[A-Za-z0-9]{16,}/g,
    },
    {
        id: 'SEC_STRIPE_WEBHOOK',
        severity: 'critical',
        description: 'Secreto de firma de webhook de Stripe',
        regex: /\bwhsec_[A-Za-z0-9]{16,}/g,
    },
    {
        id: 'SEC_PRIVATE_KEY_HEX',
        severity: 'critical',
        description: 'Clave privada EVM en hexadecimal',
        regex: /\b0x[a-fA-F0-9]{64}\b/g,
    },
    {
        id: 'SEC_PEM_BLOCK',
        severity: 'critical',
        description: 'Bloque PEM de clave privada',
        regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g,
    },
    {
        id: 'SEC_MNEMONIC',
        severity: 'critical',
        description: 'Frase semilla BIP-39 (12 o más palabras seguidas en minúscula)',
        // Medido sobre el tope de 200 000 caracteres que aplica el propio
        // escáner: el peor caso construido tarda 0,7 ms. `safe-regex` marca la
        // forma del patrón, no su coste real; aquí el coste está acotado.
        // eslint-disable-next-line security/detect-unsafe-regex
        regex: /\b(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/g,
    },
    {
        id: 'SEC_BEZHAS_API_KEY',
        severity: 'critical',
        description: 'API Key de BeZhas',
        regex: /\bbzh_(?:live|dev|pro|ent|test)_[A-Za-z0-9]{8,}/g,
    },
    {
        id: 'SEC_JWT',
        severity: 'high',
        description: 'JSON Web Token',
        regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    },
    {
        id: 'SEC_GITHUB_TOKEN',
        severity: 'critical',
        description: 'Token de GitHub',
        regex: /\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}/g,
    },
    {
        id: 'SEC_AWS_KEY',
        severity: 'critical',
        description: 'Access Key de AWS',
        regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    },
    {
        id: 'SEC_OPENAI_ANTHROPIC',
        severity: 'critical',
        description: 'Clave de proveedor de modelos',
        regex: /\b(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{32,})/g,
    },
    {
        id: 'SEC_MONGODB_URI',
        severity: 'high',
        description: 'Cadena de conexión con credenciales embebidas',
        regex: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s:@/]+:[^\s:@/]+@/g,
    },
];

/** Nombres de variable cuyo valor nunca debe salir del servidor. */
export const FORBIDDEN_ENV_KEYS = [
    'RELAYER_PRIVATE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'JWT_SECRET',
    'MONGODB_URI',
    'ADMIN_TOKEN',
    'GITHUB_TOKEN',
    'FIRECRAWL_API_KEY',
    'TALLY_API_KEY',
    'ALPACA_API_KEY',
    'ALPACA_SECRET_KEY',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
] as const;

export const SEVERITY_RANK: Record<Severity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
};
