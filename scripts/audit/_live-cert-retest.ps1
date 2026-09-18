$B = "http://localhost:3002"
function J($u) { (curl.exe -s --max-time 600 $u) | ConvertFrom-Json }

"--- fitment-search M4 Competition xDrive (wheel side) ---"
$fs = J "$B/api/wheels/fitment-search?year=2024&make=BMW&model=M4&modification=2024-bmw-m4-competition-xdrive&pageSize=5"
"block=$($fs.fitment.certificationBlock) certifiable=$($fs.fitment.certifiable) showGuaranteedFit=$($fs.fitment.showGuaranteedFit) sv=$($fs.fitment.sourceVerification | ConvertTo-Json -Compress) results=$($fs.results.Count)"
$fs.results | Select-Object -First 3 | ForEach-Object { "  $($_.sku) class=$($_.fitmentClass)$($_.fitment.fitmentClass) geometryClass=$($_.geometryClass)$($_.fitment.geometryClass) certified=$($_.certified)$($_.fitment.certified) block=$($_.certificationBlock)$($_.fitment.certificationBlock)" }
$sku120 = ($fs.results | Select-Object -First 1).sku
"--- check-fitment M4 Competition xDrive WITH trim, 5x120 wheel ($sku120) ---"
$cf = J "$B/api/wheels/check-fitment?year=2024&make=BMW&model=M4&modification=2024-bmw-m4-competition-xdrive&sku=$sku120"
"fits=$($cf.fits) reason=$($cf.reason) boltCompat=$($cf.boltPatternCompatible) block=$($cf.certificationBlock) note=$($cf.sourceNote)"
"--- check-fitment M4 WITH trim, 5x114.3 Mustang wheel (D68117906545) - must NOT reject on an unverified pattern ---"
$cf2 = J "$B/api/wheels/check-fitment?year=2024&make=BMW&model=M4&modification=2024-bmw-m4-competition-xdrive&sku=D68117906545"
"fits=$($cf2.fits) reason=$($cf2.reason) boltCompat=$($cf2.boltPatternCompatible) block=$($cf2.certificationBlock)"
"--- Raptor: resolve modification id ---"
$tr = J "$B/api/vehicles/trims?year=2020&make=Ford&model=F-150"
$rap = $tr.results | Where-Object { $_.label -eq "Raptor" } | Select-Object -First 1
"raptor value=$($rap.value) modificationId=$($rap.modificationId)"
"--- fitment-search Raptor (verified wheel specs) ---"
$fsr = J "$B/api/wheels/fitment-search?year=2020&make=Ford&model=F-150&modification=$($rap.value)&pageSize=3"
"block=$($fsr.fitment.certificationBlock) certifiable=$($fsr.fitment.certifiable) showGuaranteedFit=$($fsr.fitment.showGuaranteedFit) blocked=$($fsr.blocked) results=$($fsr.results.Count)"
$skuR = ($fsr.results | Select-Object -First 1).sku
if ($skuR) {
  $cfr = J "$B/api/wheels/check-fitment?year=2020&make=Ford&model=F-150&modification=$($rap.value)&sku=$skuR"
  "raptor check-fitment sku=$skuR fits=$($cfr.fits) reason=$($cfr.reason) block=$($cfr.certificationBlock)"
}
"--- tires/search Raptor 17 (tire side) ---"
$ts = J "$B/api/tires/search?year=2020&make=Ford&model=F-150&modification=$($rap.value)&wheelDiameter=17&limit=5"
"certifiable=$($ts.certifiable) trimRequired=$($ts.trimRequired) block=$($ts.certificationBlock) scope=$($ts.tireSizesScope) results=$($ts.results.Count)"
$ts.results | Select-Object -First 2 | ForEach-Object { "  $($_.sku) size=$($_.size) fitBadgeAllowed=$($_.fitBadgeAllowed) fitBlockReason=$($_.fitBlockReason) loadIndexOk=$($_.loadIndexOk)" }
"--- tires/search Silverado 2500 HD LT (verified) ---"
$ts2 = J "$B/api/tires/search?year=2024&make=Chevrolet&model=Silverado%202500%20HD&modification=LT&limit=3"
"certifiable=$($ts2.certifiable) block=$($ts2.certificationBlock) scope=$($ts2.tireSizesScope) results=$($ts2.results.Count)"
$ts2.results | Select-Object -First 2 | ForEach-Object { "  $($_.sku) size=$($_.size) fitBadgeAllowed=$($_.fitBadgeAllowed) fitBlockReason=$($_.fitBlockReason) reqLI=$($_.requiredLoadIndex) src=$($_.requiredLoadIndexSource)" }
"--- check-fitment Silverado 2500 HD LT with its first wheel (verified path still certifies) ---"
$fsh = J "$B/api/wheels/fitment-search?year=2024&make=Chevrolet&model=Silverado%202500%20HD&modification=LT&pageSize=3"
"hd fitment-search block=$($fsh.fitment.certificationBlock) certifiable=$($fsh.fitment.certifiable) showGuaranteedFit=$($fsh.fitment.showGuaranteedFit) results=$($fsh.results.Count)"
$skuH = ($fsh.results | Select-Object -First 1).sku
if ($skuH) {
  $cfh = J "$B/api/wheels/check-fitment?year=2024&make=Chevrolet&model=Silverado%202500%20HD&modification=LT&sku=$skuH"
  "hd check-fitment sku=$skuH fits=$($cfh.fits) reason=$($cfh.reason) block=$($cfh.certificationBlock)"
}
