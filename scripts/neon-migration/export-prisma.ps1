# Export from Prisma Postgres
# Usage: .\export-prisma.ps1

$ErrorActionPreference = "Stop"

# Get connection string from env or prompt
$PRISMA_URL = $env:PRISMA_URL
if (-not $PRISMA_URL) {
    $PRISMA_URL = Read-Host "Enter Prisma Postgres connection string"
}

# Validate connection string
if ($PRISMA_URL -notmatch "postgres://") {
    Write-Error "Invalid connection string. Must start with postgres://"
    exit 1
}

# Parse connection string for pg_dump
# Format: postgres://USER:PASS@HOST:PORT/DB?sslmode=require
$match = [regex]::Match($PRISMA_URL, "postgres://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)")
if (-not $match.Success) {
    Write-Error "Could not parse connection string"
    exit 1
}

$PGUSER = $match.Groups[1].Value
$PGPASSWORD = $match.Groups[2].Value
$PGHOST = $match.Groups[3].Value
$PGPORT = $match.Groups[4].Value
$PGDATABASE = $match.Groups[5].Value

# Set environment variables for pg_dump
$env:PGPASSWORD = $PGPASSWORD

# Output filename
$timestamp = Get-Date -Format "yyyy-MM-dd-HHmm"
$outputFile = "prisma-export-$timestamp.sql"

Write-Host "=== Prisma Postgres Export ===" -ForegroundColor Cyan
Write-Host "Host: $PGHOST"
Write-Host "Database: $PGDATABASE"
Write-Host "Output: $outputFile"
Write-Host ""

# Test connection first
Write-Host "Testing connection..." -ForegroundColor Yellow
try {
    $testResult = psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Connection test failed: $testResult"
        exit 1
    }
    Write-Host "Connection OK" -ForegroundColor Green
} catch {
    Write-Error "Connection failed: $_"
    exit 1
}

# Get table counts before export
Write-Host ""
Write-Host "Getting table counts..." -ForegroundColor Yellow
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

psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c $tableCountQuery | Tee-Object -FilePath "table-counts-prisma.txt"

# Run pg_dump
Write-Host ""
Write-Host "Running pg_dump..." -ForegroundColor Yellow
Write-Host "This may take a few minutes for large databases..."

pg_dump `
    -h $PGHOST `
    -p $PGPORT `
    -U $PGUSER `
    -d $PGDATABASE `
    --no-owner `
    --no-acl `
    --clean `
    --if-exists `
    --format=plain `
    --file=$outputFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE"
    exit 1
}

# Get file size
$fileSize = (Get-Item $outputFile).Length / 1MB
Write-Host ""
Write-Host "=== Export Complete ===" -ForegroundColor Green
Write-Host "File: $outputFile"
Write-Host "Size: $([math]::Round($fileSize, 2)) MB"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Create Neon database at https://console.neon.tech"
Write-Host "2. Set NEON_URL environment variable"
Write-Host "3. Run: .\import-neon.ps1"

# Clear password from env
$env:PGPASSWORD = ""
