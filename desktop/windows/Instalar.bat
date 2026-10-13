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

:falhou
echo.
echo  ERRO na instalacao. Veja o log em: %LOCALAPPDATA%\GestorQ\instalacao_log.txt
echo.
pause
exit /b 1
