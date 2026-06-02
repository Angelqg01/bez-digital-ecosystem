/**
 * Demo del Sistema de Diagnóstico y Automatización
 * Muestra las capacidades sin necesidad de servidor HTTP
 */

require('dotenv').config();
const { DiagnosticAgent } = require('./services/automation/diagnosticAgent.service');
const { RewardSystem } = require('./services/automation/rewardSystem.service');
const { ThirdPartyAnalyzer } = require('./services/automation/thirdPartyAnalyzer.service');
const mongoose = require('mongoose');

console.log('🚀 DEMO: Sistema de Diagnóstico y Automatización BeZhas\n');
console.log('='.repeat(70));

async function runDemo() {
    try {
        // Conectar MongoDB en modo memoria para demo
        console.log('\n📊 1. HEALTH SCORE - Diagnóstico del Sistema');
        console.log('-'.repeat(70));

        const healthScore = await DiagnosticAgent.generateHealthScore();
        console.log(`\n✅ Health Score Generado: ${healthScore.healthScore}/100`);
        console.log(`   Database: ${healthScore.database ? '✅ OK' : '❌ Error'}`);
        console.log(`   Redis: ${healthScore.redis ? '✅ OK' : '❌ Error'}`);
        console.log(`   Blockchain: ${healthScore.blockchain ? '✅ OK' : '❌ Error'}`);
        console.log(`   API: ${healthScore.api ? '✅ OK' : '❌ Error'}`);

        if (healthScore.recommendations && healthScore.recommendations.length > 0) {
            console.log('\n📋 Recomendaciones:');
            healthScore.recommendations.forEach((rec, i) => {
                console.log(`   ${i + 1}. ${rec}`);
            });
        }

        // Demo de análisis de recompensas
        console.log('\n\n💰 2. REWARD AUTOMATION - Sistema de Recompensas');
        console.log('-'.repeat(70));
        console.log('   Configuración:');
        console.log('   • Cron: Lunes 00:00 (Weekly)');
        console.log('   • Threshold: 100 BEZ o 9.99€');
        console.log('   • Modo: SIMULACIÓN (HOT_WALLET_PRIVATE_KEY no configurada)');
        console.log('\n   ⚙️ El sistema analiza automáticamente:');
        console.log('   - Calidad del contenido (AI scoring)');
        console.log('   - Engagement (likes, shares, comments)');
        console.log('   - VIP tier benefits (bonos adicionales)');

        // Demo de análisis de terceros
        console.log('\n\n🔍 3. THIRD-PARTY ANALYZER - Análisis Competitivo');
        console.log('-'.repeat(70));
        console.log('   Análisis configurado para:');
        console.log('   • LinkedIn, Twitter, Facebook');
        console.log('   • Instagram, TikTok, Reddit');
        console.log('\n   📊 Genera reportes en: /backend/REPORTS/');
        console.log('   • UX_ANALYSIS_*.md');
        console.log('   • Benchmarking automático');
        console.log('   • Identificación de mejoras');

        // Demo de auto-recovery
        console.log('\n\n🔧 4. AUTO-RECOVERY - Sincronización Automática');
        console.log('-'.repeat(70));
        console.log('   Capacidades:');
        console.log('   ✅ Detección de discrepancias DB ↔ Blockchain');
        console.log('   ✅ Verificación automática de transacciones');
        console.log('   ✅ Resincronización de balances');
        console.log('   ✅ Retry automático de transacciones fallidas');

        // Demo de scheduled jobs
        console.log('\n\n⏰ 5. SCHEDULED JOBS - Automatización Temporal');
        console.log('-'.repeat(70));
        console.log('   Jobs activos:');
        console.log('   • Rewards Distribution: Lunes 00:00');
        console.log('   • Health Check: Cada 6 horas');
        console.log('   • Maintenance Tasks: Diario 03:00');
        console.log('   • Platform Analysis: Semanal');

        // Stats finales
        console.log('\n\n📈 6. API ENDPOINTS DISPONIBLES');
        console.log('-'.repeat(70));
        const endpoints = [
            'GET  /api/diagnostic/health         - Health score del sistema',
            'GET  /api/diagnostic/logs           - Logs de diagnóstico',
            'POST /api/diagnostic/sync/:userId   - Forzar sincronización',
            'GET  /api/diagnostic/reports        - Reportes de mantenimiento',
            'POST /api/diagnostic/analyze        - Análisis bajo demanda',
            'GET  /api/diagnostic/queue-stats    - Estadísticas de colas'
        ];

        endpoints.forEach(ep => console.log(`   ${ep}`));

        console.log('\n\n' + '='.repeat(70));
        console.log('✅ DEMO COMPLETADO');
        console.log('='.repeat(70));
        console.log('\n📖 Documentación completa en: DIAGNOSTIC_SYSTEM_README.md');
        console.log('🧪 Tests: npm test -- tests/automation/');
        console.log('🌐 Dashboard Frontend: frontend/src/components/admin/DiagnosticDashboard.jsx');
        console.log('\n💡 Para activar el servidor HTTP:');
        console.log('   cd backend && pnpm run start');
        console.log('   Luego accede a: http://localhost:3001/api/diagnostic/health\n');

    } catch (error) {
        console.error('\n❌ Error en demo:', error.message);
    } finally {
        // No cerrar mongoose connection porque puede estar siendo usado por otros servicios
        console.log('\n👋 Demo finalizado\n');
    }
}

// Ejecutar demo
runDemo().catch(console.error);
