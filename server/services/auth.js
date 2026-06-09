require('dotenv').config();

const blockchain = require('./blockchain');
const memoryStore = require('./memoryStore');
const crypto = require('./crypto');

const DEVICE_TYPES = {
    0: 'Unknown',
    1: 'DoorLock',
    2: 'Camera',
    3: 'Sensor',
    4: 'Thermostat',
    5: 'Light',
    6: 'Appliance'
};

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

async function warmupFromChain(address) {
    const info = await blockchain.getDeviceInfo(address);
    if (info.status !== 1) {
        throw new Error('设备不存在或已注销');
    }
    memoryStore.cachePublicKey(address, {
        publicKey: info.publicKey,
        deviceType: info.deviceType,
        status: info.status,
        registeredAt: info.registeredAt,
        lastAuthAt: info.lastAuthAt,
        chainNonce: info.nonce
    });
    return info;
}

/**
 * 注册设备 — 仅上链，无本地数据库
 */
async function register(address, publicKey, deviceType, privateKey) {
    const startTime = Date.now();

    if (!blockchain.isConnected()) {
        throw new Error('区块链未连接，无法注册');
    }

    const existing = await blockchain.getDeviceInfo(address).catch(() => null);
    if (existing && existing.status === 1) {
        throw new Error('设备已注册');
    }

    const pk = publicKey || address;
    const chainResult = await blockchain.registerDevice(address, pk, deviceType);

    memoryStore.cachePublicKey(address, {
        publicKey: pk,
        deviceType,
        status: 1,
        registeredAt: Math.floor(Date.now() / 1000),
        lastAuthAt: 0,
        chainNonce: 0
    });
    memoryStore.addKnownDevice(address);

    const responseTime = Date.now() - startTime;
    memoryStore.logAuth(address, 'register', true, responseTime, 'chain');

    return {
        success: true,
        address,
        publicKey: pk,
        deviceType: DEVICE_TYPES[deviceType] || 'Unknown',
        transactionHash: chainResult.transactionHash,
        registeredAt: Date.now(),
        responseTime,
        privateKey: privateKey || undefined
    };
}

/**
 * 开发辅助：创建账户、充值、注册
 */
async function devCreateAndRegister(deviceType = 1) {
    const account = await blockchain.createAccount();
    const accounts = await blockchain.getAccounts();
    await blockchain.fundAccount(accounts[0], account.address);

    return register(
        account.address,
        account.address,
        deviceType,
        account.privateKey
    );
}

/**
 * 获取链上 nonce
 */
async function getAuthNonce(address) {
    if (!blockchain.isConnected()) {
        throw new Error('区块链未连接');
    }
    const nonce = await blockchain.getNonce(address);
    return { address, nonce, timestamp: Math.floor(Date.now() / 1000) };
}

/**
 * 在线认证 — 链上 nonce + 验签 + 写链
 */
async function authenticate(address, signature, nonce, timestamp, privateKey) {
    const startTime = Date.now();

    if (!blockchain.isConnected()) {
        throw new Error('区块链未连接，请使用离线认证');
    }

    let sig = signature;
    let useNonce = nonce;
    let useTimestamp = timestamp;

    if (privateKey) {
        useNonce = useNonce ?? (await blockchain.getNonce(address));
        useTimestamp = useTimestamp ?? Math.floor(Date.now() / 1000);
        const signed = crypto.signAuthMessage(privateKey, address, useNonce, useTimestamp, '');
        sig = signed.signature;
    }

    if (!sig) {
        throw new Error('缺少签名或私钥');
    }

    useNonce = useNonce ?? (await blockchain.getNonce(address));
    useTimestamp = useTimestamp ?? Math.floor(Date.now() / 1000);

    const chainResult = await blockchain.authenticateDevice(
        address,
        useNonce,
        useTimestamp,
        '',
        sig,
        privateKey
    );

    const cached = memoryStore.getCachedPublicKey(address);
    if (cached) {
        memoryStore.cachePublicKey(address, {
            ...cached,
            lastAuthAt: useTimestamp,
            chainNonce: useNonce + 1
        });
    }

    const responseTime = Date.now() - startTime;
    memoryStore.logAuth(address, 'authenticate', true, responseTime, 'chain');

    return {
        success: true,
        mode: 'online',
        nonce: useNonce,
        responseTime,
        transactionHash: chainResult.transactionHash,
        message: '在线认证成功（链上 nonce 已递增）'
    };
}

