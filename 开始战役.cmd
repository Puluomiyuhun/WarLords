@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0种族战役2复刻"
set "COOP_PORT=18644"
set "COOP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%COOP_NODE%" goto run
set "COOP_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 20 or newer is required.
 pause
 exit /b 1
)
:run
"%COOP_NODE%" coop-local-server.cjs --solo --open
if errorlevel 1 pause
