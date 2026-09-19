$root = (Get-Location).Path
"== latest migrations =="
Get-ChildItem -Path drizzle,migrations,src\db\migrations -ErrorAction SilentlyContinue -Recurse -Include *.sql | Sort-Object Name | Select-Object -Last 4 | ForEach-Object { $_.FullName.Replace("$root\", "") }
"== drizzle schema files defining vehicle_fitments =="
Get-ChildItem src -Recurse -Include *.ts | Select-String -Pattern 'pgTable\(.vehicle_fitments' -List | ForEach-Object { $_.Path.Replace("$root\", "") }
"== files referencing oem_load_index / oemLoadIndex =="
Get-ChildItem src -Recurse -Include *.ts | Select-String -Pattern 'oem_load_index|oemLoadIndex' -List | ForEach-Object { $_.Path.Replace("$root\", "") } | Select-Object -First 14
"== usaf load-index cache =="
Get-ChildItem scripts\audit\pass4\usaf-load-index -Recurse -File | ForEach-Object { "$($_.FullName.Replace("$root\", '')) $([math]::Round($_.Length/1KB))KB" }
"== apply-migration runners =="
Get-ChildItem scripts -Filter 'apply-*.mjs' | Select-Object -First 6 | ForEach-Object { $_.Name }
"== git =="
git rev-parse --short HEAD
