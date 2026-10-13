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
set "OPCAO="
if not errorlevel 2 set "OPCAO=-ApagarDados"
rem copia o desinstalador para a pasta TEMP (a pasta do programa sera apagada)
copy /y "%~dp0desinstalar.ps1" "%TEMP%\gestorq-desinstalar.ps1" >nul
cd /d "%TEMP%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\gestorq-desinstalar.ps1" %OPCAO%
echo.
timeout /t 8
exit /b 0

:sem_pasta
echo  ERRO: variavel LOCALAPPDATA nao encontrada. Nada foi removido.
pause
exit /b 1
