# Shared helpers for Dakhl-o-Kharj Windows scripts.
# Console text is English on purpose: the Windows console does not render Persian (RTL) correctly.
# Persian guide: docs\SETUP-WINDOWS.md
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ConfigFile = Join-Path $Root 'config.json'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn2($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "`n    ERROR: $msg" -ForegroundColor Red }

# Runs an external program and stops the script with a clear message if it fails.
# Usage: Invoke-Native 'npm ci' { npm ci --no-audit }
function Invoke-Native([string]$What, [scriptblock]$Command) {
  $global:LASTEXITCODE = 0
  & $Command
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "$What failed (exit code $LASTEXITCODE). Nothing after this step was done."
    Write-Host '    Copy the messages above and send them for help.'
    exit 1
  }
}

# Writes config.json as UTF-8 WITHOUT BOM (Windows PowerShell 5.1 adds a BOM with -Encoding UTF8).
function Save-AppConfig($cfg) {
  [IO.File]::WriteAllText($ConfigFile, ($cfg | ConvertTo-Json), (New-Object Text.UTF8Encoding $false))
}

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

# Re-runs the calling script as Administrator (Windows shows a permission window) and waits for it.
# Returns the elevated script's exit code; exits with 1 if the user clicked No.
function Invoke-Elevated([string]$ScriptPath, [string]$Arguments = '') {
  Write-Host '    Administrator permission is needed. A permission window will open; click Yes.'
  try {
    $p = Start-Process powershell -Verb RunAs -Wait -PassThru -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" $Arguments"
  } catch {
    Write-Fail 'Administrator permission was not given (No was clicked). Run the script again and click Yes.'
    exit 1
  }
  return $p.ExitCode
}

function Get-LanIPv4 {
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -match '^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|WSL|Loopback' } |
    Select-Object -ExpandProperty IPAddress
}
