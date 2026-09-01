# Build and run the local MYPS API host on http://localhost:5015
# Usage:  .\run-api.ps1          (build, then run)
#         .\run-api.ps1 -NoBuild (run the existing build)

param([switch]$NoBuild)

$ErrorActionPreference = 'Stop'
$root    = $PSScriptRoot
$proj    = Join-Path $root 'Main\Main.csproj'
$outDir  = Join-Path $root 'Main\bin\Debug\net8.0'
$exe     = Join-Path $outDir 'Main.exe'
$xmlDoc  = Join-Path $outDir 'Main.xml'

# 1. Stop any running host first. Building while Main.exe is alive fails on
#    locked DLLs *and* truncates Main.xml to NUL bytes, after which
#    AddDevSwagger's IncludeXmlComments throws and EVERY request 500s.
$running = Get-Process -Name 'Main' -ErrorAction SilentlyContinue
if ($running) {
    Write-Host "Stopping running Main.exe (PID $($running.Id -join ', '))..." -ForegroundColor Yellow
    $running | Stop-Process -Force
    $running | Wait-Process -Timeout 15 -ErrorAction SilentlyContinue
}

if (-not $NoBuild) {
    # 2. Drop a corrupted XML doc file so the build regenerates it.
    if (Test-Path $xmlDoc) {
        $bytes = [System.IO.File]::ReadAllBytes($xmlDoc)
        if ($bytes.Length -eq 0 -or ($bytes | Select-Object -First 1) -eq 0) {
            Write-Host "Main.xml is corrupted - removing so the build regenerates it." -ForegroundColor Yellow
            Remove-Item $xmlDoc -Force
        }
    }

    Write-Host "Building Main..." -ForegroundColor Cyan
    dotnet build $proj -c Debug
    if ($LASTEXITCODE -ne 0) { throw "Build failed - not starting the API." }
}

if (-not (Test-Path $exe)) { throw "Main.exe not found at $exe - run without -NoBuild." }

# 3. launchSettings.json only applies to `dotnet run`; running the exe directly
#    would bind :5000. The FE proxy and the PIS URLs in
#    appsettings.Development.json both expect :5015. Development also enables
#    DevPisController, the local SOAP stand-in that makes offline login work.
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS        = 'http://localhost:5015'

Write-Host ""
Write-Host "API      : http://localhost:5015" -ForegroundColor Green
Write-Host "Swagger  : http://localhost:5015/swagger" -ForegroundColor Green
Write-Host "Env      : Development   (Ctrl+C to stop)" -ForegroundColor Green
Write-Host ""

Push-Location $outDir
try { & $exe } finally { Pop-Location }
