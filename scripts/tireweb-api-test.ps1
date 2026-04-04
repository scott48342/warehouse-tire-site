# TireWeb API Direct Test Script
# Tests the SOAP API directly without going through the application

param(
    [string]$TireSize = "2656020",
    [int]$ConnectionId = 488677,  # ATD default
    [switch]$Verbose
)

# Load credentials from .env.local
$envFile = Join-Path $PSScriptRoot "..\\.env.local"
$envContent = Get-Content $envFile -ErrorAction SilentlyContinue
$accessKey = ($envContent | Where-Object { $_ -match "^TIREWIRE_ACCESS_KEY=" }) -replace "^TIREWIRE_ACCESS_KEY=", ""
$groupToken = ($envContent | Where-Object { $_ -match "^TIREWIRE_GROUP_TOKEN=" }) -replace "^TIREWIRE_GROUP_TOKEN=", ""

if (-not $accessKey -or -not $groupToken) {
    Write-Error "Missing TIREWIRE_ACCESS_KEY or TIREWIRE_GROUP_TOKEN in .env.local"
    exit 1
}

Write-Host "=== TireWeb API Direct Test ===" -ForegroundColor Cyan
Write-Host "Endpoint: http://ws.tirewire.com/connectionscenter/productsservice.asmx"
Write-Host "Connection ID: $ConnectionId"
Write-Host "Tire Size: $TireSize"
Write-Host "Access Key: $($accessKey.Substring(0,8))..."
Write-Host "Group Token: $($groupToken.Substring(0,8))..."
Write-Host ""

# Build SOAP request
$soapRequest = @"
<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:prod="http://ws.tirewire.com/connectionscenter/productsservice">
  <soap:Body>
    <prod:GetTires>
      <prod:options>
        <prod:AccessKey>$accessKey</prod:AccessKey>
        <prod:GroupToken>$groupToken</prod:GroupToken>
        <prod:ConnectionID>$ConnectionId</prod:ConnectionID>
        <prod:TireSize>$TireSize</prod:TireSize>
        <prod:DetailLevel>10</prod:DetailLevel>
      </prod:options>
    </prod:GetTires>
  </soap:Body>
</soap:Envelope>
"@

function Test-TireWebAPI {
    param(
        [string]$RequestBody,
        [string]$Label
    )
    
    $startTime = Get-Date
    
    try {
        $response = Invoke-WebRequest `
            -Uri "http://ws.tirewire.com/connectionscenter/productsservice.asmx" `
            -Method POST `
            -ContentType "text/xml;charset=UTF-8" `
            -Headers @{
                "SOAPAction" = "http://ws.tirewire.com/connectionscenter/productsservice/GetTires"
            } `
            -Body $RequestBody `
            -UseBasicParsing
        
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        $content = $response.Content
        
        # Extract key info from response
        $errorCode = if ($content -match "<ErrorCode>(\d+)</ErrorCode>") { $matches[1] } else { "0" }
        $errorMsg = if ($content -match "<ErrorMessage>([^<]+)</ErrorMessage>") { $matches[1] } else { "" }
        $tireCount = ([regex]::Matches($content, "<Tire>")).Count
        
        $result = @{
            Label = $Label
            StatusCode = $response.StatusCode
            Duration = [math]::Round($duration)
            ErrorCode = $errorCode
            ErrorMessage = $errorMsg
            TireCount = $tireCount
            ResponseLength = $content.Length
            Success = ($errorCode -eq "0" -and $tireCount -gt 0)
            RawResponse = $content
        }
        
        return $result
    }
    catch {
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalMilliseconds
        
        return @{
            Label = $Label
            StatusCode = "ERROR"
            Duration = [math]::Round($duration)
            ErrorCode = "EXCEPTION"
            ErrorMessage = $_.Exception.Message
            TireCount = 0
            ResponseLength = 0
            Success = $false
            RawResponse = ""
        }
    }
}

function Format-Result {
    param($Result)
    
    if ($Result.Success) {
        $status = "[OK]"
        $statusColor = "Green"
    } else {
        $status = "[FAIL]"
        $statusColor = "Red"
    }
    
    Write-Host "[$($Result.Label)]" -NoNewline
    Write-Host " $status" -ForegroundColor $statusColor -NoNewline
    Write-Host " | HTTP: $($Result.StatusCode) | Time: $($Result.Duration)ms | Tires: $($Result.TireCount) | Size: $($Result.ResponseLength) bytes"
    
    if ($Result.ErrorCode -ne "0") {
        Write-Host "  ErrorCode: $($Result.ErrorCode) - $($Result.ErrorMessage)" -ForegroundColor Yellow
    }
}

