
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

    Write-Host "Invalid value. Must be a number between $Min and $Max." -ForegroundColor Yellow
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
  Write-Host 'Docker Desktop is not installed.' -ForegroundColor Yellow
  Write-Host 'It is required to run LiveKit + Redis.' -ForegroundColor Gray
  Write-Host ''

  $install = Read-YesNo -Prompt 'Download and install Docker Desktop automatically?' -Default 'y'
  if (-not $install) {
    Write-Host ''
    Write-Host 'You can install it manually from: https://www.docker.com/products/docker-desktop/' -ForegroundColor Gray
    Write-Host 'Once installed, run this script again.' -ForegroundColor Gray
    return $false
  }

  Write-Host ''
  Write-Host 'Downloading Docker Desktop...' -ForegroundColor Cyan
  Write-Host "(~600 MB, this may take a few minutes)" -ForegroundColor Gray

  try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing
    $ProgressPreference = 'Continue'
  } catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    Write-Host 'Download it manually: https://www.docker.com/products/docker-desktop/' -ForegroundColor Yellow
    return $false
  }

  $fileSize = (Get-Item $installerPath).Length / 1MB
  if ($fileSize -lt 100) {
    Write-Host 'The downloaded file appears incomplete. Download it manually.' -ForegroundColor Red
    Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue
    return $false
  }

  Write-Host "Download complete ($([math]::Round($fileSize)) MB)." -ForegroundColor Green
  Write-Host ''
  Write-Host 'Installing Docker Desktop (silent mode)...' -ForegroundColor Cyan
  Write-Host 'This may take several minutes. Do not close this window.' -ForegroundColor Gray

  try {
    $process = Start-Process -FilePath $installerPath `
      -ArgumentList 'install', '--quiet', '--accept-license' `
      -Wait -PassThru -NoNewWindow
  } catch {
    Write-Host "Failed to run the installer: $_" -ForegroundColor Red
    Write-Host 'Manually run the downloaded installer at:' -ForegroundColor Yellow
    Write-Host "  $installerPath" -ForegroundColor Yellow
    return $false
  }

  Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue

  if ($process.ExitCode -ne 0) {
    Write-Host "Installer exited with code: $($process.ExitCode)" -ForegroundColor Red
    Write-Host 'You may need to restart your computer or run as administrator.' -ForegroundColor Yellow
    return $false
  }

  # Refresh PATH for current session
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machinePath;$userPath"

  Write-Host ''
  Write-Host 'Docker Desktop installed successfully.' -ForegroundColor Green

  if (-not (Test-DockerInstalled)) {
    Write-Host ''
    Write-Host 'Docker was installed but is not detected in PATH yet.' -ForegroundColor Yellow
    Write-Host 'You may need to:' -ForegroundColor Yellow
    Write-Host '  1. Restart this terminal' -ForegroundColor Gray
    Write-Host '  2. Launch Docker Desktop from the Start menu' -ForegroundColor Gray
    Write-Host '  3. Restart your computer if WSL/Hyper-V was enabled' -ForegroundColor Gray
    Write-Host ''
    Write-Host 'After that, run this script again.' -ForegroundColor Yellow
    return $false
  }

  return $true
}

Write-Host ''
Write-Host '== gcphone LiveKit setup ==' -ForegroundColor Cyan
Write-Host 'This wizard configures LiveKit + Redis for gcphone.' -ForegroundColor Gray
Write-Host ''

# ── Docker check ──────────────────────────────────────────────────
if (-not (Test-DockerInstalled)) {
  $installed = Install-DockerDesktop
  if (-not $installed) {
    Write-Host ''
    Write-Host 'Continuing with configuration anyway...' -ForegroundColor Gray
    Write-Host 'You can start the services after installing Docker.' -ForegroundColor Gray
    Write-Host ''
  }
} else {
  Write-Host 'Docker detected.' -ForegroundColor Green
  if (Test-DockerRunning) {
    Write-Host 'Docker daemon is running.' -ForegroundColor Green
  } else {
    Write-Host 'Docker is installed but the daemon is not running.' -ForegroundColor Yellow
    Write-Host 'Start Docker Desktop before running start-livekit.bat.' -ForegroundColor Yellow
  }
  if (Test-DockerComposeAvailable) {
    Write-Host 'Docker Compose available.' -ForegroundColor Green
  } else {
    Write-Host 'Docker Compose not detected. Update Docker Desktop.' -ForegroundColor Yellow
  }
}

