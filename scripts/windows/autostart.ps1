# Start the server automatically when you log in to Windows (use -Remove to undo).
param([switch]$Remove)
. (Join-Path $PSScriptRoot 'common.ps1')
$task = 'DakhlKharj Server'
if ($Remove) {
  schtasks /Delete /TN $task /F | Out-Null
  Write-Ok 'Autostart removed'
  return
}
$bat = Join-Path $PSScriptRoot 'start.bat'
schtasks /Create /TN $task /TR "cmd /c start `"DakhlKharj`" /min `"$bat`"" /SC ONLOGON /RL LIMITED /F | Out-Null
Write-Ok "The server will start (minimized) each time $($env:USERNAME) logs in"
