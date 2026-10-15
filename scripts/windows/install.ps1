# Dakhl-o-Kharj: one-time installation on Windows 11.
# Run: double-click install.bat (or: powershell -ExecutionPolicy Bypass -File scripts\windows\install.ps1)
. (Join-Path $PSScriptRoot 'common.ps1')

Write-Step 'Checking Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
$needNode = $true
if ($node) {
  $v = (& node -v).TrimStart('v').Split('.')
  if ([int]$v[0] -gt 22 -or ([int]$v[0] -eq 22 -and [int]$v[1] -ge 13)) { $needNode = $false; Write-Ok "Node.js $(& node -v)" }
  else { Write-Warn2 "Node.js $(& node -v) is too old (need 22.13+)." }
}
if ($needNode) {
  Write-Host '    Installing Node.js LTS with winget...'
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  Write-Warn2 'Node.js installed. Close this window and run install.bat again.'
  exit 1
}

Write-Step 'Data folder'
$default = Get-DataDir
$answer = Read-Host "    Data folder [$default]"
$dataDir = if ([string]::IsNullOrWhiteSpace($answer)) { $default } else { $answer.Trim() }
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$appFolder = Split-Path $dataDir -Parent
# Only the current user, SYSTEM and Administrators may access the folder (D:\ is shared by default)
icacls $appFolder /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
Write-Ok "Data folder: $dataDir (access limited to $($env:USERNAME))"

Write-Step 'Backup folder'
$defaultBackup = Join-Path $appFolder 'backups'
$answer = Read-Host "    Folder for automatic daily backups [$defaultBackup]"
$backupDir = if ([string]::IsNullOrWhiteSpace($answer)) { $defaultBackup } else { $answer.Trim() }
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
if (-not $backupDir.StartsWith($appFolder)) {
  icacls $backupDir /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)F" "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
}
Write-Ok "Backups: $backupDir"

$cfg = [ordered]@{ dataDir = $dataDir; backupDir = $backupDir; port = 8443; setupPort = 8080; hostname = 'dakhlkharj.local' }
$cfg | ConvertTo-Json | Set-Content -Path $ConfigFile -Encoding UTF8
Write-Ok "Settings saved to config.json"

Write-Step 'Installing packages and building the app (needs internet once)'
Push-Location $Root
try {
  npm ci --no-audit --no-fund
  npm run build -w client
} finally { Pop-Location }
Write-Ok 'App built'

Write-Step 'Network and firewall'
& (Join-Path $PSScriptRoot 'firewall.ps1')

Write-Step 'Next steps'
Write-Host '    1) Run setup-https.bat  (creates the security certificate for the iPhone)'
Write-Host '    2) Run start.bat        (starts the server)'
Write-Host '    3) On this laptop open https://localhost:8443 > Settings > Server password'
Write-Host '    Optional: autostart.bat  (start the server automatically when you log in)'
