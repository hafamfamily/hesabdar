# Shared helpers for Dakhl-o-Kharj Windows scripts.
# Console text is English on purpose: the Windows console does not render Persian (RTL) correctly.
# Persian guide: docs\SETUP-WINDOWS.md
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ConfigFile = Join-Path $Root 'config.json'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }

function Get-AppConfig {
  if (Test-Path $ConfigFile) { return Get-Content $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json }
  return $null
}

function Get-DataDir {
  $cfg = Get-AppConfig
  if ($cfg -and $cfg.dataDir) { return $cfg.dataDir }
  if (Test-Path 'D:\') { return 'D:\DakhlKharj\data' }
  return (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'DakhlKharj\data')
}

function Test-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  return (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-LanIPv4 {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -match '^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|WSL|Loopback' } |
    Select-Object -ExpandProperty IPAddress
}
