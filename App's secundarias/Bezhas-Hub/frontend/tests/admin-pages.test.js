/**
 * 🧪 Admin Pages E2E Tests
 * 
 * Tests para verificar que las páginas de administración cargan correctamente.
 * 
 * Ejecución:
 *   node frontend/tests/admin-pages.test.js
 * 
 * Requisitos:
 *   - Frontend corriendo en http://localhost:5173
 *   - Backend corriendo en http://localhost:3001
 */

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3001';

// Páginas a testear
const ADMIN_PAGES = [
    {
        path: '/admin',
        name: 'Admin Dashboard',
        expectedContent: ['dashboard', 'admin'],
        description: 'Panel principal de administración'
    },
    {
        path: '/admin/ai',
        name: 'Centro de IA',
        expectedContent: ['ia', 'inteligencia', 'ai'],
        description: 'Centro de Inteligencia Artificial con 8 tabs'
    },
    {
        path: '/admin/users-management',
        name: 'Gestión de Usuarios',
        expectedContent: ['usuario', 'user', 'gestión'],
        description: 'Administración de usuarios del sistema'
    },
    {
        path: '/admin/content',
        name: 'Gestión de Contenido',
        expectedContent: ['contenido', 'content', 'posts'],
        description: 'Moderación y gestión de contenido'
    },
    {
        path: '/admin/ads',
        name: 'Centro de Anuncios',
        expectedContent: ['anuncio', 'ads', 'campaña', 'campaign'],
        description: 'Gestión de publicidad y campañas'
    }
];

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
    warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
    header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`)
};

// Resultados
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    details: []
};

/**
 * Verifica si un servidor está disponible
 */
async function checkServer(url, name) {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
            signal: controller.signal,
            method: 'HEAD'
        });
        clearTimeout(timeout);

        return response.ok || response.status < 500;
    } catch (error) {
        return false;
    }
}

/**
 * Testa una página específica
 */
async function testPage(page) {
    const url = `${FRONTEND_URL}${page.path}`;
    const startTime = Date.now();

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        const elapsed = Date.now() - startTime;
        const html = await response.text();

        // Verificaciones
        const checks = {
            statusOk: response.ok,
            hasHtml: html.includes('<!DOCTYPE html>') || html.includes('<html'),
            hasReactRoot: html.includes('id="root"') || html.includes('id="app"'),
            noServerError: !html.includes('Internal Server Error') && !html.includes('500'),
            hasViteScripts: html.includes('/@vite/') || html.includes('src/main.jsx'),
            responseTime: elapsed < 5000
        };

        const allPassed = Object.values(checks).every(v => v);

        const result = {
            page: page.name,
            path: page.path,
            status: response.status,
            elapsed: `${elapsed}ms`,
            passed: allPassed,
            checks
        };

        results.details.push(result);

        if (allPassed) {
            results.passed++;
            log.success(`${page.name} (${page.path}) - ${response.status} - ${elapsed}ms`);
        } else {
            results.failed++;
            log.error(`${page.name} (${page.path}) - ${response.status} - ${elapsed}ms`);
            Object.entries(checks).forEach(([check, passed]) => {
                if (!passed) {
                    log.warn(`  └─ ${check}: FAILED`);
                }
            });
        }

        return allPassed;

    } catch (error) {
        const elapsed = Date.now() - startTime;
        results.failed++;

        const result = {
            page: page.name,
            path: page.path,
            status: 'ERROR',
            elapsed: `${elapsed}ms`,
            passed: false,
            error: error.message
        };

        results.details.push(result);
        log.error(`${page.name} (${page.path}) - ERROR: ${error.message}`);

        return false;
    }
}

/**
 * Testa el API del backend
 */
async function testBackendAPI() {
    log.header('📡 Testing Backend API');

    const endpoints = [
        { path: '/api/health', name: 'Health Check' },
        { path: '/api/admin/v1/stats', name: 'Admin Stats', requiresAuth: true }
    ];

    for (const endpoint of endpoints) {
        const url = `${BACKEND_URL}${endpoint.path}`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: endpoint.requiresAuth ? {} : {}
            });

            if (response.ok || response.status === 401) {
                log.success(`${endpoint.name} - ${response.status}`);
            } else {
                log.warn(`${endpoint.name} - ${response.status}`);
            }
        } catch (error) {
            log.error(`${endpoint.name} - ${error.message}`);
        }
    }
}

/**
 * Test adicional: Verifica tabs del Centro de IA
 */
async function testAITabs() {
    log.header('🧠 Testing Centro de IA Tabs');

    const tabs = [
        'overview',
        'diagnostic',
        'chat-config',
        'features',
        'agents',
        'models',
        'tools',
        'analytics'
    ];

    for (const tab of tabs) {
        const url = `${FRONTEND_URL}/admin/ai?tab=${tab}`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                log.success(`Tab: ${tab} - OK`);
            } else {
                log.error(`Tab: ${tab} - ${response.status}`);
            }
        } catch (error) {
            log.error(`Tab: ${tab} - ${error.message}`);
        }
    }
}

/**
 * Test adicional: Verifica tabs del Admin Dashboard
 */
async function testAdminTabs() {
    log.header('📊 Testing Admin Dashboard Tabs');

    const tabs = [
        'dashboard',
        'treasury',
        'dao',
        'permissions',
        'roles'
    ];

    for (const tab of tabs) {
        const url = `${FRONTEND_URL}/admin?tab=${tab}`;
        try {
            const response = await fetch(url);
            if (response.ok) {
                log.success(`Tab: ${tab} - OK`);
            } else {
                log.error(`Tab: ${tab} - ${response.status}`);
            }
        } catch (error) {
            log.error(`Tab: ${tab} - ${error.message}`);
        }
    }
}

/**
 * Genera reporte final
 */
function generateReport() {
    log.header('📋 REPORTE FINAL');

    console.log(`
