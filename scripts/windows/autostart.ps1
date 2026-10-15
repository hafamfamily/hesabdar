# Start the server automatically when you log in to Windows (use -Remove to undo).
# Creating a log-on task needs Administrator permission; the script asks for it itself.
param([switch]$Remove, [string]$ForUser = '')
. (Join-Path $PSScriptRoot 'common.ps1')
$task = 'DakhlKharj Server'
# The Windows user the task is for (kept when the script re-runs elevated)
$user = if ($ForUser) { $ForUser } else { "$env:USERDOMAIN\$env:USERNAME" }

if (-not (Test-Admin)) {
  $passArgs = "-ForUser `"$user`""
  if ($Remove) { $passArgs += ' -Remove' }
  $code = Invoke-Elevated $PSCommandPath $passArgs
  if ($code -ne 0) { Write-Fail 'Autostart was not changed. See the messages in the administrator window.'; exit 1 }
  if ($Remove) { Write-Ok 'Autostart removed' } else { Write-Ok "The server will start (minimized) each time $user logs in" }
  exit 0
}

if ($Remove) {
  $out = schtasks /Delete /TN $task /F 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "Could not remove autostart: $out"
    Read-Host '    Press Enter to close'
    exit 1
  }
  Write-Ok 'Autostart removed'
  exit 0
}

$bat = Join-Path $PSScriptRoot 'start.bat'
$tr = "cmd /c start `"DakhlKharj`" /min `"$bat`""
$args2 = @('/Create', '/TN', $task, '/TR', $tr, '/SC', 'ONLOGON', '/RL', 'LIMITED', '/F')
# If the admin window runs under another account, create the task for the original user (runs at their log-on)
if ($user -ne "$env:USERDOMAIN\$env:USERNAME") { $args2 += @('/RU', $user, '/IT') }
$out = schtasks @args2 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Fail "Could not create the autostart task: $out"
  Read-Host '    Press Enter to close'
  exit 1
}
Write-Ok "The server will start (minimized) each time $user logs in"
exit 0
