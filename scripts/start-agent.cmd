@echo off
cd /d "%~dp0..\agent"
echo.
echo ==============================
echo   Lighthouse Pro Local Agent
echo ==============================
if not exist node_modules\lighthouse\package.json (
  echo Installing Lighthouse dependencies (first run only)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo npm install failed. Check Node.js and network.
    pause
    exit /b 1
  )
)
echo Agent address: http://127.0.0.1:4177/health
echo Keep this window open to run audits.
node server.mjs
if errorlevel 1 pause
