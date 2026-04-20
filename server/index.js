const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const { initDatabase } = require('./models/database');
const blockchain = require('./services/blockchain');
const cache = require('./services/cache');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./utils/errors');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保数据目录存在
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 请求日志中间件
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP请求', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip
        });
    });
    next();
});

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// 初始化数据库
logger.info('初始化数据库...');
initDatabase();
logger.info('数据库初始化完成');

// 初始化Redis
logger.info('初始化Redis连接...');
cache.initRedis();

// 初始化区块链
logger.info('初始化区块链连接...');
blockchain.initBlockchain().then(() => {
    logger.info('区块链连接成功');
}).catch(err => {
    logger.warn('区块链连接失败，将使用本地模式', { error: err.message });
});

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);

// 根路径重定向到首页
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 健康检查
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    };
    res.json(health);
});

// 404处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
    logger.info(`服务器启动成功`, {
        port: PORT,
        url: `http://localhost:${PORT}`,
        health: `http://localhost:${PORT}/health`,
        environment: process.env.NODE_ENV || 'development'
    });
});

// 优雅关闭
process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号,开始优雅关闭...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('收到SIGINT信号,开始优雅关闭...');
    process.exit(0);
});

module.exports = app;
