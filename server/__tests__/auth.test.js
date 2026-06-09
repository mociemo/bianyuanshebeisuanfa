const request = require('supertest');
const app = require('../index');
const memoryStore = require('../services/memoryStore');

describe('全去中心化认证 API', () => {
    beforeEach(() => {
        memoryStore.clearMemory();
    });

    describe('GET /health', () => {
        test('应返回健康状态与架构信息', async () => {
            const response = await request(app).get('/health');
            expect(response.status).toBe(200);
            expect(response.body.status).toBe('ok');
            expect(response.body.architecture).toBe('fully-decentralized');
            expect(response.body.storage).toBe('blockchain-only');
        });
    });

    describe('GET /api/auth/dashboard', () => {
        test('应返回仪表盘数据', async () => {
            const response = await request(app).get('/api/auth/dashboard');
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('deviceStats');
            expect(response.body).toHaveProperty('memory');
            expect(response.body.architecture).toBe('fully-decentralized');
        });
    });

    describe('POST /api/auth/clear-memory', () => {
        test('应清空边缘内存', async () => {
            const response = await request(app).post('/api/auth/clear-memory');
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('POST /api/auth/offline-auth', () => {
        test('未预热公钥时应拒绝离线认证', async () => {
            const response = await request(app)
                .post('/api/auth/offline-auth')
                .send({
                    address: '0x1234567890123456789012345678901234567890',
                    nonce: 1,
                    timestamp: Math.floor(Date.now() / 1000),
                    challenge: '0xabc',
                    signature: '0x00'
                });
            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/auth/register', () => {
        test('区块链未连接时应返回错误', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    address: '0x1234567890123456789012345678901234567890',
                    deviceType: 1
                });
            expect([400, 401]).toContain(response.status);
            expect(response.body).toHaveProperty('error');
        });
    });
});
