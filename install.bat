@echo off
echo ========================================
echo   全去中心化身份认证系统 - 安装
echo ========================================

echo.
echo [1/2] 安装 Node.js 依赖...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo 依赖安装失败!
    pause
    exit /b 1
)

echo.
echo [2/2] 编译智能合约...
call npx hardhat compile
if %ERRORLEVEL% NEQ 0 (
    echo 合约编译失败!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   安装完成!
echo ========================================
echo.
echo 下一步:
echo   1. 启动区块链: npm run node
echo   2. 部署合约: npm run deploy
echo   3. 将 CONTRACT_ADDRESS 写入 .env
echo   4. 启动服务器: npm start
echo.
pause
