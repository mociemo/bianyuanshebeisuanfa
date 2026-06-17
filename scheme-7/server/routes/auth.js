const express = require('express');
const router = express.Router();
const auth = require('../services/auth');

router.post('/register', async (req, res) => {
    try {
        const { address, publicKey, deviceType, privateKey } = req.body;
        if (!address || deviceType === undefined) {
            return res.status(400).json({ error: '缺少必要参数: address, deviceType' });
        }
        const result = await auth.register(address, publicKey || address, parseInt(deviceType), privateKey);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/dev/create-and-register', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: '生产环境不可用' });
    }
    try {
        const deviceType = parseInt(req.body.deviceType) || 1;
        const result = await auth.devCreateAndRegister(deviceType);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/nonce/:address', async (req, res) => {
    try {
        const result = await auth.getAuthNonce(req.params.address);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/authenticate', async (req, res) => {
    try {
        const { address, signature, nonce, timestamp, privateKey } = req.body;
        if (!address) return res.status(400).json({ error: '缺少必要参数: address' });
        const result = await auth.authenticate(address, signature,
            nonce !== undefined ? parseInt(nonce) : undefined,
            timestamp !== undefined ? parseInt(timestamp) : undefined,
            privateKey);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

router.post('/verify', async (req, res) => {
    try {
        const { address, signature, nonce, timestamp, privateKey } = req.body;
        if (!address) return res.status(400).json({ error: '缺少必要参数: address' });
        const result = await auth.verifyOnline(address, signature,
            nonce !== undefined ? parseInt(nonce) : undefined,
            timestamp !== undefined ? parseInt(timestamp) : undefined,
            privateKey);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

router.get('/challenge/:address', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const result = await auth.requestOfflineChallenge(req.params.address, forceRefresh);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/warmup/:address', async (req, res) => {
    try {
        const result = await auth.warmupDevice(req.params.address);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.post('/offline-auth', async (req, res) => {
    try {
        const { address, signature, nonce, timestamp, challenge, privateKey } = req.body;
        if (!address || !challenge) return res.status(400).json({ error: '缺少必要参数: address, challenge' });
        const result = await auth.offlineAuth(address, signature, parseInt(nonce), parseInt(timestamp), challenge, privateKey);
        res.json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
});

router.post('/revoke', async (req, res) => {
    try {
        const { address } = req.body;
        if (!address) return res.status(400).json({ error: '缺少必要参数: address' });
        const result = await auth.revoke(address);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/devices', async (req, res) => {
    try {
        const devices = await auth.getDeviceList();
        res.json({ devices });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/device/:address', async (req, res) => {
    try {
        const deviceInfo = await auth.getDeviceInfo(req.params.address);
        res.json(deviceInfo);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

router.post('/verify-type', async (req, res) => {
    try {
        const { address, deviceType } = req.body;
        if (!address || deviceType === undefined) return res.status(400).json({ error: '缺少必要参数: address, deviceType' });
        const result = await auth.verifyDeviceType(address, parseInt(deviceType));
        res.json({ valid: result });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/stats', (req, res) => {
    try { res.json(auth.getAuthStats()); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/dashboard', async (req, res) => {
    try { res.json(await auth.getDashboardStats()); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/performance-history', (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        res.json({ history: auth.getPerformanceHistory(hours) });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/batch-authenticate', async (req, res) => {
    try {
        const { addresses, privateKey } = req.body;
        if (!addresses || !Array.isArray(addresses)) return res.status(400).json({ error: '缺少必要参数: addresses (数组)' });
        res.json({ results: await auth.batchAuthenticate(addresses, { privateKey }) });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/simulate-weak-network', async (req, res) => {
    try {
        const { address, delay, privateKey } = req.body;
        if (!address) return res.status(400).json({ error: '缺少必要参数: address' });
        res.json(await auth.simulateWeakNetwork(address, delay || 2000, privateKey));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/device-status', async (req, res) => {
    try { res.json({ status: await auth.getDeviceStatus() }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/device-group', (req, res) => {
    try {
        const { groupName, addresses } = req.body;
        if (!groupName || !addresses || !Array.isArray(addresses)) return res.status(400).json({ error: '缺少必要参数: groupName, addresses' });
        res.json(auth.createDeviceGroup(groupName, addresses));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/device-groups', async (req, res) => {
    try { res.json({ groups: await auth.getDeviceGroups() }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/clear-memory', (req, res) => {
    try { res.json(auth.clearMemory()); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/trigger-scenario', async (req, res) => {
    try {
        const { scenarioName, triggerDevice } = req.body;
        if (!scenarioName || !triggerDevice) return res.status(400).json({ error: '缺少必要参数: scenarioName, triggerDevice' });
        res.json(await auth.triggerScenario(scenarioName, triggerDevice));
    } catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
