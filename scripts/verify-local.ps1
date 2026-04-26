param(
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$web = Join-Path $root 'web'
$luaFiles = @(
  'client\nui_bridge.lua',
  'client\nui_helpers.lua',
  'client\nui\contacts.lua',
  'client\nui\messages.lua',
  'client\nui\mail.lua',
  'client\nui\phone_setup.lua',
  'client\nui\notifications.lua',
  'client\nui\settings.lua',
  'client\nui\gallery.lua',
  'client\nui\bank_wallet.lua',
  'client\nui\sdk_permissions.lua'
)

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Script
  )

  Write-Host ""
  Write-Host "==> $Name"
  & $Script
}

function Get-AuthoredFiles {
  param([string[]]$Roots)

  $excludedDirectories = @(
    '.git',
    '.claude',
    '.superpowers',
    '.playwright-mcp',
    'node_modules',
    'dist',
    'build',
    '.vitepress',
    'coverage'
  )

  foreach ($relativeRoot in $Roots) {
    $path = Join-Path $root $relativeRoot
    if (-not (Test-Path $path)) { continue }

    Get-ChildItem -LiteralPath $path -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object {
        $fullName = $_.FullName
        foreach ($directory in $excludedDirectories) {
          if ($fullName -like "*\$directory\*") { return $false }
        }
        return $true
      }
  }
}

Push-Location $root
try {
  Invoke-Step 'git diff check' {
    git diff --check
  }

  Invoke-Step 'Lua syntax for touched NUI modules' {
    if (-not (Get-Command luac -ErrorAction SilentlyContinue)) {
      Write-Host 'luac not found; skipping Lua syntax check.'
      return
    }

    $paths = $luaFiles | ForEach-Object { Join-Path $root $_ }
    luac -p @paths
  }

  Invoke-Step 'TypeScript typecheck' {
    Push-Location $web
    try {
      bun run typecheck
    } finally {
      Pop-Location
    }
  }

  if (-not $SkipBuild) {
    Invoke-Step 'Vite production build' {
      Push-Location $web
      try {
        bun run build
      } finally {
        Pop-Location
      }
    }
  }

  Invoke-Step 'Authored-file hygiene scan' {
    $files = @(Get-AuthoredFiles -Roots @('client', 'server', 'shared', 'web\src', 'docs', 'sql', 'scripts', '.'))
    $blockedPattern = 'TO' + 'DO|TO' + 'DOS'
    $blockedHits = $files | Select-String -Pattern $blockedPattern -CaseSensitive
    if ($blockedHits) {
      $blockedHits | ForEach-Object { Write-Host $_ }
      throw 'Blocked hygiene markers found.'
    }

    $removedAppPattern = '(?<![A-Za-z0-9_])' + 'app' + 'store' + '(?![A-Za-z0-9_])|app-store'
    $runtimeFiles = @(Get-AuthoredFiles -Roots @('client', 'server', 'shared', 'web\src', 'web\public', 'web\dist'))
    $removedAppHits = $runtimeFiles | Select-String -Pattern $removedAppPattern -CaseSensitive:$false
    if ($removedAppHits) {
      $removedAppHits | ForEach-Object { Write-Host $_ }
      throw 'Removed app references found.'
    }
  }

  Invoke-Step 'Web contract audit' {
    & (Join-Path $root 'scripts\audit-web-contracts.ps1') -SkipBundleBudget:$SkipBuild
  }

  Write-Host ""
  Write-Host 'All local checks passed.'
} finally {
  Pop-Location
}
