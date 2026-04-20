const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const { Device, OfflineToken, AuthLog } = require('../models/database');
const blockchain = require('./blockchain');
const cache = require('./cache');

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const OFFLINE_TOKEN_TTL = parseInt(process.env.OFFLINE_TOKEN_TTL) || 3600;

// 设备类型映射
const DEVICE_TYPES = {
    0: 'Unknown',
    1: 'DoorLock',
    2: 'Camera',
    3: 'Sensor',
    4: 'Thermostat',
    5: 'Light',
    6: 'Appliance'
};

/**
 * 注册设备
 * 1. 保存到SQLite
 * 2. 上链注册
 * 3. 缓存公钥
 */
async function register(address, publicKey, deviceType) {
    const startTime = Date.now();

    try {
        // 检查是否已注册
        const existing = Device.findByAddress(address);
        if (existing) {
            throw new Error('设备已注册');
        }

        // 保存到本地数据库
        Device.create(address, publicKey, deviceType);
        console.log(`设备已保存到数据库: ${address}`);

        // 上链注册
        try {
            await blockchain.registerDevice(address, publicKey, deviceType);
            console.log(`设备已上链: ${address}`);
        } catch (chainError) {
            console.warn('上链失败，使用本地注册:', chainError.message);
        }

        // 缓存公钥
        await cache.cachePublicKey(address, publicKey);

        const responseTime = Date.now() - startTime;

        // 记录日志
        AuthLog.log(address, 'register', true, responseTime, false);

        return {
            success: true,
            address,
            deviceType: DEVICE_TYPES[deviceType] || 'Unknown',
            registeredAt: Date.now(),
            responseTime
        };
    } catch (error) {
        AuthLog.log(address, 'register', false, Date.now() - startTime, false);
        throw error;
    }
}

/**
 * 认证设备（缓存优先）
 * 1. 先查缓存
 * 2. 未命中查链上合约
 * 3. 写入缓存
 */
async function authenticate(address, signature = '0x00') {
    const startTime = Date.now();
    let cached = false;
    let success = false;

    try {
        // 1. 尝试从缓存获取认证结果
        const cachedResult = await cache.getCachedAuthResult(address);
        if (cachedResult !== null) {
            console.log(`缓存命中: ${address}`);
            cached = true;
            success = cachedResult;

            // 更新本地数据库
            if (success) {
                Device.updateLastAuth(address);
            }

            const responseTime = Date.now() - startTime;
            AuthLog.log(address, 'authenticate', success, responseTime, true);

            return {
                success,
                cached: true,
                responseTime,
                message: success ? '认证成功（缓存）' : '认证失败（缓存）'
            };
        }

        // 2. 缓存未命中，查询区块链
        console.log(`缓存未命中，查询区块链: ${address}`);

        try {
            const chainResult = await blockchain.authenticateDevice(address, signature);
            success = chainResult.success;

            // 缓存结果
            await cache.cacheAuthResult(address, success);

            // 更新本地数据库
            if (success) {
                Device.updateLastAuth(address);
            }

            const responseTime = Date.now() - startTime;

            // 如果链上查询失败，尝试本地查询
            if (!success) {
                const localDevice = Device.findByAddress(address);
                if (localDevice && localDevice.status === 1) {
                    success = true;
                    await cache.cacheAuthResult(address, true);
                    Device.updateLastAuth(address);
                }
            }

            AuthLog.log(address, 'authenticate', success, responseTime, false);

            return {
                success,
                cached: false,
                responseTime,
                transactionHash: chainResult.transactionHash,
                message: success ? '认证成功' : '认证失败'
            };
        } catch (chainError) {
            console.warn('区块链查询失败，尝试本地验证:', chainError.message);

            // 降级到本地验证
            const localDevice = Device.findByAddress(address);
            if (localDevice && localDevice.status === 1) {
                success = true;
                await cache.cacheAuthResult(address, true);
                Device.updateLastAuth(address);
            }

            const responseTime = Date.now() - startTime;
            AuthLog.log(address, 'authenticate', success, responseTime, false);

            return {
                success,
                cached: false,
                responseTime,
                message: success ? '认证成功（本地验证）' : '认证失败'
            };
        }
    } catch (error) {
        AuthLog.log(address, 'authenticate', false, Date.now() - startTime, cached);
        throw error;
    }
}

