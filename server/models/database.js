const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/auth.db');

// 确保数据目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

/**
 * 初始化数据库表
 */
function initDatabase() {
    // 设备表
    db.exec(`
        CREATE TABLE IF NOT EXISTS devices (
            address TEXT PRIMARY KEY,
            public_key TEXT NOT NULL,
            device_type INTEGER NOT NULL DEFAULT 0,
            status INTEGER NOT NULL DEFAULT 1,
            registered_at INTEGER NOT NULL,
            last_auth_at INTEGER,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);

    // 离线凭证表
    db.exec(`
        CREATE TABLE IF NOT EXISTS offline_tokens (
            id TEXT PRIMARY KEY,
            device_address TEXT NOT NULL,
            token TEXT NOT NULL,
            issued_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            used_at INTEGER,
            created_at INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (device_address) REFERENCES devices(address)
        )
    `);

    // 认证日志表
    db.exec(`
        CREATE TABLE IF NOT EXISTS auth_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_address TEXT NOT NULL,
            method TEXT NOT NULL,
            success INTEGER NOT NULL,
            response_time INTEGER,
            cached INTEGER DEFAULT 0,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);

    // 创建索引
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
        CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
        CREATE INDEX IF NOT EXISTS idx_offline_tokens_device ON offline_tokens(device_address);
        CREATE INDEX IF NOT EXISTS idx_offline_tokens_expires ON offline_tokens(expires_at);
        CREATE INDEX IF NOT EXISTS idx_auth_logs_device ON auth_logs(device_address);
    `);

    console.log('数据库初始化完成');
}

/**
 * 设备模型
 */
const Device = {
    /**
     * 创建设备
     */
    create(address, publicKey, deviceType) {
        const stmt = db.prepare(`
            INSERT INTO devices (address, public_key, device_type, status, registered_at)
            VALUES (?, ?, ?, 1, ?)
        `);
        return stmt.run(address, publicKey, deviceType, Date.now());
    },

    /**
     * 根据地址查询设备
     */
    findByAddress(address) {
        const stmt = db.prepare('SELECT * FROM devices WHERE address = ?');
        return stmt.get(address);
    },

    /**
     * 查询所有设备
     */
    findAll() {
        const stmt = db.prepare('SELECT * FROM devices ORDER BY registered_at DESC');
        return stmt.all();
    },

    /**
     * 查询有效设备
     */
    findActive() {
        const stmt = db.prepare('SELECT * FROM devices WHERE status = 1 ORDER BY registered_at DESC');
        return stmt.all();
    },

    /**
     * 按类型查询设备
     */
    findByType(deviceType) {
        const stmt = db.prepare('SELECT * FROM devices WHERE device_type = ? AND status = 1');
        return stmt.all(deviceType);
    },

    /**
     * 更新设备状态
     */
    updateStatus(address, status) {
        const stmt = db.prepare(`
            UPDATE devices SET status = ?, updated_at = ? WHERE address = ?
        `);
        return stmt.run(status, Date.now(), address);
    },

    /**
     * 更新最后认证时间
     */
    updateLastAuth(address) {
        const stmt = db.prepare(`
            UPDATE devices SET last_auth_at = ?, updated_at = ? WHERE address = ?
        `);
        return stmt.run(Date.now(), Date.now(), address);
    }
};

/**
 * 离线凭证模型
 */
const OfflineToken = {
    /**
     * 创建离线凭证
     */
    create(id, deviceAddress, token, expiresAt) {
        const stmt = db.prepare(`
            INSERT INTO offline_tokens (id, device_address, token, issued_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(id, deviceAddress, token, Date.now(), expiresAt);
    },

    /**
     * 验证离线凭证
     */
    verify(token) {
        const stmt = db.prepare(`
            SELECT * FROM offline_tokens
            WHERE token = ? AND expires_at > ? AND used_at IS NULL
        `);
        return stmt.get(token, Date.now());
    },

    /**
     * 使用离线凭证
     */
    markUsed(id) {
        const stmt = db.prepare(`
            UPDATE offline_tokens SET used_at = ? WHERE id = ?
        `);
        return stmt.run(Date.now(), id);
    },

    /**
     * 删除设备的所有离线凭证
     */
    deleteByDevice(deviceAddress) {
        const stmt = db.prepare('DELETE FROM offline_tokens WHERE device_address = ?');
        return stmt.run(deviceAddress);
    },

    /**
     * 清理过期凭证
     */
    cleanup() {
        const stmt = db.prepare('DELETE FROM offline_tokens WHERE expires_at < ?');
        return stmt.run(Date.now());
    },

    /**
     * 获取有效离线凭证数量
     */
    getActiveCount() {
        const stmt = db.prepare(`
            SELECT COUNT(*) as count
            FROM offline_tokens
            WHERE expires_at > ? AND used_at IS NULL
        `);
        return stmt.get(Date.now()).count;
    }
};

/**
 * 认证日志模型
 */
const AuthLog = {
    /**
     * 记录认证日志
     */
    log(deviceAddress, method, success, responseTime, cached = false) {
        const stmt = db.prepare(`
            INSERT INTO auth_logs (device_address, method, success, response_time, cached)
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(deviceAddress, method, success ? 1 : 0, responseTime, cached ? 1 : 0);
    },

    /**
     * 查询设备认证历史
     */
    findByDevice(deviceAddress, limit = 100) {
        const stmt = db.prepare(`
            SELECT * FROM auth_logs
            WHERE device_address = ?
            ORDER BY created_at DESC
            LIMIT ?
        `);
        return stmt.all(deviceAddress, limit);
    },

    /**
     * 获取缓存命中率
     */
    getCacheStats() {
        const stmt = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cached_count,
                ROUND(SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as cache_hit_rate
            FROM auth_logs
            WHERE created_at > ?
        `);
        const oneHourAgo = Date.now() - 3600000;
        return stmt.get(oneHourAgo);
    },

    /**
     * 获取最近的认证日志
     */
    getRecentLogs(limit = 100) {
        const stmt = db.prepare(`
            SELECT
                device_address,
                method,
                success,
                response_time,
                cached,
                created_at
            FROM auth_logs
            ORDER BY created_at DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }
};

module.exports = {
    db,
    initDatabase,
    Device,
    OfflineToken,
    AuthLog
};
