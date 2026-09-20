/**
 * Reglas de seguridad para todo el repositorio.
 *
 * Esta configuración vive aquí, y no dentro del workflow, para que lo que
 * comprueba la CI sea exactamente lo que puede ejecutar cualquiera en local:
 *
 *   pnpm dlx eslint --no-config-lookup --config eslint.security.config.mjs <rutas>
 *
 * ─── Qué bloquea y qué no ────────────────────────────────────────────────
 *
 * BLOQUEAN las reglas que, cuando disparan, casi siempre señalan algo real:
 * inyección en el DOM, `child_process`, `require` dinámico, `eval`, aleatorio
 * no criptográfico, expresiones regulares con retroceso exponencial y
 * caracteres bidireccionales (el vector de «Trojan Source»).
 *
 * NO BLOQUEAN, pero se cuentan y se informan, `detect-object-injection` y
 * `detect-non-literal-fs-filename`: disparan en cualquier `obj[clave]` o
 * `fs.readFile(ruta)` y, medidas sobre este repositorio, dan 333 y 49 avisos
 * respectivamente. Convertirlas en bloqueantes no añadiría seguridad: taparía
 * las doce que sí importan bajo cuatrocientas que no.
 */
import { createRequire } from 'node:module';

// Los complementos se resuelven desde `tools/security-lint`, no desde la raíz.
//
// Poner ESLint 9 entre las dependencias de la raíz rompe `next lint`: cambia
// la resolución de `eslint-config-next` y `eslint-plugin-import` deja de ser
// alcanzable. Comprobado guardando el cambio y volviendo a lanzar el lint.
// Con la cadena aislada en su propio paquete, cada uno conserva su versión
// —la raíz ninguna, los frontales ESLint 8, esta configuración ESLint 9— y
// este fichero se queda en la raíz para que los patrones `files` de abajo
// sigan siendo relativos al repositorio.
const requerir = createRequire(new URL('./tools/security-lint/package.json', import.meta.url));

const security = requerir('eslint-plugin-security');
const noUnsanitized = requerir('eslint-plugin-no-unsanitized');
const tsParser = requerir('@typescript-eslint/parser');

const BLOQUEANTES = {
    'no-unsanitized/method': 'error',
    'no-unsanitized/property': 'error',
    'security/detect-child-process': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-pseudoRandomBytes': 'error',
    'security/detect-unsafe-regex': 'error',
    'security/detect-bidi-characters': 'error',
    'security/detect-new-buffer': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
};

const INFORMATIVAS = {
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-fs-filename': 'warn',
};

const REGLAS = { ...BLOQUEANTES, ...INFORMATIVAS };
const PLUGINS = { security, 'no-unsanitized': noUnsanitized };

// Los `eslint-disable` que haya en el código apuntan a reglas de las
// configuraciones normales, no a estas. Sin esto, cada uno de ellos sale
// como «directiva sin usar» y ahoga el informe.
const OPCIONES = { linterOptions: { reportUnusedDisableDirectives: 'off' } };

export default [
    {
        ...OPCIONES,
        files: ['**/*.{ts,tsx,mts}'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2023,
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: PLUGINS,
        rules: REGLAS,
    },
    {
        // El backend es CommonJS.
        ...OPCIONES,
        files: ['backend/**/*.js', 'deployed-backend/**/*.js', 'api/**/*.js', 'scripts/**/*.js', '**/*.cjs'],
        languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs' },
        plugins: PLUGINS,
        rules: REGLAS,
    },
    {
        // Los frontales son módulos ES.
        ...OPCIONES,
        files: ['frontend/**/*.{js,jsx}', 'frontend-next/**/*.{js,jsx}', 'sdk/**/*.js', '**/*.mjs'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'module',
            parserOptions: { ecmaFeatures: { jsx: true } },
        },
        plugins: PLUGINS,
        rules: REGLAS,
    },
];
