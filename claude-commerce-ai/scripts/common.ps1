# Funções compartilhadas pelos scripts do Claude Commerce AI.
# Compatível com Windows PowerShell 5.1 e PowerShell 7+.

$ErrorActionPreference = 'Stop'
$script:Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:EnvFile = Join-Path $script:Root '.env'
$script:PidDir = Join-Path $script:Root 'storage\pids'
$script:LogDir = Join-Path $script:Root 'logs'

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "    [ok] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "    [aviso] $Message" -ForegroundColor Yellow }
function Write-Fail([string]$Message) { Write-Host "    [erro] $Message" -ForegroundColor Red }

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    # Evita BOM: o primeiro "KEY=" de um .env com BOM não é reconhecido por algumas ferramentas.
    [System.IO.File]::WriteAllText($Path, $Text, (New-Object System.Text.UTF8Encoding $false))
}

function New-Secret([int]$Bytes = 32) {
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $buffer = New-Object byte[] $Bytes
    $rng.GetBytes($buffer)
    return (($buffer | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Read-DotEnv([string]$Path = $script:EnvFile) {
    $values = @{}
    if (-not (Test-Path $Path)) { return $values }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        $idx = $trimmed.IndexOf('=')
        if ($idx -lt 1) { continue }
        $key = $trimmed.Substring(0, $idx).Trim()
        $value = $trimmed.Substring($idx + 1).Trim().Trim('"')
        $values[$key] = $value
    }
    return $values
}

function Set-DotEnvValue([string]$Key, [string]$Value, [switch]$OnlyIfEmpty, [string]$Path = $script:EnvFile) {
    $lines = [System.Collections.Generic.List[string]]::new()
    $found = $false
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=(.*)$") {
            $found = $true
            $current = $Matches[1].Trim()
            if ($OnlyIfEmpty -and $current -ne '') { $lines.Add($line); continue }
            $lines.Add("$Key=$Value")
        } else {
            $lines.Add($line)
        }
    }
    if (-not $found) { $lines.Add("$Key=$Value") }
    Write-Utf8NoBom $Path (($lines -join "`n") + "`n")
}

function Test-Command([string]$Name) {
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-PythonExe {
    $venv = Join-Path $script:Root '.venv\Scripts\python.exe'
    if (Test-Path $venv) { return $venv }
    $venvUnix = Join-Path $script:Root '.venv/bin/python'
    if (Test-Path $venvUnix) { return $venvUnix }
    return $null
}

function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$What) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$What falhou (código $LASTEXITCODE)" }
}

function Wait-Http([string]$Url, [int]$TimeoutSeconds = 60, [hashtable]$Headers = @{}) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $null = Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -TimeoutSec 3
            return $true
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    return $false
}

function Save-Pid([string]$Name, [int]$ProcessId) {
    New-Item -ItemType Directory -Force -Path $script:PidDir | Out-Null
    Write-Utf8NoBom (Join-Path $script:PidDir "$Name.pid") "$ProcessId"
}

function Stop-SavedProcess([string]$Name) {
    $file = Join-Path $script:PidDir "$Name.pid"
    if (-not (Test-Path $file)) { return $false }
    $processId = [int]([System.IO.File]::ReadAllText($file).Trim())
    if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
        if ($IsWindows -or $env:OS -eq 'Windows_NT') {
            # Encerra a árvore inteira (npm -> node, python -> uvicorn workers).
            & taskkill.exe /PID $processId /T /F | Out-Null
        } else {
            Stop-Process -Id $processId -Force
        }
    }
    Remove-Item $file -Force
    return $true
}
