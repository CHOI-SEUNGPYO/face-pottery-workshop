$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$gameNode = Get-Command node -ErrorAction SilentlyContinue
if (-not $gameNode) { throw 'Node.js 22.12 이상을 설치한 뒤 다시 실행해 주세요.' }
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'dist/index.html'))) { throw '실행본이 없어요. npm ci 후 npm run build를 실행해 주세요.' }
$gamePort = if ($env:PORT) { [int]$env:PORT } else { 4174 }
$gameUrl = "http://127.0.0.1:$gamePort"
$gameReady = $false
$gameResponse = $null
try {
    $gameResponse = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
    $gameReady = $gameResponse.Content.Contains('작은 흙 공방')
    if (-not $gameReady) { throw "Port $gamePort is used by another application." }
} catch {
    if ($gameResponse) { throw }
}
if (-not $gameReady) {
    $gameLogDir = Join-Path $env:TEMP 'togi-prototype'
    New-Item -ItemType Directory -Path $gameLogDir -Force | Out-Null
    $gameProcess = Start-Process -FilePath $gameNode.Source -ArgumentList @('server.mjs') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $gameLogDir 'launcher.log') -RedirectStandardError (Join-Path $gameLogDir 'launcher-error.log')
    for ($gameTry = 0; $gameTry -lt 20; $gameTry++) {
        Start-Sleep -Milliseconds 200
        if ($gameProcess.HasExited) { throw "서버를 열지 못했어요. $gameLogDir/launcher-error.log를 확인해 주세요." }
        try { $null = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 1; $gameReady = $true; break } catch {}
    }
    if (-not $gameReady) { throw '서버 응답을 기다리는 시간이 초과됐어요.' }
}
Start-Process $gameUrl
