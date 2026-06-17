require('dotenv').config();
const blockchain = require('./blockchain');
const mongodb = require('./mongodb');
const crypto = require('./crypto');

const DEVICE_TYPES = { 0: 'Unknown', 1: 'DoorLock', 2: 'Camera', 3: 'Sensor', 4: 'Thermostat', 5: 'Light', 6: 'Appliance' };
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

async function register(address, publicKey, deviceType, privateKey) {
    const startTime = Date.now();
    if (!blockchain.isConnected()) throw new Error('区块链未连接');
    const existing = await mongodb.findDevice(address);
    if (existing && existing.status === 1) throw new Error('设备已注册');

    const pk = publicKey || address;
    // MongoDB + 链双写
    await mongodb.upsertDevice(address, { publicKey: pk, deviceType, status: 1, registeredAt: new Date() });
    const chainResult = await blockchain.registerDevice(address, pk, deviceType);
    await mongodb.saveAuthLog(address, 'register', true, Date.now() - startTime, 'chain');

    return {
        success: true, address, publicKey: pk,
        deviceType: DEVICE_TYPES[deviceType] || 'Unknown',
        transactionHash: chainResult.transactionHash,
        registeredAt: Date.now(), responseTime: Date.now() - startTime,
        privateKey: privateKey || undefined
    };
}

async function devCreateAndRegister(deviceType = 1) {
    const account = await blockchain.createAccount();
    const accounts = await blockchain.getAccounts();
    await blockchain.fundAccount(accounts[0], account.address);
    return register(account.address, account.address, deviceType, account.privateKey);
}

async function getAuthNonce(address) {
    if (!mongodb.isConnected()) throw new Error('MongoDB 未连接');
    const nonce = await mongodb.getNonce(address);
    return { address, nonce, timestamp: Math.floor(Date.now() / 1000), source: 'mongodb' };
}

async function authenticate(address, signature, nonce, timestamp, privateKey) {
    const startTime = Date.now();
    let sig = signature, useNonce = nonce, useTimestamp = timestamp;

    if (privateKey) {
        useNonce = useNonce ?? (await mongodb.getNonce(address));
        useTimestamp = useTimestamp ?? Math.floor(Date.now() / 1000);
        sig = crypto.signAuthMessage(privateKey, address, useNonce, useTimestamp, '').signature;
    }
    if (!sig) throw new Error('缺少签名或私钥');

    useNonce = useNonce ?? (await mongodb.getNonce(address));
    useTimestamp = useTimestamp ?? Math.floor(Date.now() / 1000);

    const mongoNonce = await mongodb.getNonce(address);
    if (useNonce !== mongoNonce) throw new Error('Nonce 不匹配');

    // Simple on-chain authenticate (no nonce check in contract)
    const chainResult = await blockchain.authenticateDevice(address);
    await mongodb.incrementNonce(address);

    const responseTime = Date.now() - startTime;
    await mongodb.saveAuthLog(address, 'authenticate', true, responseTime, 'chain');

    return {
        success: true, mode: 'online', nonce: useNonce,
        responseTime, transactionHash: chainResult.transactionHash,
        message: '在线认证成功（MongoDB nonce + 链上记录）'
    };
}

async function requestOfflineChallenge(address, forceRefresh = false) {
    const startTime = Date.now();
    if (!mongodb.isConnected()) throw new Error('MongoDB 未连接');

    const device = await mongodb.findDevice(address);
    if (!device || device.status !== 1) throw new Error('设备不存在或已注销');

    const challenge = crypto.generateChallenge();
    const credentialHash = crypto.buildAuthMessageHash(address, 0, Math.floor(Date.now() / 1000), challenge);
    await mongodb.storeCredential(address, credentialHash);

    return {
        success: true, address, challenge, pubkeyCached: true,
        offlineWindow: parseInt(process.env.OFFLINE_TIMESTAMP_WINDOW) || 60,
        responseTime: Date.now() - startTime
    };
}

async function offlineAuth(address, signature, nonce, timestamp, challenge, privateKey) {
    const startTime = Date.now();
    const device = await mongodb.findDevice(address);
    if (!device || device.status !== 1) throw new Error('设备不存在或已注销');

    // Verify credential from MongoDB
    const credentialHash = crypto.buildAuthMessageHash(address, nonce, timestamp, challenge);
    if (!(await mongodb.consumeCredential(address, credentialHash))) {
        throw new Error('无效或已使用的凭证');
    }

    const window = parseInt(process.env.OFFLINE_TIMESTAMP_WINDOW) || 60;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > window) throw new Error(`时间戳超出窗口（±${window}秒）`);

    let sig = signature;
    if (privateKey) sig = crypto.signAuthMessage(privateKey, address, nonce, timestamp, challenge).signature;
    if (!sig) throw new Error('缺少签名');

    const valid = crypto.verifySignature(address, nonce, timestamp, challenge, sig);
    if (!valid) throw new Error('签名验证失败');

    const responseTime = Date.now() - startTime;
    await mongodb.saveAuthLog(address, 'offline_auth', true, responseTime, 'offline');

    return {
        success: true, mode: 'offline', deviceAddress: address,
        deviceType: DEVICE_TYPES[device.deviceType] || 'Unknown',
        responseTime, message: '离线认证成功（MongoDB 凭证验证）'
    };
}