┌────────────────────────────────────────────────────┐
│                  RESULTADOS                        │
├────────────────────────────────────────────────────┤
│  ✓ Passed:  ${String(results.passed).padStart(3)}                                  │
│  ✗ Failed:  ${String(results.failed).padStart(3)}                                  │
│  ⊘ Skipped: ${String(results.skipped).padStart(3)}                                  │
├────────────────────────────────────────────────────┤
│  Total:     ${String(results.passed + results.failed + results.skipped).padStart(3)}                                  │
└────────────────────────────────────────────────────┘
`);

    if (results.failed > 0) {
        log.error('Algunas pruebas fallaron. Revisa los detalles arriba.');
        console.log('\n📝 Detalles de fallos:');
        results.details
            .filter(d => !d.passed)
            .forEach(d => {
                console.log(`   - ${d.page}: ${d.error || 'Check failed'}`);
            });
    } else {
        log.success('¡Todas las pruebas pasaron! 🎉');
    }

    return results.failed === 0;
}

/**
 * Main
 */
async function main() {
    console.log(`
╔════════════════════════════════════════════════════╗
║     🧪 BeZhas Admin Pages Test Suite               ║
║     Testing: ${FRONTEND_URL.padEnd(30)}     ║
╚════════════════════════════════════════════════════╝
`);

    // 1. Verificar servidores
    log.header('🔍 Verificando Servidores');

    const frontendUp = await checkServer(FRONTEND_URL, 'Frontend');
    const backendUp = await checkServer(BACKEND_URL, 'Backend');

    if (frontendUp) {
        log.success(`Frontend disponible en ${FRONTEND_URL}`);
    } else {
        log.error(`Frontend NO disponible en ${FRONTEND_URL}`);
        log.warn('Ejecuta: cd frontend && pnpm dev');
        process.exit(1);
    }

    if (backendUp) {
        log.success(`Backend disponible en ${BACKEND_URL}`);
    } else {
        log.warn(`Backend NO disponible en ${BACKEND_URL}`);
        log.warn('Algunas funciones pueden no funcionar correctamente.');
    }

    // 2. Test de páginas principales
    log.header('📄 Testing Páginas Admin');

    for (const page of ADMIN_PAGES) {
        await testPage(page);
    }

    // 3. Tests adicionales
    await testAITabs();
    await testAdminTabs();

    // 4. Test backend (si está disponible)
    if (backendUp) {
        await testBackendAPI();
    }

    // 5. Reporte final
    const success = generateReport();

    process.exit(success ? 0 : 1);
}

// Ejecutar
main().catch(error => {
    log.error(`Error fatal: ${error.message}`);
    process.exit(1);
});
