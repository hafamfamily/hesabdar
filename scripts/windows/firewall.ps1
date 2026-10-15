# Allows the iPhone on the home Wi-Fi to reach the server. Only the "Private" network profile is opened.
. (Join-Path $PSScriptRoot 'common.ps1')

if (-not (Test-Admin)) {
  $code = Invoke-Elevated $PSCommandPath
  if ($code -ne 0) { Write-Fail 'Firewall setup did not finish. See the messages in the administrator window.'; exit 1 }
  Write-Ok 'Firewall configured'
  exit 0
}

try {
  foreach ($p in Get-NetConnectionProfile) {
    if ($p.NetworkCategory -eq 'Public') {
      $ans = Read-Host "    Network '$($p.Name)' is set to Public. Is this your home network? Set it to Private? (y/n)"
      if ($ans -match '^[yY]') { Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private; Write-Ok "'$($p.Name)' is now Private" }
      else { Write-Warn2 'The iPhone cannot connect while the network is Public.' }
    } else { Write-Ok "Network '$($p.Name)' is $($p.NetworkCategory)" }
  }

  $rules = @(
    @{ Name = 'DakhlKharj HTTPS'; Protocol = 'TCP'; Port = 8443 },
    @{ Name = 'DakhlKharj Setup'; Protocol = 'TCP'; Port = 8080 },
    @{ Name = 'DakhlKharj mDNS'; Protocol = 'UDP'; Port = 5353 }
  )
  foreach ($r in $rules) {
    Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Action Allow -Protocol $r.Protocol -LocalPort $r.Port -Profile Private -RemoteAddress LocalSubnet | Out-Null
    Write-Ok "Firewall: $($r.Protocol) $($r.Port) allowed on Private networks (local subnet only)"
  }
} catch {
  Write-Fail "Firewall setup failed: $($_.Exception.Message)"
  Read-Host '    Press Enter to close'
  exit 1
}
Start-Sleep -Seconds 2
exit 0
