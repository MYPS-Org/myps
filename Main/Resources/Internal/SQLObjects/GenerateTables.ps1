# =============================================================================
# MYPS Schema Sync - full-fidelity per-table DDL extraction
# =============================================================================
# Emits one .sql file per table into .\Tables\<schema>_<table>.sql containing:
#   columns (full type incl. length/precision/scale, COLLATE when non-default,
#   IDENTITY(seed,increment) read from the catalog), named DEFAULT constraints,
#   PRIMARY KEY, UNIQUE constraints, CHECK constraints, FOREIGN KEYS (with
#   ON DELETE/UPDATE actions) and INDEXES (unique / filtered / INCLUDE columns).
#
# The DDL generation logic lives in GenerateTableDDL.template.sql so it can be
# run and tested standalone; this script only drives it per table and syncs.
#
# Tables dropped from the database have their .sql file autodeleted.
# =============================================================================

$ErrorActionPreference = "Stop"

# --- Connection -------------------------------------------------------------
# Required environment variables, no defaults (2026-10-15): the script used to fall back to a
# shared server with a committed `sa` password. Name the database you mean, every time.
$missing = @('MYPS_DB_SERVER', 'MYPS_DB_NAME', 'MYPS_DB_USER', 'MYPS_DB_PASSWORD') |
    Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) }
if ($missing.Count -gt 0) {
    Write-Error ("Set {0} before running this script, e.g. `$env:MYPS_DB_SERVER='localhost'; `$env:MYPS_DB_NAME='myps_db_dev'; `$env:MYPS_DB_USER='...'; `$env:MYPS_DB_PASSWORD='...'" -f ($missing -join ', '))
    exit 1
}
$server   = $env:MYPS_DB_SERVER
$database = $env:MYPS_DB_NAME
$user     = $env:MYPS_DB_USER
$password = $env:MYPS_DB_PASSWORD

# --- Paths (repo-relative, so the script survives a clone elsewhere) --------
$scriptDir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetDir    = Join-Path $scriptDir "Tables"
$templateFile = Join-Path $scriptDir "GenerateTableDDL.template.sql"
$stagingDir   = Join-Path $env:TEMP "myps_db_sync_$(Get-Date -Format 'yyyyMMddHHmmss')"

if (-not (Test-Path $templateFile)) {
    Write-Error "DDL template not found: $templateFile"
    exit 1
}
$template = Get-Content $templateFile -Raw

# --- 1. Connectivity check (guards the autodelete in step 3) ----------------
$null = sqlcmd -S $server -d $database -U $user -P $password -Q "SELECT 1" -h -1 -t 10 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Database unreachable. Aborting sync to prevent accidental file deletion."
    exit 1
}

New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null
New-Item -ItemType Directory -Path $targetDir  -Force | Out-Null

Write-Host "Starting schema sync from $database ..."

# --- 2. Enumerate tables ----------------------------------------------------
$tableQuery = "SET NOCOUNT ON; SELECT SCHEMA_NAME(schema_id) + '.' + name FROM sys.tables WHERE is_ms_shipped = 0 ORDER BY SCHEMA_NAME(schema_id), name;"
$tables = sqlcmd -S $server -d $database -U $user -P $password -h -1 -W -Q $tableQuery

$generatedFiles = @()
$failed = @()

foreach ($table in $tables) {
    if ([string]::IsNullOrWhiteSpace($table)) { continue }
    $tableName = $table.Trim()
    if ($tableName -notmatch '\.') { continue }

    $schema   = $tableName.Split(".")[0]
    $baseName = $tableName.Substring($schema.Length + 1)
    $fileName = "$($schema)_$($baseName).sql"

    # Escape single quotes before injecting as T-SQL literals.
    $sqlScript = $template.Replace('$SCHEMA$', $schema.Replace("'", "''")).Replace('$TABLE$', $baseName.Replace("'", "''"))

    # Drive via -i: a script this size does not fit reliably in -Q, and
    # sqlcmd -i requires a BACKSLASH path (forward slashes fail with
    # "Access is denied" on the drive letter).
    $queryFile = Join-Path $stagingDir "_query_$fileName"
    Set-Content -Path $queryFile -Value $sqlScript -Encoding UTF8

    $ddl = sqlcmd -S $server -d $database -U $user -P $password -i $queryFile -h -1 -t 120

    if ($LASTEXITCODE -ne 0 -or -not (($ddl -join "`n") -match "CREATE TABLE")) {
        Write-Host "FAILED: $fileName" -ForegroundColor Red
        $failed += $fileName
        continue
    }

    # PRINT right-pads each chunk; strip trailing whitespace per line.
    $clean = (($ddl | ForEach-Object { $_.TrimEnd() }) -join "`r`n").Trim() + "`r`n"

    Set-Content -Path (Join-Path $stagingDir $fileName) -Value $clean -Encoding UTF8 -NoNewline
    $generatedFiles += $fileName
    Remove-Item $queryFile -Force
}

# Fail closed: never sync (and therefore never autodelete) on partial output.
if ($failed.Count -gt 0) {
    Write-Error "DDL generation failed for $($failed.Count) table(s): $($failed -join ', '). Aborting sync so no file is deleted."
    Remove-Item $stagingDir -Recurse -Force
    exit 1
}

# --- 3. Sync: autodelete, update, create ------------------------------------
$existingFiles = @(Get-ChildItem -Path $targetDir -Filter *.sql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name)

foreach ($file in $existingFiles) {
    if ($generatedFiles -notcontains $file) {
        Remove-Item (Join-Path $targetDir $file) -Force
        Write-Host "Autodeleted (table dropped): $file" -ForegroundColor Red
    }
}

$created = 0; $updated = 0
foreach ($file in $generatedFiles) {
    $targetPath  = Join-Path $targetDir  $file
    $stagingPath = Join-Path $stagingDir $file

    if (Test-Path $targetPath) {
        if ((Get-FileHash $targetPath).Hash -ne (Get-FileHash $stagingPath).Hash) {
            Copy-Item $stagingPath $targetPath -Force
            Write-Host "Updated (schema changed): $file" -ForegroundColor Yellow
            $updated++
        }
    } else {
        Copy-Item $stagingPath $targetPath -Force
        Write-Host "Created (new table): $file" -ForegroundColor Green
        $created++
    }
}

Remove-Item $stagingDir -Recurse -Force
Write-Host "Sync complete. $($generatedFiles.Count) table(s): $created created, $updated updated." -ForegroundColor Cyan
