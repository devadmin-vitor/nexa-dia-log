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

# Programas externos (python, npm, docker, npx) escrevem avisos e progresso no stderr.
# No Windows PowerShell 5.1, com $ErrorActionPreference = 'Stop', isso interrompe o script
# mesmo quando o programa termina com sucesso. Por isso toda chamada externa passa por aqui
# e o resultado é decidido pelo código de saída ($LASTEXITCODE), não pelo stderr.
function Invoke-Native([string]$File, [string[]]$Arguments, [switch]$Quiet) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        # Out-Host mostra a saída sem misturá-la ao valor de retorno da função.
        if ($Quiet) { & $File @Arguments *> $null } else { & $File @Arguments | Out-Host }
        return $LASTEXITCODE
    } catch {
        return 1
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Get-NativeOutput([string]$File, [string[]]$Arguments) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $File @Arguments 2> $null
        if ($LASTEXITCODE -ne 0) { return $null }
        return (($out | Out-String).Trim())
    } catch {
        return $null
    } finally {
        $ErrorActionPreference = $previous
    }
}

function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$What) {
    $code = Invoke-Native $File $Arguments
    if ($code -ne 0) { throw "$What falhou (código $code)" }
}

# Porta livre no computador? Usa Get-NetTCPConnection (Windows) e confirma tentando abrir a porta.
function Test-PortFree([int]$Port) {
    if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
        if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { return $false }
    }
    $listener = $null
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

function Find-FreePort([int]$Start, [int]$Count = 30) {
    for ($p = $Start; $p -lt ($Start + $Count); $p++) {
        if (Test-PortFree $p) { return $p }
    }
    return $null
}

# Garante que a porta de um serviço do docker-compose esteja livre; se outra aplicação a usa,
# escolhe a próxima livre e grava no .env (porta do host e URL de conexão).
function Resolve-ComposePort([string]$Service, [string]$PortKey, [int]$Default, [string]$UrlKey, [hashtable]$EnvValues) {
    $port = if ($EnvValues[$PortKey]) { [int]$EnvValues[$PortKey] } else { $Default }
    # Se o próprio container do projeto já está rodando, a porta ocupada é dele.
    $running = Get-NativeOutput 'docker' @('compose', 'ps', '--status', 'running', '-q', $Service)
    if ($running) { return $port }
    if (Test-PortFree $port) { return $port }
    $new = Find-FreePort ($port + 1)
    if (-not $new) { throw "Porta $port ocupada e nenhuma porta livre encontrada após ela para $Service." }
    Set-DotEnvValue $PortKey "$new"
    $url = (Read-DotEnv)[$UrlKey]
    if ($url) { Set-DotEnvValue $UrlKey ($url -replace ":$port(/|$)", ":$new`$1") }
    Write-Warn "Porta $port ocupada por outro programa: $Service passa a usar a porta $new ($PortKey e $UrlKey atualizados no .env)."
    return $new
}

function Test-DockerRunning {
    return ((Invoke-Native 'docker' @('info') -Quiet) -eq 0)
}

# Versões com todas as dependências testadas. Versões mais novas só são usadas se nada daqui existir
# (pacotes como psycopg-binary e pydantic-core podem ainda não ter instaladores prontos para elas).
$script:PreferredPython = @('3.11', '3.12', '3.13', '3.14')

function Get-PythonVersion([string[]]$Command) {
    $extra = @()
    if ($Command.Count -gt 1) { $extra = $Command[1..($Command.Count - 1)] }
    $ver = Get-NativeOutput $Command[0] ($extra + @('-c', 'import sys;print(*sys.version_info[:2],sep=chr(46))'))
    if ($ver -and $ver -match '^\d+\.\d+$') { return $ver }
    return $null
}

# Procura um Python 3.11+ em: py -3.X, Pythons instalados pelo uv (Astral), python do PATH, py -3.
# Prefere as versões de $PreferredPython, na ordem.
function Find-Python([string]$Override) {
    if ($Override) {
        $cmd = @($Override)
        $ver = Get-PythonVersion $cmd
        if ($ver -and [version]$ver -ge [version]'3.11') { return @{ Command = $cmd; Version = $ver } }
        throw "O Python informado em -Python não funciona ou é anterior ao 3.11: $Override"
    }
    $found = @()
    foreach ($v in $script:PreferredPython) {
        if (Test-Command 'py') {
            $ver = Get-PythonVersion @('py', "-$v")
            if ($ver -eq $v) { return @{ Command = @('py', "-$v"); Version = $ver } }
        }
        if (Test-Command 'uv') {
            $path = Get-NativeOutput 'uv' @('python', 'find', $v)
            if ($path -and (Test-Path $path)) {
                $ver = Get-PythonVersion @($path)
                if ($ver -eq $v) { return @{ Command = @($path); Version = $ver } }
            }
        }
    }
    foreach ($cmd in @(@('python'), @('py', '-3'))) {
        if (-not (Test-Command $cmd[0])) { continue }
        $ver = Get-PythonVersion $cmd
        if ($ver -and [version]$ver -ge [version]'3.11') { $found += , @{ Command = $cmd; Version = $ver } }
    }
    if ($found.Count -gt 0) { return $found[0] }
    return $null
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
