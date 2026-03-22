param(
  [string]$Pattern = 'lug|hub ring|hubring|lug nut|accessor'
)

$files = Get-ChildItem -Path .\src -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx
$matches = $files | Select-String -Pattern $Pattern -SimpleMatch -ErrorAction SilentlyContinue
$matches | Select-Object -First 100 | ForEach-Object {
  "$($_.Path):$($_.LineNumber) $($_.Line.Trim())"
}
