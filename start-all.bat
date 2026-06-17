@echo off
echo ========================================
echo   Identity Auth Comparison - One Click Start
echo ========================================
echo.

echo [1/3] Starting Scheme-7 (Improved) - Port 3000
start "Scheme-7-Improved" cmd /k "cd /d d:\shenfenrz\scheme-7 && echo Installing dependencies... && npm install && echo Starting... && npm start"

echo [2/3] Starting Scheme-A (Baseline) - Port 3001
start "Scheme-A-Baseline" cmd /k "cd /d d:\shenfenrz\scheme-a && echo Installing dependencies... && npm install && echo Starting... && npm start"

echo [3/3] Starting Frontend (Comparison UI) - Port 8080
start "Frontend-Comparison" cmd /k "cd /d d:\shenfenrz\frontend && echo Installing dependencies... && npm install && echo Starting... && npm start"

echo.
echo ========================================
echo   All services launched!
echo.
echo   Frontend:    http://localhost:8080
echo   Scheme-7:    http://localhost:3000/health
echo   Scheme-A:    http://localhost:3001/health
echo ========================================
echo.
echo Press any key to close this window...
pause >nul
