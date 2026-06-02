#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando actualización de npm a pnpm en el proyecto\n');

const filesToCheck = [
    {
        file: 'start-backend.ps1',
        shouldContain: ['pnpm install', 'pnpm start'],
        shouldNotContain: []
    },
    {
        file: 'start-frontend.ps1',
        shouldContain: ['pnpm install', 'pnpm run dev'],
        shouldNotContain: []
    },
    {
        file: 'frontend/src/pages/DeveloperConsole.jsx',
        shouldContain: ['pnpm install @bezhas/sdk-core', 'pnpm start</code>'],
        shouldNotContain: []
    },
    {
        file: 'check.ps1',
        shouldContain: ['pnpm start'],
        shouldNotContain: []
    },
    {
        file: 'health-check.ps1',
        shouldContain: ['pnpm start'],
        shouldNotContain: []
    },
    {
        file: 'test-loyalty-implementation.js',
        shouldContain: ['pnpm start', 'pnpm run dev'],
        shouldNotContain: []
    },
    {
        file: 'verify-loyalty-visual.ps1',
        shouldContain: ['pnpm start', 'pnpm run dev'],
        shouldNotContain: []
    }
];

let passed = 0;
let failed = 0;

filesToCheck.forEach(check => {
    const filePath = path.join(__dirname, check.file);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ ${check.file} - Archivo no encontrado`);
        failed++;
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Verificar que contenga pnpm
    const hasAllPnpm = check.shouldContain.every(str => content.includes(str));

    if (hasAllPnpm) {
        console.log(`✅ ${check.file} - Actualizado correctamente a pnpm`);
        passed++;
    } else {
        console.log(`❌ ${check.file} - Falta alguna referencia a pnpm`);
        const missing = check.shouldContain.filter(str => !content.includes(str));
        console.log(`   Falta: ${missing.join(', ')}`);
        failed++;
    }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 Resultado: ${passed}/${filesToCheck.length} archivos actualizados correctamente`);
console.log(`${'='.repeat(60)}\n`);

if (failed === 0) {
    console.log('✅ ¡Todos los archivos críticos han sido actualizados a pnpm!\n');
    console.log('🎯 Beneficios de usar pnpm:');
    console.log('   ✓ Mayor seguridad con verificación estricta de integridad');
    console.log('   ✓ Instalación hasta 2x más rápida');
    console.log('   ✓ Ahorro de espacio en disco (enlaces simbólicos)');
    console.log('   ✓ Mejor manejo de dependencias monorepo');
    console.log('   ✓ Compatible con lockfiles determinísticos\n');
    console.log('🚀 Comandos actualizados:');
    console.log('   - Instalar: pnpm install');
    console.log('   - Iniciar backend: pnpm start (desde /backend)');
    console.log('   - Iniciar frontend: pnpm run dev (desde /frontend)');
    console.log('   - Scripts: .\\start-both.ps1 (ya usa pnpm internamente)\n');
} else {
    console.log(`⚠️  ${failed} archivos necesitan corrección manual\n`);
}
