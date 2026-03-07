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

Write-Host ''
Write-Host '== gcphone LiveKit setup ==' -ForegroundColor Cyan
Write-Host 'Este asistente genera .env, livekit.yaml y scripts de arranque.' -ForegroundColor Gray
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

$livekitHost = "$signalScheme://$publicHost`:$signalPort"

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
  "LIVEKIT_USE_EXTERNAL_IP=$($useExternalIp.ToString().ToLowerInvariant())"
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
  '  exit /b 1',
  ')',
  'if not exist "%SCRIPT_DIR%\livekit.yaml" (',
  '  echo [gcphone-livekit] Missing livekit.yaml. Run setup-livekit.bat first.',
  '  exit /b 1',
  ')',
  '',
  'docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" up -d',
  'if errorlevel 1 (',
  '  echo [gcphone-livekit] Docker compose failed.',
  '  exit /b 1',
  ')',
  '',
  'echo [gcphone-livekit] LiveKit stack running.',
  'docker compose --env-file "%SCRIPT_DIR%\.env" -f "%SCRIPT_DIR%\docker-compose.yml" ps',
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
  '  exit /b 1',
  ')',
  '',
  'echo [gcphone-livekit] LiveKit stack stopped.',
  'exit /b 0'
)
Set-Content -Path $stopScriptPath -Value ($stopBat -join "`r`n") -Encoding Ascii

Write-Host ''
Write-Host 'Archivos generados:' -ForegroundColor Green
Write-Host "- $configPath"
Write-Host "- $envPath"
Write-Host "- $startScriptPath"
Write-Host "- $stopScriptPath"
Write-Host ''
Write-Host 'Convars para FiveM (copiar en server.cfg):' -ForegroundColor Green
Write-Host "setr livekit_host \"$livekitHost\""
Write-Host "setr livekit_api_key \"$apiKey\""
Write-Host "setr livekit_api_secret \"$apiSecret\""
Write-Host "setr livekit_room_prefix \"$roomPrefix\""
Write-Host "setr livekit_max_call_duration \"$maxCallDuration\""
Write-Host ''
Write-Host 'Listo. Ejecuta start-livekit.bat para levantar LiveKit + Redis.' -ForegroundColor Cyan
