param([Parameter(Mandatory = $true)][string]$Origem)
# Instalador do GestorQ Desktop (chamado pelo Instalar.bat)
$ErrorActionPreference = 'Stop'
$Destino = Join-Path $env:LOCALAPPDATA 'Programs\GestorQ'
$Base    = Join-Path $env:LOCALAPPDATA 'GestorQ'
$Dados   = Join-Path $Base 'dados'
$Log     = Join-Path $Base 'instalacao_log.txt'
function Log($m) {
  Write-Host "  $m"
  try { $l = (Get-Date -Format 'dd/MM/yyyy HH:mm:ss') + '  ' + $m; Add-Content -Path $Log -Value $l -Encoding UTF8 } catch {}
}
try {
  if (-not $env:LOCALAPPDATA -or -not $Destino.EndsWith('\Programs\GestorQ')) { throw 'pasta de instalacao invalida' }
  New-Item -ItemType Directory -Force -Path $Destino, $Dados | Out-Null
  $Origem = (Resolve-Path -LiteralPath $Origem).ProviderPath.TrimEnd('\')
  if (-not (Test-Path -LiteralPath (Join-Path $Origem 'server\server.js')) -or -not (Test-Path -LiteralPath (Join-Path $Origem 'runtime\node.exe'))) { throw 'pacote incompleto: extraia o ZIP inteiro' }
  # O ZIP nao pode estar extraido dentro da pasta do programa nem da pasta de dados (seria apagado na copia)
  foreach ($proibida in @($Destino, $Base)) {
    if (($Origem + '\').StartsWith($proibida.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
      throw "o ZIP foi extraido dentro de $proibida. Extraia em outra pasta (por exemplo, Downloads) e rode o Instalar.bat de novo"
    }
  }
  $versao = '0'
  try { $versao = (Get-Content -LiteralPath (Join-Path $Origem 'server\versao.json') -Raw | ConvertFrom-Json).versao } catch {}
  Log "Instalando GestorQ $versao a partir de: $Origem"

  # 1) Fecha um GestorQ que esteja aberto (servidor antigo usando os arquivos)
  Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Destino + '\', [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object {
    Log "Encerrando servidor antigo (PID $($_.Id))"; Stop-Process -Id $_.Id -Force
  }
  Start-Sleep -Milliseconds 500

  # 2) Copia o programa (os dados ficam em outra pasta e nao sao tocados)
  Log "Copiando arquivos para $Destino"
  robocopy $Origem $Destino /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy falhou (codigo $LASTEXITCODE)" }
  Get-ChildItem -LiteralPath $Destino -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

  # 3) Lancador: VBScript (sem janela preta) ou, se o VBScript estiver desativado no Windows, PowerShell
  $usarVbs = $false
  try {
    $teste = Join-Path $env:TEMP 'gestorq-teste-vbs.vbs'
    Set-Content -LiteralPath $teste -Value 'WScript.Quit 7' -Encoding ASCII
    $pr = Start-Process -FilePath (Join-Path $env:WINDIR 'System32\cscript.exe') -ArgumentList '//nologo', ('"' + $teste + '"') -WindowStyle Hidden -Wait -PassThru
    $usarVbs = ($pr.ExitCode -eq 7)
    Remove-Item -LiteralPath $teste -Force -ErrorAction SilentlyContinue
  } catch { $usarVbs = $false }
  if ($usarVbs) {
    $exe  = Join-Path $env:WINDIR 'System32\wscript.exe'
    $argumentos = '"' + (Join-Path $Destino 'GestorQ.vbs') + '"'
    Log 'Lancador: VBScript'
  } else {
    $exe  = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $argumentos = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Destino 'iniciar.ps1') + '"'
    Log 'Lancador: PowerShell (VBScript indisponivel)'
  }

  # 4) Atalhos na Area de Trabalho e no Menu Iniciar
  $shell = New-Object -ComObject WScript.Shell
  $progs = [Environment]::GetFolderPath('Programs')
  foreach ($a in @((Join-Path ([Environment]::GetFolderPath('Desktop')) 'GestorQ.lnk'), (Join-Path $progs 'GestorQ.lnk'))) {
    $s = $shell.CreateShortcut($a)
    $s.TargetPath = $exe
    $s.Arguments = $argumentos
    $s.WorkingDirectory = $Destino
    $s.IconLocation = (Join-Path $Destino 'gestorq.ico') + ',0'
    $s.Description = 'GestorQ - Gestao de Qualidade e Perdas'
    if (-not $usarVbs) { $s.WindowStyle = 7 }   # minimizado
    $s.Save()
    Log "Atalho criado: $a"
  }
  $d = $shell.CreateShortcut((Join-Path $progs 'Desinstalar GestorQ.lnk'))
  $d.TargetPath = Join-Path $Destino 'Desinstalar.bat'
  $d.WorkingDirectory = $Destino
  $d.Save()
  $p = $shell.CreateShortcut((Join-Path $progs 'Pasta de dados do GestorQ.lnk'))
  $p.TargetPath = $Dados
  $p.Save()

  # 5) Aparece em Configuracoes > Aplicativos > Aplicativos instalados (so para este usuario)
  try {
    $reg = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\GestorQ'
    New-Item -Path $reg -Force | Out-Null
    $tam = [int]((Get-ChildItem -LiteralPath $Destino -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1KB)
    $valores = @{
      DisplayName = 'GestorQ Desktop'; DisplayVersion = [string]$versao; Publisher = 'GestorQ'
      DisplayIcon = (Join-Path $Destino 'gestorq.ico'); InstallLocation = $Destino
      UninstallString = '"' + (Join-Path $Destino 'Desinstalar.bat') + '"'
    }
    foreach ($k in $valores.Keys) { New-ItemProperty -Path $reg -Name $k -Value $valores[$k] -PropertyType String -Force | Out-Null }
    New-ItemProperty -Path $reg -Name EstimatedSize -Value $tam -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $reg -Name NoModify -Value 1 -PropertyType DWord -Force | Out-Null
    New-ItemProperty -Path $reg -Name NoRepair -Value 1 -PropertyType DWord -Force | Out-Null
    Log 'Registrado em Aplicativos instalados'
  } catch { Log ('Aviso: nao foi possivel registrar em Aplicativos instalados: ' + $_.Exception.Message) }

  Log "Instalacao concluida."
  # 6) Abre o app
  Start-Process -FilePath $exe -ArgumentList $argumentos
  exit 0
} catch {
  Log ("ERRO: " + $_.Exception.Message)
  exit 1
}
