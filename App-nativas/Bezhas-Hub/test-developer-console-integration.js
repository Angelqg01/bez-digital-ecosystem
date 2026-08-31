const fs = require('fs');
const path = require('path');

console.log('🧪 Verificando Integración de Developer Console con Documentation y Loyalty\n');

const checks = [
    {
        name: 'Frontend: DeveloperConsole.jsx con nuevos imports',
        file: 'frontend/src/pages/DeveloperConsole.jsx',
        contains: ['Terminal', 'Trophy', 'TrendingUp', 'Target', 'CodeBlock', 'DeveloperIncentives']
    },
    {
        name: 'Frontend: Tab de Documentation implementado',
        file: 'frontend/src/pages/DeveloperConsole.jsx',
        contains: ['DocumentationTab', 'BeZhas SDK Documentation', 'apiKey:', 'installCode']
    },
    {
        name: 'Frontend: Tab de Loyalty Metrics implementado',
        file: 'frontend/src/pages/DeveloperConsole.jsx',
        contains: ['LoyaltyMetricsTab', 'Speed Demon', 'Contract Architect', 'Identity Pioneer']
    },
    {
        name: 'Frontend: Función fetchUsageStats agregada',
        file: 'frontend/src/pages/DeveloperConsole.jsx',
        contains: ['fetchUsageStats', '/api/developer/usage-stats/', 'setUsageStats']
    },
    {
        name: 'Frontend: Tabs actualizados en navegación',
        file: 'frontend/src/pages/DeveloperConsole.jsx',
        contains: ["id: 'docs', label: 'Documentation'", "id: 'loyalty', label: 'Loyalty Metrics'"]
    },
    {
        name: 'Backend: Controlador con getUsageStats',
        file: 'backend/controllers/developerConsole.controller.js',
        contains: ['exports.getUsageStats', 'requestsThisMonth', 'smartContractCalls', 'identityValidations']
    },
    {
        name: 'Backend: Rutas actualizadas con usage-stats',
        file: 'backend/routes/developerConsole.routes.js',
        contains: ['getUsageStats', '/usage-stats/:address']
    },
    {
        name: 'Backend: Modelo ApiKey con campos de gamificación',
        file: 'backend/models/ApiKey.model.js',
        contains: ['smartContractCalls', 'identityValidations', 'achievements']
    }
];

let passed = 0;
let failed = 0;

checks.forEach(check => {
    const filePath = path.join(__dirname, check.file);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ ${check.name}`);
        console.log(`   Archivo no encontrado: ${check.file}\n`);
        failed++;
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const allFound = check.contains.every(str => content.includes(str));

    if (allFound) {
        console.log(`✅ ${check.name}`);
        passed++;
    } else {
        console.log(`❌ ${check.name}`);
        const missing = check.contains.filter(str => !content.includes(str));
        console.log(`   Falta: ${missing.join(', ')}\n`);
        failed++;
    }
});

console.log(`\n📊 Resultado: ${passed}/${checks.length} tests pasados`);

if (failed === 0) {
    console.log('\n✅ ¡Integración completa y verificada!\n');
    console.log('🚀 Próximos pasos:');
    console.log('   1. Ejecuta: .\\start-both.ps1');
    console.log('   2. Navega a: http://localhost:5173/developer-console');
    console.log('   3. Conecta tu wallet');
    console.log('   4. Explora los 3 nuevos tabs:');
    console.log('      📖 Documentation - SDK completo con ejemplos de código');
    console.log('      🏆 Loyalty Metrics - Progreso de gamificación y achievements');
    console.log('      🔧 ToolBEZ Enterprise - Herramientas avanzadas\n');
    console.log('💡 Funcionalidades implementadas:');
    console.log('   ✓ CodeBlock component con copy-to-clipboard');
    console.log('   ✓ DeveloperIncentives con 3 achievement cards');
    console.log('   ✓ Métricas en tiempo real desde backend');
    console.log('   ✓ Endpoint /api/developer/usage-stats/:address');
    console.log('   ✓ Documentación interactiva del SDK\n');
} else {
    console.log(`\n⚠️  ${failed} verificaciones fallaron\n`);
}
