const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const blockchain = require('./services/blockchain');
const mongodb = require('./services/mongodb');

const { errorHandler, notFoundHandler } = {
    errorHandler: (err, req, res, next) => {
        console.error(`[方案A] 错误:`, err.message);
        res.status(err.statusCode || 500).json({ error: err.message || '服务器内部错误' });
    },
    notFoundHandler: (req, res) => {
        res.status(404).json({ error: `路径 ${req.method} ${req.path} 不存在` });
    }
};

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

async function init() {
    console.log('[方案A] 初始化 MongoDB 连接...');
    await mongodb.connectDB();
    console.log('[方案A] MongoDB 连接成功');
    console.log('[方案A] 初始化区块链连接...');
    try {
        await blockchain.initBlockchain();
        console.log('[方案A] 区块链连接成功');
    } catch (err) {
        console.warn('[方案A] 区块链连接失败:', err.message);
    }
}

app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        architecture: 'hybrid-blockchain-mongodb',
        storage: 'chain-mongodb',
        blockchain: blockchain.isConnected(),
        mongodb: mongodb.isConnected(),
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
    init().then(() => {
        app.listen(PORT, () => {
            console.log(`[方案A] 服务器启动成功 | http://localhost:${PORT}/health`);
        });
    });
}

process.on('SIGTERM', () => { console.log('[方案A] 收到SIGTERM信号'); process.exit(0); });
process.on('SIGINT', () => { console.log('[方案A] 收到SIGINT信号'); process.exit(0); });

module.exports = app;
