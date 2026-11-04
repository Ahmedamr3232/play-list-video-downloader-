@echo off
title YT-DLP Playlist Downloader Server
color 0A
cd /d "%~dp0"

echo =====================================================================
echo              YT-DLP PLAYLIST DOWNLOADER SERVER
echo =====================================================================
echo.
echo  * Server URL:  http://127.0.0.1:5000
echo  * Directory:   %~dp0
echo.
echo  Keep this window OPEN while downloading videos in Chrome.
echo  Press Ctrl+C to close and stop the server.
echo =====================================================================
echo.

python server.py
if %errorlevel% neq 0 (
    echo.
    echo Server stopped.
    pause
)
