@echo off
title YT-DLP Playlist Downloader - Setup
echo ============================================================
echo      YT-DLP Chrome Extension & Server Setup
echo ============================================================
echo.

echo [1/3] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python from https://www.python.org/
    pause
    exit /b
)
python --version

echo.
echo [2/3] Installing Python dependencies (Flask, Flask-CORS, yt-dlp)...
pip install flask flask-cors yt-dlp --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies. Check your internet connection.
    pause
    exit /b
)
echo [OK] Dependencies installed successfully!

echo.
echo [3/3] Updating yt-dlp to latest version...
yt-dlp -U
echo.
echo ============================================================
echo      Setup Completed Successfully!
echo ============================================================
echo.
echo How to use:
echo.
echo 1. Start the server:
echo    Double-click "server\start_server.bat" (or "start_server_background.bat")
echo.
echo 2. Load the Extension into Google Chrome or Edge:
echo    a. Open Chrome and navigate to: chrome://extensions
echo    b. Turn ON "Developer mode" (toggle in top-right corner)
echo    c. Click the "Load unpacked" button (top-left)
echo    d. Select the folder:
echo       "%~dp0extension"
echo.
echo 3. Pin the extension in Chrome and paste any playlist URL!
echo.
pause
