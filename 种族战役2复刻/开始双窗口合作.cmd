@echo off
setlocal
set "COOP_PORT=18644"
cd /d "%~dp0"
set "COOP_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%COOP_NODE%" goto run
set "COOP_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js was not found. Install Node.js 24 or use this computer's Codex runtime.
 pause
 exit /b 1
)
:run
"%COOP_NODE%" coop-local-server.cjs --open
if errorlevel 1 pause
