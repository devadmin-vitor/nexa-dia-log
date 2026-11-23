<#
.SYNOPSIS
  Inicia toda a stack local: Redis + n8n (Docker), Supabase, API (FastAPI) e dashboard (Next.js).
.EXAMPLE
  .\scripts\start.ps1
  .\scripts\start.ps1 -NoDashboard
#>
[CmdletBinding()]
param(
    [switch]$NoDashboard,
    [string]$ApiHost = '127.0.0.1',
    [int]$ApiPort = 8000
)

. (Join-Path $PSScriptRoot 'common.ps1')
Set-Location $script:Root

if (-not (Test-Path $script:EnvFile)) { throw '.env não encontrado. Rode primeiro: .\scripts\setup.ps1' }
$envValues = Read-DotEnv
if ($envValues['EMERGENCY_STOP'] -eq 'true') { Write-Warn 'EMERGENCY_STOP=true: agentes, tarefas e agendamentos ficarão bloqueados.' }
New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null

Write-Step 'Docker'
if (-not (Test-DockerRunning)) { throw 'Docker Desktop não está em execução. Abra o Docker Desktop e tente novamente.' }
Invoke-Checked 'docker' @('compose', 'up', '-d') 'docker compose up'
Write-Ok 'Redis e n8n iniciados'

Write-Step 'Supabase local (pode levar alguns minutos na primeira vez)'
Invoke-Checked 'npx' @('supabase', 'start') 'supabase start'
$status = Get-NativeOutput 'npx' @('supabase', 'status', '-o', 'env')
foreach ($pair in @(@('ANON_KEY', 'SUPABASE_ANON_KEY'), @('SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'))) {
    if ($status -and $status -match "(?m)^$($pair[0])=""?([^""\r\n]+)""?") {
        Set-DotEnvValue $pair[1] $Matches[1] -OnlyIfEmpty
    }
}
Write-Ok 'Supabase ativo (Studio: http://127.0.0.1:54323)'

Write-Step "API FastAPI em http://${ApiHost}:${ApiPort}"
$py = Get-PythonExe
if (-not $py) { throw '.venv não encontrado. Rode .\scripts\setup.ps1' }
Stop-SavedProcess 'api' | Out-Null
$api = Start-Process -FilePath $py -ArgumentList @('-m', 'uvicorn', 'apps.api.main:app', '--host', $ApiHost, '--port', "$ApiPort") `
    -WorkingDirectory $script:Root -RedirectStandardOutput (Join-Path $script:LogDir 'api.out.log') `
    -RedirectStandardError (Join-Path $script:LogDir 'api.err.log') -WindowStyle Hidden -PassThru
Save-Pid 'api' $api.Id
if (-not (Wait-Http "http://127.0.0.1:$ApiPort/health" 60)) { throw 'A API não respondeu. Veja logs\api.err.log' }
Write-Ok "API ativa (PID $($api.Id)) — documentação: http://127.0.0.1:$ApiPort/docs"

if (-not $NoDashboard) {
    Write-Step 'Dashboard Next.js em http://localhost:3000'
    Stop-SavedProcess 'dashboard' | Out-Null
    $npm = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
    $dash = Start-Process -FilePath $npm -ArgumentList @('run', 'dev') -WorkingDirectory (Join-Path $script:Root 'apps\dashboard') `
        -RedirectStandardOutput (Join-Path $script:LogDir 'dashboard.out.log') `
        -RedirectStandardError (Join-Path $script:LogDir 'dashboard.err.log') -WindowStyle Hidden -PassThru
    Save-Pid 'dashboard' $dash.Id
    if (Wait-Http 'http://127.0.0.1:3000' 120) { Write-Ok "Dashboard ativo (PID $($dash.Id))" } else { Write-Warn 'Dashboard ainda não respondeu; veja logs\dashboard.err.log' }
}

Write-Step 'Verificação de saúde'
& (Join-Path $PSScriptRoot 'health.ps1')
