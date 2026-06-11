# Create Pi Desktop Desktop Shortcut
# Usage: Right-click -> "Run with PowerShell" or in PowerShell: .\create-shortcut.ps1

$ErrorActionPreference = "Stop"

# Detect paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$desktopPath = [Environment]::GetFolderPath("Desktop")

# v1.1 fix: Use the BAT launcher to ensure PATH includes npm global bin
$appLauncher = Join-Path $scriptDir "Pi Desktop.bat"
$iconFile = Join-Path $scriptDir "build\icon.ico"

# Verify files exist
if (-not (Test-Path $appLauncher)) {
    Write-Error "Pi Desktop.bat not found: $appLauncher"
    exit 1
}

if (-not (Test-Path $iconFile)) {
    Write-Warning "Icon file not found: $iconFile, using default icon"
    $iconFile = Join-Path $scriptDir "dist\win-unpacked\Pi Desktop.exe"
}

# Create desktop shortcut
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut((Join-Path $desktopPath "Pi Desktop.lnk"))
$shortcut.TargetPath = $appLauncher
$shortcut.WorkingDirectory = $scriptDir
$shortcut.IconLocation = $iconFile
$shortcut.Description = "Pi Desktop - AI Coding Agent"
$shortcut.WindowStyle = 7  # Minimized window (BAT will open Electron separately)
$shortcut.Save()

Write-Host "Desktop shortcut created!" -ForegroundColor Green
Write-Host "Location: $desktopPath\Pi Desktop.lnk"
Write-Host "Target: $appLauncher"
Write-Host ""
Write-Host "The shortcut now uses a launcher that ensures PATH includes npm global bin," -ForegroundColor Cyan
Write-Host "so Pi CLI can be detected correctly when starting from desktop." -ForegroundColor Cyan
