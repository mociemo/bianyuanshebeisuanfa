@echo off
echo ========================================
echo   安装区块链认证系统依赖
echo ========================================

echo.
echo [1/3] 安装Node.js依赖...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo 依赖安装失败!
    pause
    exit /b 1
)

echo.
echo [2/3] 编译智能合约...
call npx hardhat compile
if %ERRORLEVEL% NEQ 0 (
    echo 合约编译失败!
    pause
    exit /b 1
)

echo.
echo [3/3] 创建数据目录...
if not exist "data" mkdir data

echo.
echo ========================================
echo   安装完成!
echo ========================================
echo.
echo 下一步:
echo   1. 启动 Redis: redis-server
echo   2. 启动区块链: npm run node
echo   3. 部署合约: npm run deploy
echo   4. 启动服务器: npm start
echo   5. 运行模拟器: npm run device
echo.
pause
