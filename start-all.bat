@echo off
setlocal
set "ROOT=%~dp0"

echo ========================================
echo   Identity Auth Comparison - One Click Start
echo ========================================
echo   Root: %ROOT%
echo.

echo [1/5] Starting Local Hardhat Blockchain (Port 8545)...
start "Hardhat-Node" cmd /k "cd /d "%ROOT%scheme-7" && npx hardhat node"

echo Waiting for Hardhat node to be ready...
::wait_node
timeout /t 3 >nul
curl -s http://127.0.0.1:8545/ 1>nul 2>nul
if errorlevel 1 goto wait_node
echo Hardhat node is ready!

echo.
echo [2/5] Deploying contracts...
echo   - Scheme-7 contract...
cd /d "%ROOT%scheme-7"
call npx hardhat compile
call npx hardhat run scripts/deploy.js --network localhost
echo   - Scheme-A contract...
cd /d "%ROOT%scheme-a"
call npx hardhat compile
call npx hardhat run scripts/deploy.js --network localhost

echo.
echo [3/5] Starting Scheme-7 (Improved) - Port 3000
start "Scheme-7-Improved" cmd /k "cd /d "%ROOT%scheme-7" && npm start"

echo [4/5] Starting Scheme-A (Baseline) - Port 3001
start "Scheme-A-Baseline" cmd /k "cd /d "%ROOT%scheme-a" && npm start"

echo [5/5] Starting Frontend (Comparison UI) - Port 8080
start "Frontend-Comparison" cmd /k "cd /d "%ROOT%frontend" && npm start"

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
