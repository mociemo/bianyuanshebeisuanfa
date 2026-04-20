const express = require('express');
const router = express.Router();
const auth = require('../services/auth');

/**
 * POST /api/auth/register
 * 注册设备
 * Body: { address, publicKey, deviceType }
 */
router.post('/register', async (req, res) => {
    try {
        const { address, publicKey, deviceType } = req.body;

        if (!address || !publicKey || deviceType === undefined) {
            return res.status(400).json({
                error: '缺少必要参数: address, publicKey, deviceType'
            });
        }

        const result = await auth.register(address, publicKey, parseInt(deviceType));
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/auth/authenticate
 * 认证设备
 * Body: { address, signature? }
 */
router.post('/authenticate', async (req, res) => {
    try {
        const { address, signature } = req.body;

        if (!address) {
            return res.status(400).json({ error: '缺少必要参数: address' });
        }

        const result = await auth.authenticate(address, signature);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/auth/revoke
 * 注销设备
 * Body: { address }
 */
router.post('/revoke', async (req, res) => {
    try {
        const { address } = req.body;

        if (!address) {
            return res.status(400).json({ error: '缺少必要参数: address' });
        }

        const result = await auth.revoke(address);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/auth/offline-token
 * 生成离线凭证
 * Body: { address }
 */
router.post('/offline-token', async (req, res) => {
    try {
        const { address } = req.body;

        if (!address) {
            return res.status(400).json({ error: '缺少必要参数: address' });
        }

        const result = await auth.generateOfflineToken(address);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /api/auth/offline-auth
 * 离线认证
 * Body: { token }
 */
router.post('/offline-auth', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: '缺少必要参数: token' });
        }

        const result = await auth.offlineAuth(token);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

/**
 * GET /api/auth/devices
 * 获取设备列表
 */
router.get('/devices', (req, res) => {
    try {
        const devices = auth.getDeviceList();
        res.json({ devices });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/device/:address
 * 获取设备信息
 */
router.get('/device/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const deviceInfo = await auth.getDeviceInfo(address);
        res.json(deviceInfo);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

/**
 * POST /api/auth/verify-type
 * 验证设备类型
 * Body: { address, deviceType }
 */
router.post('/verify-type', async (req, res) => {
    try {
        const { address, deviceType } = req.body;

        if (!address || deviceType === undefined) {
            return res.status(400).json({
                error: '缺少必要参数: address, deviceType'
            });
        }

        const result = await auth.verifyDeviceType(address, parseInt(deviceType));
        res.json({ valid: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * GET /api/auth/stats
 * 获取认证统计
 */
router.get('/stats', (req, res) => {
    try {
        const stats = auth.getAuthStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/dashboard
 * 获取仪表盘详细统计数据
 */
router.get('/dashboard', (req, res) => {
    try {
        const stats = auth.getDashboardStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/performance-history
 * 获取性能历史数据（用于趋势图）
 */
router.get('/performance-history', (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const history = auth.getPerformanceHistory(hours);
        res.json({ history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/batch-authenticate
 * 批量认证
 */
router.post('/batch-authenticate', async (req, res) => {
    try {
        const { addresses, signatures } = req.body;
        
        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: '缺少必要参数: addresses (数组)' });
        }

        const results = await auth.batchAuthenticate(addresses, signatures || []);
        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/batch-offline-tokens
 * 批量生成离线凭证
 */
router.post('/batch-offline-tokens', async (req, res) => {
    try {
        const { addresses } = req.body;
        
        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: '缺少必要参数: addresses (数组)' });
        }

        const results = await auth.batchGenerateOfflineTokens(addresses);
        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/simulate-weak-network
 * 模拟弱网环境认证
 */
router.post('/simulate-weak-network', async (req, res) => {
    try {
        const { address, delay } = req.body;
        
        if (!address) {
            return res.status(400).json({ error: '缺少必要参数: address' });
        }

        const result = await auth.simulateWeakNetwork(address, delay || 2000);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/device-status
 * 获取设备状态监控
 */
router.get('/device-status', (req, res) => {
    try {
        const status = auth.getDeviceStatus();
        res.json({ status });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/device-group
 * 创建设备分组
 */
router.post('/device-group', async (req, res) => {
    try {
        const { groupName, addresses } = req.body;
        
        if (!groupName || !addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: '缺少必要参数: groupName, addresses' });
        }

        const result = await auth.createDeviceGroup(groupName, addresses);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/auth/device-groups
 * 获取设备分组列表
 */
router.get('/device-groups', (req, res) => {
    try {
        const groups = auth.getDeviceGroups();
        res.json({ groups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/update-cache-ttl
 * 更新缓存TTL配置
 */
router.post('/update-cache-ttl', async (req, res) => {
    try {
        const { ttl } = req.body;
        
        if (!ttl || isNaN(ttl)) {
            return res.status(400).json({ error: '缺少必要参数: ttl (数字)' });
        }

        const result = await auth.updateCacheTTL(parseInt(ttl));
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/clear-cache
 * 清空所有缓存
 */
router.post('/clear-cache', async (req, res) => {
    try {
        const result = await auth.clearAllCache();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/auth/trigger-scenario
 * 触发设备联动场景
 */
router.post('/trigger-scenario', async (req, res) => {
    try {
        const { scenarioName, triggerDevice } = req.body;
        
        if (!scenarioName || !triggerDevice) {
            return res.status(400).json({ error: '缺少必要参数: scenarioName, triggerDevice' });
        }

        const result = await auth.triggerScenario(scenarioName, triggerDevice);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
