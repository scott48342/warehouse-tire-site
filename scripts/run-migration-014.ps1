$envFile = Get-Content ".env.local"
$pgLine = $envFile | Select-String "POSTGRES_URL"
$env:POSTGRES_URL = $pgLine.Line.Split('"')[1]
node scripts/run-migration.js 0014_abandoned_cart_emails.sql
