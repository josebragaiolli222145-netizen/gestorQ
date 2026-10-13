param([Parameter(Mandatory = $true)][string]$Origem)
# Instalador do GestorQ Desktop (chamado pelo Instalar.bat)
$ErrorActionPreference = 'Stop'
$Destino = Join-Path $env:LOCALAPPDATA 'Programs\GestorQ'
$Base    = Join-Path $env:LOCALAPPDATA 'GestorQ'
$Dados   = Join-Path $Base 'dados'
$Log     = Join-Path $Base 'instalacao_log.txt'
New-Item -ItemType Directory -Force -Path $Destino, $Dados | Out-Null
function Log($m) { $l = (Get-Date -Format 'dd/MM/yyyy HH:mm:ss') + '  ' + $m; Add-Content -Path $Log -Value $l -Encoding UTF8; Write-Host "  $m" }
try {
  Log "Instalando a partir de: $Origem"

  # 1) Fecha um GestorQ que esteja aberto (servidor antigo usando os arquivos)
  Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Destino, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object {
    Log "Encerrando servidor antigo (PID $($_.Id))"; Stop-Process -Id $_.Id -Force
  }
  Start-Sleep -Milliseconds 500

  # 2) Copia o programa (os dados ficam em outra pasta e nao sao tocados)
  Log "Copiando arquivos para $Destino"
  robocopy $Origem $Destino /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy falhou (codigo $LASTEXITCODE)" }
  Get-ChildItem -Path $Destino -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

  # 3) Atalhos na Area de Trabalho e no Menu Iniciar
  $shell = New-Object -ComObject WScript.Shell
  $alvos = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'GestorQ.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'GestorQ.lnk')
  )
  foreach ($a in $alvos) {
    $s = $shell.CreateShortcut($a)
    $s.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
    $s.Arguments = '"' + (Join-Path $Destino 'GestorQ.vbs') + '"'
    $s.WorkingDirectory = $Destino
    $s.IconLocation = (Join-Path $Destino 'gestorq.ico') + ',0'
    $s.Description = 'GestorQ - Gestao de Qualidade e Perdas'
    $s.Save()
    Log "Atalho criado: $a"
  }
  $d = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'Desinstalar GestorQ.lnk'))
  $d.TargetPath = Join-Path $Destino 'Desinstalar.bat'
  $d.WorkingDirectory = $Destino
  $d.Save()
  $p = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Programs')) 'Pasta de dados do GestorQ.lnk'))
  $p.TargetPath = $Dados
  $p.Save()

  Log "Instalacao concluida."
  # 4) Abre o app
  Start-Process -FilePath (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + (Join-Path $Destino 'GestorQ.vbs') + '"')
  exit 0
} catch {
  Log ("ERRO: " + $_.Exception.Message)
  exit 1
}
