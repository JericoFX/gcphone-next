@echo off
setlocal
set SCRIPT_DIR=%~dp0

docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" down
if errorlevel 1 (
  echo [gcphone-livekit] Docker compose down failed.
  exit /b 1
)

echo [gcphone-livekit] LiveKit stack stopped.
exit /b 0
