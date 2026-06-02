# BeZhas Payment System - Automated Test Script
# Fecha: 12 Enero 2026

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BeZhas Payment System Test Suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001"
$script:testsPassed = 0
$script:testsFailed = 0
$script:testsTotal = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [object]$Body = $null,
        [int]$ExpectedStatus = 200
    )
    
    $script:testsTotal++
    Write-Host "Testing: $Name" -NoNewline
    
    try {
        $params = @{
            Uri = "$baseUrl$Url"
            Method = $Method
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host " ✅ PASS" -ForegroundColor Green
            $script:testsPassed++
            
            # Show response preview
            if ($response.Content.Length -gt 0) {
                $content = $response.Content | ConvertFrom-Json
                $preview = ($content | ConvertTo-Json -Compress).Substring(0, [Math]::Min(80, ($content | ConvertTo-Json -Compress).Length))
                Write-Host "   Response: $preview..." -ForegroundColor Gray
            }
            return $true
        } else {
            Write-Host " ❌ FAIL (Status: $($response.StatusCode))" -ForegroundColor Red
            $script:testsFailed++
            return $false
        }
    }
    catch {
        Write-Host " ❌ FAIL" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:testsFailed++
        return $false
    }
}

# Test 1: Server Health Check
Write-Host "`n[1] Server Health Checks" -ForegroundColor Yellow
Test-Endpoint -Name "Main Health Endpoint" -Url "/health"

# Test 2: Payment System
Write-Host "`n[2] Payment System (Legacy - Should return 501)" -ForegroundColor Yellow
Test-Endpoint -Name "Payment Health (Migration Status)" -Url "/api/payment/health"
Test-Endpoint -Name "Create Validation Session (Migrated)" -Url "/api/payment/create-validation-session" -Method "POST" -ExpectedStatus 501
Test-Endpoint -Name "Stripe Webhook (Migrated)" -Url "/api/payment/webhook" -Method "POST" -ExpectedStatus 501
Test-Endpoint -Name "Payment Intent (Migrated)" -Url "/api/payment/stripe/create-payment-intent" -Method "POST" -ExpectedStatus 501

# Test 3: Fiat Gateway (Bank Transfer)
Write-Host "`n[3] Fiat Gateway (Bank Transfer System)" -ForegroundColor Yellow
Test-Endpoint -Name "Get Bank Details" -Url "/api/fiat/bank-details"
Test-Endpoint -Name "Calculate BEZ for 100 EUR" -Url "/api/fiat/calculate" -Method "POST" -Body @{amountEur=100}
Test-Endpoint -Name "Calculate BEZ for 500 EUR" -Url "/api/fiat/calculate" -Method "POST" -Body @{amountEur=500}
Test-Endpoint -Name "Calculate BEZ for 1000 EUR" -Url "/api/fiat/calculate" -Method "POST" -Body @{amountEur=1000}

# Test 4: WebSocket System
Write-Host "`n[4] WebSocket System" -ForegroundColor Yellow
Test-Endpoint -Name "WebSocket Stats" -Url "/api/websocket/stats"

# Test 5: Auth System (CRÍTICO - Seguridad Web3)
Write-Host "`n[5] Authentication & Security" -ForegroundColor Yellow
Test-Endpoint -Name "Auth Nonce Generation (Anti-Replay)" -Url "/api/auth/nonce?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" -ExpectedStatus 200

# Test 6: BEZ Coin System
Write-Host "`n[6] BEZ Coin System" -ForegroundColor Yellow
Test-Endpoint -Name "BEZ Coin Balance Check" -Url "/api/bezcoin/balance/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" -ExpectedStatus 200

# Test 7: Feed System
Write-Host "`n[7] Social Feed System" -ForegroundColor Yellow
Test-Endpoint -Name "Get Feed Posts" -Url "/api/feed" -ExpectedStatus 200

# Results Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Test Results Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total Tests: $script:testsTotal" -ForegroundColor White
Write-Host "Passed: $script:testsPassed" -ForegroundColor Green
Write-Host "Failed: $script:testsFailed" -ForegroundColor Red

if ($script:testsTotal -gt 0) {
    $successRate = [math]::Round(($script:testsPassed / $script:testsTotal) * 100, 2)
    Write-Host "`nSuccess Rate: $successRate%" -ForegroundColor $(if($successRate -ge 80) {"Green"} elseif($successRate -ge 60) {"Yellow"} else {"Red"})
} else {
    Write-Host "`nNo tests were executed!" -ForegroundColor Red
}

if ($script:testsFailed -eq 0 -and $script:testsTotal -gt 0) {
    Write-Host "`n✅ ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "Sistema de pagos completamente funcional." -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n⚠️ SOME TESTS FAILED" -ForegroundColor Yellow
    Write-Host "Revisa los errores arriba para más detalles." -ForegroundColor Yellow
    exit 1
}
