const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const blockchain = require('./services/blockchain');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./utils/errors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        logger.info('HTTP请求', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: `${Date.now() - start}ms`,
            ip: req.ip
        });
    });
    next();
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

logger.info('初始化区块链连接（链上为唯一持久化存储）...');

async function initServices() {
    try {
        await blockchain.initBlockchain();
        logger.info('区块链连接成功');
    } catch (err) {
        logger.warn('区块链连接失败，离线验签模式可用（需已预热公钥）', { error: err.message });
    }
}

app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        architecture: 'fully-decentralized',
        storage: 'blockchain-only',
        edgeCache: 'memory-ephemeral',
        blockchain: blockchain.isConnected(),
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
    initServices().then(() => {
        app.listen(PORT, () => {
            logger.info('服务器启动成功', {
                port: PORT,
                url: `http://localhost:${PORT}`,
                health: `http://localhost:${PORT}/health`
            });
        });
    });
}

process.on('SIGTERM', () => {
    logger.info('收到SIGTERM信号,开始优雅关闭...');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('收到SIGINT信号,开始优雅关闭...');
    process.exit(0);
});

module.exports = app;
