# ============================================================================
#  DotEnv.ps1 — Carga del .env de la raíz para los scripts de PowerShell.
#
#  Existe porque start-dev.ps1 y bootstrap-local.ps1 traían el entorno de
#  desarrollo escrito a mano, credenciales incluidas:
#
#      $env:DATABASE_URL = "postgresql://admin:TuPasswordSeguro@localhost:5432/..."
#      $env:JWT_SECRET   = "dev-secret-key-change-in-production"
#
#  Eso tenía dos problemas a la vez. Uno, la contraseña quedaba escrita en un
#  fichero versionado — así fue como TuPasswordSeguro acabó siendo la
#  contraseña real de la base de datos. Y dos, esos valores ya no describían
#  ningún despliegue: apuntaban a la base `bezhas_control` en el puerto 5432
#  con el usuario `admin`, mientras el stack real usa `bezhas` en el 5433.
#  Arrancar con ellos no fallaba de forma obvia, simplemente no conectaba.
#
#  Ahora hay una sola fuente de verdad, el .env de la raíz, la misma que usa
#  docker-compose.
#
#  Uso:
#      . (Join-Path $ROOT "scripts\lib\DotEnv.ps1")
#      Import-DotEnv -Path (Join-Path $ROOT ".env")
#      Assert-EnvVars @("DATABASE_URL", "JWT_SECRET")
# ============================================================================

<#
.SYNOPSIS
    Vuelca las variables de un fichero .env en el entorno del proceso.
.DESCRIPTION
    Ignora comentarios y líneas vacías, y quita las comillas envolventes —un
    hash bcrypt se guarda entre comillas simples porque contiene '$'—.

    Por defecto NO pisa las variables que ya existan en el entorno: quien
    exporta algo antes de llamar al script lo hace a propósito, y el .env no
    debe ganarle. Con -Override se invierte.
#>
function Import-DotEnv {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [switch]$Override
    )

    if (-not (Test-Path $Path)) {
        Write-Host "  [ERR] No se encuentra $Path" -ForegroundColor Red
        Write-Host "        Copia .env.example a .env y rellena los valores." -ForegroundColor Red
        exit 1
    }

    $cargadas = 0
    foreach ($linea in Get-Content -Path $Path -Encoding UTF8) {
        $t = $linea.Trim()
        if ($t.Length -eq 0 -or $t.StartsWith('#')) { continue }

        # Sólo el PRIMER '=' separa: los valores llevan '=' dentro (URLs de
        # conexión, tokens en base64) y partir por todos los truncaría.
        $i = $t.IndexOf('=')
        if ($i -lt 1) { continue }

        $nombre = $t.Substring(0, $i).Trim()
        $valor  = $t.Substring($i + 1).Trim()

        if (($valor.StartsWith("'") -and $valor.EndsWith("'")) -or
            ($valor.StartsWith('"') -and $valor.EndsWith('"'))) {
            if ($valor.Length -ge 2) { $valor = $valor.Substring(1, $valor.Length - 2) }
        }

        if (-not $Override -and (Get-Item "Env:$nombre" -ErrorAction SilentlyContinue)) { continue }

        Set-Item -Path "Env:$nombre" -Value $valor
        $cargadas++
    }

    Write-Host "  [OK] .env cargado ($cargadas variables)" -ForegroundColor Green
}

<#
.SYNOPSIS
    Aborta si falta alguna variable imprescindible.
.DESCRIPTION
    El equivalente al `${VAR:?...}` de docker-compose: más vale parar con un
    mensaje claro que arrancar a medias contra una base equivocada y pasar
    media hora depurando un fallo de conexión.

    Trata la cadena vacía como ausencia: un `VAR=` en el .env es un olvido.
#>
function Assert-EnvVars {
    param([Parameter(Mandatory = $true)][string[]]$Names)

    $faltan = @()
    foreach ($n in $Names) {
        $v = [Environment]::GetEnvironmentVariable($n)
        if ([string]::IsNullOrWhiteSpace($v)) { $faltan += $n }
    }

    if ($faltan.Count -gt 0) {
        Write-Host ""
        Write-Host "  [ERR] Faltan variables en el .env:" -ForegroundColor Red
        foreach ($n in $faltan) { Write-Host "          $n" -ForegroundColor Red }
        Write-Host "        Mira .env.example para saber qué valor lleva cada una." -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}
