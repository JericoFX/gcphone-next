
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envPath = Join-Path $scriptDir '.env'
$configPath = Join-Path $scriptDir 'livekit.yaml'
$startScriptPath = Join-Path $scriptDir 'start-livekit.bat'
$stopScriptPath = Join-Path $scriptDir 'stop-livekit.bat'

function Read-Text {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt,
    [string]$Default = '',
    [switch]$AllowEmpty
  )

  if ($AllowEmpty) {
    $value = Read-Host $Prompt
    if ([string]::IsNullOrWhiteSpace($value)) {
      return ''
    }
    return $value.Trim()
  }

  if ($Default -ne '') {
    $value = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) {
      return $Default
    }
    return $value.Trim()
  }

  while ($true) {
    $value = Read-Host $Prompt
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
  }
}

function Read-Int {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt,
    [Parameter(Mandatory = $true)][int]$Default,
    [int]$Min = 1,
    [int]$Max = 65535
  )

  while ($true) {
    $raw = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return $Default
    }

    $parsed = 0
    if ([int]::TryParse($raw, [ref]$parsed) -and $parsed -ge $Min -and $parsed -le $Max) {
      return $parsed
    }

    Write-Host "Valor invalido. Debe ser numero entre $Min y $Max." -ForegroundColor Yellow
  }
}

function Read-YesNo {
  param(
    [Parameter(Mandatory = $true)][string]$Prompt,
    [ValidateSet('y', 'n')][string]$Default = 'n'
  )

  $defaultText = if ($Default -eq 'y') { 'Y/n' } else { 'y/N' }
  while ($true) {
    $raw = Read-Host "$Prompt [$defaultText]"
    if ([string]::IsNullOrWhiteSpace($raw)) {
      return $Default -eq 'y'
    }

    $normalized = $raw.Trim().ToLowerInvariant()
    if ($normalized -in @('y', 'yes', 's', 'si')) {
      return $true
    }
    if ($normalized -in @('n', 'no')) {
      return $false
    }
  }
}

function New-RandomToken {
  param([int]$Length = 40)
  $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $Length; $i++) {
    $index = Get-Random -Minimum 0 -Maximum $chars.Length
    [void]$sb.Append($chars[$index])
  }
  return $sb.ToString()
}

function Escape-YamlSingle {
  param([Parameter(Mandatory = $true)][string]$Value)
  return $Value.Replace("'", "''")
}

