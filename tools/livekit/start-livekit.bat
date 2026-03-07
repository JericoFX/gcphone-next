@echo off
setlocal
set SCRIPT_DIR=%~dp0

if not exist "%SCRIPT_DIR%\.env" (
  echo [gcphone-livekit] Missing .env. Run setup-livekit.bat first.
  exit /b 1
)

if not exist "%SCRIPT_DIR%\livekit.yaml" (
  echo [gcphone-livekit] Missing livekit.yaml. Run setup-livekit.bat first.
  exit /b 1
)

docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" up -d
if errorlevel 1 (
  echo [gcphone-livekit] Docker compose failed.
  exit /b 1
)

echo [gcphone-livekit] LiveKit stack running.
docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" ps
exit /b 0
