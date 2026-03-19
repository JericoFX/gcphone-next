@echo off
setlocal
set SCRIPT_DIR=%~dp0

if not exist "%SCRIPT_DIR%setup-livekit.ps1" (
  echo [gcphone-livekit] Missing setup-livekit.ps1
  pause
  exit /b 1
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