Write-Host ''

$signalScheme = Read-Text -Prompt 'Connection scheme for FiveM (ws or wss)' -Default 'ws'
$signalScheme = $signalScheme.ToLowerInvariant()
if ($signalScheme -notin @('ws', 'wss')) {
  Write-Host 'Invalid scheme, defaulting to ws.' -ForegroundColor Yellow
  $signalScheme = 'ws'
}

# Auto-detect public IP so remote clients can connect
$detectedIp = '127.0.0.1'
try {
  $detectedIp = (Invoke-WebRequest -Uri 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 5).Content.Trim()
  Write-Host "Detected public IP: $detectedIp" -ForegroundColor Green
} catch {
  Write-Host 'Could not detect public IP, defaulting to 127.0.0.1' -ForegroundColor Yellow
  Write-Host 'IMPORTANT: 127.0.0.1 only works for local testing.' -ForegroundColor Yellow
  Write-Host 'For remote players, use your server public IP or domain.' -ForegroundColor Yellow
}

$publicHost = Read-Text -Prompt 'LiveKit public IP or host (remote players connect to this)' -Default $detectedIp
$publicHost = ($publicHost -replace '^wss?://', '').TrimEnd('/')
$signalPort = Read-Int -Prompt 'LiveKit signal/WebSocket port' -Default 7880
$rtcTcpPort = Read-Int -Prompt 'LiveKit RTC TCP port' -Default 7881
$rtcUdpStart = Read-Int -Prompt 'RTC UDP range start' -Default 50000
$rtcUdpEnd = Read-Int -Prompt 'RTC UDP range end' -Default 50100

if ($rtcUdpEnd -lt $rtcUdpStart) {
  Write-Host 'UDP range end was less than start. Swapping automatically.' -ForegroundColor Yellow
  $tmp = $rtcUdpStart
  $rtcUdpStart = $rtcUdpEnd
  $rtcUdpEnd = $tmp
}

$useExternalIp = Read-YesNo -Prompt 'Use use_external_ip in LiveKit' -Default 'y'

$apiKey = Read-Text -Prompt 'LiveKit API key' -Default 'gcphone'
$apiSecretInput = Read-Text -Prompt 'LiveKit API secret (empty to generate)' -AllowEmpty
$apiSecret = if ([string]::IsNullOrWhiteSpace($apiSecretInput)) { New-RandomToken -Length 48 } else { $apiSecretInput }

$roomPrefix = Read-Text -Prompt 'Room prefix (livekit_room_prefix)' -Default 'gcphone'
$maxCallDuration = Read-Int -Prompt 'Max call duration (seconds)' -Default 300 -Min 30 -Max 86400

$socketPort = Read-Int -Prompt 'Socket.IO server port (WaveChat / SnapLive chat)' -Default 3001

$enableTurnTls = Read-YesNo -Prompt 'Enable built-in TURN/TLS in LiveKit (requires domain + cert)' -Default 'n'
$turnDomain = ''
$turnTlsPort = 5349
$turnCertFile = ''
$turnKeyFile = ''

