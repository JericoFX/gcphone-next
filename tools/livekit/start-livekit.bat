@echo off
setlocal
set SCRIPT_DIR=%~dp0

if not exist "%SCRIPT_DIR%\.env" (
  echo [gcphone-livekit] Missing .env. Run setup-livekit.bat first.
  pause
  exit /b 1
)
if not exist "%SCRIPT_DIR%\livekit.yaml" (
  echo [gcphone-livekit] Missing livekit.yaml. Run setup-livekit.bat first.
  pause
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo [gcphone-livekit] Docker is not installed.
  echo [gcphone-livekit] Node.js alone is not enough to host LiveKit media.
  echo [gcphone-livekit] Install Docker Desktop, or run native livekit-server binary manually.
  set /p INSTALL_DOCKER=Open Docker Desktop download page now? Y/N: 
  if /I "%INSTALL_DOCKER%"=="Y" (
    start "" "https://www.docker.com/products/docker-desktop/"
  )
  pause
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [gcphone-livekit] Docker Compose is not available.
  echo [gcphone-livekit] Update Docker Desktop and try again.
  pause
  exit /b 1
)

docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" up -d
if errorlevel 1 (
  echo [gcphone-livekit] Docker compose failed.
  pause
  exit /b 1
)

echo [gcphone-livekit] LiveKit stack running.
docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" ps
pause
exit /b 0
