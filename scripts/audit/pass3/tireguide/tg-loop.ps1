# Tire Guide Pro extraction loop â€” drives the Tire Power Front Counter (RDP) via win-relay, prints each Y/M/M to PDF
# on this PC (\\tsclient\F redirection), parses with tg-parse.py, keeps JSON, deletes PDF.
#   powershell -NoProfile -File tg-loop.ps1 [-Worklist worklist.json] [-Limit 20] [-Only "1998|ford|ranger,2011|lexus|gs"] [-Hwnd 4983028]
# PAUSE: create F:\clawd\tire-guide-pdfs\PAUSE ; loop finishes current vehicle and exits cleanly. Resumable: skips existing out JSON.
param(
  [string]$Worklist = "$PSScriptRoot\worklist.json",
  [int]$Limit = 0,
  [string]$Only = "",
  [int]$Hwnd = 4983028,
  [switch]$KeepPdf
)
$ErrorActionPreference = "Continue"
$RELAY = "g:\clawd\win-relay\relay.js"
$PDFDIR = "F:\clawd\tire-guide-pdfs"
$OUT = "$PSScriptRoot\out"
$LOG = "$OUT\log.jsonl"
$PAUSE = "$PDFDIR\PAUSE"
$T = "hwnd:$Hwnd"
$makes = Get-Content "$PSScriptRoot\tg-makes.json" -Raw | ConvertFrom-Json
$truckRx = [regex]::new($makes._truckModelRegex, "IgnoreCase")
$mkIndex = (Get-Content "$PSScriptRoot\tg-make-index.json" -Raw | ConvertFrom-Json).names
$CORR = "$PSScriptRoot\out\tg-make-corrections.jsonl"
New-Item -ItemType Directory -Force -Path $OUT, $PDFDIR | Out-Null

