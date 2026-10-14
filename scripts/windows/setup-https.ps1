# Creates a local HTTPS certificate with mkcert (works fully offline; nothing is sent anywhere).
# The iPhone must trust the mkcert root certificate once (see docs\SETUP-WINDOWS.md).
. (Join-Path $PSScriptRoot 'common.ps1')

Write-Step 'Checking mkcert'
$mk = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mk) {
  Write-Host '    Installing mkcert with winget...'
  winget install --id FiloSottile.mkcert -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  $mk = Get-Command mkcert -ErrorAction SilentlyContinue
  if (-not $mk) { Write-Warn2 'mkcert was installed but not found yet. Close this window and run setup-https.bat again.'; exit 1 }
}
Write-Ok "mkcert: $($mk.Source)"

Write-Step 'Installing the local root certificate on this laptop (click Yes if Windows asks)'
mkcert -install

$dataDir = Get-DataDir
$certDir = Join-Path $dataDir 'certs'
New-Item -ItemType Directory -Force -Path $certDir | Out-Null
$cfg = Get-AppConfig
$hostName = if ($cfg -and $cfg.hostname) { $cfg.hostname } else { 'dakhlkharj.local' }
$ips = @(Get-LanIPv4)

Write-Step "Creating certificate for: $hostName, localhost, 127.0.0.1, $($ips -join ', ')"
$names = @($hostName, 'localhost', '127.0.0.1', '::1') + $ips
mkcert -cert-file (Join-Path $certDir 'cert.pem') -key-file (Join-Path $certDir 'key.pem') @names

$caRoot = (mkcert -CAROOT).Trim()
Copy-Item (Join-Path $caRoot 'rootCA.pem') (Join-Path $certDir 'rootCA.pem') -Force
Write-Ok "Certificate saved in $certDir"
Write-Warn2 "Never share rootCA-key.pem from $caRoot. It stays only on this laptop."

Write-Step 'Done'
Write-Host '    Restart the server (start.bat). Then on the iPhone open: http://<laptop-ip>:8080'
foreach ($ip in $ips) { Write-Host "      http://$($ip):8080" }
Write-Host '    If the laptop IP changes later, the name https://dakhlkharj.local:8443 keeps working.'
Write-Host '    To use the IP address directly after it changes, run this script again.'
