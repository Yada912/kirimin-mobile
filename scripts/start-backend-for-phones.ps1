<#
  Start the Kirimin backend on this PC so phones with the Kirimin APK can connect.

  Usage (from the repo root, in PowerShell):
    .\scripts\start-backend-for-phones.ps1            # phones on the same Wi-Fi
    .\scripts\start-backend-for-phones.ps1 -Tunnel    # phones on ANY network (mobile data, other Wi-Fi)

  Then in the app: tap the server pill on the Welcome / Masuk screen (or Profil > Alamat server)
  and enter the address printed below.
#>
param(
  [switch]$Tunnel,
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$server = Join-Path $root 'server'

# 1. Node check
try { $nodeVersion = (node -v) } catch { Write-Host 'Node.js is not installed. Run: winget install OpenJS.NodeJS.LTS' -ForegroundColor Red; exit 1 }
Write-Host "Node $nodeVersion"

# 2. Let phones on the network reach the port (needs an admin PowerShell the first time).
$ruleName = "Kirimin API $Port"
if (-not (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue)) {
  try {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Private,Domain | Out-Null
    Write-Host "Firewall: opened TCP $Port for private networks." -ForegroundColor Green
  } catch {
    Write-Host "Firewall: could not add a rule (run PowerShell as Administrator once), or allow Node.js when Windows asks." -ForegroundColor Yellow
  }
}

# 3. Print the addresses phones should use.
$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -ExpandProperty IPAddress
Write-Host ''
Write-Host 'Same Wi-Fi: enter one of these in the app (Alamat server):' -ForegroundColor Cyan
foreach ($ip in $ips) { Write-Host "    http://${ip}:$Port" }
Write-Host ''

# 4. Optional public tunnel (free, no account): Cloudflare quick tunnel.
if ($Tunnel) {
  $cf = Get-Command cloudflared -ErrorAction SilentlyContinue
  if (-not $cf) {
    Write-Host 'cloudflared is not installed. Install it once with:  winget install Cloudflare.cloudflared' -ForegroundColor Yellow
  } else {
    $log = Join-Path $env:TEMP 'kirimin-tunnel.log'
    Remove-Item $log -ErrorAction SilentlyContinue
    Start-Process -FilePath $cf.Source -ArgumentList @('tunnel', '--url', "http://localhost:$Port", '--logfile', $log) -WindowStyle Minimized
    Write-Host 'Starting tunnel…'
    $url = $null
    for ($i = 0; $i -lt 30 -and -not $url; $i++) {
      Start-Sleep -Seconds 1
      if (Test-Path $log) { $url = (Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1).Matches.Value }
    }
    if ($url) {
      Write-Host 'Any network: enter this in the app (Alamat server):' -ForegroundColor Cyan
      Write-Host "    $url"
      Write-Host '    (the address changes each time the tunnel restarts)'
    } else {
      Write-Host "Tunnel did not report a URL yet; check $log" -ForegroundColor Yellow
    }
    Write-Host ''
  }
}

# 5. Run the API (Ctrl+C to stop).
Set-Location $server
$env:HOST = '0.0.0.0'
$env:PORT = "$Port"
npm start
