# Script para probar el endpoint /api/feed
Write-Host "🔍 Probando endpoint /api/feed..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/feed" -Method Get -TimeoutSec 10
    
    Write-Host "`n✅ Feed endpoint respondió correctamente!" -ForegroundColor Green
    Write-Host "`n📊 Total de posts: $($response.Count)" -ForegroundColor Yellow
    
    Write-Host "`n📝 Posts encontrados:" -ForegroundColor Cyan
    $response | ForEach-Object {
        $preview = if ($_.content.Length -gt 60) { $_.content.Substring(0, 60) + "..." } else { $_.content }
        $pinnedIcon = if ($_.pinned) { "📌" } else { "  " }
        $validatedIcon = if ($_.validated) { "✅" } else { "  " }
        Write-Host "$pinnedIcon$validatedIcon ID:$($_._id) - $($_.author) - $preview"
    }
    
    Write-Host "`n📍 Posts pinned: $($response | Where-Object { $_.pinned } | Measure-Object | Select-Object -ExpandProperty Count)" -ForegroundColor Magenta
    Write-Host "✔️  Posts validated: $($response | Where-Object { $_.validated } | Measure-Object | Select-Object -ExpandProperty Count)" -ForegroundColor Green
    
}
catch {
    Write-Host "`n❌ Error al conectar con el backend:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`n💡 Asegúrate de que el backend esté corriendo en puerto 3001" -ForegroundColor Yellow
}
