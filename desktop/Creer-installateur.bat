@echo off
rem Cree l'installateur Windows (Korvalune Setup.exe) dans le dossier "dist". Necessite Node.js (https://nodejs.org).
cd /d "%~dp0"
call npm install || goto fin
call npm run build
:fin
echo.
echo Termine. L'installateur est dans le dossier dist.
pause
