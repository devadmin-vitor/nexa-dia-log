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
    [switch]$SkipDocker
)

. (Join-Path $PSScriptRoot 'common.ps1')
Set-Location $script:Root

Write-Step 'Verificando pré-requisitos'
$missing = @()
foreach ($tool in @('git', 'node', 'npm', 'docker')) {
    if (Test-Command $tool) { Write-Ok $tool } else { $missing += $tool; Write-Fail "$tool não encontrado" }
}
$pythonCmd = $null
if (Test-Command 'py') {
    & py -3.11 --version *> $null
    if ($LASTEXITCODE -eq 0) { $pythonCmd = @('py', '-3.11') }
}
if (-not $pythonCmd -and (Test-Command 'python')) {
    $ver = (& python -c "import sys; print('%d.%d' % sys.version_info[:2])")
    if ([version]$ver -ge [version]'3.11') { $pythonCmd = @('python') }
}
if ($pythonCmd) { Write-Ok "Python ($($pythonCmd -join ' '))" } else { $missing += 'python 3.11+'; Write-Fail 'Python 3.11+ não encontrado' }
if (Test-Command 'node') {
    $nodeVer = (& node --version).TrimStart('v')
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
Set-DotEnvValue 'REDIS_URL' "redis://:$($envValues['REDIS_PASSWORD'])@localhost:6379/0" -OnlyIfEmpty
$envValues = Read-DotEnv
Write-Ok 'Tokens locais gerados (valores existentes foram preservados)'
if (-not $envValues['ANTHROPIC_API_KEY']) { Write-Warn 'ANTHROPIC_API_KEY vazio: preencha no .env para usar a Claude API' }
if (-not $envValues['USD_BRL_RATE']) { Write-Warn 'USD_BRL_RATE vazio: preencha a cotação para liberar chamadas pagas' }

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
Write-Ok "Supabase CLI $(& npx supabase --version)"

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
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop não está em execução. Abra o Docker Desktop e rode o setup novamente.' }
    Invoke-Checked 'docker' @('compose', 'pull') 'docker compose pull'
    Write-Ok 'Imagens baixadas'
}

Write-Host ''
Write-Host 'Instalação concluída. Próximos passos:' -ForegroundColor Green
Write-Host '  1. (Opcional) Preencha ANTHROPIC_API_KEY e USD_BRL_RATE no .env'
Write-Host '  2. .\scripts\start.ps1'
Write-Host '  3. Abra http://localhost:5678 e crie a conta owner do n8n; depois importe os workflows (README).'
