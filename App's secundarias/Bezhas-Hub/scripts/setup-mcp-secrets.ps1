# ========================================================
# BeZhas MCP Intelligence Server - GCP Secret Setup
# ========================================================
# Run this ONCE before deploying to add MCP-specific secrets
# Usage: .\setup-mcp-secrets.ps1
# ========================================================

$PROJECT_ID = "totemic-bonus-479312-c6"
$REGION = "us-central1"

Write-Host "Setting up GCP Secrets for MCP Intelligence Server..." -ForegroundColor Cyan

$MCP_URL = "https://bezhas-intelligence-${PROJECT_ID}.${REGION}.run.app"
Write-Host "MCP_SERVER_URL will be set after first deploy."
Write-Host "   Expected URL: $MCP_URL"

$secrets = @(
    @{ Name = "MCP_SERVER_URL"; Description = "Internal URL of MCP Intelligence Server on Cloud Run" },
    @{ Name = "GITHUB_TOKEN"; Description = "GitHub Personal Access Token for MCP GitHub tool" },
    @{ Name = "FIRECRAWL_API_KEY"; Description = "Firecrawl API key for web scraping MCP tool" },
    @{ Name = "TALLY_API_KEY"; Description = "Tally DAO API key for governance MCP tool" },
    @{ Name = "ALPACA_API_KEY"; Description = "Alpaca Markets API key for trading MCP tool" },
    @{ Name = "ALPACA_SECRET_KEY"; Description = "Alpaca Markets secret key for trading MCP tool" }
)

foreach ($secret in $secrets) {
    Write-Host "Creating secret: $($secret.Name)" -ForegroundColor Yellow
    Write-Host "   $($secret.Description)"
    
    $exists = gcloud secrets describe $secret.Name --project=$PROJECT_ID 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Secret already exists, skipping creation" -ForegroundColor Green
    }
    else {
        Write-Host "   Creating with placeholder value..."
        Write-Host "placeholder" | gcloud secrets create $secret.Name --project=$PROJECT_ID --data-file=- --replication-policy=automatic
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   Created successfully" -ForegroundColor Green
        }
        else {
            Write-Host "   Failed to create" -ForegroundColor Red
        }
    }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IMPORTANT: Update placeholder secrets with real values:" -ForegroundColor Yellow
Write-Host '  echo "YOUR_VALUE" | gcloud secrets versions add SECRET_NAME --project=$PROJECT_ID --data-file=-'
Write-Host "After first deploy, update MCP_SERVER_URL with the actual Cloud Run URL:"
Write-Host '  gcloud run services describe bezhas-intelligence --region=us-central1 --format="value(status.url)"'
Write-Host "========================================" -ForegroundColor Cyan
