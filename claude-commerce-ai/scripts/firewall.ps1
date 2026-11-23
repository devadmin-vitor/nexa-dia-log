<#
.SYNOPSIS
  Bloqueia, no Firewall do Windows, conexões vindas da rede para as portas do Supabase local (44320-44329).
.DESCRIPTION
  O Supabase CLI publica suas portas em 0.0.0.0. Esta regra impede que outros aparelhos da rede acessem o banco,
  a API e o Studio. O acesso a partir do próprio computador (localhost) continua funcionando.
  Execute uma vez, em um PowerShell aberto como Administrador. Para remover:
    Remove-NetFirewallRule -DisplayName 'Claude Commerce AI - bloquear Supabase na rede'
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$name = 'Claude Commerce AI - bloquear Supabase na rede'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$isAdmin = (New-Object Security.Principal.WindowsPrincipal $identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw 'Abra o PowerShell como Administrador (botão direito > Executar como administrador) e rode este script novamente.'
}

if (Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue) {
    Write-Host "A regra '$name' já existe. Nada a fazer." -ForegroundColor Green
    exit 0
}

New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort '44320-44329' `
    -RemoteAddress Any -Action Block -Profile Any `
    -Description 'Supabase local do Claude Commerce AI: acessível apenas pelo próprio computador.' | Out-Null
Write-Host "Regra criada: conexões de entrada da rede para 44320-44329 bloqueadas." -ForegroundColor Green
