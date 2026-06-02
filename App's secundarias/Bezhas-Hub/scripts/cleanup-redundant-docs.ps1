# 🗑️ Script de Limpieza de Documentación Redundante
# Elimina archivos .md duplicados después de la consolidación
# EJECUTAR: .\cleanup-redundant-docs.ps1

Write-Host "🧹 LIMPIEZA DE DOCUMENTACIÓN REDUNDANTE" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Crear backup primero
$backupDir = "backup_docs_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Write-Host "📦 Creando backup en: $backupDir" -ForegroundColor Yellow
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item "*.md" $backupDir -Force
Write-Host "✅ Backup completado" -ForegroundColor Green
Write-Host ""

# Contador
$deletedCount = 0
$totalSize = 0

# GRUPO 1: Implementation Reports (CONSOLIDADOS EN: IMPLEMENTATION_MASTER_REPORT.md)
Write-Host "🗂️ GRUPO 1: Implementation Reports" -ForegroundColor Magenta
$implementationDocs = @(
    "COMPLETE_IMPLEMENTATION_REPORT.md",
    "COMPLETE_SYSTEM_GUIDE.md",
    "IMPLEMENTACION_COMPLETA_RESUMEN.md",
    "IMPLEMENTACION_POSTS.md",
    "COMPLETE_FEED_SUMMARY.md",
    "WEB3_SYSTEMS_IMPLEMENTATION_COMPLETE.md",
    "COMPLETE_WEB3_IMPLEMENTATION.md",
    "DESARROLLO_COMPLETADO.md"
)

