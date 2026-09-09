<#
.SYNOPSIS
    Shows what's actually live in the database for a SQL object, versus the backup files sitting
    next to this script in this folder.

.DESCRIPTION
    Every file in this folder named "<object>_backup_pre_<reason>_<date>.sql" is a point-in-time
    snapshot captured immediately BEFORE a specific fix was applied -- never the current state.
    The database itself is always the only source of truth for what's live. This script answers
    "what's live, and how does it compare to my most recent backup" in one call instead of manually
    piecing it together from OBJECT_DEFINITION and file timestamps.

.PARAMETER ObjectName
    The object name without schema, e.g. "a1_usp_AIP2" (matches dbo.a1_usp_AIP2 and any
    a1_usp_AIP2_backup_*.sql files in this folder).

.PARAMETER Password
    The sa password for the target server. Not defaulted here on purpose -- see RISK-090 in the
    Obsidian vault (Risks & Technical Debt/Risk Register.md): the sa password for this class of
    server is already a known, open, critical credential-exposure risk from a different file
    (appsettings.Development.json). Hardcoding it as a default here would add a second exposure
    site for the same problem instead of fixing it. Pass it explicitly each run.

.EXAMPLE
    .\whats-live.ps1 -ObjectName a1_usp_AIP2 -Password "..."

.EXAMPLE
    .\whats-live.ps1 -ObjectName vProgramLatest -Server "192.168.50.200" -Database "myps_db_dev" -Password "..."
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$ObjectName,

    [string]$Server = "192.168.50.200",
    [string]$Database = "myps_db_dev",
    [string]$User = "sa",

    [Parameter(Mandatory = $true)]
    [string]$Password
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== Live status: dbo.$ObjectName on $Database ($Server) ===" -ForegroundColor Cyan
$liveInfo = & sqlcmd -S $Server -U $User -P $Password -d $Database -Q "SET NOCOUNT ON; SELECT name, type_desc, create_date, modify_date FROM sys.objects WHERE name = '$ObjectName';" -y 0 -Y 0
if (-not $liveInfo -or $liveInfo.Trim().Length -eq 0) {
    Write-Host "No object named '$ObjectName' found in $Database. Check spelling/casing." -ForegroundColor Red
    exit 1
}
Write-Host $liveInfo

Write-Host ""
Write-Host "=== Backup files for this object in this folder, oldest to newest ===" -ForegroundColor Cyan
$backups = Get-ChildItem -Path $scriptDir -Filter "${ObjectName}_backup_*.sql" | Sort-Object Name
if ($backups.Count -eq 0) {
    Write-Host "None found matching '${ObjectName}_backup_*.sql'."
    exit 0
}

$i = 1
foreach ($b in $backups) {
    Write-Host "  $i. $($b.Name)"
    $i++
}

$mostRecent = $backups[-1]
Write-Host ""
Write-Host "Most recent backup (state immediately BEFORE the latest fix): $($mostRecent.Name)" -ForegroundColor Yellow

Write-Host ""
Write-Host "=== Diff: live definition vs. most recent backup ===" -ForegroundColor Cyan
$liveDefFile = [System.IO.Path]::GetTempFileName()
& sqlcmd -S $Server -U $User -P $Password -d $Database -Q "SET NOCOUNT ON; SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.$ObjectName'));" -y 0 -Y 0 -o $liveDefFile

$diff = Compare-Object -ReferenceObject (Get-Content $mostRecent.FullName) -DifferenceObject (Get-Content $liveDefFile)
if ($diff) {
    $diff | ForEach-Object {
        if ($_.SideIndicator -eq "=>") {
            Write-Host "+ (live)   $($_.InputObject)" -ForegroundColor Green
        } else {
            Write-Host "- (backup) $($_.InputObject)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "No differences -- live definition matches the most recent backup exactly." -ForegroundColor Yellow
    Write-Host "(Unexpected for a '_backup_pre_<fix>' file -- a backup should predate a change. Worth a second look.)" -ForegroundColor Yellow
}

Remove-Item $liveDefFile -ErrorAction SilentlyContinue