/**
 * 快速验签（view 调用，不写链）
 */
async function verifyOnline(address, signature, nonce, timestamp, privateKey) {
    const startTime = Date.now();

    let sig = signature;
    let useNonce = nonce;
    let useTimestamp = timestamp;

    if (privateKey) {
        useNonce = useNonce ?? (await blockchain.getNonce(address));
        useTimestamp = useTimestamp ?? Math.floor(Date.now() / 1000);
        sig = crypto.signAuthMessage(privateKey, address, useNonce, useTimestamp, '').signature;
    }

    const result = await blockchain.verifyAuthOnChain(address, useNonce, useTimestamp, '', sig);
    const responseTime = Date.now() - startTime;
    memoryStore.logAuth(address, 'verify', result.valid, responseTime, 'chain');

    return {
        success: result.valid,
        mode: 'verify',
        responseTime,
        message: result.valid ? '链上验签通过（未写链）' : '验签失败'
    };
}

/**
 * 请求离线 challenge 并预热公钥缓存
 */
async function requestOfflineChallenge(address, forceRefresh = false) {
    const startTime = Date.now();
    let cached = memoryStore.getCachedPublicKey(address);

    if (!cached || cached.expired || forceRefresh) {
        if (!blockchain.isConnected()) {
            if (!cached) {
                throw new Error('公钥未预热且区块链不可达，无法离线认证');
            }
        } else {
            await warmupFromChain(address);
            cached = memoryStore.getCachedPublicKey(address);
        }
    }

    const challenge = crypto.generateChallenge();
    memoryStore.setChallenge(address, challenge);

    return {
        success: true,
        address,
        challenge,
        pubkeyCached: true,
        pubkeyTtl: memoryStore.getPubkeyTtl(),
        offlineWindow: memoryStore.getOfflineWindow(),
        responseTime: Date.now() - startTime
    };
}

/**
 * 离线认证 — 场景 B：内存公钥 + 本地验签 + timestamp + 内存 nonce
 */
async function offlineAuth(address, signature, nonce, timestamp, challenge, privateKey) {
    const startTime = Date.now();

    const cached = memoryStore.getCachedPublicKey(address);
    if (!cached) {
        throw new Error('公钥未预热，请先联网执行 challenge 预热');
    }
    if (cached.expired) {
        throw new Error('公钥缓存已过期，请重新联网预热');
    }
    if (cached.status !== 1) {
        throw new Error('设备已注销或状态异常');
    }

    if (!challenge || !memoryStore.consumeChallenge(address, challenge)) {
        throw new Error('无效或已过期的 challenge');
    }

    const window = memoryStore.getOfflineWindow();
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > window) {
        throw new Error(`时间戳超出允许窗口（±${window}秒）`);
    }

    if (!memoryStore.checkOfflineNonce(address, nonce)) {
        throw new Error('离线 nonce 重放检测失败');
    }

    let sig = signature;
    if (privateKey) {
        sig = crypto.signAuthMessage(privateKey, address, nonce, timestamp, challenge).signature;
    }
    if (!sig) {
        throw new Error('缺少签名');
    }

    const valid = crypto.verifySignature(address, nonce, timestamp, challenge, sig);
    if (!valid) {
        memoryStore.logAuth(address, 'offline_auth', false, Date.now() - startTime, 'offline');
        throw new Error('签名验证失败');
    }

    const responseTime = Date.now() - startTime;
    memoryStore.logAuth(address, 'offline_auth', true, responseTime, 'offline');

    return {
        success: true,
        mode: 'offline',
        deviceAddress: address,
        deviceType: DEVICE_TYPES[cached.deviceType] || 'Unknown',
        responseTime,
        message: '离线认证成功（本地验签，未上链）'
    };
}

async function revoke(address) {
    const startTime = Date.now();

    if (!blockchain.isConnected()) {
        throw new Error('区块链未连接，无法注销');
    }

    const chainResult = await blockchain.revokeDevice(address);
    memoryStore.invalidatePublicKey(address);

    const responseTime = Date.now() - startTime;
    memoryStore.logAuth(address, 'revoke', true, responseTime, 'chain');

    return {
        success: true,
        address,
        transactionHash: chainResult.transactionHash,
        responseTime,
        message: '设备已注销（链上状态已更新）'
    };
}

