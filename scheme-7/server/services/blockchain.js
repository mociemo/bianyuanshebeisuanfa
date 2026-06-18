const { Web3 } = require('web3');

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
        name: 'registerDevice', outputs: [], stateMutability: 'nonpayable', type: 'function'
    },
    {
        inputs: [
            { internalType: 'address', name: 'deviceAddress', type: 'address' },
            { internalType: 'uint256', name: 'nonce', type: 'uint256' },
            { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
            { internalType: 'string', name: 'challenge', type: 'string' },
            { internalType: 'bytes', name: 'signature', type: 'bytes' }
        ],
        name: 'authenticate', outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'nonpayable', type: 'function'
    },
    {
        inputs: [
            { internalType: 'address', name: 'deviceAddress', type: 'address' },
            { internalType: 'uint256', name: 'nonce', type: 'uint256' },
            { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
            { internalType: 'string', name: 'challenge', type: 'string' },
            { internalType: 'bytes', name: 'signature', type: 'bytes' }
        ],
        name: 'verifyAuth', outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view', type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'deviceAddress', type: 'address' }],
        name: 'revokeDevice', outputs: [], stateMutability: 'nonpayable', type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'deviceAddress', type: 'address' }],
        name: 'getDeviceInfo', outputs: [
            { internalType: 'string', name: 'publicKey', type: 'string' },
            { internalType: 'uint8', name: 'deviceType', type: 'uint8' },
            { internalType: 'uint8', name: 'status', type: 'uint8' },
            { internalType: 'uint256', name: 'registeredAt', type: 'uint256' },
            { internalType: 'uint256', name: 'lastAuthAt', type: 'uint256' },
            { internalType: 'uint256', name: 'nonce', type: 'uint256' }
        ], stateMutability: 'view', type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'deviceAddress', type: 'address' }],
        name: 'getNonce', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view', type: 'function'
    },
    {
        inputs: [{ internalType: 'address', name: 'deviceAddress', type: 'address' }],
        name: 'isDeviceValid', outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view', type: 'function'
    },
    {
        inputs: [
            { internalType: 'address', name: 'deviceAddress', type: 'address' },
            { internalType: 'uint8', name: 'deviceType', type: 'uint8' }
        ],
        name: 'verifyDeviceType', outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
        stateMutability: 'view', type: 'function'
    }
];

async function initBlockchain() {
    web3 = new Web3(BLOCKCHAIN_URL);
    const networkId = await web3.eth.net.getId();
    console.log(`[方案7] 区块链连接, Network ID: ${networkId}`);
    if (CONTRACT_ADDRESS) {
        contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        console.log(`[方案7] 合约: ${CONTRACT_ADDRESS}`);
    }
    return { web3, contract };
}

function ensureContract() { if (!contract) throw new Error('合约未初始化'); }

// 进程内账户级锁：同一账户的交易排队执行，避免自己打自己
const accountLocks = {};

function withAccountLock(account, fn) {
    if (!accountLocks[account]) accountLocks[account] = Promise.resolve();
    // .then(onFulfilled, onRejected): 无论上一笔成功或失败，都继续执行下一笔
    // 同时正确传递本次调用的结果/错误给调用方
    accountLocks[account] = accountLocks[account].then(() => fn(), () => fn());
    return accountLocks[account];
}

// 轻量 nonce 重试：仅应对跨服务器碰撞（automine 下极少发生）
async function withNonceRetry(fn, maxRetries = 3, baseDelay = 50) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            const msg = (err?.message || String(err)).toLowerCase();
            const isNonceErr = msg.includes('nonce too low') || msg.includes('nonce is too low');
            if (i < maxRetries - 1 && isNonceErr) {
                console.log(`[方案7 Nonce重试] 第${i + 1}次, 等待${baseDelay}ms`);
                await new Promise(r => setTimeout(r, baseDelay));
                continue;
            }
            throw err;
        }
    }
}

async function registerDevice(deviceAddress, publicKey, deviceType) {
    ensureContract();
    const accounts = await web3.eth.getAccounts();
    return withNonceRetry(() => withAccountLock(accounts[0], async () => {
        const nonce = await web3.eth.getTransactionCount(accounts[0], 'pending');
        const result = await contract.methods
            .registerDevice(deviceAddress, publicKey, deviceType)
            .send({ from: accounts[0], gas: 400000, nonce });
        return { transactionHash: result.transactionHash };
    }));
}

