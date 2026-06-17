const hre = require("hardhat");

async function main() {
    console.log("[方案A] 正在部署简化版 Authentication 合约...");
    const Authentication = await hre.ethers.getContractFactory("Authentication");
    const authentication = await Authentication.deploy();
    await authentication.waitForDeployment();
    const address = await authentication.getAddress();
    console.log("[方案A] 合约已部署到:", address);
    console.log("CONTRACT_ADDRESS=" + address);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
