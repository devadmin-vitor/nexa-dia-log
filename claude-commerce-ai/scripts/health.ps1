<#
.SYNOPSIS
  Verifica a saúde de todos os serviços pela API (GET /health/services).
  Código de saída 0 = serviços obrigatórios ok; 1 = algum problema.
#>
[CmdletBinding()]
param(
    [string]$ApiUrl = 'http://127.0.0.1:8000'
)

. (Join-Path $PSScriptRoot 'common.ps1')

$envValues = Read-DotEnv
$headers = @{ 'X-API-Key' = $envValues['BACKEND_API_TOKEN'] }

try {
    $null = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing -TimeoutSec 5
} catch {
    Write-Fail "API indisponível em $ApiUrl. Rode .\scripts\start.ps1"
    exit 1
}

# /health/services responde 503 quando algo obrigatório falha; lemos o corpo nos dois casos.
$body = $null
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $body = (Invoke-WebRequest -Uri "$ApiUrl/health/services" -Headers $headers -UseBasicParsing -TimeoutSec 30 -SkipHttpErrorCheck).Content
} else {
    # Windows PowerShell 5.1: respostas 4xx/5xx viram WebException; o corpo é lido do stream.
    try {
        $body = (Invoke-WebRequest -Uri "$ApiUrl/health/services" -Headers $headers -UseBasicParsing -TimeoutSec 30).Content
    } catch {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { throw }
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $body = $reader.ReadToEnd()
    }
}
$result = $body | ConvertFrom-Json
if ($null -eq $result.services) {
    Write-Fail "Resposta inesperada: $body"
    exit 1
}

foreach ($s in $result.services) {
    $line = '{0,-15} {1,-28} {2}' -f $s.status, $s.name, $s.detail
    switch ($s.status) {
        'ok' { Write-Host "  $line" -ForegroundColor Green }
        'down' { Write-Host "  $line" -ForegroundColor Red }
        default { Write-Host "  $line" -ForegroundColor Yellow }
    }
}
if ($result.ok) {
    Write-Host 'Serviços obrigatórios: OK' -ForegroundColor Green
    exit 0
}
Write-Host 'Há serviços obrigatórios com problema.' -ForegroundColor Red
exit 1
