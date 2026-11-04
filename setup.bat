@echo off
setlocal enabledelayedexpansion
title YT-DLP Downloader - 1-Click Automated Setup
color 0B
cd /d "%~dp0"

echo =====================================================================
echo           YT-DLP PLAYLIST DOWNLOADER - 1-CLICK SETUP
echo =====================================================================
echo.
echo Welcome! This automated script will set up everything for you.
echo No technical skills needed!
echo.

:: -------------------------------------------------------------
:: Step 1: Check Python
:: -------------------------------------------------------------
echo [1/4] Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Python is not detected in your PATH.
    echo [*] Attempting automated installation via Windows Package Manager (winget)...
    winget install Python.Python.3.11 --silent --accept-source-agreements --accept-package-agreements
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Could not install Python automatically.
        echo Opening Python download page in your browser...
        start https://www.python.org/downloads/
        echo.
        echo [IMPORTANT] When installing Python, CHECK the box:
        echo   "[X] Add python.exe to PATH"
        echo.
        pause
        exit /b 1
    )
    echo [*] Python installed! Refreshing environment...
    call refreshenv >nul 2>&1
)

for /f "tokens=*" %%i in ('python --version') do echo [OK] %%i detected.

:: -------------------------------------------------------------
:: Step 2: Install / Update Dependencies
:: -------------------------------------------------------------
echo.
echo [2/4] Installing required libraries (yt-dlp, Flask, Flask-CORS)...
python -m pip install --upgrade pip --quiet
python -m pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [!] Standard install had a warning, trying direct install...
    python -m pip install yt-dlp flask flask-cors
)
echo [OK] Python dependencies are ready!

:: -------------------------------------------------------------
:: Step 3: Check / Ensure FFmpeg
:: -------------------------------------------------------------
echo.
echo [3/4] Checking FFmpeg (for MP3 conversion and high-res merging)...
where ffmpeg >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] FFmpeg found in system PATH.
) else (
    if exist "%~dp0server\bin\ffmpeg.exe" (
        echo [OK] Local FFmpeg found in server\bin\
    ) else (
        echo [*] Installing FFmpeg via winget for optimal audio/video quality...
        winget install Gyan.FFmpeg --silent --accept-source-agreements --accept-package-agreements >nul 2>&1
        if %errorlevel% neq 0 (
            echo [NOTE] FFmpeg will be optional or can be installed anytime.
        ) else (
            echo [OK] FFmpeg installed successfully!
        )
    )
)

:: -------------------------------------------------------------
:: Step 4: Create Desktop Shortcut
:: -------------------------------------------------------------
echo.
echo [4/4] Creating Desktop Shortcut...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut(\"$desktop\Start YT-DLP Server.lnk\"); " ^
  "$s.TargetPath = '%~dp0start.bat'; " ^
  "$s.WorkingDirectory = '%~dp0'; " ^
  "$s.Description = 'Start YT-DLP Playlist Downloader Server'; " ^
  "$s.Save(); " ^
  "Write-Host '[OK] Shortcut created on Desktop: Start YT-DLP Server.lnk'"

echo.
echo =====================================================================
echo                    SETUP COMPLETED SUCCESSFULLY!
echo =====================================================================
echo.
echo NEXT STEPS (Takes 30 seconds):
echo.
echo 1. Google Chrome or Edge Extension:
echo    a. We will open: chrome://extensions
echo    b. Turn ON "Developer mode" (toggle in top-right corner)
echo    c. Click "Load unpacked" (top-left button)
echo    d. Select this folder:
echo       "%~dp0extension"
echo.
echo 2. To start downloading anytime:
echo    Just double-click the "Start YT-DLP Server" icon on your Desktop!
echo.
echo =====================================================================
echo.

set /p START_NOW="Do you want to launch the server right now? (Y/n): "
if /i not "%START_NOW%"=="n" (
    start "" "%~dp0start.bat"
    start chrome chrome://extensions
)

pause
