class AppError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.statusCode = statusCode; this.code = code; this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, field = null) { super(message, 400, 'VALIDATION_ERROR'); this.field = field; }
}

class AuthenticationError extends AppError {
    constructor(message = '认证失败') { super(message, 401, 'AUTHENTICATION_ERROR'); }
}

class BlockchainError extends AppError {
    constructor(message = '区块链操作失败') { super(message, 500, 'BLOCKCHAIN_ERROR'); }
}

class DeviceError extends AppError {
    constructor(message = '设备操作失败') { super(message, 400, 'DEVICE_ERROR'); }
}

function errorHandler(err, req, res, next) {
    const logger = require('./logger');
    if (err.isOperational) {
        logger.warn(err.message, { statusCode: err.statusCode, code: err.code, path: req.path });
    } else {
        logger.error('未处理的错误', { message: err.message, stack: err.stack, path: req.path });
    }
    res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code || 'INTERNAL_ERROR', message: err.message || '服务器内部错误',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) }
    });
}

function notFoundHandler(req, res) {
    const logger = require('./logger');
    logger.warn('404 Not Found', { path: req.path, method: req.method });
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `路径 ${req.method} ${req.path} 不存在` } });
}

function asyncHandler(fn) {
    return (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };
}

module.exports = { AppError, ValidationError, AuthenticationError, BlockchainError, DeviceError, errorHandler, notFoundHandler, asyncHandler };