function Test-DockerInstalled {
  try {
    $null = Get-Command docker -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Test-DockerComposeAvailable {
  try {
    $null = & docker compose version 2>&1
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Test-DockerRunning {
  try {
    $null = & docker info 2>&1
    return $LASTEXITCODE -eq 0
  } catch {
    return $false
  }
}

function Install-DockerDesktop {
  $installerUrl = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe'
  $installerPath = Join-Path $env:TEMP 'DockerDesktopInstaller.exe'

  Write-Host ''
  Write-Host 'Docker Desktop no esta instalado.' -ForegroundColor Yellow
  Write-Host 'Es necesario para ejecutar LiveKit + Redis.' -ForegroundColor Gray
  Write-Host ''

  $install = Read-YesNo -Prompt 'Descargar e instalar Docker Desktop automaticamente?' -Default 'y'
  if (-not $install) {
    Write-Host ''
    Write-Host 'Puedes instalarlo manualmente desde: https://www.docker.com/products/docker-desktop/' -ForegroundColor Gray
    Write-Host 'Una vez instalado, vuelve a ejecutar este script.' -ForegroundColor Gray
    return $false
  }

  Write-Host ''
  Write-Host 'Descargando Docker Desktop...' -ForegroundColor Cyan
  Write-Host "(~600 MB, puede tomar unos minutos)" -ForegroundColor Gray

  try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    $ProgressPreference = 'Continue'
  } catch {
    Write-Host "Error al descargar: $_" -ForegroundColor Red
    Write-Host 'Descargalo manualmente: https://www.docker.com/products/docker-desktop/' -ForegroundColor Yellow
    return $false
  }

  $fileSize = (Get-Item $installerPath).Length / 1MB
  if ($fileSize -lt 100) {
    Write-Host 'El archivo descargado parece incompleto. Descargalo manualmente.' -ForegroundColor Red
    Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue
    return $false
  }

  Write-Host "Descarga completa ($([math]::Round($fileSize)) MB)." -ForegroundColor Green
  Write-Host ''
  Write-Host 'Instalando Docker Desktop (modo silencioso)...' -ForegroundColor Cyan
  Write-Host 'Esto puede tomar varios minutos. No cierres esta ventana.' -ForegroundColor Gray

  try {
    $process = Start-Process -FilePath $installerPath `
      -ArgumentList 'install', '--quiet', '--accept-license' `
      -Wait -PassThru -NoNewWindow
  } catch {
    Write-Host "Error al ejecutar el instalador: $_" -ForegroundColor Red
    Write-Host 'Ejecuta manualmente el instalador descargado en:' -ForegroundColor Yellow
    Write-Host "  $installerPath" -ForegroundColor Yellow
    return $false
  }

  Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue

  if ($process.ExitCode -ne 0) {
    Write-Host "El instalador finalizo con codigo: $($process.ExitCode)" -ForegroundColor Red
    Write-Host 'Es posible que necesites reiniciar el equipo o ejecutar como administrador.' -ForegroundColor Yellow
    return $false
  }

  # Refresh PATH for current session
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machinePath;$userPath"

  Write-Host ''
  Write-Host 'Docker Desktop instalado correctamente.' -ForegroundColor Green

  if (-not (Test-DockerInstalled)) {
    Write-Host ''
    Write-Host 'Docker se instalo pero no se detecta en PATH todavia.' -ForegroundColor Yellow
    Write-Host 'Es posible que necesites:' -ForegroundColor Yellow
    Write-Host '  1. Reiniciar esta terminal' -ForegroundColor Gray
    Write-Host '  2. Iniciar Docker Desktop desde el menu de inicio' -ForegroundColor Gray
    Write-Host '  3. Reiniciar el equipo si se activo WSL/Hyper-V' -ForegroundColor Gray
    Write-Host ''
    Write-Host 'Despues de eso, vuelve a ejecutar este script.' -ForegroundColor Yellow
    return $false
  }

  return $true
}

Write-Host ''
Write-Host '== gcphone LiveKit setup ==' -ForegroundColor Cyan
Write-Host 'Este asistente configura LiveKit + Redis para gcphone.' -ForegroundColor Gray
Write-Host ''

# ── Docker check ──────────────────────────────────────────────────
if (-not (Test-DockerInstalled)) {
  $installed = Install-DockerDesktop
  if (-not $installed) {
    Write-Host ''
    Write-Host 'Continuando con la configuracion de todos modos...' -ForegroundColor Gray
    Write-Host 'Podras iniciar los servicios despues de instalar Docker.' -ForegroundColor Gray
    Write-Host ''
  }
} else {
  Write-Host 'Docker detectado.' -ForegroundColor Green
  if (Test-DockerRunning) {
    Write-Host 'Docker daemon esta corriendo.' -ForegroundColor Green
  } else {
    Write-Host 'Docker esta instalado pero el daemon no esta corriendo.' -ForegroundColor Yellow
    Write-Host 'Inicia Docker Desktop antes de ejecutar start-livekit.bat.' -ForegroundColor Yellow
  }
  if (Test-DockerComposeAvailable) {
    Write-Host 'Docker Compose disponible.' -ForegroundColor Green
  } else {
    Write-Host 'Docker Compose no detectado. Actualiza Docker Desktop.' -ForegroundColor Yellow
  }
}

Write-Host ''

$signalScheme = Read-Text -Prompt 'Esquema de conexion para FiveM (ws o wss)' -Default 'ws'
$signalScheme = $signalScheme.ToLowerInvariant()
if ($signalScheme -notin @('ws', 'wss')) {
  Write-Host 'Esquema invalido, se usara ws.' -ForegroundColor Yellow
  $signalScheme = 'ws'
}

$publicHost = Read-Text -Prompt 'IP o host publico del LiveKit' -Default '127.0.0.1'
$publicHost = ($publicHost -replace '^wss?://', '').TrimEnd('/')
$signalPort = Read-Int -Prompt 'Puerto signal/WebSocket de LiveKit' -Default 7880
$rtcTcpPort = Read-Int -Prompt 'Puerto RTC TCP de LiveKit' -Default 7881
$rtcUdpStart = Read-Int -Prompt 'Inicio rango RTC UDP' -Default 50000
$rtcUdpEnd = Read-Int -Prompt 'Fin rango RTC UDP' -Default 50100

if ($rtcUdpEnd -lt $rtcUdpStart) {
  Write-Host 'El fin de rango UDP era menor que el inicio. Se ajusta automaticamente.' -ForegroundColor Yellow
  $tmp = $rtcUdpStart
  $rtcUdpStart = $rtcUdpEnd
  $rtcUdpEnd = $tmp
}

$useExternalIp = Read-YesNo -Prompt 'Usar use_external_ip en LiveKit' -Default 'y'

$apiKey = Read-Text -Prompt 'LiveKit API key' -Default 'gcphone'
$apiSecretInput = Read-Text -Prompt 'LiveKit API secret (vacio para generar)' -AllowEmpty
$apiSecret = if ([string]::IsNullOrWhiteSpace($apiSecretInput)) { New-RandomToken -Length 48 } else { $apiSecretInput }

$roomPrefix = Read-Text -Prompt 'Prefijo de room (livekit_room_prefix)' -Default 'gcphone'
$maxCallDuration = Read-Int -Prompt 'Max duracion de llamada (segundos)' -Default 300 -Min 30 -Max 86400

$enableTurnTls = Read-YesNo -Prompt 'Habilitar TURN/TLS integrado en LiveKit (requiere dominio + cert)' -Default 'n'
$turnDomain = ''
$turnTlsPort = 5349
$turnCertFile = ''
$turnKeyFile = ''

if ($enableTurnTls) {
  $turnDomain = Read-Text -Prompt 'Dominio TURN (ej: turn.midominio.com)'
  $turnTlsPort = Read-Int -Prompt 'Puerto TURN TLS' -Default 5349
  $turnCertFile = Read-Text -Prompt 'Ruta cert_file dentro del contenedor' -Default '/etc/livekit/certs/turn.crt'
  $turnKeyFile = Read-Text -Prompt 'Ruta key_file dentro del contenedor' -Default '/etc/livekit/certs/turn.key'
}

$livekitHost = ('{0}://{1}:{2}' -f $signalScheme, $publicHost, $signalPort)

$apiKeyYaml = Escape-YamlSingle -Value $apiKey
$apiSecretYaml = Escape-YamlSingle -Value $apiSecret

$yamlLines = @(
  "port: $signalPort",
  'log_level: info',
  'rtc:',
  "  tcp_port: $rtcTcpPort",
  "  port_range_start: $rtcUdpStart",
  "  port_range_end: $rtcUdpEnd",
  "  use_external_ip: $($useExternalIp.ToString().ToLowerInvariant())",
  'redis:',
  '  address: redis:6379',
  'keys:',
  "  '$apiKeyYaml': '$apiSecretYaml'"
)

if ($enableTurnTls) {
  $yamlLines += 'turn:'
  $yamlLines += '  enabled: true'
  $yamlLines += "  domain: '$(Escape-YamlSingle -Value $turnDomain)'"
  $yamlLines += "  tls_port: $turnTlsPort"
  $yamlLines += "  cert_file: '$(Escape-YamlSingle -Value $turnCertFile)'"
  $yamlLines += "  key_file: '$(Escape-YamlSingle -Value $turnKeyFile)'"
} else {
  $yamlLines += 'turn:'
  $yamlLines += '  enabled: false'
}

Set-Content -Path $configPath -Value ($yamlLines -join "`r`n") -Encoding Ascii

$envLines = @(
  "LIVEKIT_HOST=$livekitHost",
  "LIVEKIT_WS_PORT=$signalPort",
  "LIVEKIT_RTC_TCP_PORT=$rtcTcpPort",
  "LIVEKIT_RTC_PORT_RANGE_START=$rtcUdpStart",
  "LIVEKIT_RTC_PORT_RANGE_END=$rtcUdpEnd",
  "LIVEKIT_API_KEY=$apiKey",
  "LIVEKIT_API_SECRET=$apiSecret",
  "LIVEKIT_ROOM_PREFIX=$roomPrefix",
  "LIVEKIT_MAX_CALL_DURATION=$maxCallDuration",
  "LIVEKIT_USE_EXTERNAL_IP=$($useExternalIp.ToString().ToLowerInvariant())",
  "SOCKET_PORT=$socketPort"
)

if ($enableTurnTls) {
  $envLines += 'LIVEKIT_TURN_TLS_ENABLED=true'
  $envLines += "LIVEKIT_TURN_DOMAIN=$turnDomain"
  $envLines += "LIVEKIT_TURN_TLS_PORT=$turnTlsPort"
  $envLines += "LIVEKIT_TURN_CERT_FILE=$turnCertFile"
  $envLines += "LIVEKIT_TURN_KEY_FILE=$turnKeyFile"
} else {
  $envLines += 'LIVEKIT_TURN_TLS_ENABLED=false'
}

Set-Content -Path $envPath -Value ($envLines -join "`r`n") -Encoding Ascii

$startBat = @(
  '@echo off',
  'setlocal',
  'set SCRIPT_DIR=%~dp0',
  '',
  'if not exist "%SCRIPT_DIR%\.env" (',
  '  echo [gcphone-livekit] Missing .env. Run setup-livekit.bat first.',
  '  pause',
  '  exit /b 1',
  ')',
  'if not exist "%SCRIPT_DIR%\livekit.yaml" (',
  '  echo [gcphone-livekit] Missing livekit.yaml. Run setup-livekit.bat first.',
  '  pause',
  '  exit /b 1',
  ')',
  '',
  'where docker >nul 2>nul',
  'if errorlevel 1 (',
  '  echo [gcphone-livekit] Docker no esta instalado.',
  '  echo.',
  '  set /p INSTALL_DOCKER=[gcphone-livekit] Descargar e instalar Docker Desktop automaticamente? (Y/N): ',
  '  if /I "%INSTALL_DOCKER%"=="Y" (',
  '    echo [gcphone-livekit] Descargando Docker Desktop...',
  '    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ProgressPreference=''SilentlyContinue''; Invoke-WebRequest -Uri ''https://desktop.docker.com/win/main/amd64/Docker%%20Desktop%%20Installer.exe'' -OutFile ''%TEMP%\DockerDesktopInstaller.exe'' -UseBasicParsing; Write-Host ''Descarga completa.'' } catch { Write-Host ''Error al descargar.''; exit 1 }"',
  '    if errorlevel 1 (',
  '      echo [gcphone-livekit] Error al descargar. Visita: https://www.docker.com/products/docker-desktop/',
  '      pause',
  '      exit /b 1',
  '    )',
  '    echo [gcphone-livekit] Instalando Docker Desktop (modo silencioso)...',
  '    echo [gcphone-livekit] Esto puede tomar varios minutos. No cierres esta ventana.',
  '    "%TEMP%\DockerDesktopInstaller.exe" install --quiet --accept-license',
  '    if errorlevel 1 (',
  '      echo [gcphone-livekit] Instalacion fallo. Puede requerir reinicio o permisos de administrador.',
  '      pause',
  '      exit /b 1',
  '    )',
  '    del "%TEMP%\DockerDesktopInstaller.exe" >nul 2>nul',
  '    echo [gcphone-livekit] Docker Desktop instalado. Reinicia esta terminal e inicia Docker Desktop.',
  '    pause',
  '    exit /b 0',
  '  ) else (',
  '    echo [gcphone-livekit] Instala Docker Desktop manualmente: https://www.docker.com/products/docker-desktop/',
  '    pause',
  '    exit /b 1',
  '  )',
  ')',
  '',
  'docker compose version >nul 2>nul',
  'if errorlevel 1 (',
  '  echo [gcphone-livekit] Docker Compose no disponible. Actualiza Docker Desktop.',
  '  pause',
  '  exit /b 1',
  ')',
  '',
  'docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" up -d',
  'if errorlevel 1 (',
  '  echo [gcphone-livekit] Docker compose fallo.',
  '  pause',
  '  exit /b 1',
  ')',
  '',
  'echo [gcphone-livekit] LiveKit stack corriendo.',
  'docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" ps',
  'pause',
  'exit /b 0'
)
Set-Content -Path $startScriptPath -Value ($startBat -join "`r`n") -Encoding Ascii

$stopBat = @(
  '@echo off',
  'setlocal',
  'set SCRIPT_DIR=%~dp0',
  '',
  'docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" down',
  'if errorlevel 1 (',
  '  echo [gcphone-livekit] Docker compose down failed.',
  '  pause',
  '  exit /b 1',
  ')',
  '',
  'echo [gcphone-livekit] LiveKit stack stopped.',
  'pause',
  'exit /b 0'
)
Set-Content -Path $stopScriptPath -Value ($stopBat -join "`r`n") -Encoding Ascii

# ── Socket.IO port ────────────────────────────────────────────────
Write-Host ''
$socketPort = Read-Int -Prompt 'Puerto del Socket.IO server (WaveChat / SnapLive chat)' -Default 3001

# ── Firewall rules ────────────────────────────────────────────────
Write-Host ''
$openFirewall = Read-YesNo -Prompt 'Abrir los puertos de LiveKit y Socket.IO en el Firewall de Windows?' -Default 'y'

if ($openFirewall) {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )

  $fwCommands = @(
    "netsh advfirewall firewall delete rule name=`"gcphone-livekit-signal`" >nul 2>&1",
    "netsh advfirewall firewall delete rule name=`"gcphone-livekit-rtc-tcp`" >nul 2>&1",
    "netsh advfirewall firewall delete rule name=`"gcphone-livekit-rtc-udp`" >nul 2>&1",
    "netsh advfirewall firewall delete rule name=`"gcphone-socket-io`" >nul 2>&1",
    "netsh advfirewall firewall add rule name=`"gcphone-livekit-signal`" dir=in action=allow protocol=TCP localport=$signalPort",
    "netsh advfirewall firewall add rule name=`"gcphone-livekit-rtc-tcp`" dir=in action=allow protocol=TCP localport=$rtcTcpPort",
    "netsh advfirewall firewall add rule name=`"gcphone-livekit-rtc-udp`" dir=in action=allow protocol=UDP localport=$rtcUdpStart-$rtcUdpEnd",
    "netsh advfirewall firewall add rule name=`"gcphone-socket-io`" dir=in action=allow protocol=TCP localport=$socketPort"
  )
  $fwScript = $fwCommands -join ' & '

  $ruleList = @(
    "  - gcphone-livekit-signal   TCP $signalPort",
    "  - gcphone-livekit-rtc-tcp  TCP $rtcTcpPort",
    "  - gcphone-livekit-rtc-udp  UDP $rtcUdpStart-$rtcUdpEnd",
    "  - gcphone-socket-io        TCP $socketPort"
  )

  if ($isAdmin) {
    Write-Host 'Configurando reglas de firewall...' -ForegroundColor Cyan
    cmd /c $fwScript
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'Reglas de firewall creadas:' -ForegroundColor Green
      $ruleList | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    } else {
      Write-Host 'Error al crear reglas de firewall.' -ForegroundColor Red
      Write-Host 'Puedes crearlas manualmente desde un terminal con permisos de administrador.' -ForegroundColor Yellow
    }
  } else {
    Write-Host 'Se necesitan permisos de administrador para modificar el firewall.' -ForegroundColor Yellow
    Write-Host 'Abriendo ventana elevada...' -ForegroundColor Cyan

    try {
      $process = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', $fwScript `
        -Verb RunAs -Wait -PassThru
      if ($process.ExitCode -eq 0) {
        Write-Host 'Reglas de firewall creadas:' -ForegroundColor Green
        $ruleList | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
      } else {
        Write-Host 'Error al crear reglas de firewall.' -ForegroundColor Red
      }
    } catch {
      Write-Host 'El usuario cancelo la elevacion o hubo un error.' -ForegroundColor Yellow
      Write-Host 'Puedes abrir los puertos manualmente ejecutando como administrador:' -ForegroundColor Yellow
      Write-Host "  netsh advfirewall firewall add rule name=`"gcphone-livekit-signal`" dir=in action=allow protocol=TCP localport=$signalPort" -ForegroundColor Gray
      Write-Host "  netsh advfirewall firewall add rule name=`"gcphone-livekit-rtc-tcp`" dir=in action=allow protocol=TCP localport=$rtcTcpPort" -ForegroundColor Gray
      Write-Host "  netsh advfirewall firewall add rule name=`"gcphone-livekit-rtc-udp`" dir=in action=allow protocol=UDP localport=$rtcUdpStart-$rtcUdpEnd" -ForegroundColor Gray
      Write-Host "  netsh advfirewall firewall add rule name=`"gcphone-socket-io`" dir=in action=allow protocol=TCP localport=$socketPort" -ForegroundColor Gray
    }
  }
} else {
  Write-Host ''
  Write-Host 'Recuerda abrir estos puertos manualmente si es necesario:' -ForegroundColor Yellow
  Write-Host "  - TCP $signalPort (LiveKit signal/WebSocket)" -ForegroundColor Gray
  Write-Host "  - TCP $rtcTcpPort (LiveKit RTC TCP)" -ForegroundColor Gray
  Write-Host "  - UDP $rtcUdpStart-$rtcUdpEnd (LiveKit RTC media)" -ForegroundColor Gray
  Write-Host "  - TCP $socketPort (Socket.IO server)" -ForegroundColor Gray
}

Write-Host ''
Write-Host 'Archivos generados:' -ForegroundColor Green
Write-Host "- $configPath"
Write-Host "- $envPath"
Write-Host "- $startScriptPath"
Write-Host "- $stopScriptPath"
Write-Host ''
Write-Host 'Convars para FiveM (copiar en server.cfg):' -ForegroundColor Green
Write-Host "setr livekit_host `"$livekitHost`""
Write-Host "setr livekit_api_key `"$apiKey`""
Write-Host "setr livekit_api_secret `"$apiSecret`""
Write-Host "setr livekit_room_prefix `"$roomPrefix`""
Write-Host "setr livekit_max_call_duration `"$maxCallDuration`""
Write-Host ''
$socketHost = ('{0}://{1}:{2}' -f $signalScheme, $publicHost, $socketPort)
Write-Host 'Convars Socket.IO (copiar en server.cfg):' -ForegroundColor Green
Write-Host "setr gcphone_socket_host `"$socketHost`""
Write-Host ''
Write-Host 'Listo. Ejecuta start-livekit.bat para levantar LiveKit + Redis.' -ForegroundColor Cyan
