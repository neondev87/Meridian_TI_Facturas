@echo off
rem Arranca Meridian TI con doble clic: revisa Python, crea venv, instala dependencias, arranca Flask (SQLite) y abre el navegador.
setlocal EnableExtensions
chcp 65001 >nul
title Meridian TI - servidor
cd /d "%~dp0"

echo.
echo  ============================================
echo    Meridian TI - iniciando la página
echo  ============================================
echo.

rem ---------- 1. Python ----------
set "PY="
py -3 --version >nul 2>&1 && set "PY=py -3"
if not defined PY python --version >nul 2>&1 && set "PY=python"
if not defined PY goto :sin_python
%PY% -c "import sys, sqlite3; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>&1
if errorlevel 1 goto :python_viejo
for /f "delims=" %%v in ('%PY% --version 2^>^&1') do echo  [ok] %%v encontrado

rem ---------- 2. Entorno virtual (solo la primera vez) ----------
set "VPY=%~dp0venv\Scripts\python.exe"
if exist "%VPY%" goto :venv_listo
echo  [..] Creando el entorno virtual venv\ - solo la primera vez
%PY% -m venv "%~dp0venv"
if errorlevel 1 goto :error_venv
:venv_listo

rem ---------- 3. Dependencias (solo si cambió requirements.txt) ----------
fc /b "requirements.txt" "venv\requisitos-instalados.txt" >nul 2>&1
if not errorlevel 1 goto :dependencias_listas
echo  [..] Instalando dependencias - solo la primera vez o si cambió requirements.txt
"%VPY%" -m pip install --disable-pip-version-check -q -r requirements.txt
if errorlevel 1 goto :error_pip
copy /y "requirements.txt" "venv\requisitos-instalados.txt" >nul
:dependencias_listas
echo  [ok] Dependencias de Python listas

rem ---------- 4. Servidor ----------
rem backend\app.py crea db\meridian.db la primera vez, elige un puerto libre (8000 o el siguiente) y abre el navegador.
echo.
echo  ============================================
echo    Cierra esta ventana para detener el servidor
echo  ============================================
"%VPY%" backend\app.py --abrir
if errorlevel 1 goto :error_servidor
echo.
echo  El servidor se detuvo.
timeout /t 5 >nul
exit /b 0

rem ---------- Errores ----------
:sin_python
echo  No se encontró Python en este equipo.
echo.
echo  Cómo instalarlo:
echo    1. Entra a https://www.python.org/downloads/ y descarga Python 3.
echo    2. En el instalador, marca la casilla "Add python.exe to PATH".
echo    3. Termina la instalación y vuelve a abrir iniciar-pagina.bat.
goto :fallo

:python_viejo
echo  Tu versión de Python es muy antigua. Se necesita Python 3.9 o más reciente.
echo  Descárgalo de https://www.python.org/downloads/
goto :fallo

:error_venv
echo  No se pudo crear el entorno virtual venv\.
echo  Borra la carpeta venv si existe y vuelve a intentarlo.
goto :fallo

:error_pip
echo  No se pudieron instalar las dependencias. Revisa tu conexión a internet y vuelve a intentarlo.
if exist "venv\requisitos-instalados.txt" del "venv\requisitos-instalados.txt"
goto :fallo

:error_servidor
echo.
echo  El servidor se detuvo por un error; arriba está el detalle.
goto :fallo

:fallo
echo.
echo  La página no se inició.
pause
exit /b 1
