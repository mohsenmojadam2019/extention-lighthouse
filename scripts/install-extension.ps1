$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$extensionPath = Join-Path $root 'extension'
Write-Host ""
Write-Host "Lighthouse Pro — Chrome setup" -ForegroundColor Cyan
Write-Host "Extension directory: $extensionPath"
Write-Host "Step 1: Run scripts\start-agent.cmd and keep it open."
Write-Host "Step 2: In Chrome, enable Developer mode at chrome://extensions"
Write-Host "Step 3: Load unpacked and choose: $extensionPath"
Write-Host "Step 4: Pin Lighthouse Pro, visit a website, click its icon."
Start-Process 'chrome://extensions' -ErrorAction SilentlyContinue