if ($enableTurnTls) {
  $turnDomain = Read-Text -Prompt 'TURN domain (e.g. turn.mydomain.com)'
  $turnTlsPort = Read-Int -Prompt 'TURN TLS port' -Default 5349
  $turnCertFile = Read-Text -Prompt 'cert_file path inside the container' -Default '/etc/livekit/certs/turn.crt'
  $turnKeyFile = Read-Text -Prompt 'key_file path inside the container' -Default '/etc/livekit/certs/turn.key'
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
  '  echo [gcphone-livekit] Docker is not installed.',
  '  echo.',
  '  set /p INSTALL_DOCKER=[gcphone-livekit] Download and install Docker Desktop automatically? (Y/N): ',
  '  if /I "%INSTALL_DOCKER%"=="Y" (',
  '    echo [gcphone-livekit] Downloading Docker Desktop...',
  '    powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $ProgressPreference=''SilentlyContinue''; Invoke-WebRequest -Uri ''https://desktop.docker.com/win/main/amd64/Docker%%20Desktop%%20Installer.exe'' -OutFile ''%TEMP%\DockerDesktopInstaller.exe'' -UseBasicParsing; Write-Host ''Download complete.'' } catch { Write-Host ''Download failed.''; exit 1 }"',
  '    if errorlevel 1 (',
  '      echo [gcphone-livekit] Download failed. Visit: https://www.docker.com/products/docker-desktop/',
  '      pause',
  '      exit /b 1',
  '    )',
  '    echo [gcphone-livekit] Installing Docker Desktop (silent mode)...',
  '    echo [gcphone-livekit] This may take several minutes. Do not close this window.',
  '    "%TEMP%\DockerDesktopInstaller.exe" install --quiet --accept-license',
  '    if errorlevel 1 (',
  '      echo [gcphone-livekit] Installation failed. May require restart or administrator privileges.',
  '      pause',
  '      exit /b 1',
  '    )',
  '    del "%TEMP%\DockerDesktopInstaller.exe" >nul 2>nul',
  '    echo [gcphone-livekit] Docker Desktop installed. Restart this terminal and start Docker Desktop.',
  '    pause',
  '    exit /b 0',
  '  ) else (',
  '    echo [gcphone-livekit] Install Docker Desktop manually: https://www.docker.com/products/docker-desktop/',
  '    pause',
  '    exit /b 1',
  '  )',
  ')',
  '',
  'docker compose version >nul 2>nul',
  'if errorlevel 1 (',
  '  echo [gcphone-livekit] Docker Compose not available. Update Docker Desktop.',
  '  pause',
  '  exit /b 1',
  ')',
  '',
  'docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" up -d',
  'if errorlevel 1 (',
  '  echo [gcphone-livekit] Docker compose failed.',
  '  pause',
  '  exit /b 1',
  ')',
  '',
  'echo [gcphone-livekit] LiveKit stack running.',
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

# ── Firewall rules ────────────────────────────────────────────────
Write-Host ''
$openFirewall = Read-YesNo -Prompt 'Open LiveKit and Socket.IO ports in Windows Firewall?' -Default 'y'

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
    Write-Host 'Configuring firewall rules...' -ForegroundColor Cyan
    cmd /c $fwScript
    if ($LASTEXITCODE -eq 0) {
      Write-Host 'Firewall rules created:' -ForegroundColor Green
      $ruleList | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
    } else {
      Write-Host 'Failed to create firewall rules.' -ForegroundColor Red
      Write-Host 'You can create them manually from an administrator terminal.' -ForegroundColor Yellow
    }
  } else {
    Write-Host 'Administrator privileges required to modify the firewall.' -ForegroundColor Yellow
    Write-Host 'Opening elevated window...' -ForegroundColor Cyan

    try {
      $process = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', $fwScript `
        -Verb RunAs -Wait -PassThru
      if ($process.ExitCode -eq 0) {
        Write-Host 'Firewall rules created:' -ForegroundColor Green
        $ruleList | ForEach-Object { Write-Host $_ -ForegroundColor Gray }
      } else {
        Write-Host 'Failed to create firewall rules.' -ForegroundColor Red
      }
    } catch {
      Write-Host 'User cancelled elevation or an error occurred.' -ForegroundColor Yellow
      Write-Host 'You can open the ports manually by running as administrator:' -ForegroundColor Yellow
      Write-Host "  netsh advfirewall firewall add rule name=`"gcphone-livekit-signal`" dir=in action=allow protocol=TCP localport=$signalPort" -ForegroundColor Gray
      Write-Host "  netsh advfirewall firewall add rule name=`"gcphone-livekit-rtc-tcp`" dir=in action=allow protocol=TCP localport=$rtcTcpPort" -ForegroundColor Gray
      Write-Host "  netsh advfirewall firewall add rule name=`"gcphone-livekit-rtc-udp`" dir=in action=allow protocol=UDP localport=$rtcUdpStart-$rtcUdpEnd" -ForegroundColor Gray
      Write-Host "  netsh advfirewall firewall add rule name=`"gcphone-socket-io`" dir=in action=allow protocol=TCP localport=$socketPort" -ForegroundColor Gray
    }
  }
} else {
  Write-Host ''
  Write-Host 'Remember to open these ports manually if needed:' -ForegroundColor Yellow
  Write-Host "  - TCP $signalPort (LiveKit signal/WebSocket)" -ForegroundColor Gray
  Write-Host "  - TCP $rtcTcpPort (LiveKit RTC TCP)" -ForegroundColor Gray
  Write-Host "  - UDP $rtcUdpStart-$rtcUdpEnd (LiveKit RTC media)" -ForegroundColor Gray
  Write-Host "  - TCP $socketPort (Socket.IO server)" -ForegroundColor Gray
}

