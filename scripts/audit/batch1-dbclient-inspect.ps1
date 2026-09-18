Set-Location F:\clawd\wt-fitment-fix
Write-Output "--- db client files ---"
Get-ChildItem -Recurse src -Include *.ts -File | Select-String -Pattern 'from "pg"|from "@neondatabase|from "@vercel/postgres"|drizzle-orm/neon|drizzle-orm/node-postgres|drizzle-orm/vercel-postgres|new Pool\(' | ForEach-Object { "$($_.Path.Substring(24)):$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 25
Write-Output "--- POSTGRES_URL readers ---"
Get-ChildItem -Recurse src -Include *.ts -File | Select-String -Pattern 'POSTGRES_URL' | ForEach-Object { "$($_.Path.Substring(24)):$($_.LineNumber): $($_.Line.Trim())" } | Select-Object -First 25
Write-Output "--- env (masked) ---"
Select-String -Path .env.local -Pattern '^(POSTGRES_URL|DATABASE_URL|FITMENT_PREVIEW_READONLY|FITMENT_CACHE_DISABLED|UPSTASH|KV_|REDIS)' | ForEach-Object { ($_.Line -replace '(://[^:]+:)[^@]+@', '$1***@') -replace '(options=)[^&\s]*', '$1<opt>' }
