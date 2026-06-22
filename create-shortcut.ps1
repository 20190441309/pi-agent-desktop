# Pi Agent 桌面快捷方式创建脚本
# 运行此脚本在桌面创建 Pi Agent 快捷方式

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutNames = @("Pi Agent.lnk", "Pi Agent Desktop.lnk")

# Derive paths from the script's own location — works from any checkout path.
$projectRoot = $PSScriptRoot
$appPath = Join-Path $PSScriptRoot "apps\desktop\dist\win-unpacked\Pi Desktop.exe"
$iconPath = Join-Path $PSScriptRoot "apps\desktop\build\icon.ico"

if (-not (Test-Path $appPath)) {
    Write-Host "未找到打包后的应用: $appPath" -ForegroundColor Red
    Write-Host "请先运行: pnpm --filter @pi-desktop/desktop package:dir" -ForegroundColor Yellow
    exit 1
}

# 如果图标不存在，使用默认图标
if (-not (Test-Path $iconPath)) {
    $iconPath = "shell32.dll,13"
}

# 创建 WScript.Shell 对象
$WshShell = New-Object -ComObject WScript.Shell

foreach ($shortcutName in $shortcutNames) {
    $shortcutPath = Join-Path $desktopPath $shortcutName

    # 创建或刷新快捷方式
    $shortcut = $WshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $appPath
    $shortcut.WorkingDirectory = $projectRoot
    $shortcut.Description = "Pi Agent Desktop - 最新本地打包版本"
    $shortcut.IconLocation = $iconPath
    $shortcut.WindowStyle = 1  # 正常窗口

    # 保存快捷方式
    $shortcut.Save()

    Write-Host "桌面快捷方式已更新: $shortcutPath" -ForegroundColor Green
}
Write-Host ""
Write-Host "使用说明:" -ForegroundColor Cyan
Write-Host "   - 双击桌面图标启动 Pi Agent" -ForegroundColor White
Write-Host "   - 应用将启动 Electron 桌面客户端" -ForegroundColor White
Write-Host ""
