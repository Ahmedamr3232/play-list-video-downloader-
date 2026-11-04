@echo off
title YT-DLP Playlist Downloader Server
color 0A
cd /d "%~dp0"

echo =====================================================================
echo              YT-DLP PLAYLIST DOWNLOADER SERVER
echo =====================================================================
echo.
echo  * Server URL:  http://127.0.0.1:5000
echo  * Status:      Starting up...
echo.
echo  Keep this window OPEN while downloading videos in Chrome.
echo  Press Ctrl+C to close and stop the server.
echo =====================================================================
echo.

:: Check if port 5000 is already in use
netstat -ano | findstr ":5000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo [NOTE] Server is already running on port 5000!
    echo You can use the Chrome extension right now.
    echo.
    echo If you want to restart it, close any existing server windows first.
    pause
    exit /b
)

:: Run the server
python server\server.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server stopped with an error code.
    echo If Python is not recognized, run 'setup.bat' first.
    echo.
    pause
)
