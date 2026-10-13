@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Instalador do GestorQ
rem ==================================================================
rem  Instalador do GestorQ Desktop
rem  - nao precisa de administrador (instala so para o seu usuario)
rem  - programa: %LOCALAPPDATA%\Programs\GestorQ
rem  - dados (banco de dados e backups): %LOCALAPPDATA%\GestorQ\dados
rem  - reinstalar/atualizar NAO apaga os dados
rem ==================================================================
if not exist "%~dp0programa\runtime\node.exe" goto pacote_incompleto
echo.
echo  Instalando o GestorQ Desktop...
echo.
where powershell >nul 2>nul
if errorlevel 1 goto sem_powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0programa\instalar.ps1" -Origem "%~dp0programa"
if errorlevel 1 goto falhou
echo.
echo  Pronto! Use o atalho "GestorQ" na Area de Trabalho ou no Menu Iniciar.
echo.
timeout /t 8
exit /b 0

:pacote_incompleto
echo.
echo  ERRO: a pasta "programa" nao foi encontrada ao lado deste arquivo.
echo  Extraia o ZIP inteiro antes de rodar o instalador (botao direito, Extrair Tudo).
echo.
pause
exit /b 1

:sem_powershell
echo.
echo  ERRO: o PowerShell do Windows nao foi encontrado ou esta bloqueado.
echo  O instalador precisa dele. Se o computador e da empresa, peca ao TI para
echo  liberar o PowerShell para o seu usuario e rode o Instalar.bat de novo.
echo.
pause
exit /b 1

:falhou
echo.
echo  ERRO na instalacao (a mensagem acima explica o motivo).
echo  Log completo em: %LOCALAPPDATA%\GestorQ\instalacao_log.txt
echo  Se a mensagem fala em "ExecutionPolicy" ou "bloqueado", o PowerShell esta
echo  restrito por politica da empresa: peca ao TI para liberar.
echo.
pause
exit /b 1
