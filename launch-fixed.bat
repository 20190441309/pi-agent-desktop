@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"

echo [Pi Agent] Stopping existing instance...
taskkill /F /IM electron.exe 2>nul >nul
taskkill /F /IM node.exe 2>nul >nul

echo [Pi Agent] Pulling latest code...
git pull origin master
if errorlevel 1 (
  echo [Pi Agent] Git pull failed.
  pause
  exit /b 1
)

echo [Pi Agent] Installing dependencies...
call pnpm install
if errorlevel 1 (
  echo [Pi Agent] Dependency install failed.
  pause
  exit /b 1
)

echo [Pi Agent] Building desktop...
cd /d "%ROOT%apps\desktop"
call pnpm run build
if errorlevel 1 (
  echo [Pi Agent] Build failed. Window will not start with stale files.
  pause
  exit /b 1
)

echo [Pi Agent] Starting...
call "%~dp0apps\desktop\node_modules\.bin\electron.CMD" .

endlocal
