const hre = require("hardhat");

async function main() {
    console.log("正在部署 Authentication 合约...");

    const Authentication = await hre.ethers.getContractFactory("Authentication");
    const authentication = await Authentication.deploy();

    await authentication.waitForDeployment();
    const address = await authentication.getAddress();

    console.log("Authentication 合约已部署到:", address);
    console.log("请将以下地址保存到 .env 文件中:");
    console.log(`CONTRACT_ADDRESS=${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
