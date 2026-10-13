@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Desinstalar GestorQ
echo.
echo  Isto remove o programa GestorQ deste computador.
echo  Os DADOS (banco de dados e backups) ficam guardados em:
echo     %LOCALAPPDATA%\GestorQ\dados
echo  Para apagar os dados tambem, exclua essa pasta manualmente depois.
echo.
choice /c SN /m " Deseja continuar"
if errorlevel 2 exit /b 0
powershell -NoProfile -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith((Join-Path $env:LOCALAPPDATA 'Programs\GestorQ'), [StringComparison]::OrdinalIgnoreCase) } | Stop-Process -Force"
del "%USERPROFILE%\Desktop\GestorQ.lnk" >nul 2>nul
powershell -NoProfile -Command "Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path ([Environment]::GetFolderPath('Desktop')) 'GestorQ.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'GestorQ.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'Desinstalar GestorQ.lnk'), (Join-Path ([Environment]::GetFolderPath('Programs')) 'Pasta de dados do GestorQ.lnk')"
cd /d "%TEMP%"
start "" /b cmd /c "timeout /t 2 >nul & rmdir /s /q "%LOCALAPPDATA%\Programs\GestorQ""
echo.
echo  GestorQ removido. Seus dados continuam em %LOCALAPPDATA%\GestorQ\dados
echo.
timeout /t 6
