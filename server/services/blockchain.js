const { Web3 } = require('web3');
require('dotenv').config();

// 区块链配置
const BLOCKCHAIN_URL = process.env.BLOCKCHAIN_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// 创建Web3实例
let web3;
let contract;
let contractInstance;

/**
 * 初始化Web3和合约连接
 */
async function initBlockchain() {
    try {
        web3 = new Web3(BLOCKCHAIN_URL);

        // 获取网络版本
        const networkId = await web3.eth.net.getId();
        console.log(`连接到区块链网络, Network ID: ${networkId}`);

        // 获取账户
        const accounts = await web3.eth.getAccounts();
        console.log(`可用账户: ${accounts.length} 个`);

        if (CONTRACT_ADDRESS) {
            await loadContract(CONTRACT_ADDRESS);
        } else {
            console.warn('警告: CONTRACT_ADDRESS 未设置');
        }

        return { web3, contract: contractInstance };
    } catch (error) {
        console.error('区块链初始化失败:', error.message);
        throw error;
    }
}

/**
 * 加载合约
 */
async function loadContract(address) {
    try {
        // 合约ABI（简化版）
        const abi = [
            {
                "inputs": [
                    { "internalType": "address", "name": "deviceAddress", "type": "address" },
                    { "internalType": "string", "name": "publicKey", "type": "string" },
                    { "internalType": "uint8", "name": "deviceType", "type": "uint8" }
                ],
                "name": "registerDevice",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    { "internalType": "address", "name": "deviceAddress", "type": "address" },
                    { "internalType": "bytes", "name": "signature", "type": "bytes" }
                ],
                "name": "authenticate",
                "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{ "internalType": "address", "name": "deviceAddress", "type": "address" }],
                "name": "revokeDevice",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [{ "internalType": "address", "name": "deviceAddress", "type": "address" }],
                "name": "getDeviceInfo",
                "outputs": [
                    { "internalType": "string", "name": "publicKey", "type": "string" },
                    { "internalType": "uint8", "name": "deviceType", "type": "uint8" },
                    { "internalType": "uint8", "name": "status", "type": "uint8" },
                    { "internalType": "uint256", "name": "registeredAt", "type": "uint256" },
                    { "internalType": "uint256", "name": "lastAuthAt", "type": "uint256" }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [{ "internalType": "address", "name": "deviceAddress", "type": "address" }],
                "name": "isDeviceValid",
                "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    { "internalType": "address", "name": "deviceAddress", "type": "address" },
                    { "internalType": "uint8", "name": "deviceType", "type": "uint8" }
                ],
                "name": "verifyDeviceType",
                "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
                "stateMutability": "view",
                "type": "function"
            }
        ];

        contract = new web3.eth.Contract(abi, address);
        contractInstance = contract;
        console.log(`合约加载成功: ${address}`);

        return contract;
    } catch (error) {
        console.error('合约加载失败:', error.message);
        throw error;
    }
}

/**
 * 注册设备
 */
async function registerDevice(deviceAddress, publicKey, deviceType) {
    if (!contract) {
        throw new Error('合约未初始化');
    }

    const accounts = await web3.eth.getAccounts();
    const owner = accounts[0];

    const startTime = Date.now();
    const result = await contract.methods
        .registerDevice(deviceAddress, publicKey, deviceType)
        .send({ from: owner, gas: 300000 });

    const responseTime = Date.now() - startTime;
    console.log(`设备注册成功: ${deviceAddress}, 耗时: ${responseTime}ms`);

    return {
        transactionHash: result.transactionHash,
        responseTime
    };
}

/**
 * 认证设备
 */
async function authenticateDevice(deviceAddress, signature) {
    if (!contract) {
        throw new Error('合约未初始化');
    }

    const startTime = Date.now();
    const result = await contract.methods
        .authenticate(deviceAddress, signature)
        .send({ from: deviceAddress, gas: 200000 });

    const responseTime = Date.now() - startTime;
    console.log(`设备认证成功: ${deviceAddress}, 耗时: ${responseTime}ms`);

    return {
        success: true,
        transactionHash: result.transactionHash,
        responseTime
    };
}

/**
 * 注销设备
 */
async function revokeDevice(deviceAddress) {
    if (!contract) {
        throw new Error('合约未初始化');
    }

    const accounts = await web3.eth.getAccounts();
    const owner = accounts[0];

    const startTime = Date.now();
    const result = await contract.methods
        .revokeDevice(deviceAddress)
        .send({ from: owner, gas: 200000 });

    const responseTime = Date.now() - startTime;
    console.log(`设备注销成功: ${deviceAddress}, 耗时: ${responseTime}ms`);

    return {
        transactionHash: result.transactionHash,
        responseTime
    };
}

/**
 * 获取设备信息
 */
async function getDeviceInfo(deviceAddress) {
    if (!contract) {
        throw new Error('合约未初始化');
    }

    const startTime = Date.now();
    const info = await contract.methods.getDeviceInfo(deviceAddress).call();
    const responseTime = Date.now() - startTime;

    return {
        publicKey: info[0],
        deviceType: parseInt(info[1]),
        status: parseInt(info[2]),
        registeredAt: parseInt(info[3]),
        lastAuthAt: parseInt(info[4]),
        responseTime
    };
}

/**
 * 验证设备是否有效
 */
async function isDeviceValid(deviceAddress) {
    if (!contract) {
        throw new Error('合约未初始化');
    }

    return await contract.methods.isDeviceValid(deviceAddress).call();
}

/**
 * 验证设备类型
 */
async function verifyDeviceType(deviceAddress, deviceType) {
    if (!contract) {
        throw new Error('合约未初始化');
    }

    return await contract.methods.verifyDeviceType(deviceAddress, deviceType).call();
}

/**
 * 获取账户列表
 */
async function getAccounts() {
    if (!web3) {
        throw new Error('Web3未初始化');
    }
    return await web3.eth.getAccounts();
}

/**
 * 创建账户（测试用）
 */
async function createAccount() {
    if (!web3) {
        throw new Error('Web3未初始化');
    }
    const account = web3.eth.accounts.create();
    return account;
}

module.exports = {
    initBlockchain,
    registerDevice,
    authenticateDevice,
    revokeDevice,
    getDeviceInfo,
    isDeviceValid,
    verifyDeviceType,
    getAccounts,
    createAccount,
    getWeb3: () => web3,
    getContract: () => contractInstance
};
