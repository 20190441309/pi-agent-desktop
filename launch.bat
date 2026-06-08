@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%apps\desktop"
echo [Pi Agent] Closing existing local instance...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { ($_.Name -in @('electron.exe','node.exe')) -and ($_.CommandLine -like '*pi-agent-desktop*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo [Pi Agent] Building...
call pnpm run build
if errorlevel 1 (
  echo [Pi Agent] Build failed. Window will not start with stale files.
  pause
  exit /b 1
)
echo [Pi Agent] Starting...
start "" "%ROOT%apps\desktop\node_modules\.bin\electron.CMD" .
endlocal
