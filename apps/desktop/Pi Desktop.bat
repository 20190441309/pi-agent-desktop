@echo off
REM Pi Desktop Launcher - Ensures PATH includes npm global bin for Pi CLI detection

REM Get npm prefix
for /f "tokens=*" %%a in ('npm config get prefix 2^>nul') do set NPM_PREFIX=%%a

REM Add npm bin directories to PATH
if exist "%NPM_PREFIX%" (
    set "PATH=%NPM_PREFIX%;%NPM_PREFIX%\node_modules\.bin;%PATH%"
)

REM Also add common npm global paths
if exist "%APPDATA%\npm" (
    set "PATH=%APPDATA%\npm;%PATH%"
)
if exist "%LOCALAPPDATA%\npm" (
    set "PATH=%LOCALAPPDATA%\npm;%PATH%"
)

REM Launch Pi Desktop
start "" "%~dp0dist\win-unpacked\Pi Desktop.exe"
