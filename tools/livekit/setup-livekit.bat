@echo off
setlocal
set SCRIPT_DIR=%~dp0

if not exist "%SCRIPT_DIR%setup-livekit.ps1" (
  echo [gcphone-livekit] Missing setup-livekit.ps1
  pause
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [gcphone-livekit] Docker Desktop is not installed.
  set /p INSTALL_DOCKER=Open Docker Desktop download page now? (Y/N): 
  if /I "%INSTALL_DOCKER%"=="Y" (
    start "" "https://www.docker.com/products/docker-desktop/"
  )
  echo [gcphone-livekit] You can continue setup now and install Docker later.
  echo.
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%setup-livekit.ps1"
if errorlevel 1 (
  echo.
  echo [gcphone-livekit] Setup failed.
  pause
  exit /b 1
)

echo.
echo [gcphone-livekit] Setup completed.
echo [gcphone-livekit] Run start-livekit.bat to launch services.
pause
exit /b 0
