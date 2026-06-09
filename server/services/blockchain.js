const { Web3 } = require('web3');
require('dotenv').config();

const BLOCKCHAIN_URL = process.env.BLOCKCHAIN_URL || 'http://127.0.0.1:8545';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

let web3;
let contract;

const CONTRACT_ABI = [
    {
        inputs: [
            { internalType: 'address', name: 'deviceAddress', type: 'address' },
            { internalType: 'string', name: 'publicKey', type: 'string' },
            { internalType: 'uint8', name: 'deviceType', type: 'uint8' }
        ],
        name: 'registerDevice',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'address', name: 'deviceAddress', type: 'address' },
            { internalType: 'uint256', name: 'nonce', type: 'uint256' },
            { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
            { internalType: 'string', name: 'challenge', type: 'string' },
            { internalType: 'bytes', name: 'signature', type: 'bytes' }
        ],
        name: 'authenticate',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'address', name: 'deviceAddress', type: 'address' },
            { internalType: 'uint256', name: 'nonce', type: 'uint256' },
            { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
            { internalType: 'string', name: 'challenge', type: 'string' },
            { internalType: 'bytes', name: 'signature', type: 'bytes' }
        ],
        name: 'verifyAuth',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'deviceAddress', type: 'address' }],
        name: 'revokeDevice',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'deviceAddress', type: 'address' }],
        name: 'getDeviceInfo',
        outputs: [
            { internalType: 'string', name: 'publicKey', type: 'string' },
            { internalType: 'uint8', name: 'deviceType', type: 'uint8' },
            { internalType: 'uint8', name: 'status', type: 'uint8' },
            { internalType: 'uint256', name: 'registeredAt', type: 'uint256' },
            { internalType: 'uint256', name: 'lastAuthAt', type: 'uint256' },
            { internalType: 'uint256', name: 'nonce', type: 'uint256' }
        ],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'deviceAddress', type: 'address' }],
        name: 'getNonce',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'deviceAddress', type: 'address' }],
        name: 'isDeviceValid',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    },
    {
        inputs: [
            { internalType: 'address', name: 'deviceAddress', type: 'address' },
            { internalType: 'uint8', name: 'deviceType', type: 'uint8' }
        ],
        name: 'verifyDeviceType',
        outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function'
    }
];

async function initBlockchain() {
    web3 = new Web3(BLOCKCHAIN_URL);
    const networkId = await web3.eth.net.getId();
    console.log(`连接到区块链网络, Network ID: ${networkId}`);

    const accounts = await web3.eth.getAccounts();
    console.log(`可用账户: ${accounts.length} 个`);

    if (CONTRACT_ADDRESS) {
        contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        console.log(`合约加载成功: ${CONTRACT_ADDRESS}`);
    } else {
        console.warn('警告: CONTRACT_ADDRESS 未设置');
    }

    return { web3, contract };
}

function ensureContract() {
    if (!contract) throw new Error('合约未初始化');
}

async function registerDevice(deviceAddress, publicKey, deviceType) {
    ensureContract();
    const accounts = await web3.eth.getAccounts();
    const owner = accounts[0];
    const startTime = Date.now();

    const result = await contract.methods
        .registerDevice(deviceAddress, publicKey, deviceType)
        .send({ from: owner, gas: 400000 });

    return {
        transactionHash: result.transactionHash,
        responseTime: Date.now() - startTime
    };
}

async function authenticateDevice(deviceAddress, nonce, timestamp, challenge, signature, privateKey) {
    ensureContract();
    const startTime = Date.now();
    const method = contract.methods.authenticate(
        deviceAddress,
        nonce,
        timestamp,
        challenge || '',
        signature
    );

    let result;
    if (privateKey) {
        const gas = await method.estimateGas({ from: deviceAddress }).catch(() => 300000n);
        const gasPrice = await web3.eth.getGasPrice();
        const txData = {
            from: deviceAddress,
            to: contract.options.address,
            data: method.encodeABI(),
            gas: gas.toString(),
            gasPrice: gasPrice.toString()
        };
        const signed = await web3.eth.accounts.signTransaction(txData, privateKey);
        result = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    } else {
        result = await method.send({ from: deviceAddress, gas: 300000 });
    }

    return {
        success: true,
        transactionHash: result.transactionHash,
        responseTime: Date.now() - startTime
    };
}

async function verifyAuthOnChain(deviceAddress, nonce, timestamp, challenge, signature) {
    ensureContract();
    const startTime = Date.now();
    const valid = await contract.methods
        .verifyAuth(deviceAddress, nonce, timestamp, challenge || '', signature)
        .call();
    return {
        valid,
        responseTime: Date.now() - startTime
    };
}

async function revokeDevice(deviceAddress) {
    ensureContract();
    const accounts = await web3.eth.getAccounts();
    const owner = accounts[0];
    const startTime = Date.now();

    const result = await contract.methods
        .revokeDevice(deviceAddress)
        .send({ from: owner, gas: 200000 });

    return {
        transactionHash: result.transactionHash,
        responseTime: Date.now() - startTime
    };
}

async function getDeviceInfo(deviceAddress) {
    ensureContract();
    const startTime = Date.now();
    const info = await contract.methods.getDeviceInfo(deviceAddress).call();

    return {
        publicKey: info.publicKey || info[0],
        deviceType: parseInt(info.deviceType ?? info[1]),
        status: parseInt(info.status ?? info[2]),
        registeredAt: parseInt(info.registeredAt ?? info[3]),
        lastAuthAt: parseInt(info.lastAuthAt ?? info[4]),
        nonce: parseInt(info.nonce ?? info[5]),
        responseTime: Date.now() - startTime
    };
}

async function getNonce(deviceAddress) {
    ensureContract();
    const nonce = await contract.methods.getNonce(deviceAddress).call();
    return parseInt(nonce);
}

async function isDeviceValid(deviceAddress) {
    ensureContract();
    return contract.methods.isDeviceValid(deviceAddress).call();
}

async function verifyDeviceType(deviceAddress, deviceType) {
    ensureContract();
    return contract.methods.verifyDeviceType(deviceAddress, deviceType).call();
}

async function getAccounts() {
    if (!web3) throw new Error('Web3未初始化');
    return web3.eth.getAccounts();
}

async function createAccount() {
    if (!web3) throw new Error('Web3未初始化');
    return web3.eth.accounts.create();
}

async function fundAccount(fromAddress, toAddress, amount = '1000000000000000000') {
    if (!web3) throw new Error('Web3未初始化');
    return web3.eth.sendTransaction({
        from: fromAddress,
        to: toAddress,
        value: amount,
        gas: 21000
    });
}

function isConnected() {
    return !!contract && !!web3;
}

module.exports = {
    initBlockchain,
    registerDevice,
    authenticateDevice,
    verifyAuthOnChain,
    revokeDevice,
    getDeviceInfo,
    getNonce,
    isDeviceValid,
    verifyDeviceType,
    getAccounts,
    createAccount,
    fundAccount,
    isConnected,
    getWeb3: () => web3,
    getContract: () => contract
};
