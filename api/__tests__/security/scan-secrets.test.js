/**
 * scripts/security/scan-secrets.cjs es la puerta «sin secretos» del CI y de `audit:production`.
 * Se ejecuta aquí sobre un repositorio git desechable para comprobar QUÉ bloquea y qué no:
 * un secreto en un fichero versionable falla; el mismo secreto en un .env ignorado por git sólo avisa
 * (no está en el repositorio, pero sigue siendo una clave real en el disco).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.resolve(__dirname, '..', '..', '..', 'scripts', 'security', 'scan-secrets.cjs');
const CLAVE = 'sk-proj-Q9wLm2Zx8Vb4Nk7Rt1Yh6Gf3Dc5Ps0Ja';
let raiz;

const escribir = (rel, txt) => { const f = path.join(raiz, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, txt); };
function escanear() {
    const r = spawnSync(process.execPath, [path.join(raiz, 'scripts', 'security', 'scan-secrets.cjs'), '--json'], { cwd: raiz, encoding: 'utf8' });
    return { status: r.status, ...JSON.parse(r.stdout) };
}

beforeEach(() => {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
    fs.mkdirSync(path.join(raiz, 'scripts', 'security'), { recursive: true });
    fs.copyFileSync(SCRIPT, path.join(raiz, 'scripts', 'security', 'scan-secrets.cjs'));
    spawnSync('git', ['init', '-q'], { cwd: raiz });
    escribir('.gitignore', '.env\n.env.*\n');
});
afterEach(() => fs.rmSync(raiz, { recursive: true, force: true }));

test('un secreto en un fichero versionable hace fallar el escaneo', () => {
    escribir('src/config.js', `const k = "${CLAVE}";\n`);
    const r = escanear();
    expect(r.status).toBe(1);
    expect(r.findings.map((f) => f.file)).toEqual(['src/config.js']);
});

test('el mismo secreto en un .env ignorado por git sólo avisa', () => {
    escribir('.env', `OPENAI_KEY=${CLAVE}\n`);
    escribir('.env.amoy', 'PRIVATE_KEY=0x' + 'ab'.repeat(32) + '\n');
    const r = escanear();
    expect(r.status).toBe(0);
    expect(r.findings).toEqual([]);
    expect(r.locales.map((f) => f.file).sort()).toEqual(['.env', '.env.amoy']);
});

test('un .env NO ignorado sí falla (es lo que acabaría en un commit)', () => {
    fs.writeFileSync(path.join(raiz, '.gitignore'), '');
    escribir('.env', `OPENAI_KEY=${CLAVE}\n`);
    expect(escanear().status).toBe(1);
});

test('no escanea los worktrees de agentes (.claude/)', () => {
    escribir('.claude/worktrees/x/src/a.js', `const k = "${CLAVE}";\n`);
    expect(escanear()).toMatchObject({ status: 0, findings: [], locales: [] });
});

test('falsos positivos conocidos: clave pública de Anvil, ruta, expansión de shell y llamada a función', () => {
    escribir('a.sh', 'PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d\n');
    escribir('b.md', 'INTERNAL_API_KEY=~/bezhas-blockchain.env\n');
    escribir('c.sh', 'JWT_SECRET="video-demo-secret-$(head -c12 /dev/urandom)xxxxxxxxxx"\n');
    escribir('d.js', 'const JWT_SECRET = resolveChatJwtSecretFromEnvironment();\n');
    expect(escanear()).toMatchObject({ status: 0, findings: [] });
});
