<#
.SYNOPSIS
  Instalação inicial do Claude Commerce AI no Windows.
.DESCRIPTION
  Verifica pré-requisitos, cria o .env com segredos locais gerados aleatoriamente,
  cria o ambiente virtual Python, instala dependências (Python, Supabase CLI, dashboard)
  e baixa as imagens Docker. Pode ser executado novamente: não sobrescreve valores existentes.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
#>
[CmdletBinding()]
param(
    [switch]$SkipDocker,
    # Caminho de um python.exe específico (ex.: o 3.11 instalado pelo uv)
    [string]$Python
)

. (Join-Path $PSScriptRoot 'common.ps1')
Set-Location $script:Root

Write-Step 'Verificando pré-requisitos'
$missing = @()
foreach ($tool in @('git', 'node', 'npm', 'docker')) {
    if (Test-Command $tool) { Write-Ok $tool } else { $missing += $tool; Write-Fail "$tool não encontrado" }
}
$pythonCmd = $null
$found = Find-Python $Python
if ($found) {
    $pythonCmd = $found.Command
    Write-Ok "Python $($found.Version) ($($pythonCmd -join ' '))"
    if ($script:PreferredPython -notcontains $found.Version) {
        Write-Warn "Python $($found.Version) é mais novo que as versões testadas (3.11-3.14); se a instalação de pacotes falhar, instale o 3.11 ou use -Python <caminho>."
    }
} else {
    $missing += 'Python 3.11+'
    Write-Fail 'Python 3.11 ou mais novo não encontrado. Instale com: py install 3.11  (ou: winget install Python.Python.3.11)'
}
if (Test-Command 'node') {
    $nodeVer = (Get-NativeOutput 'node' @('--version')).TrimStart('v')
    if ([version]$nodeVer -lt [version]'20.9.0') { $missing += 'node >= 20.9'; Write-Fail "Node $nodeVer (requer 20.9+)" }
}
if (Test-Command 'ffmpeg') { Write-Ok 'ffmpeg' } else { Write-Warn 'ffmpeg não encontrado (necessário só na Sprint 3: winget install Gyan.FFmpeg)' }
if ($missing.Count -gt 0) {
    throw "Instale antes de continuar: $($missing -join ', '). Veja o README (seção Instalação)."
}

Write-Step 'Configurando .env'
if (-not (Test-Path $script:EnvFile)) {
    Copy-Item (Join-Path $script:Root '.env.example') $script:EnvFile
    Write-Ok '.env criado a partir de .env.example'
}
Set-DotEnvValue 'BACKEND_API_TOKEN' (New-Secret 32) -OnlyIfEmpty
Set-DotEnvValue 'SCHEDULER_TOKEN' (New-Secret 32) -OnlyIfEmpty
Set-DotEnvValue 'REDIS_PASSWORD' (New-Secret 24) -OnlyIfEmpty
Set-DotEnvValue 'N8N_ENCRYPTION_KEY' (New-Secret 32) -OnlyIfEmpty
$envValues = Read-DotEnv
$redisPort = if ($envValues['REDIS_HOST_PORT']) { $envValues['REDIS_HOST_PORT'] } else { '6379' }
Set-DotEnvValue 'REDIS_URL' "redis://:$($envValues['REDIS_PASSWORD'])@localhost:$redisPort/0" -OnlyIfEmpty
$envValues = Read-DotEnv
Write-Ok 'Tokens locais gerados (valores existentes foram preservados)'
if (-not $envValues['ANTHROPIC_API_KEY']) { Write-Ok 'Modo Cowork: nenhuma API de IA configurada (sem custo). Nada a preencher.' }

Write-Step 'Ambiente Python (.venv)'
if (-not (Get-PythonExe)) {
    $exe = $pythonCmd[0]
    $pyArgs = @()
    if ($pythonCmd.Count -gt 1) { $pyArgs += $pythonCmd[1..($pythonCmd.Count - 1)] }
    Invoke-Checked $exe ($pyArgs + @('-m', 'venv', '.venv')) 'Criação do .venv'
}
$py = Get-PythonExe
Invoke-Checked $py @('-m', 'pip', 'install', '--upgrade', 'pip', '--quiet') 'Atualização do pip'
Invoke-Checked $py @('-m', 'pip', 'install', '-r', 'requirements-dev.txt', '--quiet') 'Instalação das dependências Python'
Write-Ok 'Dependências Python instaladas'

Write-Step 'Supabase CLI (npm)'
Invoke-Checked 'npm' @('install', '--no-fund', '--no-audit') 'npm install (raiz)'
Write-Ok "Supabase CLI $(Get-NativeOutput 'npx' @('supabase', '--version'))"

Write-Step 'Dashboard (apps/dashboard)'
Push-Location (Join-Path $script:Root 'apps\dashboard')
try {
    Invoke-Checked 'npm' @('install', '--no-fund', '--no-audit') 'npm install (dashboard)'
} finally { Pop-Location }
$dashEnv = "# Gerado por scripts/setup.ps1 - somente servidor; nunca use NEXT_PUBLIC_ para estes valores`n" +
    "BACKEND_URL=http://127.0.0.1:8000`nBACKEND_API_TOKEN=$($envValues['BACKEND_API_TOKEN'])`n"
Write-Utf8NoBom (Join-Path $script:Root 'apps\dashboard\.env.local') $dashEnv
Write-Ok 'apps/dashboard/.env.local criado'

if (-not $SkipDocker) {
    Write-Step 'Imagens Docker (Redis, n8n)'
    if (-not (Test-DockerRunning)) { throw 'Docker Desktop não está em execução. Abra o Docker Desktop, espere ficar "running" e rode o setup novamente.' }
    Invoke-Checked 'docker' @('compose', 'pull') 'docker compose pull'
    Write-Ok 'Imagens baixadas'
}

Write-Host ''
Write-Host 'Instalação concluída. Próximos passos:' -ForegroundColor Green
Write-Host '  1. powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1'
Write-Host '  2. Abra http://localhost:3000 (dashboard)'
Write-Host '  3. (Opcional) http://localhost:5678: crie a conta owner do n8n e importe os workflows (README).'