async function revoke(address) {
    const startTime = Date.now();
    if (!blockchain.isConnected()) throw new Error('区块链未连接');

    const chainResult = await blockchain.revokeDevice(address);
    await mongodb.upsertDevice(address, { status: 2 });

    const responseTime = Date.now() - startTime;
    await mongodb.saveAuthLog(address, 'revoke', true, responseTime, 'chain');

    return {
        success: true, address, transactionHash: chainResult.transactionHash,
        responseTime, message: '设备已注销（MongoDB + 链上双写）'
    };
}

async function getDeviceInfo(address) {
    const startTime = Date.now();
    const device = await mongodb.findDevice(address);
    if (!device) throw new Error('设备不存在');

    return {
        address, publicKey: device.publicKey,
        deviceType: DEVICE_TYPES[device.deviceType] || 'Unknown',
        status: device.status === 1 ? 'Active' : 'Revoked',
        registeredAt: device.registeredAt ? new Date(device.registeredAt).getTime() : 0,
        lastAuthAt: device.lastAuthAt ? new Date(device.lastAuthAt).getTime() : 0,
        nonce: device.nonce || 0, source: 'mongodb',
        responseTime: Date.now() - startTime
    };
}

async function getDeviceList() {
    const devices = await mongodb.getAllDevices();
    return devices.map(d => ({
        address: d.address, publicKey: d.publicKey,
        deviceType: DEVICE_TYPES[d.deviceType] || 'Unknown',
        status: d.status === 1 ? 'Active' : 'Revoked',
        registeredAt: d.registeredAt ? new Date(d.registeredAt).getTime() : 0,
        lastAuthAt: d.lastAuthAt ? new Date(d.lastAuthAt).getTime() : 0,
        source: 'mongodb'
    }));
}

async function getDashboardStats() {
    const devices = await getDeviceList();
    const activeDevices = devices.filter(d => d.status === 'Active');
    const mongoStats = await mongodb.getDeviceStats();
    const logs = await mongodb.findAuthLogs(100);
    const chainLogs = logs.filter(l => l.mode === 'chain' && l.success);
    const offlineLogs = logs.filter(l => l.mode === 'offline' && l.success);

    return {
        architecture: 'hybrid-blockchain-mongodb', storage: 'chain-mongodb',
        deviceStats: {
            total: devices.length, active: activeDevices.length,
            revoked: devices.filter(d => d.status === 'Revoked').length,
            byType: mongoStats.byType || {}
        },
        performance: {
            avgChainTime: chainLogs.length ? Math.round(chainLogs.reduce((s, l) => s + (l.responseTime || 0), 0) / chainLogs.length) : 0,
            avgOfflineTime: offlineLogs.length ? Math.round(offlineLogs.reduce((s, l) => s + (l.responseTime || 0), 0) / offlineLogs.length) : 0
        },
        memory: {
            pubkeyCached: devices.length, knownDevices: devices.length,
            totalRequests: logs.length, chainRequests: chainLogs.length, offlineRequests: offlineLogs.length
        },
        recentLogs: logs.slice(0, 20).map(l => ({
            device_address: l.address, method: l.method, success: l.success ? 1 : 0,
            response_time: l.responseTime || 0, mode: l.mode, created_at: l.createdAt ? l.createdAt.getTime() : Date.now()
        }))
    };
}

async function clearMemory() {
    await mongodb.clearAll();
    return { success: true, message: 'MongoDB 临时数据已清空（凭证、日志），设备数据保留' };
}

async function warmupDevice(address) {
    const device = await mongodb.findDevice(address);
    if (!device || device.status !== 1) throw new Error('设备不存在或已注销');
    return { success: true, address, publicKey: device.publicKey, message: '设备已在 MongoDB 中' };
}

module.exports = {
    register, devCreateAndRegister, getAuthNonce, authenticate,
    requestOfflineChallenge, offlineAuth, revoke,
    getDeviceInfo, getDeviceList, getDashboardStats, clearMemory, warmupDevice,
    DEVICE_TYPES
};
