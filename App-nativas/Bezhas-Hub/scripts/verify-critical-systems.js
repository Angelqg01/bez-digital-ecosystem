/**
 * Script de Verificación de Sistema
 * Verifica que todas las implementaciones críticas están correctamente configuradas
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando implementación de sistemas críticos...\n');

let errors = 0;
let warnings = 0;
let passed = 0;

// ========================================
// 1. Verificar Modelos
// ========================================
console.log('📦 1. Verificando Modelos...');

const models = [
    'backend/models/validation.model.js',
    'backend/models/mockModels.js',
    'backend/models/user.model.js'
];

models.forEach(model => {
    const fullPath = path.join(__dirname, '..', model);
    if (fs.existsSync(fullPath)) {
        console.log(`  ✅ ${model} existe`);
        passed++;
    } else {
        console.log(`  ❌ ${model} NO encontrado`);
        errors++;
    }
});

// ========================================
// 2. Verificar Servicios
// ========================================
console.log('\n🛠️  2. Verificando Servicios...');

const services = [
    'backend/services/validationQueue.service.js',
    'backend/services/vip.service.js',
    'backend/services/ipfs.service.js'
];

services.forEach(service => {
    const fullPath = path.join(__dirname, '..', service);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Verificar que no tenga TODOs críticos
        const hasCriticalTodo = content.match(/TODO:.*Update user record|TODO:.*Emitir evento/);
        if (hasCriticalTodo) {
            console.log(`  ⚠️  ${service} - Contiene TODOs pendientes`);
            warnings++;
        } else {
            console.log(`  ✅ ${service} - Sin TODOs críticos`);
            passed++;
        }
    } else {
        console.log(`  ❌ ${service} NO encontrado`);
        errors++;
    }
});

// ========================================
// 3. Verificar Middleware
// ========================================
console.log('\n🛡️  3. Verificando Middleware...');

const middlewares = [
    'backend/middleware/vip.middleware.js',
    'backend/middleware/auth.middleware.js'
];

middlewares.forEach(middleware => {
    const fullPath = path.join(__dirname, '..', middleware);
    if (fs.existsSync(fullPath)) {
        console.log(`  ✅ ${middleware} existe`);
        passed++;
    } else {
        console.log(`  ❌ ${middleware} NO encontrado`);
        errors++;
    }
});

// ========================================
// 4. Verificar Base de Datos
// ========================================
console.log('\n💾 4. Verificando Base de Datos...');

const dbFile = path.join(__dirname, '..', 'backend/database/inMemoryDB.js');
if (fs.existsSync(dbFile)) {
    const content = fs.readFileSync(dbFile, 'utf8');

    // Verificar que tiene las collections necesarias
    const hasValidations = content.includes('this.validations');
    const hasVipSubscriptions = content.includes('this.vipSubscriptions');

    if (hasValidations && hasVipSubscriptions) {
        console.log('  ✅ InMemoryDB tiene collections de Validations y VIP');
        passed++;
    } else {
        console.log('  ⚠️  InMemoryDB falta alguna collection crítica');
        warnings++;
    }
} else {
    console.log('  ❌ inMemoryDB.js NO encontrado');
    errors++;
}

// ========================================
// 5. Verificar Variables de Entorno
// ========================================
console.log('\n🔐 5. Verificando Variables de Entorno...');

const envExampleFile = path.join(__dirname, '..', 'backend/.env.example');
if (fs.existsSync(envExampleFile)) {
    const content = fs.readFileSync(envExampleFile, 'utf8');

    const requiredVars = [
        'PINATA_API_KEY',
        'PINATA_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'MOONPAY_API_KEY',
        'MOONPAY_SECRET_KEY'
    ];

    requiredVars.forEach(varName => {
        if (content.includes(varName)) {
            console.log(`  ✅ ${varName} está documentado`);
            passed++;
        } else {
            console.log(`  ❌ ${varName} NO está documentado`);
            errors++;
        }
    });

    // Verificar que no hay duplicados
    const pinataMatches = content.match(/PINATA_API_KEY=/g);
    if (pinataMatches && pinataMatches.length > 1) {
        console.log(`  ⚠️  Variables PINATA duplicadas (${pinataMatches.length} veces)`);
        warnings++;
    } else {
        console.log('  ✅ Sin variables duplicadas');
        passed++;
    }
} else {
    console.log('  ❌ .env.example NO encontrado');
    errors++;
}

// ========================================
// 6. Verificar Rutas
// ========================================
console.log('\n🛣️  6. Verificando Rutas...');

const routes = [
    'backend/routes/validation.routes.js',
    'backend/routes/vip.routes.js',
    'backend/routes/upload.routes.js'
];

routes.forEach(route => {
    const fullPath = path.join(__dirname, '..', route);
    if (fs.existsSync(fullPath)) {
        console.log(`  ✅ ${route} existe`);
        passed++;
    } else {
        console.log(`  ⚠️  ${route} NO encontrado (puede ser opcional)`);
        warnings++;
    }
});

// ========================================
// 7. Verificar Integración WebSocket
// ========================================
console.log('\n🔌 7. Verificando Integración WebSocket...');

const wsIntegrations = [
    { file: 'backend/services/validationQueue.service.js', search: 'broadcastToUser' },
    { file: 'backend/services/vip.service.js', search: 'broadcastToUser' }
];

wsIntegrations.forEach(({ file, search }) => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(search)) {
            console.log(`  ✅ ${file.split('/').pop()} - WebSocket integrado`);
            passed++;
        } else {
            console.log(`  ⚠️  ${file.split('/').pop()} - WebSocket NO integrado`);
            warnings++;
        }
    }
});

// ========================================
// 8. Verificar Documentación
// ========================================
console.log('\n📚 8. Verificando Documentación...');

const docs = [
    'IMPLEMENTACION_CRITICA_COMPLETADA.md',
    'ANALISIS_PENDIENTES_INCOMPLETOS.md'
];

docs.forEach(doc => {
    const fullPath = path.join(__dirname, '..', doc);
    if (fs.existsSync(fullPath)) {
        console.log(`  ✅ ${doc} existe`);
        passed++;
    } else {
        console.log(`  ⚠️  ${doc} NO encontrado`);
        warnings++;
    }
});

// ========================================
// Resumen Final
// ========================================
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN DE VERIFICACIÓN');
console.log('='.repeat(50));
console.log(`✅ Verificaciones Exitosas: ${passed}`);
console.log(`⚠️  Advertencias: ${warnings}`);
console.log(`❌ Errores Críticos: ${errors}`);
console.log('='.repeat(50));

if (errors === 0 && warnings === 0) {
    console.log('\n🎉 ¡PERFECTO! Todos los sistemas críticos están implementados correctamente.');
    console.log('✅ Sistema listo para testing y deployment.');
    process.exit(0);
} else if (errors === 0) {
    console.log('\n✅ Sistema funcional con algunas advertencias menores.');
    console.log('⚠️  Revisa las advertencias antes de deployment a producción.');
    process.exit(0);
} else {
    console.log('\n❌ Se encontraron errores críticos.');
    console.log('🔧 Por favor, corrige los errores antes de continuar.');
    process.exit(1);
}
