const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');
const ERROR_FILE = path.join(LOG_DIR, 'error.log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志级别
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;

/**
 * 格式化日志消息
 */
function formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}\n`;
}

/**
 * 写入日志到文件
 */
function writeToFile(file, content) {
    fs.appendFile(file, content, (err) => {
        if (err) console.error('写入日志文件失败:', err);
    });
}

/**
 * 记录错误日志
 */
function error(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.ERROR) {
        const content = formatMessage('ERROR', message, meta);
        console.error(content);
        writeToFile(LOG_FILE, content);
        writeToFile(ERROR_FILE, content);
    }
}

/**
 * 记录警告日志
 */
function warn(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.WARN) {
        const content = formatMessage('WARN', message, meta);
        console.warn(content);
        writeToFile(LOG_FILE, content);
    }
}

/**
 * 记录信息日志
 */
function info(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.INFO) {
        const content = formatMessage('INFO', message, meta);
        console.log(content);
        writeToFile(LOG_FILE, content);
    }
}

/**
 * 记录调试日志
 */
function debug(message, meta = {}) {
    if (currentLevel >= LOG_LEVELS.DEBUG) {
        const content = formatMessage('DEBUG', message, meta);
        console.log(content);
        writeToFile(LOG_FILE, content);
    }
}

/**
 * 记录认证日志
 */
function authLog(address, method, success, responseTime, cached = false) {
    info('认证操作', {
        address,
        method,
        success,
        responseTime: `${responseTime}ms`,
        cached: cached ? '是' : '否'
    });
}

/**
 * 记录性能日志
 */
function perfLog(operation, duration, meta = {}) {
    info(`性能指标: ${operation}`, {
        duration: `${duration}ms`,
        ...meta
    });
}

module.exports = {
    error,
    warn,
    info,
    debug,
    authLog,
    perfLog,
    LOG_LEVELS
};
