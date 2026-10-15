# Update Dakhl-o-Kharj to the latest version (your data and settings are kept).
. (Join-Path $PSScriptRoot 'common.ps1')

Write-Step 'Getting the latest version'
if (Test-Path (Join-Path $Root '.git')) {
  Invoke-Native 'Downloading the update (git pull)' { git -C $Root pull --ff-only }
} else {
  Write-Warn2 'This folder was not downloaded with git.'
  Write-Host '    Download the new ZIP from GitHub and extract it over this folder (keep config.json), then run update.bat again.'
  Write-Host '    Your data is in the data folder and is not touched by updates.'
  $ans = Read-Host '    Already extracted the new files? Continue with build (y/n)'
  if ($ans -notmatch '^[yY]') { exit 0 }
}

# Older installers wrote config.json with a BOM; rewrite it without one (content unchanged)
$cfg = Get-AppConfig
if ($cfg) { Save-AppConfig $cfg }

Write-Step 'Installing packages and building the app'
Push-Location $Root
try {
  Invoke-Native 'Installing packages (npm ci)' { npm ci --no-audit --no-fund }
  Invoke-Native 'Building the app (npm run build)' { npm run build -w client }
} finally { Pop-Location }
Write-Ok 'Updated.'
Write-Host '    Close the server window and run start.bat again.'
Write-Host '    On the iPhone, close the app completely and open it twice; the new version loads automatically.'
