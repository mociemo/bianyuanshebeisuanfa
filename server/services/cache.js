const Redis = require('ioredis');
require('dotenv').config();

// Redis配置
const REDIS_CONFIG = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
        if (times > 3) {
            console.error('Redis连接失败，已超过最大重试次数');
            return null;
        }
        return Math.min(times * 200, 2000);
    }
};

// 缓存配置
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300; // 5分钟
const OFFLINE_TOKEN_TTL = parseInt(process.env.OFFLINE_TOKEN_TTL) || 3600; // 1小时

// Redis客户端
let redis = null;
let isConnected = false;

/**
 * 初始化Redis连接
 */
function initRedis() {
    try {
        redis = new Redis(REDIS_CONFIG);

        redis.on('connect', () => {
            console.log('Redis连接成功');
            isConnected = true;
        });

        redis.on('error', (err) => {
            console.error('Redis错误:', err.message);
            isConnected = false;
        });

        redis.on('close', () => {
            console.log('Redis连接关闭');
            isConnected = false;
        });

        return redis;
    } catch (error) {
        console.error('Redis初始化失败:', error.message);
        return null;
    }
}

/**
 * 检查Redis是否可用
 */
function isRedisAvailable() {
    return isConnected && redis !== null;
}

/**
 * 缓存公钥
 * @param {string} address - 设备地址
 * @param {string} publicKey - 公钥
 * @param {number} ttl - 过期时间（秒），默认5分钟
 */
async function cachePublicKey(address, publicKey, ttl = CACHE_TTL) {
    if (!isRedisAvailable()) {
        console.warn('Redis不可用，跳过缓存公钥');
        return false;
    }

    try {
        const key = `pubkey:${address.toLowerCase()}`;
        await redis.setex(key, ttl, publicKey);
        return true;
    } catch (error) {
        console.error('缓存公钥失败:', error.message);
        return false;
    }
}

/**
 * 获取缓存的公钥
 */
async function getCachedPublicKey(address) {
    if (!isRedisAvailable()) {
        return null;
    }

    try {
        const key = `pubkey:${address.toLowerCase()}`;
        return await redis.get(key);
    } catch (error) {
        console.error('获取缓存公钥失败:', error.message);
        return null;
    }
}

/**
 * 缓存认证结果
 * @param {string} address - 设备地址
 * @param {boolean} result - 认证结果
 * @param {number} ttl - 过期时间（秒），默认5分钟
 */
async function cacheAuthResult(address, result, ttl = CACHE_TTL) {
    if (!isRedisAvailable()) {
        return false;
    }

    try {
        const key = `auth:${address.toLowerCase()}`;
        await redis.setex(key, ttl, result ? '1' : '0');
        return true;
    } catch (error) {
        console.error('缓存认证结果失败:', error.message);
        return false;
    }
}

/**
 * 获取缓存的认证结果
 */
async function getCachedAuthResult(address) {
    if (!isRedisAvailable()) {
        return null;
    }

    try {
        const key = `auth:${address.toLowerCase()}`;
        const result = await redis.get(key);
        if (result === null) return null;
        return result === '1';
    } catch (error) {
        console.error('获取缓存认证结果失败:', error.message);
        return null;
    }
}

/**
 * 缓存设备信息
 * @param {string} address - 设备地址
 * @param {object} deviceInfo - 设备信息对象
 * @param {number} ttl - 过期时间（秒），默认5分钟
 */
async function cacheDeviceInfo(address, deviceInfo, ttl = CACHE_TTL) {
    if (!isRedisAvailable()) {
        return false;
    }

    try {
        const key = `device:${address.toLowerCase()}`;
        await redis.setex(key, ttl, JSON.stringify(deviceInfo));
        return true;
    } catch (error) {
        console.error('缓存设备信息失败:', error.message);
        return false;
    }
}

/**
 * 获取缓存的设备信息
 */
async function getCachedDeviceInfo(address) {
    if (!isRedisAvailable()) {
        return null;
    }

    try {
        const key = `device:${address.toLowerCase()}`;
        const data = await redis.get(key);
        if (data === null) return null;
        return JSON.parse(data);
    } catch (error) {
        console.error('获取缓存设备信息失败:', error.message);
        return null;
    }
}

/**
 * 缓存离线认证凭证
 * @param {string} token - 离线凭证
 * @param {object} tokenData - 凭证数据
 */
async function cacheOfflineToken(token, tokenData) {
    if (!isRedisAvailable()) {
        return false;
    }

    try {
        const key = `offline:${token}`;
        await redis.setex(key, OFFLINE_TOKEN_TTL, JSON.stringify(tokenData));
        return true;
    } catch (error) {
        console.error('缓存离线凭证失败:', error.message);
        return false;
    }
}

/**
 * 获取缓存的离线凭证
 */
async function getCachedOfflineToken(token) {
    if (!isRedisAvailable()) {
        return null;
    }

    try {
        const key = `offline:${token}`;
        const data = await redis.get(key);
        if (data === null) return null;
        return JSON.parse(data);
    } catch (error) {
        console.error('获取缓存离线凭证失败:', error.message);
        return null;
    }
}

/**
 * 使设备缓存失效（注销/状态变更时调用）
 * @param {string} address - 设备地址
 */
async function invalidateDevice(address) {
    if (!isRedisAvailable()) {
        return false;
    }

    try {
        const keys = [
            `pubkey:${address.toLowerCase()}`,
            `auth:${address.toLowerCase()}`,
            `device:${address.toLowerCase()}`
        ];
        await redis.del(...keys);
        console.log(`设备缓存已失效: ${address}`);
        return true;
    } catch (error) {
        console.error('清空设备缓存失败:', error.message);
        return false;
    }
}

/**
 * 清空所有缓存
 */
async function clearAllCache() {
    if (!isRedisAvailable()) {
        return false;
    }

    try {
        await redis.flushdb();
        console.log('所有缓存已清空');
        return true;
    } catch (error) {
        console.error('清空缓存失败:', error.message);
        return false;
    }
}

/**
 * 获取缓存统计信息
 */
async function getCacheStats() {
    if (!isRedisAvailable()) {
        return null;
    }

    try {
        const info = await redis.info('stats');
        const keys = await redis.dbsize();

        // 解析stats
        const stats = {};
        info.split('\r\n').forEach(line => {
            const [key, value] = line.split(':');
            if (key && value) {
                stats[key] = value;
            }
        });

        return {
            totalKeys: keys,
            hits: stats.keyspace_hits || 0,
            misses: stats.keyspace_misses || 0,
            hitRate: stats.keyspace_hits && stats.keyspace_misses
                ? (parseInt(stats.keyspace_hits) / (parseInt(stats.keyspace_hits) + parseInt(stats.keyspace_misses)) * 100).toFixed(2)
                : 0
        };
    } catch (error) {
        console.error('获取缓存统计失败:', error.message);
        return null;
    }
}

module.exports = {
    initRedis,
    isRedisAvailable,
    cachePublicKey,
    getCachedPublicKey,
    cacheAuthResult,
    getCachedAuthResult,
    cacheDeviceInfo,
    getCachedDeviceInfo,
    cacheOfflineToken,
    getCachedOfflineToken,
    invalidateDevice,
    clearAllCache,
    getCacheStats,
    CACHE_TTL,
    OFFLINE_TOKEN_TTL
};
