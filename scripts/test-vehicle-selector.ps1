# Vehicle Selector Regression Test
# Tests tire API flow for 4 vehicles

$baseUrl = "http://localhost:3000"
$vehicles = @(
    @{ Year = "1969"; Make = "Chevrolet"; Model = "Camaro" },
    @{ Year = "1996"; Make = "Dodge"; Model = "Ram 1500" },
    @{ Year = "2024"; Make = "Ford"; Model = "F-150" },
    @{ Year = "2023"; Make = "Chevrolet"; Model = "Tahoe" }
)

Write-Host "`n=== VEHICLE SELECTOR REGRESSION TEST ===" -ForegroundColor Cyan
Write-Host "Testing API endpoints for 4 vehicles`n" -ForegroundColor Gray

$passCount = 0
$failCount = 0

foreach ($v in $vehicles) {
    Write-Host "$($v.Year) $($v.Make) $($v.Model)" -NoNewline
    
    try {
        # Test makes API
        $makesUrl = "$baseUrl/api/vehicles/makes?year=$($v.Year)"
        $makesRes = Invoke-RestMethod -Uri $makesUrl -Method Get -TimeoutSec 10
        $hasMake = $makesRes.results -contains $v.Make
        
        if (-not $hasMake) {
            Write-Host " [FAIL - Make not found]" -ForegroundColor Red
            $failCount++
            continue
        }
        
        # Test models API
        $modelsUrl = "$baseUrl/api/vehicles/models?year=$($v.Year)&make=$($v.Make)"
        $modelsRes = Invoke-RestMethod -Uri $modelsUrl -Method Get -TimeoutSec 10
        $hasModel = $modelsRes.results -contains $v.Model
        
        if (-not $hasModel) {
            Write-Host " [FAIL - Model not found]" -ForegroundColor Red
            $failCount++
            continue
        }
        
        # Test trims API
        $trimsUrl = "$baseUrl/api/vehicles/trims?year=$($v.Year)&make=$($v.Make)&model=$($v.Model)"
        $trimsRes = Invoke-RestMethod -Uri $trimsUrl -Method Get -TimeoutSec 10
        $trimCount = $trimsRes.results.Count
        
        if ($trimCount -eq 0) {
            Write-Host " [PARTIAL - No trims found]" -ForegroundColor Yellow
        } else {
            Write-Host " [PASS - $trimCount trims]" -ForegroundColor Green
            $passCount++
        }
    }
    catch {
        Write-Host " [ERROR - $($_.Exception.Message)]" -ForegroundColor Red
        $failCount++
    }
}

Write-Host "`n=== SUMMARY ===" -ForegroundColor Cyan
Write-Host "PASS: $passCount/4" -ForegroundColor Green
Write-Host "FAIL: $failCount/4" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
