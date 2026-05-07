#!/usr/bin/env pwsh
# Run lifted package QA with proper environment variables

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Get-Item $scriptDir).Parent.Parent.FullName

Push-Location $projectRoot

# Load .env.local
$envFile = Join-Path $projectRoot ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^#=]+)=["'']?(.+?)["'']?$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

# Run the script
node scripts/qa-sweep/lifted-package-qa.mjs @args

Pop-Location