async function getDeviceInfo(address) {
    const startTime = Date.now();

    if (!blockchain.isConnected()) {
        const cached = memoryStore.getCachedPublicKey(address);
        if (!cached) throw new Error('区块链不可达且无内存缓存');
        return formatDeviceInfo(address, cached, true, Date.now() - startTime);
    }

    const info = await warmupFromChain(address);
    return formatDeviceInfo(address, info, false, Date.now() - startTime);
}

function formatDeviceInfo(address, info, fromMemory, responseTime) {
    return {
        address,
        publicKey: info.publicKey,
        deviceType: DEVICE_TYPES[info.deviceType] || 'Unknown',
        status: info.status === 1 ? 'Active' : 'Revoked',
        registeredAt: (info.registeredAt || 0) * (info.registeredAt > 1e12 ? 1 : 1000),
        lastAuthAt: (info.lastAuthAt || 0) * (info.lastAuthAt > 1e12 ? 1 : 1000),
        nonce: info.chainNonce ?? info.nonce,
        source: fromMemory ? 'memory' : 'chain',
        responseTime
    };
}

async function getDeviceList() {
    const addresses = memoryStore.getKnownDevices();
    const devices = [];

    for (const address of addresses) {
        try {
            if (blockchain.isConnected()) {
                const info = await blockchain.getDeviceInfo(address);
                if (info.status === 1 || info.status === 2) {
                    devices.push(formatDeviceInfo(address, info, false, info.responseTime));
                }
            } else {
                const cached = memoryStore.getCachedPublicKey(address);
                if (cached) devices.push(formatDeviceInfo(address, cached, true, 0));
            }
        } catch {
            // 跳过已不存在的设备
        }
    }
    return devices;
}

async function verifyDeviceType(address, deviceType) {
    if (blockchain.isConnected()) {
        return blockchain.verifyDeviceType(address, deviceType);
    }
    const cached = memoryStore.getCachedPublicKey(address);
    return cached && cached.deviceType === deviceType && cached.status === 1;
}

function getAuthStats() {
    return memoryStore.getMemoryStats();
}

async function getDashboardStats() {
    const devices = await getDeviceList();
    const activeDevices = devices.filter((d) => d.status === 'Active');
    const memStats = memoryStore.getMemoryStats();

    const deviceTypeDistribution = {};
    Object.keys(DEVICE_TYPES).forEach((key) => {
        if (key !== '0') deviceTypeDistribution[DEVICE_TYPES[key]] = 0;
    });
    activeDevices.forEach((device) => {
        const typeName = device.deviceType || 'Unknown';
        deviceTypeDistribution[typeName] = (deviceTypeDistribution[typeName] || 0) + 1;
    });

    return {
        architecture: 'fully-decentralized',
        storage: 'chain-only',
        edgeMemory: 'ephemeral',
        deviceStats: {
            total: devices.length,
            active: activeDevices.length,
            revoked: devices.filter((d) => d.status === 'Revoked').length,
            byType: deviceTypeDistribution
        },
        performance: {
            avgChainTime: memStats.avgChainTime,
            avgOfflineTime: memStats.avgOfflineTime
        },
        memory: {
            pubkeyCached: memStats.pubkeyCached,
            knownDevices: memStats.knownDevices,
            totalRequests: memStats.totalRequests,
            chainRequests: memStats.chainRequests,
            offlineRequests: memStats.offlineRequests
        },
        recentLogs: memoryStore.getSessionLogs(20)
    };
}

function getPerformanceHistory(hours = 24) {
    return memoryStore.getPerfHistory(hours);
}

async function batchAuthenticate(addresses, options = {}) {
    const results = [];
    for (const address of addresses) {
        try {
            const result = await authenticate(
                address,
                options.signatures?.[addresses.indexOf(address)],
                undefined,
                undefined,
                options.privateKey
            );
            results.push({ address, success: true, ...result });
        } catch (error) {
            results.push({ address, success: false, error: error.message });
        }
    }
    return results;
}

async function simulateWeakNetwork(address, delay = 2000, privateKey) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return authenticate(address, undefined, undefined, undefined, privateKey);
}

