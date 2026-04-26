param(
  [switch]$SkipBundleBudget
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$webSrc = Join-Path $root 'web\src'
$appsDir = Join-Path $webSrc 'components\apps'
$configPath = Join-Path $webSrc 'config\apps.ts'
$phoneFramePath = Join-Path $webSrc 'components\Phone\PhoneFrame.tsx'
$nuiTypesPath = Join-Path $webSrc 'types\nui.ts'
$localeDir = Join-Path $webSrc 'locales'
$distDir = Join-Path $root 'web\dist\assets'

function Fail($message) {
  throw "[audit-web-contracts] $message"
}

function ReadText($path) {
  if (-not (Test-Path $path)) { Fail "Missing required file: $path" }
  return Get-Content -LiteralPath $path -Raw
}

function MatchValues($text, $pattern) {
  return [regex]::Matches($text, $pattern) | ForEach-Object { $_.Groups[1].Value }
}

Write-Host '==> Web app registry audit'

$appsConfig = ReadText $configPath
$registeredApps = @(MatchValues $appsConfig "(?m)^\s*\{\s*id:\s*'([^']+)'")
if ($registeredApps.Count -eq 0) { Fail 'No app ids found in web/src/config/apps.ts' }
$appIconPaths = [regex]::Matches($appsConfig, "(?m)^\s*\{\s*id:\s*'([^']+)'.*?icon:\s*'([^']+)'") |
  ForEach-Object { [pscustomobject]@{ Id = $_.Groups[1].Value; Icon = $_.Groups[2].Value } }

$phoneFrame = ReadText $phoneFramePath
$lazyApps = @(MatchValues $phoneFrame "(?m)^\s*([a-z0-9]+):\s*lazy\(")

$appFolders = Get-ChildItem -LiteralPath $appsDir -Directory |
  Where-Object {
    $_.Name -notin @('home', '_template', 'utils', 'notifications') -and
    @(Get-ChildItem -LiteralPath $_.FullName -Recurse -File -ErrorAction SilentlyContinue).Count -gt 0
  } |
  ForEach-Object { $_.Name }

$missingLazy = $registeredApps | Where-Object { $_ -notin $lazyApps }
$missingFolder = $registeredApps | Where-Object { $_ -notin $appFolders }
$orphanFolders = $appFolders | Where-Object { $_ -notin $registeredApps }

if ($missingLazy) { Fail "Registered apps missing lazy route: $($missingLazy -join ', ')" }
if ($missingFolder) { Fail "Registered apps missing component folder: $($missingFolder -join ', ')" }
if ($orphanFolders) { Fail "Unregistered app folders found: $($orphanFolders -join ', ')" }

Write-Host "Apps registered: $($registeredApps.Count)"

Write-Host '==> App icon asset audit'

$missingIcons = @()
foreach ($entry in $appIconPaths) {
  $relativeIcon = $entry.Icon -replace '^\./', ''
  $publicIcon = Join-Path (Join-Path $root 'web\public') $relativeIcon
  if (-not (Test-Path $publicIcon)) {
    $missingIcons += "$($entry.Id): $($entry.Icon)"
  }
}

if ($missingIcons) { Fail "Registered app icons missing from web/public: $($missingIcons -join ', ')" }
Write-Host "App icons checked: $($appIconPaths.Count)"

Write-Host '==> Locale app-name audit'

$localeFiles = Get-ChildItem -LiteralPath $localeDir -Filter '*.json'
foreach ($file in $localeFiles) {
  $json = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
  $strings = $json.strings
  foreach ($appId in $registeredApps) {
    $key = "app.$appId"
    if (-not ($strings.PSObject.Properties.Name -contains $key)) {
      Fail "$($file.Name) is missing $key"
    }
  }
}

Write-Host "Locale files checked: $($localeFiles.Count)"

Write-Host '==> Typed NUI usage audit'

$nuiTypes = ReadText $nuiTypesPath
$responseMapKeys = @(MatchValues $nuiTypes "(?m)^\s{2}([A-Za-z0-9_]+):")
$fetchKnownNames = Get-ChildItem -LiteralPath $webSrc -Recurse -Include *.ts,*.tsx |
  Select-String -Pattern "fetchKnownNui\('([A-Za-z0-9_]+)'" |
  ForEach-Object { $_.Matches.Groups[1].Value } |
  Sort-Object -Unique

$unknownFetches = $fetchKnownNames | Where-Object { $_ -notin $responseMapKeys }
if ($unknownFetches) { Fail "fetchKnownNui events missing NuiResponseMap entries: $($unknownFetches -join ', ')" }

Write-Host "Typed fetchKnownNui events checked: $($fetchKnownNames.Count)"

Write-Host '==> Removed app runtime reference audit'

$runtimeFiles = Get-ChildItem -LiteralPath $webSrc -Recurse -File |
  Where-Object {
    $_.FullName -notlike '*\node_modules\*' -and
    $_.Extension -in @('.ts', '.tsx', '.json', '.scss')
  }
$removedAppHits = $runtimeFiles | Select-String -Pattern '(?<![A-Za-z0-9_])appstore(?![A-Za-z0-9_])|app-store|MarketApp|marketGetListings|marketCreateListing|marketGetMyListings|marketMarkAsSold|marketDeleteListing|marketContactSeller' -CaseSensitive:$false
if ($removedAppHits) {
  $removedAppHits | ForEach-Object { Write-Host $_ }
  Fail 'Removed app runtime references found.'
}

if (-not $SkipBundleBudget -and (Test-Path $distDir)) {
  Write-Host '==> Bundle budget audit'
  $bankBundle = Join-Path $distDir 'app-bank.js'
  if (Test-Path $bankBundle) {
    $size = (Get-Item -LiteralPath $bankBundle).Length
    $limit = 850kb
    if ($size -gt $limit) {
      Fail "app-bank.js is $size bytes; budget is $limit bytes"
    }
    Write-Host "app-bank.js: $size bytes"
  }
}

Write-Host 'Web contract audit passed.'
