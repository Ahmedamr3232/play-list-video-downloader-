@echo off
REM Start the server minimized (use this as a shortcut)
start /min "" cmd /c "cd /d "%~dp0server" && python server.py"
echo Server started in background.
timeout /t 2 >nul
