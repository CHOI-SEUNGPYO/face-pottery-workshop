$ErrorActionPreference='Stop'
Set-Location -LiteralPath $PSScriptRoot
$editorNode=Get-Command node -ErrorAction Stop
$editorUrl='http://127.0.0.1:4175/'
$editorReady=$false
$editorResponse=$null
try {
    $editorResponse=Invoke-WebRequest -Uri $editorUrl -UseBasicParsing -TimeoutSec 2
    if(-not $editorResponse.Content.Contains('유물 이야기 편집')){throw '4175번 주소에서 다른 프로그램이 실행 중이에요.'}
    $editorReady=$true
} catch {if($editorResponse){throw}}
if(-not $editorReady){
    $editorLog=Join-Path $env:TEMP 'togi-prototype'
    New-Item -ItemType Directory -Path $editorLog -Force | Out-Null
    $editorProcess=Start-Process -FilePath $editorNode.Source -ArgumentList @('scripts/museum-editor.mjs') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $editorLog 'editor.log') -RedirectStandardError (Join-Path $editorLog 'editor-error.log')
    for($editorTry=0;$editorTry -lt 25;$editorTry++){
        Start-Sleep -Milliseconds 200
        if($editorProcess.HasExited){throw '편집기를 열지 못했어요. 임시 폴더의 togi-prototype/editor-error.log를 확인해 주세요.'}
        try {$null=Invoke-WebRequest -Uri $editorUrl -UseBasicParsing -TimeoutSec 1;$editorReady=$true;break}catch{}
    }
    if(-not $editorReady){throw '편집 화면 응답 시간이 초과됐어요.'}
}
Start-Process $editorUrl