async function getDeviceStatus() {
    const devices = await getDeviceList();
    const now = Date.now();

    return devices.map((device) => ({
        address: device.address,
        deviceType: device.deviceType,
        status: device.status === 'Active' ? 'Registered' : 'Revoked',
        lastAuthAt: device.lastAuthAt,
        isOnline:
            device.status === 'Active' &&
            device.lastAuthAt &&
            now - device.lastAuthAt < ONLINE_THRESHOLD_MS,
        offlineDuration: device.lastAuthAt
            ? Math.floor((now - device.lastAuthAt) / 1000)
            : null,
        source: device.source || 'chain'
    }));
}

function createDeviceGroup(groupName, addresses) {
    const group = memoryStore.createDeviceGroup(groupName, addresses);
    return {
        success: true,
        groupId: group.id,
        groupName: group.name,
        deviceCount: group.addresses.length
    };
}

async function getDeviceGroups() {
    const groups = memoryStore.getDeviceGroups();
    const result = [];

    for (const group of groups) {
        const devices = [];
        for (const address of group.addresses) {
            try {
                const info = blockchain.isConnected()
                    ? await blockchain.getDeviceInfo(address)
                    : memoryStore.getCachedPublicKey(address);
                devices.push({
                    address,
                    deviceType: DEVICE_TYPES[info?.deviceType] || 'Unknown'
                });
            } catch {
                devices.push({ address, deviceType: 'Unknown' });
            }
        }
        result.push({
            id: group.id,
            name: group.name,
            createdAt: group.createdAt,
            devices
        });
    }
    return result;
}

function clearMemory() {
    memoryStore.clearMemory();
    return { success: true, message: '边缘内存已清空（公钥缓存、离线 nonce、challenge 全部重置）' };
}

async function warmupDevice(address) {
    if (!blockchain.isConnected()) {
        throw new Error('区块链未连接，无法预热');
    }
    const info = await warmupFromChain(address);
    return {
        success: true,
        address,
        publicKey: info.publicKey,
        nonce: info.nonce,
        message: '公钥已载入边缘内存（重启后清空）'
    };
}

async function triggerScenario(scenarioName, triggerDevice) {
    const scenarios = {
        door_unlock: {
            name: '门锁开启联动',
            triggers: async () => {
                const devices = await getDeviceList();
                const actions = [];
                const lights = devices.filter((d) => d.deviceType === 'Light');
                const cameras = devices.filter((d) => d.deviceType === 'Camera');

                if (lights.length > 0) {
                    actions.push({
                        action: 'light_on',
                        devices: lights.map((d) => d.address),
                        message: `已开启 ${lights.length} 个灯具`
                    });
                }
                if (cameras.length > 0) {
                    actions.push({
                        action: 'camera_record',
                        devices: cameras.map((d) => d.address),
                        message: `已启动 ${cameras.length} 个摄像头录像`
                    });
                }
                return actions;
            }
        },
        motion_detected: {
            name: '移动检测联动',
            triggers: async () => {
                const devices = await getDeviceList();
                const lights = devices.filter((d) => d.deviceType === 'Light');
                const actions = [];

                if (lights.length > 0) {
                    actions.push({
                        action: 'all_lights_on',
                        devices: lights.map((d) => d.address),
                        message: `已开启 ${lights.length} 个灯具`
                    });
                }
                actions.push({
                    action: 'send_notification',
                    message: '检测到移动，已发送安全通知'
                });
                return actions;
            }
        }
    };

    const scenario = scenarios[scenarioName];
    if (!scenario) throw new Error(`场景不存在: ${scenarioName}`);

    const actions = await scenario.triggers(triggerDevice);
    return {
        success: true,
        scenario: scenario.name,
        triggerDevice,
        actions,
        message: `场景 "${scenario.name}" 已触发`
    };
}

module.exports = {
    register,
    devCreateAndRegister,
    getAuthNonce,
    authenticate,
    verifyOnline,
    requestOfflineChallenge,
    offlineAuth,
    revoke,
    getDeviceInfo,
    getDeviceList,
    verifyDeviceType,
    getAuthStats,
    getDashboardStats,
    getPerformanceHistory,
    batchAuthenticate,
    simulateWeakNetwork,
    getDeviceStatus,
    createDeviceGroup,
    getDeviceGroups,
    clearMemory,
    warmupDevice,
    triggerScenario,
    DEVICE_TYPES
};