/**
 * 生成离线认证凭证
 */
async function generateOfflineToken(address) {
    const startTime = Date.now();

    try {
        // 检查设备是否存在且有效
        const device = Device.findByAddress(address);
        if (!device || device.status !== 1) {
            throw new Error('设备不存在或已注销');
        }

        // 生成JWT token
        const tokenId = uuidv4();
        const expiresAt = Date.now() + OFFLINE_TOKEN_TTL * 1000;

        const token = jwt.sign(
            {
                id: tokenId,
                address: address,
                deviceType: device.device_type,
                type: 'offline_auth'
            },
            JWT_SECRET,
            { expiresIn: `${OFFLINE_TOKEN_TTL}s` }
        );

        // 保存到数据库
        OfflineToken.create(tokenId, address, token, expiresAt);

        // 缓存到Redis
        await cache.cacheOfflineToken(token, {
            address,
            deviceType: device.device_type,
            issuedAt: Date.now(),
            expiresAt
        });

        const responseTime = Date.now() - startTime;
        console.log(`离线凭证已生成: ${address}, 有效期: ${OFFLINE_TOKEN_TTL}秒`);

        return {
            success: true,
            token,
            expiresAt,
            ttl: OFFLINE_TOKEN_TTL,
            responseTime
        };
    } catch (error) {
        throw error;
    }
}

/**
 * 离线认证（使用离线凭证）
 */
async function offlineAuth(token) {
    const startTime = Date.now();

    try {
        // 验证JWT
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
            throw new Error('无效或已过期的凭证');
        }

        // 检查Redis缓存
        const cachedToken = await cache.getCachedOfflineToken(token);
        if (cachedToken) {
            console.log(`离线凭证缓存命中: ${decoded.address}`);
        }

        // 验证数据库
        const storedToken = OfflineToken.verify(token);
        if (!storedToken) {
            throw new Error('凭证无效或已使用');
        }

        // 检查设备状态
        const device = Device.findByAddress(decoded.address);
        if (!device || device.status !== 1) {
            throw new Error('设备已注销或不存在');
        }

        // 标记凭证已使用
        OfflineToken.markUsed(storedToken.id);

        // 更新最后认证时间
        Device.updateLastAuth(decoded.address);

        const responseTime = Date.now() - startTime;
        AuthLog.log(decoded.address, 'offline_auth', true, responseTime, !!cachedToken);

        return {
            success: true,
            deviceAddress: decoded.address,
            deviceType: DEVICE_TYPES[decoded.deviceType] || 'Unknown',
            cached: !!cachedToken,
            responseTime,
            message: '离线认证成功'
        };
    } catch (error) {
        AuthLog.log('unknown', 'offline_auth', false, Date.now() - startTime, false);
        throw error;
    }
}

/**
 * 注销设备
 */
async function revoke(address) {
    const startTime = Date.now();

    try {
        // 更新本地数据库
        Device.updateStatus(address, 2);

        // 尝试链上注销
        try {
            await blockchain.revokeDevice(address);
        } catch (chainError) {
            console.warn('链上注销失败:', chainError.message);
        }

        // 清空缓存
        await cache.invalidateDevice(address);

        // 删除离线凭证
        OfflineToken.deleteByDevice(address);

        const responseTime = Date.now() - startTime;
        AuthLog.log(address, 'revoke', true, responseTime, false);

        return {
            success: true,
            address,
            responseTime,
            message: '设备已注销'
        };
    } catch (error) {
        AuthLog.log(address, 'revoke', false, Date.now() - startTime, false);
        throw error;
    }
}

/**
 * 获取设备信息（缓存优先）
 */
