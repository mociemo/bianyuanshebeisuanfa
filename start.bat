@echo off
echo ========================================
echo   启动区块链认证系统
echo ========================================

echo.
echo 启动服务器...
start "Auth Server" cmd /k "npm start"

echo.
echo 等待服务器启动...
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   服务已启动
echo ========================================
echo.
echo   服务器: http://localhost:3000
echo   健康检查: http://localhost:3000/health
echo.
echo 按任意键退出...
pause >nul
