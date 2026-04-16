# Verify Migration - Compare Prisma and Neon databases
# Usage: .\verify-migration.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Migration Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check if count files exist
if (-not (Test-Path "table-counts-prisma.txt") -or -not (Test-Path "table-counts-neon.txt")) {
    Write-Error "Missing table count files. Run export and import scripts first."
    exit 1
}

Write-Host "Comparing table counts..." -ForegroundColor Yellow
Write-Host ""

# Parse counts
function Parse-TableCounts($file) {
    $counts = @{}
    $content = Get-Content $file
    foreach ($line in $content) {
        if ($line -match "^\s*(\S+)\s*\|\s*(\d+)") {
            $table = $matches[1]
            $count = [int]$matches[2]
            $counts[$table] = $count
        }
    }
    return $counts
}

$prismaCounts = Parse-TableCounts "table-counts-prisma.txt"
$neonCounts = Parse-TableCounts "table-counts-neon.txt"

# Compare
$allTables = @($prismaCounts.Keys) + @($neonCounts.Keys) | Sort-Object -Unique
$hasErrors = $false

Write-Host ("{0,-40} {1,12} {2,12} {3,10}" -f "TABLE", "PRISMA", "NEON", "STATUS")
Write-Host ("-" * 80)

foreach ($table in $allTables) {
    $prisma = if ($prismaCounts.ContainsKey($table)) { $prismaCounts[$table] } else { 0 }
    $neon = if ($neonCounts.ContainsKey($table)) { $neonCounts[$table] } else { 0 }
    
    if ($prisma -eq $neon) {
        $status = "OK"
        $color = "Green"
    } elseif ($prisma -eq 0) {
        $status = "NEW"
        $color = "Yellow"
    } elseif ($neon -eq 0) {
        $status = "MISSING"
        $color = "Red"
        $hasErrors = $true
    } else {
        $diff = $neon - $prisma
        $status = if ($diff -gt 0) { "+$diff" } else { "$diff" }
        $color = "Yellow"
    }
    
    Write-Host ("{0,-40} {1,12:N0} {2,12:N0} " -f $table, $prisma, $neon) -NoNewline
    Write-Host $status -ForegroundColor $color
}

Write-Host ""
Write-Host ("-" * 80)

# Summary
$totalPrisma = ($prismaCounts.Values | Measure-Object -Sum).Sum
$totalNeon = ($neonCounts.Values | Measure-Object -Sum).Sum

Write-Host ("{0,-40} {1,12:N0} {2,12:N0}" -f "TOTAL ROWS", $totalPrisma, $totalNeon)
Write-Host ""

if ($hasErrors) {
    Write-Host "RESULT: FAILED - Some tables are missing or have 0 rows" -ForegroundColor Red
    Write-Host "DO NOT proceed to production cutover!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "RESULT: PASSED - All tables verified" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Test locally: set POSTGRES_URL to Neon connection string"
    Write-Host "2. Run: npm run dev"
    Write-Host "3. Test critical flows:"
    Write-Host "   - YMM selectors (year/make/model dropdowns)"
    Write-Host "   - Wheel fitment search"
    Write-Host "   - Tire search"
    Write-Host "   - POS flow"
    Write-Host "   - Staggered fitment (2020 Ford Mustang GT Performance)"
    Write-Host "4. Update Vercel Preview environment variable"
    Write-Host "5. Test Preview deployment"
    Write-Host "6. Update Production environment variable"
}