# ========== TEST 1: Single Request ==========
Write-Host ""
Write-Host "=== TEST 1: Single Request ===" -ForegroundColor Cyan
$result1 = Test-TireWebAPI -RequestBody $soapRequest -Label "Single"
Format-Result $result1

# Show raw response for first test
if ($result1.RawResponse) {
    Write-Host ""
    Write-Host "Raw Response (first 500 chars):" -ForegroundColor Gray
    Write-Host $result1.RawResponse.Substring(0, [Math]::Min(500, $result1.RawResponse.Length)) -ForegroundColor DarkGray
}

# ========== TEST 2: 3 Rapid Requests ==========
Write-Host ""
Write-Host "=== TEST 2: 3 Rapid Requests (no delay) ===" -ForegroundColor Cyan
$results2 = @()
for ($i = 1; $i -le 3; $i++) {
    $result = Test-TireWebAPI -RequestBody $soapRequest -Label "Rapid-$i"
    $results2 += $result
    Format-Result $result
}

# ========== TEST 3: Different Tire Sizes ==========
Write-Host ""
Write-Host "=== TEST 3: Different Tire Sizes (500ms between) ===" -ForegroundColor Cyan
$sizes = @("2656020", "2454518", "2757017")
$sizeLabels = @("265/60R20", "245/45R18", "275/70R17")

for ($i = 0; $i -lt $sizes.Length; $i++) {
    $testRequest = $soapRequest -replace "2656020", $sizes[$i]
    $result = Test-TireWebAPI -RequestBody $testRequest -Label $sizeLabels[$i]
    Format-Result $result
    Start-Sleep -Milliseconds 500
}

# ========== TEST 4: All 3 Connections ==========
Write-Host ""
Write-Host "=== TEST 4: All 3 TireWeb Connections ===" -ForegroundColor Cyan
$connections = @(
    @{ Id = 488677; Name = "ATD" },
    @{ Id = 488546; Name = "NTW" },
    @{ Id = 488548; Name = "USAutoForce" }
)

foreach ($conn in $connections) {
    $testRequest = $soapRequest -replace "ConnectionID>488677", "ConnectionID>$($conn.Id)"
    $result = Test-TireWebAPI -RequestBody $testRequest -Label $conn.Name
    Format-Result $result
    Start-Sleep -Milliseconds 500
}

# ========== TEST 5: Recovery Test ==========
Write-Host ""
Write-Host "=== TEST 5: Recovery Test (wait 10s between) ===" -ForegroundColor Cyan
$result5a = Test-TireWebAPI -RequestBody $soapRequest -Label "Before-Wait"
Format-Result $result5a
Write-Host "Waiting 10 seconds..."
Start-Sleep -Seconds 10
$result5b = Test-TireWebAPI -RequestBody $soapRequest -Label "After-Wait"
Format-Result $result5b

# ========== SUMMARY ==========
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "           SUMMARY" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Single request result: $(if ($result1.Success) { 'SUCCESS - Got ' + $result1.TireCount + ' tires' } else { 'FAILED - ErrorCode ' + $result1.ErrorCode })"
Write-Host "Rapid requests: $($results2 | Where-Object { $_.Success } | Measure-Object | Select-Object -ExpandProperty Count)/3 succeeded"
Write-Host "Recovery after 10s wait: $(if ($result5b.Success) { 'YES - API recovered' } else { 'NO - Still failing' })"
Write-Host ""

if (-not $result1.Success -and $result1.ErrorCode -eq "127") {
    Write-Host "CONCLUSION: API is returning ErrorCode 127 (rate limited)" -ForegroundColor Red
    Write-Host "This is an API-side limitation applied to this account/IP." -ForegroundColor Red
    Write-Host "The issue is NOT in the application implementation." -ForegroundColor Red
} elseif ($result1.Success) {
    Write-Host "CONCLUSION: API is responding normally with tire data" -ForegroundColor Green
    Write-Host "If app shows rate limit errors, the issue is in implementation." -ForegroundColor Green
} else {
    Write-Host "CONCLUSION: API error - ErrorCode $($result1.ErrorCode)" -ForegroundColor Yellow
    Write-Host "Investigate credential or request format issues." -ForegroundColor Yellow
}