# ── Auto-start option ─────────────────────────────────────────────
Write-Host ''
Write-Host 'Auto-start options for start-livekit.bat:' -ForegroundColor Cyan
Write-Host '  1. No auto-start (manual only)' -ForegroundColor Gray
Write-Host '  2. Start when Windows boots (scheduled task at logon)' -ForegroundColor Gray
Write-Host '  3. Both are explained, choose later' -ForegroundColor Gray

$autoStartChoice = Read-Int -Prompt 'Auto-start option' -Default 1 -Min 1 -Max 3

$taskName = 'gcphone-livekit-autostart'

if ($autoStartChoice -eq 2) {
  $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )

  $taskAction = "cmd.exe /c `"$startScriptPath`""

  $schtasksCmd = "schtasks /create /tn `"$taskName`" /tr `"$taskAction`" /sc onlogon /rl highest /f"
  $deleteCmd = "schtasks /delete /tn `"$taskName`" /f >nul 2>&1"

  if ($isAdmin) {
    Write-Host 'Creating scheduled task...' -ForegroundColor Cyan
    cmd /c "$deleteCmd & $schtasksCmd"
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Scheduled task '$taskName' created (runs at logon)." -ForegroundColor Green
    } else {
      Write-Host 'Failed to create scheduled task.' -ForegroundColor Red
      Write-Host 'You can create it manually with:' -ForegroundColor Yellow
      Write-Host "  $schtasksCmd" -ForegroundColor Gray
    }
  } else {
    Write-Host 'Administrator privileges required to create a scheduled task.' -ForegroundColor Yellow
    Write-Host 'Opening elevated window...' -ForegroundColor Cyan

    try {
      $process = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "$deleteCmd & $schtasksCmd" `
        -Verb RunAs -Wait -PassThru
      if ($process.ExitCode -eq 0) {
        Write-Host "Scheduled task '$taskName' created (runs at logon)." -ForegroundColor Green
      } else {
        Write-Host 'Failed to create scheduled task.' -ForegroundColor Red
      }
    } catch {
      Write-Host 'User cancelled elevation or an error occurred.' -ForegroundColor Yellow
      Write-Host 'You can create the task manually by running as administrator:' -ForegroundColor Yellow
      Write-Host "  $schtasksCmd" -ForegroundColor Gray
    }
  }
} elseif ($autoStartChoice -eq 3) {
  Write-Host ''
  Write-Host 'To auto-start LiveKit on Windows boot, run as administrator:' -ForegroundColor Yellow
  Write-Host "  schtasks /create /tn `"$taskName`" /tr `"cmd.exe /c \`"$startScriptPath\`"`" /sc onlogon /rl highest /f" -ForegroundColor Gray
  Write-Host ''
  Write-Host 'To remove the auto-start task later:' -ForegroundColor Yellow
  Write-Host "  schtasks /delete /tn `"$taskName`" /f" -ForegroundColor Gray
} else {
  Write-Host 'No auto-start configured. Run start-livekit.bat manually.' -ForegroundColor Gray
}

Write-Host ''
Write-Host 'Generated files:' -ForegroundColor Green
Write-Host "- $configPath"
Write-Host "- $envPath"
Write-Host "- $startScriptPath"
Write-Host "- $stopScriptPath"
Write-Host ''
Write-Host 'Convars for FiveM (copy to server.cfg):' -ForegroundColor Green
Write-Host "setr livekit_host `"$livekitHost`""
Write-Host "setr livekit_api_key `"$apiKey`""
Write-Host "setr livekit_api_secret `"$apiSecret`""
Write-Host "setr livekit_room_prefix `"$roomPrefix`""
Write-Host "setr livekit_max_call_duration `"$maxCallDuration`""
Write-Host ''
$socketHost = ('{0}://{1}:{2}' -f $signalScheme, $publicHost, $socketPort)
Write-Host 'Socket.IO convars (copy to server.cfg):' -ForegroundColor Green
Write-Host "setr gcphone_socket_host `"$socketHost`""
Write-Host ''
Write-Host 'Done. Run start-livekit.bat to start LiveKit + Redis.' -ForegroundColor Cyan