foreach ($file in $implementationDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 2: System Status & Sessions (CONSOLIDAR EN: SYSTEM_STATUS_CURRENT.md)
Write-Host "🗂️ GRUPO 2: System Status & Sessions" -ForegroundColor Magenta
$statusDocs = @(
    "SISTEMA_COMPLETO_ANALISIS.md",
    "SISTEMA_VERIFICADO.md",
    "SISTEMA_INICIADO.md",
    "SESSION_COMPLETE.md",
    "SESSION_SUMMARY_2026-01-03.md",
    "SESION_COMPLETA_RWA.md",
    "SYSTEM_VERIFICATION_COMPLETE.md",
    "REFACTORIZACION_COMPLETADA.md"
)

foreach ($file in $statusDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 3: Admin Panel (CONSOLIDAR EN: docs/admin/)
Write-Host "🗂️ GRUPO 3: Admin Panel Docs" -ForegroundColor Magenta
$adminDocs = @(
    "ADMIN_ACCESS_FIX.md",
    "ADMIN_ACCESS.md",
    "ADMIN_ADS_UPDATE.md",
    "ADMIN_PANEL_INDEX.md",
    "ADMIN_PANEL_RESUMEN_EJECUTIVO.md",
    "ADMIN_PANEL_TESTING.md",
    "ADMIN_POSTS_ACTIVATION.md",
    "ADMIN_SETUP.md",
    "CHANGELOG_ADMIN.md"
)

foreach ($file in $adminDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 4: Security & Audit (MANTENER: SECURITY_MASTER_GUIDE.md, SECURITY_AUDIT_REPORT.md)
Write-Host "🗂️ GRUPO 4: Security Redundant Docs" -ForegroundColor Magenta
$securityDocs = @(
    "SECURITY_DAY2_COMPLETE.md",
    "SECURITY_DAY3_COMPLETE.md",
    "SECURITY_DAY4_SUMMARY.md",
    "SECURITY_DAY5_COMPLETE.md",
    "SECURITY_FIXES_APPLIED.md",
    "SECURITY_UPDATE_DEC_2025.md",
    "SECURITY_SYSTEM_README.md"
)

foreach ($file in $securityDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 5: Deployment (MANTENER: DEPLOYMENT_MASTER_GUIDE.md, DEPLOYMENT_CHECKLIST.md)
Write-Host "🗂️ GRUPO 5: Deployment Redundant Docs" -ForegroundColor Magenta
$deploymentDocs = @(
    "DEPLOYMENT_FLOW.md",
    "DEPLOYMENT_GITHUB_GUIDE.md",
    "DEPLOYMENT_GUIDE_SECURITY.md",
    "DEPLOYMENT_GUIDE.md",
    "PRODUCTION_REQUIREMENTS.md"
)

foreach ($file in $deploymentDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 6: Optimization (MANTENER: OPTIMIZATION_MASTER_REPORT.md)
Write-Host "🗂️ GRUPO 6: Optimization Redundant Docs" -ForegroundColor Magenta
$optimizationDocs = @(
    "CONSOLE_ERRORS_OPTIMIZED.md",
    "CONSOLE_OPTIMIZATIONS_COMPLETE.md",
    "CONSOLE_WARNINGS_FIXED.md",
    "OPTIMIZATION_COMPLETE.md",
    "OPTIMIZATION_REPORT.md",
    "OPTIMIZACION_ADCENTER.md"
)

foreach ($file in $optimizationDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 7: AI Platform (MANTENER: AI_PLATFORM_COMPLETE.md)
Write-Host "🗂️ GRUPO 7: AI Platform Redundant Docs" -ForegroundColor Magenta
$aiDocs = @(
    "AI_ENGINE_IMPLEMENTATION.md",
    "AI_ENGINE_VERIFICATION_REPORT.md",
    "AI_PLATFORM_INDEX.md",
    "AI_PLATFORM_README.md",
    "AI_CENTER_ADMIN_GUIDE.md",
    "ANALISIS_CHAT_AI.md"
)

foreach ($file in $aiDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 8: Quality Oracle (MANTENER: QUALITY_ORACLE_MASTER.md)
Write-Host "🗂️ GRUPO 8: Quality Oracle Redundant Docs" -ForegroundColor Magenta
$oracleDocs = @(
    "QUALITY_ORACLE_COMPLETE.md",
    "QUALITY_ORACLE_DEPLOYMENT_STATUS.md",
    "QUALITY_ORACLE_IMPLEMENTATION_COMPLETE.md",
    "QUALITY_ORACLE_PHASE2_COMPLETE.md",
    "QUALITY_ESCROW_VERIFICATION.md"
)

foreach ($file in $oracleDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 9: DAO (MANTENER: DAO_COMPLETE_GUIDE.md)
Write-Host "🗂️ GRUPO 9: DAO Redundant Docs" -ForegroundColor Magenta
$daoDocs = @(
    "DAO_DEPLOYMENT_CHECKLIST.md",
    "DAO_DEPLOYMENT_GUIDE.md",
    "DAO_SEED_GUIDE.md",
    "DAO_TROUBLESHOOTING.md"
)

foreach ($file in $daoDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 10: Automation (MANTENER: AUTOMATION_COMPLETE_GUIDE.md)
Write-Host "🗂️ GRUPO 10: Automation Redundant Docs" -ForegroundColor Magenta
$automationDocs = @(
    "AUTOMATION_FINAL_REPORT.md",
    "AUTOMATION_IMPLEMENTATION_SUMMARY.md"
)

foreach ($file in $automationDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 11: Ad Center (MANTENER: AD_CENTER_COMPLETE.md)
Write-Host "🗂️ GRUPO 11: Ad Center Redundant Docs" -ForegroundColor Magenta
$adDocs = @(
    "AD_CENTER_FRONTEND_UPDATE.md",
    "AD_CENTER_UNIFICATION.md"
)

foreach ($file in $adDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 12: Revenue & Payments (MANTENER: REVENUE_COMPLETE_GUIDE.md)
Write-Host "🗂️ GRUPO 12: Revenue Redundant Docs" -ForegroundColor Magenta
$revenueDocs = @(
    "REVENUE_STREAM_INDEX.md",
    "REVENUE_STREAM_NATIVE.md",
    "README_REVENUE_STREAM.md",
    "PAYMENT_SYSTEM_STATUS.md",
    "MOONPAY_INTEGRATION.md",
    "STRIPE_SETUP_QUICK.md"
)

foreach ($file in $revenueDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 13: Testing (MANTENER: TESTING_MASTER_GUIDE.md)
Write-Host "🗂️ GRUPO 13: Testing Redundant Docs" -ForegroundColor Magenta
$testingDocs = @(
    "TESTING_FINAL_SUMMARY.md",
    "TESTING_AUDIT_PROGRESS_REPORT.md"
)

foreach ($file in $testingDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 14: Bridge (MANTENER: BRIDGE_COMPLETE_SYSTEM.md)
Write-Host "🗂️ GRUPO 14: Bridge Redundant Docs" -ForegroundColor Magenta
$bridgeDocs = @(
    "BRIDGE_API_KEYS_COMPLETE.md",
    "BRIDGE_API_KEYS_SYSTEM.md",
    "BRIDGE_TESTS_COMPLETE.md"
)

foreach ($file in $bridgeDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 15: Feed & Social (MANTENER: FEED_SOCIAL_COMPLETE.md)
Write-Host "🗂️ GRUPO 15: Feed Redundant Docs" -ForegroundColor Magenta
$feedDocs = @(
    "FEED_ACTIVATION.md",
    "FEED_FUNCTIONS.md",
    "ADMIN_POSTS_ACTIVATION.md"
)

foreach ($file in $feedDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 16: Chat (MANTENER: CHAT_GATEKEEPER_COMPLETE.md)
Write-Host "🗂️ GRUPO 16: Chat Redundant Docs" -ForegroundColor Magenta
$chatDocs = @(
    "CHAT_GATEKEEPER_ACTIVATION_GUIDE.md"
)

foreach ($file in $chatDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 17: Quick Start (MANTENER: START_HERE.md, QUICK_START_MASTER.md)
Write-Host "🗂️ GRUPO 17: Quick Start Redundant Docs" -ForegroundColor Magenta
$quickstartDocs = @(
    "QUICK_START_ADMIN.md",
    "QUICK_START_LOGISTICS.md",
    "QUICK_START_QUALITY_ORACLE.md",
    "ACTIVATION_GUIDE.md"
)

foreach ($file in $quickstartDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 18: Marketplace (MANTENER: MARKETPLACE_MASTER_GUIDE.md)
Write-Host "🗂️ GRUPO 18: Marketplace Redundant Docs" -ForegroundColor Magenta
$marketplaceDocs = @(
    "MARKETPLACE_IMPLEMENTATION.md",
    "MARKETPLACE_STATUS.md",
    "PROFILE_MARKETPLACE_ACTIVATION.md"
)

foreach ($file in $marketplaceDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# GRUPO 19: Errores específicos (MANTENER SOLO SI SON ÚNICOS)
Write-Host "🗂️ GRUPO 19: Error Fixes Redundant Docs" -ForegroundColor Magenta
$errorDocs = @(
    "BADGES_429_ERRORS_FIXED.md",
    "QUESTS_429_ERRORS_FIXED.md",
    "VENDOR_ERROR_FIX.md",
    "PROBLEMA_RESUELTO.md",
    "SOLUCION_PANTALLA_AZUL.md"
)

foreach ($file in $errorDocs) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length
        $totalSize += $size
        Remove-Item $file -Force
        Write-Host "  ✓ Eliminado: $file ($([math]::Round($size/1KB, 2)) KB)" -ForegroundColor Gray
        $deletedCount++
    }
}
Write-Host ""

# RESUMEN FINAL
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📊 RESUMEN DE LIMPIEZA" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Archivos eliminados: $deletedCount" -ForegroundColor Green
Write-Host "💾 Espacio liberado: $([math]::Round($totalSize/1MB, 2)) MB" -ForegroundColor Green
Write-Host "📦 Backup guardado en: $backupDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "📚 DOCUMENTOS CONSOLIDADOS PRINCIPALES:" -ForegroundColor Magenta
Write-Host "  • IMPLEMENTATION_MASTER_REPORT.md" -ForegroundColor White
Write-Host "  • START_HERE.md" -ForegroundColor White
Write-Host "  • COMPLETE_SYSTEM_GUIDE.md" -ForegroundColor White
Write-Host "  • README.md" -ForegroundColor White
Write-Host ""
Write-Host "✨ Limpieza completada exitosamente!" -ForegroundColor Green
Write-Host ""

# Listar archivos .md restantes
Write-Host "📄 Archivos .md restantes:" -ForegroundColor Cyan
Get-ChildItem -Filter "*.md" | Select-Object Name, @{Name="Size (KB)";Expression={[math]::Round($_.Length/1KB,2)}} | Format-Table -AutoSize

Write-Host ""
Write-Host "💡 TIP: Si necesitas restaurar algún archivo, está en: $backupDir" -ForegroundColor Yellow
