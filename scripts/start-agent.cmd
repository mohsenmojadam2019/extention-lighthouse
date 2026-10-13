@echo off
setlocal
cd /d "%~dp0..\agent"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo Lighthouse Pro local agent: http://127.0.0.1:4177/health
echo Keep this terminal open during audits. Press Ctrl+C to stop.
node server.mjs
pause