function Rly { param([Parameter(ValueFromRemainingArguments)]$a) & node $RELAY @a 2>&1 | Out-Null }
function Wins { (Invoke-RestMethod "http://127.0.0.1:9334/windows" -TimeoutSec 5) }
function HasWin($t) { (Wins | Where-Object { $_.title -like "*$t*" } | Measure-Object).Count -gt 0 }
function WaitWin($t, $secs, $gone = $false) {
  $end = (Get-Date).AddSeconds($secs)
  while ((Get-Date) -lt $end) { $h = HasWin $t; if ($gone -and -not $h) { return $true }; if (-not $gone -and $h) { return $true }; Start-Sleep -Milliseconds 300 }
  return $false
}
function SetField($x, $y, $text) {
  Rly dclick $x $y; Start-Sleep -Milliseconds 120
  Rly key "ctrl+a"; Start-Sleep -Milliseconds 80
  if ($text -eq "") { Rly key "delete" } else { Rly type $text }
  Start-Sleep -Milliseconds 150
  Rly key "tab"; Start-Sleep -Milliseconds 350   # commit field (Model stays disabled until Make is committed)
}
function ModelName($slug) {
  # slug â†’ Tire Guide-ish display: 'f-150'â†’'F-150', 'silverado-1500'â†’'Silverado 1500', 'grand-cherokee'â†’'Grand Cherokee', 'gs'â†’'GS', 'cr-v'â†’'CR-V'
  $keep = @{ "f-150"="F-150"; "f-250"="F-250"; "f-350"="F-350"; "f-450"="F-450"; "e-150"="E-150"; "e-250"="E-250"; "e-350"="E-350"; "cr-v"="CR-V"; "hr-v"="HR-V"; "cx-5"="CX-5"; "cx-9"="CX-9"; "cx-30"="CX-30"; "cx-50"="CX-50"; "cx-70"="CX-70"; "cx-90"="CX-90"; "mx-5"="MX-5"; "rav4"="RAV4"; "4runner"="4Runner"; "c-class"="C"; "e-class"="E"; "s-class"="S"; "3-series"="3"; "5-series"="5"; "7-series"="7"; "x3"="X3"; "x5"="X5"; "is"="IS"; "es"="ES"; "gs"="GS"; "ls"="LS"; "rx"="RX"; "gx"="GX"; "lx"="LX"; "nx"="NX"; "ux"="UX"; "tlx"="TLX"; "mdx"="MDX"; "rdx"="RDX"; "ilx"="ILX"; "tsx"="TSX"; "tl"="TL"; "rl"="RL"; "wrx"="WRX"; "brz"="BRZ"; "gr86"="GR86"; "gr-corolla"="GR Corolla"; "c/k-1500"="C/K 1500"; "c/k-2500"="C/K 2500"; "c/k-3500"="C/K 3500"; "s-10"="S10"; "s10"="S10"; "srx"="SRX"; "cts"="CTS"; "ats"="ATS"; "xts"="XTS"; "ct6"="CT6"; "ct5"="CT5"; "ct4"="CT4"; "xt4"="XT4"; "xt5"="XT5"; "xt6"="XT6"; "hhr"="HHR"; "id.4"="ID.4"; "q5"="Q5"; "q7"="Q7"; "a4"="A4"; "a6"="A6"; "tt"="TT"; "xc90"="XC90"; "xc60"="XC60"; "xc40"="XC40"; "s60"="S60"; "v60"="V60"; "qx60"="QX60"; "qx80"="QX80"; "qx50"="QX50"; "g35"="G35"; "g37"="G37"; "q50"="Q50"; "q60"="Q60"; "fj-cruiser"="FJ Cruiser"; "mkz"="MKZ"; "mkx"="MKX"; "mkc"="MKC"; "mkt"="MKT"; "mks"="MKS"; "tc"="tC"; "xb"="xB"; "xd"="xD"; "frs"="FR-S"; "fr-s"="FR-S"; "iq"="iQ"; "ram-1500"="1500"; "ram-2500"="2500"; "ram-3500"="3500" }
  if ($keep.ContainsKey($slug)) { return $keep[$slug] }
  $s = $slug -replace "-", " "
  return (Get-Culture).TextInfo.ToTitleCase($s)
}
function Safe($s) { return ($s -replace '[\\/:*?<>|]', '_') }
function LetterGroup($year, $name) {
  # names present in $year that start with the same letter as $name, sorted like the picker (case-insensitive, ordinal-ish)
  $L = $name.Substring(0,1).ToUpper()
  $grp = @()
  foreach ($p in $mkIndex.PSObject.Properties) { $w = $p.Value; if ($p.Name.Substring(0,1).ToUpper() -eq $L -and $year -ge $w[0] -and $year -le $w[1]) { $grp += $p.Name } }
  return @($grp | Sort-Object { $_.ToLower() })
}
function SetMake($year, $name, [int]$kAdj = 0, [int]$attemptsLeft = 3) {
  # returns $true if picker accepted; verification happens later via PDF header
  Rly dclick 224 134; Start-Sleep -Milliseconds 100; Rly key "ctrl+a"; Rly key "delete"; Start-Sleep -Milliseconds 150
  Rly click 341 134
  if (-not (WaitWin "Select Vehicle Make" 6)) { return $false }
  Rly focus "Select Vehicle Make"; Start-Sleep -Milliseconds 250
  Rly key "home"; Start-Sleep -Milliseconds 250
  $grp = LetterGroup $year $name
  $k = [Array]::IndexOf($grp, $name); if ($k -lt 0) { $k = 0 }
  $k += $kAdj; if ($k -lt 0) { $k = 0 }
  $letter = $name.Substring(0,1).ToLower()
  for ($i = 0; $i -le $k; $i++) { Rly key $letter; Start-Sleep -Milliseconds 280 }
  Rly key "enter"
  if (-not (WaitWin "Select Vehicle Make" 4 $true)) { Rly key "escape"; return $false }
  Start-Sleep -Milliseconds 400
  # verify: OCR the Make field
  Rly shot $T "tg-makefield"; Start-Sleep -Milliseconds 150
  $got = (& powershell -NoProfile -File "$PSScriptRoot\tg-ocr.ps1" "$env:TEMP\win_relay\tg-makefield.png" -Crop "140,124,200,22" -Scale 6 2>$null | Select-Object -First 1)
  $got = if ($got) { ($got -replace "^Make:?\s*", "").Trim() } else { "" }
  if ((NormName $got) -eq (NormName $name)) { return $true }
  # mis-landed: compute adjustment from the letter group if we recognise what we got
  $gotName = $null; foreach ($n in $grp) { if ((NormName $n) -eq (NormName $got)) { $gotName = $n } }
  @{ ts = (Get-Date).ToString("s"); year = $year; wanted = $name; got = $got; k = $k } | ConvertTo-Json -Compress | Add-Content $CORR
  if ($attemptsLeft -le 0) { return $false }
  $adj = 1; if ($gotName) { $gi = [Array]::IndexOf($grp, $gotName); $wi = [Array]::IndexOf($grp, $name); if ($gi -ge 0 -and $wi -ge 0 -and $gi -ne $wi) { $adj = $wi - $gi } }
  # wrapped past the end (landed on first-of-group or another letter) -> fewer presses
  if (-not $gotName -and $got -and $got.Substring(0,1).ToUpper() -ne $letter.ToUpper()) { $adj = -1 }
  if (-not $gotName -and $gotName -eq $null -and $got -and (NormName $got) -eq (NormName $grp[0]) -and $k -gt 0) { $adj = -1 }
  return (SetMake $year $name ($kAdj + $adj) ($attemptsLeft - 1))
}
function HeaderMake($json) {
  # 'Ford Trucks Ranger' → compare against candidate names (longest match wins)
  $raw = $json.header.make_model_raw
  if (-not $raw) { return $null }
  $best = $null
  foreach ($p in $mkIndex.PSObject.Properties) { if ($raw.StartsWith($p.Name + " ", [StringComparison]::OrdinalIgnoreCase) -and ($null -eq $best -or $p.Name.Length -gt $best.Length)) { $best = $p.Name } }
  return $best
}
function NormName($s) { if ($null -eq $s) { return "" }; return (($s -replace '[^A-Za-z0-9]', '').ToLower()) }
function CleanOcr($s, $tgMake) {
  $t = ($s -replace '[\u0007\u2010-\u2015]', '-').Trim()
  if ($tgMake -like 'Audi*') { $t = $t -replace '^0(\d)', 'Q$1' }
  $t = $t -replace '^([A-Za-z]) (?=[a-z])', '$1'           # 'E xpedition' -> 'Expedition'
  $t = $t -replace '^F\.(\d{3})', 'F-$1'                   # 'F.150' -> 'F-150'
  if ($tgMake -like 'Ford*') { $t = $t -replace '^6(\d{3})\b', 'F-$1' }   # '6250 Super Duty' -> 'F-250 Super Duty'
  $t = $t -replace '\bsuper Duty\b', 'Super Duty'
  $t = $t -replace '(\*Drive|O rive|xDnve|xDrlve)', 'xDrive'
  $t = $t -replace '^43CIi', '430i'
  if ($t -match 'cancel|IZEE|^Description$') { return '' }
  return $t
}
function EnumModels($year, $tgMake) {
  $cache = "$OUT\_models\$year\$(Safe $tgMake).json"
  if (Test-Path $cache) { return (Get-Content $cache -Raw | ConvertFrom-Json) }
  Rly dclick 480 134; Start-Sleep -Milliseconds 100; Rly key "ctrl+a"; Rly key "delete"; Start-Sleep -Milliseconds 150
  Rly click 605 134
  if (-not (WaitWin "Select Vehicle Model" 6)) { return @() }
  Rly focus "Select Vehicle Model"; Start-Sleep -Milliseconds 250; Rly key "home"; Start-Sleep -Milliseconds 300
  $names = New-Object System.Collections.Generic.List[string]
  $prevHash = ""
  for ($pg = 0; $pg -lt 8; $pg++) {
    $shot = "$env:TEMP\win_relay\tg-models-$pg.png"
    Rly shot "Select Vehicle Model" "tg-models-$pg"; Start-Sleep -Milliseconds 200
    $hash = (Get-FileHash $shot -Algorithm MD5).Hash
    if ($hash -eq $prevHash) { break }
    $prevHash = $hash
    $lines = & powershell -NoProfile -File "$PSScriptRoot\tg-ocr.ps1" $shot 2>$null
    foreach ($l in $lines) {
      $t = CleanOcr $l $tgMake
      if (-not $t -or $t -match '^(Select Vehicle Model|Search:?|D ?escription|x|Select|Cancel)$' -or $t.Length -lt 2) { continue }
      if (-not $names.Contains($t)) { $names.Add($t) }
    }
    Rly key "pagedown"; Start-Sleep -Milliseconds 350
  }
  Rly key "escape"; Start-Sleep -Milliseconds 300
  New-Item -ItemType Directory -Force -Path (Split-Path $cache) | Out-Null
  ($names | ConvertTo-Json) | Set-Content $cache -Encoding UTF8
  return @($names)
}
function MatchModels($ourSlug, $tgModels) {
  # our 'f-150' -> ['F-150']; 'gs' -> ['GS 350','GS 460','GS 450h']; 'silverado-1500' -> ['Silverado 1500']; 'f-250' -> ['F-250','F-250 Super Duty']
  $n = NormName $ourSlug
  # family rules (engine-named luxury models)
  $rx = $null
  if ($ourSlug -match '^(\d)-series') { $d = $Matches[1]; $rx = "^(M)?$d\d{2}[a-z]?\b|^i$d\b" }
  elseif ($ourSlug -match '^x(\d)m?$') { $rx = "^X$($Matches[1])(?!\d)" }
  elseif ($ourSlug -match '^m(\d)$') { $rx = "^M$($Matches[1])(?!\d)" }
  elseif ($ourSlug -match '^z(\d)$') { $rx = "^Z$($Matches[1])" }
  elseif ($ourSlug -match '^i(\d)$') { $rx = "^i$($Matches[1])\b" }
  elseif ($ourSlug -match '^([a-z]{1,3})-class(?:-(coupe|cabriolet|wagon|sedan))?$') { $L = $Matches[1].ToUpper(); $rx = "^$L\d{2,3}|^(Mercedes-)?AMG $L|^$L \d" }
  elseif ($ourSlug -match '^(gla|glb|glc|gle|gls|glk|cla|cls|eqb|eqe|eqs|sl|slk|slc|amg-gt)$') { $L = ($Matches[1] -replace '-', ' ').ToUpper(); $rx = "^$L\b|^(Mercedes-)?AMG $L\b" }
  if ($rx) { $fam = @($tgModels | Where-Object { $_ -match $rx }); if ($fam.Count -gt 0) { return $fam } }
  $exact = @($tgModels | Where-Object { (NormName $_) -eq $n })
  if ($exact.Count -gt 0) { return $exact }
  $pref = @($tgModels | Where-Object { (NormName $_).StartsWith($n) })
  if ($pref.Count -gt 0) { return $pref }
  # our slug longer than TG (e.g. ours 'ram-1500' vs TG '1500'): TG name is suffix of ours
  $suf = @($tgModels | Where-Object { $nn = (NormName $_); $nn.Length -ge 3 -and $n.EndsWith($nn) })
  return $suf
}
function EnumMakes($year) {
  $cache = "$OUT\_makes\$year.json"
  if (Test-Path $cache) { return @(Get-Content $cache -Raw | ConvertFrom-Json) }
  Rly dclick 224 134; Start-Sleep -Milliseconds 100; Rly key "ctrl+a"; Rly key "delete"; Start-Sleep -Milliseconds 150
  Rly click 341 134
  if (-not (WaitWin "Select Vehicle Make" 6)) { return @() }
  Rly focus "Select Vehicle Make"; Start-Sleep -Milliseconds 250; Rly key "home"; Start-Sleep -Milliseconds 300
  $names = New-Object System.Collections.Generic.List[string]
  $prevHash = ""
  for ($pg = 0; $pg -lt 12; $pg++) {
    $shot = "$env:TEMP\win_relay\tg-makes-$pg.png"
    Rly shot "Select Vehicle Make" "tg-makes-$pg"; Start-Sleep -Milliseconds 200
    $hash = (Get-FileHash $shot -Algorithm MD5).Hash
    if ($hash -eq $prevHash) { break }
    $prevHash = $hash
    $lines = & powershell -NoProfile -File "$PSScriptRoot\tg-ocr.ps1" $shot 2>$null
    foreach ($l in $lines) {
      $t = ($l -replace '[\u0007\u2010-\u2015]', '-').Trim(); $t = $t -replace '^([A-Za-z]) (?=[a-z])', '$1'
      if ($t -match '^(Select Vehicle Make|Search:?|D ?escription|x|Select|Cancel)$' -or $t.Length -lt 3) { continue }
      if (-not $names.Contains($t)) { $names.Add($t) }
    }
    Rly key "pagedown"; Start-Sleep -Milliseconds 350
  }
  Rly key "escape"; Start-Sleep -Milliseconds 300
  New-Item -ItemType Directory -Force -Path (Split-Path $cache) | Out-Null
  ($names | ConvertTo-Json) | Set-Content $cache -Encoding UTF8
  return @($names)
}
function ReadMakeField {
  Rly shot $T "tg-makefield"; Start-Sleep -Milliseconds 150
  $got = (& powershell -NoProfile -File "$PSScriptRoot\tg-ocr.ps1" "$env:TEMP\win_relay\tg-makefield.png" -Crop "140,124,200,22" -Scale 6 2>$null | Select-Object -First 1)
  if (-not $got) { Start-Sleep -Milliseconds 600; Rly shot $T "tg-makefield"; Start-Sleep -Milliseconds 150; $got = (& powershell -NoProfile -File "$PSScriptRoot\tg-ocr.ps1" "$env:TEMP\win_relay\tg-makefield.png" -Crop "140,124,200,22" -Scale 6 2>$null | Select-Object -First 1) }
  return $(if ($got) { ($got -replace "^Make:?\s*", "").Trim() } else { "" })
}
function SetMake2($year, $name) {
  $all = EnumMakes $year
  if ($all.Count -eq 0) { return $false }
  $letter = $name.Substring(0,1)
  $grp = @($all | Where-Object { $_.Substring(0,1).ToUpper() -eq $letter.ToUpper() })
  $k = -1; for ($i = 0; $i -lt $grp.Count; $i++) { if ((NormName $grp[$i]) -eq (NormName $name)) { $k = $i } }
  if ($k -lt 0) { return $false }   # make not offered this year
  for ($try = 0; $try -lt 2; $try++) {
    Rly dclick 224 134; Start-Sleep -Milliseconds 100; Rly key "ctrl+a"; Rly key "delete"; Start-Sleep -Milliseconds 150
    Rly click 341 134
    if (-not (WaitWin "Select Vehicle Make" 6)) { return $false }
    Rly focus "Select Vehicle Make"; Start-Sleep -Milliseconds 250; Rly key "home"; Start-Sleep -Milliseconds 250
    $offset = if ((NormName $grp[0]) -eq (NormName $all[0])) { 0 } else { 1 }
    $presses = $k + $offset
    for ($i = 0; $i -lt $presses; $i++) { Rly key $letter.ToLower(); Start-Sleep -Milliseconds 280 }
    Rly key "enter"
    if (-not (WaitWin "Select Vehicle Make" 4 $true)) { Rly key "escape"; return $false }
    Start-Sleep -Milliseconds 700
    $got = ReadMakeField
    if ($got -eq "") { return $true }   # OCR blank: trust presses; PDF header verify catches mis-lands
    if ((NormName $got) -eq (NormName $name)) { return $true }
    @{ ts = (Get-Date).ToString("s"); year = $year; wanted = $name; got = $got; k = $k } | ConvertTo-Json -Compress | Add-Content $CORR
    $gi = -1; for ($i = 0; $i -lt $grp.Count; $i++) { if ((NormName $grp[$i]) -eq (NormName $got)) { $gi = $i } }
    if ($gi -ge 0) { $k += ($k - $gi) } else { break }
    if ($k -lt 0) { break }
  }
  return $false
}
function CloseStray {
  # dismiss message boxes / pickers / inventory jumps
  foreach ($t in "Select Vehicle", "Tire Power", "Error", "Information") { if (HasWin $t) { Rly focus $t; Rly key "escape"; Start-Sleep -Milliseconds 300 } }
}
function OneVehicle($it) {
  $y = $it.year; $mk = $it.make; $md = $it.model
  $outJson = "$OUT\$y\$mk\$(Safe $md).json"
  if (Test-Path $outJson) { return @{ status = "skip" } }
  $cands = @($makes.$mk); if (-not $cands -or $cands.Count -eq 0) { $cands = @((Get-Culture).TextInfo.ToTitleCase($mk)) }
  if (-not $truckRx.IsMatch($md)) { $cands = @($cands | Sort-Object { if ($_ -match "Trucks|Vans|Minivans") { 1 } else { 0 } }) }  # cars: plain make first
  $mName = ModelName $md
  $t0 = Get-Date
  foreach ($tgMake in $cands) {
    if (Test-Path $PAUSE) { return @{ status = "paused" } }

    $attempt = 0; $kAdj = 0
    while ($attempt -lt 3) {
      $attempt++
      Rly focus $T; Start-Sleep -Milliseconds 250
      CloseStray
      SetField 59 134 "$y"
      if (-not (SetMake2 $y $tgMake)) { break }
      $tgModels = EnumModels $y $tgMake
      $targets = MatchModels $md $tgModels
      if ($targets.Count -eq 0) { @{ ts = (Get-Date).ToString("s"); year = $y; make = $mk; model = $md; tgMake = $tgMake; tgModels = $tgModels } | ConvertTo-Json -Compress | Add-Content "$OUT\tg-unmatched-models.jsonl"; break }
      $merged = $null
      foreach ($tgm in $targets) {
        Rly focus $T; Rly dclick 480 134; Start-Sleep -Milliseconds 100; Rly key "ctrl+a"; Rly type $tgm; Start-Sleep -Milliseconds 150
        Rly click 605 134; Start-Sleep -Seconds 3
        CloseStray
        $pdf = "$PDFDIR\$y-$mk-$(Safe $md)-$(Safe $tgm).pdf"
        if (Test-Path $pdf) { Remove-Item $pdf -Force }
        Rly focus $T; Rly click 176 99
        if (-not (WaitWin "Save Print Output As" 8)) { continue }
        Rly focus "Save Print Output As"; Start-Sleep -Milliseconds 300
        Rly type ("\\tsclient\F" + $pdf.Substring(2)); Start-Sleep -Milliseconds 200; Rly key "enter"
        WaitWin "Save Print Output As" 8 $true | Out-Null
        if (HasWin "Confirm Save As") { Rly focus "Confirm Save As"; Rly key "y"; Start-Sleep -Milliseconds 300 }
        WaitWin "Printing Report" 25 $true | Out-Null
        $end = (Get-Date).AddSeconds(15); while ((Get-Date) -lt $end -and -not (Test-Path $pdf)) { Start-Sleep -Milliseconds 300 }
        if (-not (Test-Path $pdf)) { continue }
        $sz = -1; for ($q = 0; $q -lt 20; $q++) { $n2 = (Get-Item $pdf).Length; if ($n2 -eq $sz -and $n2 -gt 0) { break }; $sz = $n2; Start-Sleep -Milliseconds 300 }
        $tmpJson = "$env:TEMP\tg-one.json"
        & python "$PSScriptRoot\tg-parse.py" $pdf --out $tmpJson 2>&1 | Out-Null
        if (-not (Test-Path $tmpJson)) { continue }
        $j = Get-Content $tmpJson -Raw | ConvertFrom-Json
        $gotMake = HeaderMake $j
        if ($gotMake -and $gotMake -ne $tgMake) {
          @{ ts = (Get-Date).ToString("s"); year = $y; wanted = $tgMake; got = $gotMake; kAdj = $kAdj } | ConvertTo-Json -Compress | Add-Content $CORR
          Remove-Item $tmpJson, $pdf -Force -ErrorAction SilentlyContinue
          $grp = LetterGroup $y $tgMake; $gi = [Array]::IndexOf($grp, $gotMake); $wi = [Array]::IndexOf($grp, $tgMake)
          if ($gi -ge 0 -and $wi -ge 0) { $kAdj += ($wi - $gi) } else { $kAdj += 1 }
          $merged = "RETRY"; break
        }
        foreach ($o in $j.options) { $o | Add-Member -NotePropertyName tg_model -NotePropertyValue $tgm -Force }
        if ($null -eq $merged) { $merged = $j } else { $merged.options += $j.options; $merged.n_options += $j.n_options; $merged.n_sizes += $j.n_sizes }
        if (-not $KeepPdf) { Remove-Item $pdf -Force }
        Remove-Item $tmpJson -Force -ErrorAction SilentlyContinue
      }
      if ($merged -is [string] -and $merged -eq "RETRY") { continue }
      if ($null -ne $merged -and $merged.n_options -gt 0) {
        $merged | Add-Member -NotePropertyName tg_make -NotePropertyValue $tgMake -Force
        $merged | Add-Member -NotePropertyName tg_models -NotePropertyValue @($targets) -Force
        $merged | Add-Member -NotePropertyName our -NotePropertyValue @{ year = $y; make = $mk; model = $md } -Force
        New-Item -ItemType Directory -Force -Path (Split-Path $outJson) | Out-Null
        $merged | ConvertTo-Json -Depth 8 | Set-Content $outJson -Encoding UTF8
        return @{ status = "ok"; tgMake = $tgMake; tgModels = ($targets -join "|"); n_options = $merged.n_options; n_sizes = $merged.n_sizes; ms = [int]((Get-Date) - $t0).TotalMilliseconds }
      }      Remove-Item $outJson, $pdf -Force -ErrorAction SilentlyContinue
      break
    }
  }  return @{ status = "empty"; tried = ($cands -join "|"); ms = [int]((Get-Date) - $t0).TotalMilliseconds }
}