async function getDeviceInfo(address) {
    const startTime = Date.now();

    // 尝试从缓存获取
    const cachedInfo = await cache.getCachedDeviceInfo(address);
    if (cachedInfo) {
        const responseTime = Date.now() - startTime;
        return {
            ...cachedInfo,
            cached: true,
            responseTime
        };
    }

    // 查询区块链
    try {
        const chainInfo = await blockchain.getDeviceInfo(address);

        // 转换为标准格式
        const deviceInfo = {
            address,
            publicKey: chainInfo.publicKey,
            deviceType: DEVICE_TYPES[chainInfo.deviceType] || 'Unknown',
            status: chainInfo.status === 1 ? 'Active' : 'Revoked',
            registeredAt: chainInfo.registeredAt * 1000,
            lastAuthAt: chainInfo.lastAuthAt * 1000
        };

        // 缓存结果
        await cache.cacheDeviceInfo(address, deviceInfo);

        const responseTime = Date.now() - startTime;
        return {
            ...deviceInfo,
            cached: false,
            responseTime
        };
    } catch (error) {
        // 降级到本地查询
        const localDevice = Device.findByAddress(address);
        if (localDevice) {
            const responseTime = Date.now() - startTime;
            return {
                address: localDevice.address,
                publicKey: localDevice.public_key,
                deviceType: DEVICE_TYPES[localDevice.device_type] || 'Unknown',
                status: localDevice.status === 1 ? 'Active' : 'Revoked',
                registeredAt: localDevice.registered_at,
                lastAuthAt: localDevice.last_auth_at,
                cached: false,
                responseTime,
                message: '本地数据'
            };
        }
        throw error;
    }
}

/**
 * 获取设备列表
 */
function getDeviceList() {
    const devices = Device.findAll();
    return devices.map(d => ({
        address: d.address,
        publicKey: d.public_key,
        deviceType: DEVICE_TYPES[d.device_type] || 'Unknown',
        status: d.status === 1 ? 'Active' : 'Revoked',
        registeredAt: d.registered_at,
        lastAuthAt: d.last_auth_at
    }));
}

/**
 * 验证设备类型
 */
async function verifyDeviceType(address, deviceType) {
    try {
        // 尝试链上验证
        return await blockchain.verifyDeviceType(address, deviceType);
    } catch (error) {
        // 降级到本地验证
        const device = Device.findByAddress(address);
        return device && device.device_type === deviceType && device.status === 1;
    }
}

/**
 * 获取认证统计
 */
function getAuthStats() {
    const dbStats = AuthLog.getCacheStats();
    return dbStats || { total: 0, cached_count: 0, cache_hit_rate: 0 };
}

/**
 * 获取仪表盘详细统计数据
 */
function getDashboardStats() {
    const devices = Device.findAll();
    const activeDevices = devices.filter(d => d.status === 1);
    
    // 设备类型分布
    const deviceTypeDistribution = {};
    Object.keys(DEVICE_TYPES).forEach(key => {
        if (key !== '0') {
            deviceTypeDistribution[DEVICE_TYPES[key]] = 0;
        }
    });
    activeDevices.forEach(device => {
        const typeName = DEVICE_TYPES[device.device_type] || 'Unknown';
        deviceTypeDistribution[typeName] = (deviceTypeDistribution[typeName] || 0) + 1;
    });
    
    // 获取认证日志统计
    const logs = AuthLog.getRecentLogs(100);
    const cacheHitRate = AuthLog.getCacheStats();
    
    // 计算平均响应时间
    const cacheLogs = logs.filter(l => l.cached === 1 && l.response_time > 0);
    const chainLogs = logs.filter(l => l.cached === 0 && l.response_time > 0);
    
    const avgCacheTime = cacheLogs.length > 0 
        ? Math.round(cacheLogs.reduce((sum, l) => sum + l.response_time, 0) / cacheLogs.length)
        : 0;
    const avgChainTime = chainLogs.length > 0 
        ? Math.round(chainLogs.reduce((sum, l) => sum + l.response_time, 0) / chainLogs.length)
        : 0;
    
    // 获取离线凭证统计
    const offlineTokens = OfflineToken.getActiveCount();
    
    return {
        // 设备统计
        deviceStats: {
            total: devices.length,
            active: activeDevices.length,
            revoked: devices.filter(d => d.status === 2).length,
            byType: deviceTypeDistribution
        },
        
        // 性能统计
        performance: {
            avgCacheTime,
            avgChainTime,
            timeSaved: avgChainTime - avgCacheTime,
            improvementPercent: avgChainTime > 0 
                ? Math.round(((avgChainTime - avgCacheTime) / avgChainTime) * 100)
                : 0
        },
        
        // 缓存统计
        cache: {
            totalRequests: cacheHitRate.total || 0,
            cacheHits: cacheHitRate.cached_count || 0,
            cacheMisses: (cacheHitRate.total || 0) - (cacheHitRate.cached_count || 0),
            cacheHitRate: cacheHitRate.cache_hit_rate || 0
        },
        
        // 离线凭证
        offline: {
            activeTokens: offlineTokens
        },
        
        // 最近日志
        recentLogs: logs.slice(0, 20)
    };
}

