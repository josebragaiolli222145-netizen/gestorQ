# Desinstalador do GestorQ Desktop (chamado pelo Desinstalar.bat; roda a partir de uma cópia na pasta TEMP)
param([switch]$ApagarDados)
$ErrorActionPreference = 'SilentlyContinue'
$Programa = Join-Path $env:LOCALAPPDATA 'Programs\GestorQ'
$Base     = Join-Path $env:LOCALAPPDATA 'GestorQ'
if (-not $env:LOCALAPPDATA -or -not $Programa.EndsWith('\Programs\GestorQ')) { Write-Host '  ERRO: pasta invalida. Nada foi removido.'; exit 1 }

# 1) Fecha o servidor e a janela do app (perfil próprio do navegador fica na pasta de dados)
Get-Process -Name node | Where-Object { $_.Path -and $_.Path.StartsWith($Programa + '\', [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force
Get-CimInstance Win32_Process -Filter "Name='msedge.exe' or Name='chrome.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf((Join-Path $Base 'dados\navegador'), [StringComparison]::OrdinalIgnoreCase) -ge 0 } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Milliseconds 1200

# 2) Atalhos e registro em "Aplicativos instalados"
$progs = [Environment]::GetFolderPath('Programs'); $desk = [Environment]::GetFolderPath('Desktop')
foreach ($a in @((Join-Path $desk 'GestorQ.lnk'), (Join-Path $progs 'GestorQ.lnk'), (Join-Path $progs 'Desinstalar GestorQ.lnk'), (Join-Path $progs 'Pasta de dados do GestorQ.lnk'))) {
  Remove-Item -LiteralPath $a -Force
}
Remove-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GestorQ' -Recurse -Force

# 3) Dados (só se o usuário pediu)
$restouDados = $false
if ($ApagarDados) {
  for ($i = 0; $i -lt 5 -and (Test-Path -LiteralPath $Base); $i++) { Remove-Item -LiteralPath $Base -Recurse -Force; if (Test-Path -LiteralPath $Base) { Start-Sleep -Seconds 1 } }
  $restouDados = Test-Path -LiteralPath $Base
}

# 4) Programa: removido em segundo plano depois que o Desinstalar.bat terminar
$env:GQ_REMOVER = $Programa
Start-Process -WindowStyle Hidden -FilePath powershell -ArgumentList '-NoProfile', '-Command', 'for ($i = 0; $i -lt 30 -and (Test-Path -LiteralPath $env:GQ_REMOVER); $i++) { Start-Sleep 2; Remove-Item -LiteralPath $env:GQ_REMOVER -Recurse -Force -ErrorAction SilentlyContinue }'

Write-Host ''
if ($ApagarDados -and $restouDados) {
  Write-Host '  ATENCAO: nao foi possivel apagar todos os dados (algum arquivo esta em uso).'
  Write-Host "  Feche o GestorQ e apague manualmente a pasta: $Base"
  exit 2
} elseif ($ApagarDados) {
  Write-Host '  GestorQ e todos os dados foram removidos.'
} else {
  Write-Host "  GestorQ removido. Seus dados continuam em: $Base\dados"
}
exit 0
