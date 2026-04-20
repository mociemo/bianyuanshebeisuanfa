/**
 * 自定义错误类
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 验证错误
 */
class ValidationError extends AppError {
    constructor(message, field = null) {
        super(message, 400, 'VALIDATION_ERROR');
        this.field = field;
    }
}

/**
 * 认证错误
 */
class AuthenticationError extends AppError {
    constructor(message = '认证失败') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

/**
 * 区块链错误
 */
class BlockchainError extends AppError {
    constructor(message = '区块链操作失败') {
        super(message, 500, 'BLOCKCHAIN_ERROR');
    }
}

/**
 * 数据库错误
 */
class DatabaseError extends AppError {
    constructor(message = '数据库操作失败') {
        super(message, 500, 'DATABASE_ERROR');
    }
}

/**
 * 缓存错误
 */
class CacheError extends AppError {
    constructor(message = '缓存操作失败') {
        super(message, 500, 'CACHE_ERROR');
    }
}

/**
 * 设备错误
 */
class DeviceError extends AppError {
    constructor(message = '设备操作失败') {
        super(message, 400, 'DEVICE_ERROR');
    }
}

/**
 * 错误处理中间件
 */
function errorHandler(err, req, res, next) {
    const logger = require('./logger');

    // 记录错误
    if (err.isOperational) {
        logger.warn(err.message, {
            statusCode: err.statusCode,
            code: err.code,
            path: req.path
        });
    } else {
        logger.error('未处理的错误', {
            message: err.message,
            stack: err.stack,
            path: req.path
        });
    }

    // 返回错误响应
    res.status(err.statusCode || 500).json({
        success: false,
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: err.message || '服务器内部错误',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
}

/**
 * 404处理中间件
 */
function notFoundHandler(req, res) {
    const logger = require('./logger');
    
    logger.warn('404 Not Found', {
        path: req.path,
        method: req.method
    });

    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `路径 ${req.method} ${req.path} 不存在`
        }
    });
}

/**
 * 异步错误包装器
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    BlockchainError,
    DatabaseError,
    CacheError,
    DeviceError,
    errorHandler,
    notFoundHandler,
    asyncHandler
};
