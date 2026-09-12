$ErrorActionPreference = "Stop"

$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$platformTools = Join-Path $sdk "platform-tools"
$adb = Join-Path $platformTools "adb.exe"

if (!(Test-Path -LiteralPath $adb)) {
  throw "Android platform-tools adb.exe was not found at $adb"
}

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk

if (($env:Path -split ";") -notcontains $platformTools) {
  $env:Path = "$platformTools;$env:Path"
}

Write-Output "ANDROID_HOME=$env:ANDROID_HOME"
& $adb version
