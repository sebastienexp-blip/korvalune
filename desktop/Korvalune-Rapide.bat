@echo off
rem Lance Korvalune dans une fenetre d'application (Edge ou Chrome), sans rien installer.
set URL=https://legends-of-aetheria-mxaq.onrender.com
where msedge >nul 2>nul && (start "" msedge --app=%URL% --start-fullscreen & exit /b)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%URL% --start-fullscreen & exit /b)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=%URL% --start-fullscreen & exit /b)
start "" %URL%
