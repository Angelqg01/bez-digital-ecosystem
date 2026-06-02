# Script de PowerShell para verificar todos los contratos en Polygonscan
# Usa Hardhat verify con la red polygon

Write-Host "`n🔍 Verificando contratos en Polygonscan..." -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray

$BEZCOIN = "0xEcBa873B534C54DE2B62acDE232ADCa4369f11A8"
$DEPLOYER = "0x52Df82920CBAE522880dD7657e43d1A754eD044E"

$contracts = @(
    @{
        Name = "BeZhasQualityEscrow"
        Address = "0x3088573c025F197A886b97440761990c9A9e83C9"
        Args = "$BEZCOIN 10 500"
    },
    @{
        Name = "BeZhasRWAFactory"
        Address = "0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0"
        Args = "$BEZCOIN"
    },
    @{
        Name = "BeZhasVault"
        Address = "0xCDd23058bf8143680f0A320318604bB749f701ED"
        Args = "0x5F999157aF1DEfBf4E7e1b8021850b49e458CCc0"
    },
    @{
        Name = "GovernanceSystem"
        Address = "0x304Fd77f64C03482edcec0923f0Cd4A066a305F3"
        Args = "$BEZCOIN 172800 604800 10000000000000000000000 400"
    },
    @{
        Name = "BeZhasCore"
        Address = "0x260A9fBcE1c6817c04e51c170b5BFd8d594c0d8A"
        Args = "$BEZCOIN 1200 63072000 5"
    },
    @{
        Name = "LiquidityFarming"
        Address = "0x4C5330B45FEa670d5ffEAD418E74dB7EA5ECdD26"
        Args = "$BEZCOIN 100000000000000000 41832935 31536000"
    },
    @{
        Name = "NFTOffers"
        Address = "0x0C9Bf667b838f6d466619ddb90a08d6c9A64d0A4"
        Args = "$BEZCOIN $DEPLOYER"
    },
    @{
        Name = "NFTRental"
        Address = "0x96B1754BbfdC5a2f6013A8a04cB6AF2E4090C024"
        Args = "$BEZCOIN $DEPLOYER"
    },
    @{
        Name = "BeZhasMarketplace"
        Address = "0x1c061A896E0ac9C046A93eaf475c45ED5Bd8A1fE"
        Args = "$BEZCOIN 100000000000000000000 250"
    },
    @{
        Name = "BeZhasAdminRegistry"
        Address = "0xfCe2F7dcf1786d1606b9b858E9ba04dA499F1e3C"
        Args = ""
    }
)

$successCount = 0
$failCount = 0

foreach ($contract in $contracts) {
    Write-Host "`n📝 Verificando: $($contract.Name)" -ForegroundColor Yellow
    Write-Host "   Address: $($contract.Address)" -ForegroundColor Gray
    
    $argsList = $contract.Args
    
    try {
        if ($argsList -eq "") {
            $output = pnpm exec hardhat verify --network polygon $contract.Address 2>&1
        } else {
            $output = pnpm exec hardhat verify --network polygon $contract.Address $argsList.Split(' ') 2>&1
        }
        
        $outputStr = $output | Out-String
        
        if ($outputStr -match "Already Verified" -or $outputStr -match "successfully verified") {
            Write-Host "   ✅ Verificado exitosamente" -ForegroundColor Green
            $successCount++
        } elseif ($outputStr -match "error" -or $outputStr -match "Error") {
            Write-Host "   ⚠️  Error en verificación (puede estar ya verificado)" -ForegroundColor Yellow
            $failCount++
        } else {
            Write-Host "   ✅ Completado" -ForegroundColor Green
            $successCount++
        }
    } catch {
        Write-Host "   ❌ Error: $_" -ForegroundColor Red
        $failCount++
    }
    
    # Esperar 3 segundos entre verificaciones
    Start-Sleep -Seconds 3
}

Write-Host "`n" -NoNewline
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host "`n📊 Resumen de Verificación:" -ForegroundColor Cyan
Write-Host "   ✅ Exitosos: $successCount/$($contracts.Count)" -ForegroundColor Green
Write-Host "   ❌ Fallidos: $failCount/$($contracts.Count)" -ForegroundColor Red

Write-Host "`n🔗 Ver contratos verificados en:" -ForegroundColor Cyan
foreach ($contract in $contracts) {
    Write-Host "   $($contract.Name): https://polygonscan.com/address/$($contract.Address)#code" -ForegroundColor Gray
}

Write-Host ""
