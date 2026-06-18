const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function updateEnvFile(envPath, contractAddress) {
    let content = fs.readFileSync(envPath, 'utf8');
    if (content.includes('CONTRACT_ADDRESS=')) {
        content = content.replace(/CONTRACT_ADDRESS=.*/g, `CONTRACT_ADDRESS=${contractAddress}`);
    } else {
        content += `\nCONTRACT_ADDRESS=${contractAddress}\n`;
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log(`[方案A] .env 已更新 CONTRACT_ADDRESS=${contractAddress}`);
}

async function main() {
    console.log("[方案A] 正在部署简化版 Authentication 合约...");
    const Authentication = await hre.ethers.getContractFactory("Authentication");
    const authentication = await Authentication.deploy();
    await authentication.waitForDeployment();
    const address = await authentication.getAddress();
    console.log("[方案A] 合约已部署到:", address);

    // 自动写入 .env 文件
    const envPath = path.join(__dirname, '..', '.env');
    try {
        await updateEnvFile(envPath, address);
    } catch (e) {
        console.warn("[方案A] 无法更新 .env:", e.message);
        console.log("CONTRACT_ADDRESS=" + address);
    }
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
