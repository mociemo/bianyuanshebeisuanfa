const mongoose = require('mongoose');
require('dotenv').config();
const { Device, Credential, AuthLog } = require('../models/device');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/scheme-a';

let connected = false;
let mongoServer = null;

async function connectDB() {
    try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
        connected = true;
        console.log('[方案A] MongoDB 连接成功:', MONGODB_URI);
    } catch (err) {
        console.warn('[方案A] 外部 MongoDB 不可用, 启动内存 MongoDB...');
        try {
            const { MongoMemoryServer } = require('mongodb-memory-server');
            mongoServer = await MongoMemoryServer.create();
            const uri = mongoServer.getUri();
            await mongoose.connect(uri);
            connected = true;
            console.log('[方案A] 内存 MongoDB 已启动:', uri);
        } catch (err2) {
            console.error('[方案A] 内存 MongoDB 也启动失败:', err2.message);
            connected = false;
        }
    }
}

function isConnected() { return connected; }

// Device operations
async function findDevice(address) {
    return Device.findOne({ address: address.toLowerCase() });
}

async function upsertDevice(address, info) {
    return Device.findOneAndUpdate(
        { address: address.toLowerCase() }, { $set: info },
        { upsert: true, new: true }
    );
}

async function getNonce(address) {
    const device = await Device.findOne({ address: address.toLowerCase() });
    return device ? device.nonce : 0;
}

async function incrementNonce(address) {
    return Device.findOneAndUpdate(
        { address: address.toLowerCase() },
        { $inc: { nonce: 1 }, $set: { lastAuthAt: new Date() } },
        { new: true }
    );
}

// Credential operations
async function storeCredential(address, credentialHash, ttl = 3600) {
    const expiresAt = new Date(Date.now() + ttl * 1000);
    return Credential.create({ address: address.toLowerCase(), credentialHash, expiresAt });
}

async function consumeCredential(address, credentialHash) {
    const cred = await Credential.findOne({
        address: address.toLowerCase(), credentialHash, used: false,
        expiresAt: { $gt: new Date() }
    });
    if (!cred) return false;
    cred.used = true; await cred.save();
    return true;
}

// Log operations
async function saveAuthLog(address, method, success, responseTime, mode = 'chain') {
    return AuthLog.create({ address: address.toLowerCase(), method, success, responseTime, mode });
}

async function findAuthLogs(limit = 20) {
    return AuthLog.find().sort({ createdAt: -1 }).limit(limit);
}

async function getDeviceStats() {
    const total = await Device.countDocuments({ status: 1 });
    const revoked = await Device.countDocuments({ status: 2 });
    const byType = await Device.aggregate([
        { $match: { status: 1 } }, { $group: { _id: '$deviceType', count: { $sum: 1 } } }
    ]);
    const typeMap = {};
    byType.forEach(t => { typeMap[t._id] = t.count; });
    return { total, active: total, revoked, byType: typeMap };
}

async function getAllDevices() {
    return Device.find({ status: { $in: [1, 2] } });
}

async function clearAll() {
    await Credential.deleteMany({});
    await AuthLog.deleteMany({});
    return { success: true };
}

module.exports = {
    connectDB, isConnected,
    findDevice, upsertDevice, getNonce, incrementNonce,
    storeCredential, consumeCredential,
    saveAuthLog, findAuthLogs, getDeviceStats,
    getAllDevices, clearAll
};
