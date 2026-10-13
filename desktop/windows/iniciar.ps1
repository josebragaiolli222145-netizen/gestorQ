# GestorQ Desktop - lançador em PowerShell (usado quando o VBScript está desativado no Windows)
$ErrorActionPreference = 'SilentlyContinue'
$Base    = Split-Path -Parent $MyInvocation.MyCommand.Path
$Dados   = Join-Path $env:LOCALAPPDATA 'GestorQ\dados'
$NodeExe = Join-Path $Base 'runtime\node.exe'
$Server  = Join-Path $Base 'server\server.js'
New-Item -ItemType Directory -Force -Path $Dados | Out-Null

function LerPorta {
  $t = (Get-Content -LiteralPath (Join-Path $Dados 'porta.txt') -Raw -ErrorAction SilentlyContinue)
  if ($t -and $t.Trim() -match '^\d{2,5}$') { return $t.Trim() }
  return '8741'
}
function Saudavel($p) {
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:$p/api/health" -TimeoutSec 1 -UseBasicParsing
    # precisa ser o GestorQ DESTE usuário do Windows
    return ($r.app -eq 'gestorq' -and ([string]$r.dono).ToLower() -eq ([Environment]::UserName).ToLower())
  } catch { return $false }
}

$porta = LerPorta
if (-not (Saudavel $porta)) {
  Start-Process -WindowStyle Hidden -FilePath $NodeExe -ArgumentList @('--no-warnings', ('"' + $Server + '"'), '--dados', ('"' + $Dados + '"'))
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Milliseconds 500
    $porta = LerPorta
    if (Saudavel $porta) { break }
  }
}
if (-not (Saudavel $porta)) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show("Não foi possível iniciar o GestorQ.`n`nVeja o registro de erros em:`n$Dados\logs\servidor.log", 'GestorQ', 'OK', 'Error') | Out-Null
  exit 1
}
$token = ''
try { $token = (Get-Content -LiteralPath (Join-Path $Dados 'token') -Raw).Trim() } catch {}
$url = "http://127.0.0.1:$porta/#t=$token"
$perfil = Join-Path $Dados 'navegador'
$candidatos = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
foreach ($c in $candidatos) {
  if ($c -and (Test-Path -LiteralPath $c)) {
    Start-Process -FilePath $c -ArgumentList @("--app=$url", ('--user-data-dir="' + $perfil + '"'), '--no-first-run', '--no-default-browser-check', '--window-size=1366,860')
    exit 0
  }
}
Start-Process $url
