<#
.SYNOPSIS
  Backup local: banco (esquema + dados), workflows e credenciais do n8n (criptografadas) e storage/.
.DESCRIPTION
  Cria backups\AAAAMMDD-HHmmss\. O .env NÃO é copiado (contém segredos): guarde-o separadamente
  em local seguro. As credenciais exportadas do n8n só podem ser restauradas com o mesmo N8N_ENCRYPTION_KEY.
.EXAMPLE
  .\scripts\backup.ps1
  .\scripts\backup.ps1 -Keep 30 -IncludeMedia -IncludeCowork
#>
[CmdletBinding()]
param(
    [int]$Keep = 14,
    [switch]$IncludeMedia,
    # Inclui cowork\entrada e cowork\saida (relatórios, roteiros e análises feitos no Cowork)
    [switch]$IncludeCowork
)

. (Join-Path $PSScriptRoot 'common.ps1')
Set-Location $script:Root

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $script:Root 'backups'
$target = Join-Path $backupRoot $stamp
New-Item -ItemType Directory -Force -Path $target | Out-Null

Write-Step 'Banco de dados (Supabase local)'
Invoke-Checked 'npx' @('supabase', 'db', 'dump', '--local', '-f', (Join-Path $target 'schema.sql')) 'Dump do esquema'
Invoke-Checked 'npx' @('supabase', 'db', 'dump', '--local', '--data-only', '-f', (Join-Path $target 'data.sql')) 'Dump dos dados'
Write-Ok 'schema.sql e data.sql'

Write-Step 'n8n'
$exportCmd = 'mkdir -p /home/node/.n8n/backup && n8n export:workflow --all --output=/home/node/.n8n/backup/workflows.json && n8n export:credentials --all --output=/home/node/.n8n/backup/credentials.json'
if ((Invoke-Native 'docker' @('compose', 'exec', '-T', 'n8n', 'sh', '-c', $exportCmd) -Quiet) -eq 0) {
    Invoke-Native 'docker' @('compose', 'cp', 'n8n:/home/node/.n8n/backup/workflows.json', (Join-Path $target 'n8n-workflows.json')) -Quiet | Out-Null
    Invoke-Native 'docker' @('compose', 'cp', 'n8n:/home/node/.n8n/backup/credentials.json', (Join-Path $target 'n8n-credentials.encrypted.json')) -Quiet | Out-Null
    Invoke-Native 'docker' @('compose', 'exec', '-T', 'n8n', 'rm', '-rf', '/home/node/.n8n/backup') -Quiet | Out-Null
    Write-Ok 'Workflows e credenciais (criptografadas) exportados'
} else {
    Write-Warn 'n8n indisponível ou sem workflows: export ignorado'
}

Write-Step 'Arquivos'
$paths = @((Join-Path $script:Root 'storage'))
if ($IncludeMedia) { $paths += (Join-Path $script:Root 'media') }
if ($IncludeCowork) {
    foreach ($d in @('cowork\entrada', 'cowork\saida')) {
        $full = Join-Path $script:Root $d
        if (Test-Path $full) { $paths += $full }
    }
}
Compress-Archive -Path $paths -DestinationPath (Join-Path $target 'files.zip') -Force
Write-Ok "files.zip ($(($paths | ForEach-Object { Split-Path $_ -Leaf }) -join ', '))"

Write-Step "Retenção: mantendo os $Keep backups mais recentes"
Get-ChildItem $backupRoot -Directory | Sort-Object Name -Descending | Select-Object -Skip $Keep | ForEach-Object {
    Remove-Item $_.FullName -Recurse -Force
    Write-Ok "Removido $($_.Name)"
}

Write-Host ''
Write-Host "Backup concluído em $target" -ForegroundColor Green
Write-Host 'Lembrete: o .env não é incluído. Guarde uma cópia em local seguro (gerenciador de senhas).' -ForegroundColor Yellow
