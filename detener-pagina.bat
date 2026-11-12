@echo off
rem Detiene el servidor de Meridian TI que abrio iniciar-pagina.bat, usando el PID guardado en .servidor.pid.
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".servidor.pid" goto :no_corre
set /p PID=<".servidor.pid"

rem Solo se cierra si ese PID sigue siendo un proceso de Python (evita cerrar otro programa)
tasklist /fi "PID eq %PID%" /fi "IMAGENAME eq python.exe" 2>nul | find "%PID%" >nul
if errorlevel 1 goto :ya_detenido

taskkill /pid %PID% /t /f >nul 2>&1
del ".servidor.pid" >nul 2>&1
echo  Servidor de Meridian TI detenido.
timeout /t 3 >nul
exit /b 0

:ya_detenido
del ".servidor.pid" >nul 2>&1
:no_corre
echo  El servidor de Meridian TI no está corriendo.
timeout /t 3 >nul
exit /b 0
