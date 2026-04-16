# Import to Neon
# Usage: .\import-neon.ps1 [-SqlFile prisma-export-2024-01-01.sql]

param(
    [string]$SqlFile
)

$ErrorActionPreference = "Stop"

# Find latest export file if not specified
if (-not $SqlFile) {
    $SqlFile = Get-ChildItem -Filter "prisma-export-*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty Name
    if (-not $SqlFile) {
        Write-Error "No export file found. Run export-prisma.ps1 first."
        exit 1
    }
    Write-Host "Using latest export: $SqlFile" -ForegroundColor Yellow
}

if (-not (Test-Path $SqlFile)) {
    Write-Error "File not found: $SqlFile"
    exit 1
}

# Get connection string from env or prompt
$NEON_URL = $env:NEON_URL
if (-not $NEON_URL) {
    $NEON_URL = Read-Host "Enter Neon connection string"
}

# Validate connection string
if ($NEON_URL -notmatch "neon\.tech") {
    Write-Warning "Connection string doesn't contain 'neon.tech'. Are you sure this is a Neon URL?"
    $confirm = Read-Host "Continue? (y/n)"
    if ($confirm -ne "y") {
        exit 1
    }
}

# Parse connection string
# Format: postgres://USER:PASS@HOST/DB?sslmode=require
$match = [regex]::Match($NEON_URL, "postgres://([^:]+):([^@]+)@([^/]+)/([^?]+)")
if (-not $match.Success) {
    Write-Error "Could not parse connection string"
    exit 1
}

$PGUSER = $match.Groups[1].Value
$PGPASSWORD = $match.Groups[2].Value
$PGHOST = $match.Groups[3].Value
$PGDATABASE = $match.Groups[4].Value

# Set environment variables for psql
$env:PGPASSWORD = $PGPASSWORD

Write-Host "=== Neon Import ===" -ForegroundColor Cyan
Write-Host "Host: $PGHOST"
Write-Host "Database: $PGDATABASE"
Write-Host "Import file: $SqlFile"
Write-Host ""

# Test connection first
Write-Host "Testing connection..." -ForegroundColor Yellow
try {
    $testResult = psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Connection test failed: $testResult"
        exit 1
    }
    Write-Host "Connection OK" -ForegroundColor Green
} catch {
    Write-Error "Connection failed: $_"
    exit 1
}

# Confirm before import (destructive operation)
Write-Host ""
Write-Host "WARNING: This will DROP and recreate all tables in the Neon database!" -ForegroundColor Red
$confirm = Read-Host "Type 'yes' to continue"
if ($confirm -ne "yes") {
    Write-Host "Aborted."
    exit 1
}

# Run import
Write-Host ""
Write-Host "Running import..." -ForegroundColor Yellow
Write-Host "This may take several minutes..."

$startTime = Get-Date
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -f $SqlFile 2>&1 | Tee-Object -FilePath "import-log.txt"
$endTime = Get-Date
$duration = $endTime - $startTime

if ($LASTEXITCODE -ne 0) {
    Write-Error "Import failed. Check import-log.txt for details."
    exit 1
}

Write-Host ""
Write-Host "=== Import Complete ===" -ForegroundColor Green
Write-Host "Duration: $([math]::Round($duration.TotalMinutes, 1)) minutes"
Write-Host ""

# Verify by getting table counts
Write-Host "Verifying table counts..." -ForegroundColor Yellow
$tableCountQuery = @"
SELECT table_name, 
       (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT table_name, 
         query_to_xml(format('select count(*) as cnt from %I.%I', table_schema, table_name), false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
) t
ORDER BY row_count DESC;
"@

psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c $tableCountQuery | Tee-Object -FilePath "table-counts-neon.txt"

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Compare table-counts-prisma.txt and table-counts-neon.txt"
Write-Host "2. Run: .\verify-migration.ps1"
Write-Host "3. Test locally with POSTGRES_URL set to Neon"
Write-Host "4. Update Vercel Preview environment"

# Clear password from env
$env:PGPASSWORD = ""
