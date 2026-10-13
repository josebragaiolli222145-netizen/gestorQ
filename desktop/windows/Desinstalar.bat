@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Desinstalar GestorQ
if not defined LOCALAPPDATA goto sem_pasta
echo.
echo  Isto remove o programa GestorQ deste computador.
echo.
choice /c SN /m " Deseja continuar"
if errorlevel 2 exit /b 0
echo.
echo  Os DADOS (banco de dados, backups e perfil do navegador do app) ficam em:
echo     %LOCALAPPDATA%\GestorQ\dados
echo  Responda S somente se quiser APAGAR TODOS OS DADOS de forma definitiva.
choice /c SN /m " Apagar tambem os dados"
set "APAGAR=0"
if not errorlevel 2 set "APAGAR=1"
cd /d "%TEMP%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Join-Path $env:LOCALAPPDATA 'Programs\GestorQ'; Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($p + '\', [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force; Start-Sleep -Milliseconds 800; foreach ($a in @((Join-Path ([Environment]::GetFolderPath('Desktop')) 'GestorQ.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'GestorQ.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'Desinstalar GestorQ.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'Pasta de dados do GestorQ.lnk'))) { Remove-Item -LiteralPath $a -Force -ErrorAction SilentlyContinue }; if ($env:APAGAR -eq '1') { Remove-Item -LiteralPath (Join-Path $env:LOCALAPPDATA 'GestorQ') -Recurse -Force -ErrorAction SilentlyContinue }; Start-Process -WindowStyle Hidden -FilePath powershell -ArgumentList '-NoProfile','-Command',('Start-Sleep 2; Remove-Item -LiteralPath ''' + $p + ''' -Recurse -Force -ErrorAction SilentlyContinue')"
echo.
if "%APAGAR%"=="1" echo  GestorQ e todos os dados foram removidos.
if not "%APAGAR%"=="1" echo  GestorQ removido. Seus dados continuam em %LOCALAPPDATA%\GestorQ\dados
echo.
timeout /t 6
exit /b 0

:sem_pasta
echo  ERRO: variavel LOCALAPPDATA nao encontrada. Nada foi removido.
pause
exit /b 1
