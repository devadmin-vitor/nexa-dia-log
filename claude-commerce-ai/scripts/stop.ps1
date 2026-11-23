<#
.SYNOPSIS
  Para a stack local. Os dados (banco, n8n, Redis) são preservados.
.EXAMPLE
  .\scripts\stop.ps1
  .\scripts\stop.ps1 -KeepSupabase
#>
[CmdletBinding()]
param(
    [switch]$KeepSupabase
)

. (Join-Path $PSScriptRoot 'common.ps1')
Set-Location $script:Root

Write-Step 'Dashboard e API'
foreach ($name in @('dashboard', 'api')) {
    if (Stop-SavedProcess $name) { Write-Ok "$name parado" } else { Write-Warn "$name não estava em execução (sem PID salvo)" }
}

Write-Step 'Redis e n8n'
& docker compose stop
if ($LASTEXITCODE -eq 0) { Write-Ok 'Containers parados (volumes preservados)' } else { Write-Warn 'docker compose stop retornou erro' }

if (-not $KeepSupabase) {
    Write-Step 'Supabase local'
    & npx supabase stop
    if ($LASTEXITCODE -eq 0) { Write-Ok 'Supabase parado (dados preservados)' } else { Write-Warn 'supabase stop retornou erro' }
}