$items = Get-Content $Worklist -Raw | ConvertFrom-Json
if ($Only) { $set = $Only -split ","; $items = $items | Where-Object { $set -contains "$($_.year)|$($_.make)|$($_.model)" } }
if ($Limit -gt 0) { $items = $items | Select-Object -First $Limit }
$n = 0; $ok = 0; $empty = 0
foreach ($it in $items) {
  if (Test-Path $PAUSE) { Write-Host "PAUSE file present - stopping."; break }
  $r = OneVehicle $it
  if ($r.status -eq "skip") { continue }
  if ($r.status -eq "paused") { Write-Host "paused"; break }
  $n++; if ($r.status -eq "ok") { $ok++ } elseif ($r.status -eq "empty") { $empty++ }
  $line = @{ ts = (Get-Date).ToString("s"); year = $it.year; make = $it.make; model = $it.model; prio = $it.prio } + $r
  ($line | ConvertTo-Json -Compress) | Add-Content $LOG
  if ($r.status -eq "ok") { $detail = "$($r.n_options) opt/$($r.n_sizes) sizes $($r.ms)ms via " + $r.tgMake } else { $detail = [string]$r.tried }
  Write-Host ("[{0}] {1} {2} {3} -> {4} {5}" -f $n, $it.year, $it.make, $it.model, $r.status, $detail)
}
Write-Host "done: $n processed, $ok ok, $empty empty"
