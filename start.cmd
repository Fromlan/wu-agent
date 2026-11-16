@echo off
setlocal
chcp 65001 >nul
title Wu Agent
pushd "%~dp0"
if errorlevel 1 goto directory_error

where node >nul 2>nul
if errorlevel 1 goto node_missing

node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1);"
if errorlevel 1 goto node_version

if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  if errorlevel 1 goto config_error
  echo Created .env. Add your DEEPSEEK_API_KEY to enable research.
)

echo Starting Wu Agent. Keep this window open while the agent is running.
echo Press Ctrl+C to stop.
node src/server.mjs --open %*
set "START_EXIT_CODE=%ERRORLEVEL%"
popd
if not "%START_EXIT_CODE%"=="0" (
  echo Startup failed. Check the message above.
  pause
)
exit /b %START_EXIT_CODE%

:node_missing
echo Node.js was not found. Install Node.js 22.12 or newer, then try again.
goto failed

:node_version
echo Node.js 22.12 or newer is required.
goto failed

:config_error
echo Could not create .env. Check that .env.example exists and the folder is writable.
goto failed

:directory_error
echo Could not open the project folder.
pause
exit /b 1

:failed
popd
pause
exit /b 1
