# BeZhas Guillotine Script - Limpieza de Codigo Redundante
Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "  INICIANDO PROTOCOLO GUILLOTINA" -ForegroundColor Red
Write-Host "  Limpiando BeZhas de codigo basura..." -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""

$deletedCount = 0
$failedCount = 0

# 1. Componentes de Red Social Compleja (Stories, Reels, Forums)
Write-Host "[1/4] Eliminando componentes de red social compleja..." -ForegroundColor Yellow
$socialFiles = @(
    "frontend/src/components/social-feed/Stories.jsx",
    "frontend/src/components/social-feed/StoriesRail.jsx",
    "frontend/src/components/social-feed/ReelInFeedCard.jsx",
    "frontend/src/components/social-feed/VirtualFeed.jsx",
    "frontend/src/pages/ForumsPage.jsx",
    "frontend/src/pages/Forums.css",
    "frontend/src/pages/GroupsPage.jsx",
    "frontend/src/pages/GroupsPage.css",
    "frontend/src/pages/GroupDetailPage.jsx",
    "frontend/src/pages/GroupDetailPage.css",
    "frontend/src/pages/ThreadPage.jsx",
    "frontend/src/pages/RealEstateGame.jsx",
    "frontend/src/components/GamificationHub.jsx",
    "frontend/src/components/GamificationHub.css",
    "frontend/src/components/ReelFeed.jsx"
)

# 2. Contratos Duplicados y Bloatware
Write-Host "[2/4] Eliminando contratos duplicados..." -ForegroundColor Yellow
$contractFiles = @(
    "contracts/AdvancedMarketplace.sol",
    "contracts/AdvancedModerationSystem.sol",
    "contracts/AdvancedNotificationSystem.sol",
    "contracts/AdvancedSocialInteractions.sol",
    "contracts/AdvancedStakingPool.sol",
    "contracts/AdvancedCommunication.sol",
    "contracts/Forums.sol",
    "contracts/GroupPosts.sol",
    "contracts/GroupsAndCommunities.sol",
    "contracts/IGroupsAndCommunities.sol",
    "contracts/TokenizedPost.sol",
    "contracts/ShareToken.sol",
    "backend/abis/AdvancedMarketplace.json",
    "frontend/src/abis/AdvancedMarketplace.json"
)

# 3. Integraciones Especificas (Vinted, Github Sync, etc)
Write-Host "[3/4] Eliminando integraciones especificas..." -ForegroundColor Yellow
$integrationFiles = @(
    "backend/routes/vinted.routes.js",
    "backend/models/VintedListing.model.js",
    "backend/models/LogisticsShipment.model.js",
    "backend/services/githubSyncService.js",
    "backend/services/githubSyncService.ts",
    "backend/workers/contactSync.worker.js"
)

# 4. Servicios AI Fragmentados
Write-Host "[4/4] Eliminando servicios AI fragmentados..." -ForegroundColor Yellow
$aiFiles = @(
    "backend/services/aiPluginService.js",
    "backend/services/personalAI.service.js",
    "backend/services/openai.service.js",
    "backend/services/autoTagger.service.js"
)

$allFiles = $socialFiles + $contractFiles + $integrationFiles + $aiFiles

foreach ($file in $allFiles) {
    $fullPath = Join-Path (Get-Location) $file
    if (Test-Path $fullPath) {
        try {
            Remove-Item $fullPath -Force -ErrorAction Stop
            Write-Host "  [OK] $file" -ForegroundColor Green
            $deletedCount++
        }
        catch {
            Write-Host "  [ERROR] $file : $($_.Exception.Message)" -ForegroundColor Red
            $failedCount++
        }
    }
    else {
        Write-Host "  [SKIP] $file (no existe)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESULTADO DE LA GUILLOTINA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Archivos eliminados: $deletedCount" -ForegroundColor Green
Write-Host "  Archivos fallidos: $failedCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "El proyecto es ahora mas limpio y mantenible!" -ForegroundColor Green
Write-Host ""
