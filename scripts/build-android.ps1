param([string]$Architectures = 'arm64-v8a,x86_64')
$ErrorActionPreference = 'Stop'
$projectDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location $projectDirectory
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) { throw 'Set JAVA_HOME to a JDK 17+ installation.' }
if (-not (Test-Path $env:ANDROID_HOME)) { throw 'Set ANDROID_HOME to the Android SDK directory.' }
& npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
& npm.cmd run typecheck
if ($LASTEXITCODE -ne 0) { throw 'TypeScript validation failed' }
& npm.cmd test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
& npx.cmd expo prebuild --platform android --no-install
if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed' }
Push-Location android
try {
  & .\gradlew.bat :app:assembleRelease "-PreactNativeArchitectures=$Architectures" '-Dorg.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m' --console=plain
  if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
} finally { Pop-Location }
[System.IO.Directory]::CreateDirectory((Join-Path $projectDirectory 'artifacts')) | Out-Null
Copy-Item -LiteralPath 'android\app\build\outputs\apk\release\app-release.apk' -Destination 'artifacts\pressure-journal-1.0.0.apk'
Get-FileHash 'artifacts\pressure-journal-1.0.0.apk' -Algorithm SHA256
