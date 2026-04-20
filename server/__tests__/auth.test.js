const request = require('supertest');
const app = require('../index');
const db = require('../models/database').db;

describe('认证API测试', () => {
    let testAddress = '0x1234567890123456789012345678901234567890';
    let testSignature = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    beforeAll(() => {
        // 清理测试数据
        db.prepare('DELETE FROM devices WHERE address = ?').run(testAddress);
    });

    afterAll(() => {
        // 清理测试数据
        db.prepare('DELETE FROM devices WHERE address = ?').run(testAddress);
    });

    describe('POST /api/auth/register', () => {
        test('应该成功注册设备', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    address: testAddress,
                    publicKey: '0xTestPublicKey',
                    deviceType: 1
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('address');
        });

        test('缺少address参数应该返回400', async () => {
            const response = await request(app)
                .post('/api/auth/register')
                .send({
                    deviceType: 1
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });

        test('重复注册应该返回错误', async () => {
            // 第一次注册
            await request(app)
                .post('/api/auth/register')
                .send({ address: testAddress, publicKey: '0xTestPublicKey', deviceType: 1 });

            // 第二次注册
            const response = await request(app)
                .post('/api/auth/register')
                .send({ address: testAddress, publicKey: '0xTestPublicKey', deviceType: 1 });

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/auth/authenticate', () => {
        test('应该成功认证设备', async () => {
            const response = await request(app)
                .post('/api/auth/authenticate')
                .send({
                    address: testAddress,
                    signature: testSignature
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message');
        });

        test('未注册的设备认证应该失败', async () => {
            const response = await request(app)
                .post('/api/auth/authenticate')
                .send({
                    address: '0x0000000000000000000000000000000000000000',
                    signature: testSignature
                });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/auth/dashboard', () => {
        test('应该返回仪表盘统计数据', async () => {
            const response = await request(app)
                .get('/api/auth/dashboard');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('deviceStats');
            expect(response.body).toHaveProperty('performance');
            expect(response.body).toHaveProperty('cache');
        });
    });

    describe('GET /health', () => {
        test('应该返回健康状态', async () => {
            const response = await request(app)
                .get('/health');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'ok');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
        });
    });
});
