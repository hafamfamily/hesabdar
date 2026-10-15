# Update Dakhl-o-Kharj to the latest version (your data and settings are kept).
. (Join-Path $PSScriptRoot 'common.ps1')

Write-Step 'Getting the latest version'
if (Test-Path (Join-Path $Root '.git')) {
  git -C $Root pull --ff-only
  if ($LASTEXITCODE -ne 0) { Write-Warn2 'git pull failed. Local changes? Ask for help before continuing.'; exit 1 }
} else {
  Write-Warn2 'This folder was not downloaded with git.'
  Write-Host '    Download the new ZIP from GitHub and extract it over this folder (keep config.json), then run update.bat again.'
  Write-Host '    Your data is in the data folder and is not touched by updates.'
  $ans = Read-Host '    Already extracted the new files? Continue with build (y/n)'
  if ($ans -notmatch '^[yY]') { exit 0 }
}

Write-Step 'Installing packages and building the app'
Push-Location $Root
try {
  npm ci --no-audit --no-fund
  npm run build -w client
} finally { Pop-Location }
Write-Ok 'Updated.'
Write-Host '    Close the server window and run start.bat again.'
Write-Host '    On the iPhone, close the app completely and open it twice; the new version loads automatically.'