async function authenticateDevice(deviceAddress, nonce, timestamp, challenge, signature, privateKey) {
    ensureContract();
    const startTime = Date.now();
    const method = contract.methods.authenticate(deviceAddress, nonce, timestamp, challenge || '', signature);

    try {
        let result;
        if (privateKey) {
            // gas 估算失败通常意味着合约会 revert，不再静默吞错
            let gasEst;
            try {
                gasEst = await method.estimateGas({ from: deviceAddress });
            } catch (gasErr) {
                const reason = gasErr?.data?.data || gasErr?.innerError?.message || gasErr.message || String(gasErr);
                console.error('[方案7] Gas估算失败 (合约将revert):', reason);
                // 尝试用 call 获取具体的 revert 原因
                try {
                    await method.call({ from: deviceAddress });
                } catch (callErr) {
                    const revertReason = callErr?.data?.data || callErr?.innerError?.message || callErr.message || String(callErr);
                    console.error('[方案7] call 模拟也失败:', revertReason);
                }
                throw new Error(`合约调用失败(签名/nonce/设备状态可能不匹配): ${reason}`);
            }
            // 估算值加 50% 缓冲，因为 ecrecover 实际执行 gas 可能高于估算
            const gas = Math.floor(Number(gasEst) * 1.5);
            const gasPrice = await web3.eth.getGasPrice();
            const txData = {
                from: deviceAddress, to: contract.options.address,
                data: method.encodeABI(), gas: String(gas), gasPrice: gasPrice.toString()
            };
            const signed = await web3.eth.accounts.signTransaction(txData, privateKey);
            result = await web3.eth.sendSignedTransaction(signed.rawTransaction);
        } else {
            result = await method.send({ from: deviceAddress, gas: 500000 });
        }

        return { success: true, transactionHash: result.transactionHash, responseTime: Date.now() - startTime };
    } catch (err) {
        const errMsg = err?.data?.data || err?.innerError?.message || err.message || String(err);
        console.error('[方案7] authenticateDevice 失败:', errMsg);
        throw err;
    }
}

async function verifyAuthOnChain(deviceAddress, nonce, timestamp, challenge, signature) {
    ensureContract();
    const startTime = Date.now();
    const valid = await contract.methods
        .verifyAuth(deviceAddress, nonce, timestamp, challenge || '', signature)
        .call();
    return { valid, responseTime: Date.now() - startTime };
}

async function revokeDevice(deviceAddress) {
    ensureContract();
    const accounts = await web3.eth.getAccounts();
    const result = await contract.methods
        .revokeDevice(deviceAddress)
        .send({ from: accounts[0], gas: 200000 });
    return { transactionHash: result.transactionHash };
}

async function getDeviceInfo(deviceAddress) {
    ensureContract();
    const info = await contract.methods.getDeviceInfo(deviceAddress).call();
    return {
        publicKey: info.publicKey || info[0],
        deviceType: parseInt(info.deviceType ?? info[1]),
        status: parseInt(info.status ?? info[2]),
        registeredAt: parseInt(info.registeredAt ?? info[3]),
        lastAuthAt: parseInt(info.lastAuthAt ?? info[4]),
        nonce: parseInt(info.nonce ?? info[5])
    };
}

async function getNonce(deviceAddress) {
    ensureContract();
    return parseInt(await contract.methods.getNonce(deviceAddress).call());
}

async function isDeviceValid(deviceAddress) {
    ensureContract();
    return contract.methods.isDeviceValid(deviceAddress).call();
}

async function verifyDeviceType(deviceAddress, deviceType) {
    ensureContract();
    return contract.methods.verifyDeviceType(deviceAddress, deviceType).call();
}

async function getAccounts() { return web3.eth.getAccounts(); }
async function createAccount() { return web3.eth.accounts.create(); }

async function fundAccount(fromAddress, toAddress, amount = '1000000000000000000') {
    return withNonceRetry(() => withAccountLock(fromAddress, async () => {
        const nonce = await web3.eth.getTransactionCount(fromAddress, 'pending');
        return web3.eth.sendTransaction({ from: fromAddress, to: toAddress, value: amount, gas: 21000, nonce });
    }));
}

function isConnected() { return !!contract && !!web3; }

module.exports = {
    initBlockchain, registerDevice, authenticateDevice, verifyAuthOnChain,
    revokeDevice, getDeviceInfo, getNonce, isDeviceValid, verifyDeviceType,
    getAccounts, createAccount, fundAccount, isConnected,
    getWeb3: () => web3, getContract: () => contract
};