/**
 * 获取性能历史数据（用于趋势图）
 */
function getPerformanceHistory(hours = 24) {
    const db = require('../models/database').db;
    const endTime = Date.now();
    const startTime = endTime - (hours * 3600000);
    
    const stmt = db.prepare(`
        SELECT
            datetime(created_at / 1000, 'unixepoch') as time,
            ROUND(AVG(CASE WHEN cached = 1 THEN response_time ELSE NULL END), 2) as avg_cache_time,
            ROUND(AVG(CASE WHEN cached = 0 THEN response_time ELSE NULL END), 2) as avg_chain_time,
            COUNT(*) as total_requests,
            SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cache_hits,
            ROUND(SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as hit_rate
        FROM auth_logs
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY strftime('%H', datetime(created_at / 1000, 'unixepoch'))
        ORDER BY time DESC
    `);
    
    return stmt.all(startTime, endTime);
}

/**
 * 批量认证
 */
async function batchAuthenticate(addresses, signatures) {
    const results = [];
    
    for (let i = 0; i < addresses.length; i++) {
        try {
            const result = await authenticate(addresses[i], signatures[i] || '0x00');
            results.push({
                address: addresses[i],
                success: true,
                ...result
            });
        } catch (error) {
            results.push({
                address: addresses[i],
                success: false,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * 批量生成离线凭证
 */
async function batchGenerateOfflineTokens(addresses) {
    const results = [];
    
    for (const address of addresses) {
        try {
            const result = await generateOfflineToken(address);
            results.push({
                address,
                success: true,
                token: result.token,
                expiresAt: result.expiresAt
            });
        } catch (error) {
            results.push({
                address,
                success: false,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * 模拟弱网环境认证
 */
async function simulateWeakNetwork(address, delay = 2000) {
    const startTime = Date.now();
    
    try {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 执行认证
        const result = await authenticate(address);
        
        return {
            success: true,
            simulatedDelay: delay,
            ...result,
            message: `弱网模拟完成 | ${result.message}`
        };
    } catch (error) {
        return {
            success: false,
            simulatedDelay: delay,
            error: error.message
        };
    }
}

/**
 * 获取设备状态监控
 */
function getDeviceStatus() {
    const devices = Device.findAll();
    const now = Date.now();
    
    return devices.map(device => ({
        address: device.address,
        deviceType: DEVICE_TYPES[device.device_type] || 'Unknown',
        status: device.status === 1 ? 'Online' : 'Offline',
        lastAuthAt: device.last_auth_at,
        isOnline: device.status === 1 && 
                   (!device.last_auth_at || (now - device.last_auth_at) < 300000), // 5分钟内有认证记录视为在线
        offlineDuration: device.last_auth_at ? Math.floor((now - device.last_auth_at) / 1000) : null
    }));
}

/**
 * 创建设备分组
 */
function createDeviceGroup(groupName, addresses) {
    const db = require('../models/database').db;
    
    // 创建分组表（如果不存在）
    db.exec(`
        CREATE TABLE IF NOT EXISTS device_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS device_group_members (
            group_id INTEGER NOT NULL,
            device_address TEXT NOT NULL,
            FOREIGN KEY (group_id) REFERENCES device_groups(id),
            FOREIGN KEY (device_address) REFERENCES devices(address),
            PRIMARY KEY (group_id, device_address)
        )
    `);
    
    // 插入分组
    const groupStmt = db.prepare('INSERT OR IGNORE INTO device_groups (name) VALUES (?)');
    const result = groupStmt.run(groupName);
    
    if (result.changes === 0) {
        throw new Error('分组名称已存在');
    }
    
    const groupId = result.lastInsertRowid;
    
    // 添加设备到分组
    const memberStmt = db.prepare('INSERT INTO device_group_members (group_id, device_address) VALUES (?, ?)');
    addresses.forEach(address => {
        memberStmt.run(groupId, address);
    });
    
    return {
        success: true,
        groupId,
        groupName,
        deviceCount: addresses.length
    };
}

/**
 * 获取设备分组列表
 */
function getDeviceGroups() {
    const db = require('../models/database').db;
    
    const groups = db.prepare('SELECT * FROM device_groups ORDER BY created_at DESC').all();
    
    return groups.map(group => {
        const members = db.prepare(`
            SELECT dgm.device_address, d.device_type
            FROM device_group_members dgm
            LEFT JOIN devices d ON dgm.device_address = d.address
            WHERE dgm.group_id = ?
        `).all(group.id);
        
        return {
            id: group.id,
            name: group.name,
            createdAt: group.created_at,
            devices: members.map(m => ({
                address: m.device_address,
                deviceType: DEVICE_TYPES[m.device_type] || 'Unknown'
            }))
        };
    });
}

/**
 * 更新缓存TTL
 */
async function updateCacheTTL(ttl) {
    process.env.CACHE_TTL = ttl.toString();
    await cache.clearAllCache();
    return {
        success: true,
        message: `缓存TTL已更新为 ${ttl} 秒，现有缓存已清空`
    };
}

/**
 * 清空所有缓存
 */
async function clearAllCache() {
    await cache.clearAllCache();
    return {
        success: true,
        message: '所有缓存已清空'
    };
}

/**
 * 触发设备联动场景
 */
async function triggerScenario(scenarioName, triggerDevice) {
    const scenarios = {
        'door_unlock': {
            name: '门锁开启联动',
            triggers: async (address) => {
                // 门锁开启时，触发以下动作
                const actions = [];
                
                // 1. 开启客厅灯光
                const lightDevices = Device.findByType(5); // Light
                if (lightDevices.length > 0) {
                    actions.push({
                        action: 'light_on',
                        devices: lightDevices.map(d => d.address),
                        message: `已开启 ${lightDevices.length} 个灯具`
                    });
                }
                
                // 2. 开启摄像头
                const cameraDevices = Device.findByType(2); // Camera
                if (cameraDevices.length > 0) {
                    actions.push({
                        action: 'camera_record',
                        devices: cameraDevices.map(d => d.address),
                        message: `已启动 ${cameraDevices.length} 个摄像头录像`
                    });
                }
                
                return actions;
            }
        },
        'motion_detected': {
            name: '移动检测联动',
            triggers: async (address) => {
                const actions = [];
                
                // 1. 开启所有灯光
                const lightDevices = Device.findByType(5);
                if (lightDevices.length > 0) {
                    actions.push({
                        action: 'all_lights_on',
                        devices: lightDevices.map(d => d.address),
                        message: `已开启 ${lightDevices.length} 个灯具`
                    });
                }
                
                // 2. 发送通知（模拟）
                actions.push({
                    action: 'send_notification',
                    message: '检测到移动，已发送安全通知'
                });
                
                return actions;
            }
        }
    };
    
    const scenario = scenarios[scenarioName];
    if (!scenario) {
        throw new Error(`场景不存在: ${scenarioName}`);
    }
    
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
    authenticate,
    generateOfflineToken,
    offlineAuth,
    revoke,
    getDeviceInfo,
    getDeviceList,
    verifyDeviceType,
    getAuthStats,
    getDashboardStats,
    getPerformanceHistory,
    batchAuthenticate,
    batchGenerateOfflineTokens,
    simulateWeakNetwork,
    getDeviceStatus,
    createDeviceGroup,
    getDeviceGroups,
    updateCacheTTL,
    clearAllCache,
    triggerScenario,
    DEVICE_TYPES
};
