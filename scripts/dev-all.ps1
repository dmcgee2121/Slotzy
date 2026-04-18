$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$serverRoot = Join-Path $repoRoot "server"
$frontendUrl = "http://localhost:5173/pages/index.html?demo=1"

function Start-SlotzyWindow {
  param(
    [string]$Title,
    [string]$WorkingDirectory,
    [string]$Command
  )

  $psCommand = @"
`$Host.UI.RawUI.WindowTitle = '$Title'
Set-Location '$WorkingDirectory'
$Command
"@

  Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $psCommand
  ) | Out-Null
}

Write-Host "Starting Slotzy frontend and backend..."
Start-SlotzyWindow -Title "Slotzy Frontend" -WorkingDirectory $repoRoot -Command "npm run serve"
Start-Sleep -Seconds 2
Start-SlotzyWindow -Title "Slotzy Backend" -WorkingDirectory $serverRoot -Command "npm run dev"
Start-Sleep -Seconds 3
Start-Process $frontendUrl | Out-Null
Write-Host "Frontend: $frontendUrl"
Write-Host "Backend:  http://localhost:3001/api/health"
