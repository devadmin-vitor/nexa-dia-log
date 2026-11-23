<#
.SYNOPSIS
  Prepara a pasta cowork\ para o Claude Cowork: cria entrada\, saida\ e instrucoes\ e copia para
  instrucoes\ as regras mestras e o prompt de cada agente (fonte: prompts\master.md e agents\*\system_prompt.md).
.DESCRIPTION
  Rode de novo sempre que alterar algum system_prompt.md. Não apaga nada em entrada\ ou saida\.
#>
[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'common.ps1')
Set-Location $script:Root

$cowork = Join-Path $script:Root 'cowork'
foreach ($dir in @('entrada', 'saida', 'instrucoes')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $cowork $dir) | Out-Null
}

$envValues = Read-DotEnv
$brand = if ($envValues['BRAND_NAME']) { $envValues['BRAND_NAME'] } else { 'BRAND_NAME' }
$master = [System.IO.File]::ReadAllText((Join-Path $script:Root 'prompts\master.md')).Replace('{BRAND_NAME}', $brand)

$count = 0
foreach ($folder in Get-ChildItem (Join-Path $script:Root 'agents') -Directory) {
    $prompt = Join-Path $folder.FullName 'system_prompt.md'
    if (-not (Test-Path $prompt)) { continue }
    $text = $master.Trim() + "`n`n---`n`n" + [System.IO.File]::ReadAllText($prompt).Trim() + "`n`n---`n" +
        "Modo Cowork: leia os arquivos de entrada/ e salve o resultado em saida/. " +
        "Onde o texto diz 'JSON seguindo o schema do backend', use Markdown com tabelas.`n"
    Write-Utf8NoBom (Join-Path $cowork "instrucoes\$($folder.Name).md") $text
    $count++
}
Write-Ok "$count instruções atualizadas em cowork\instrucoes\"
Write-Ok "Dê ao Cowork acesso somente à pasta: $cowork"
