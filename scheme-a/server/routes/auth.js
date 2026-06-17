const express = require('express');
const router = express.Router();
const auth = require('../services/auth');

router.post('/register', async (req, res) => {
    try {
        const { address, publicKey, deviceType, privateKey } = req.body;
        if (!address || deviceType === undefined) return res.status(400).json({ error: '缺少必要参数: address, deviceType' });
        res.json(await auth.register(address, publicKey || address, parseInt(deviceType), privateKey));
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/dev/create-and-register', async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: '生产环境不可用' });
    try {
        res.json(await auth.devCreateAndRegister(parseInt(req.body.deviceType) || 1));
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.get('/nonce/:address', async (req, res) => {
    try { res.json(await auth.getAuthNonce(req.params.address)); }
    catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/authenticate', async (req, res) => {
    try {
        const { address, signature, nonce, timestamp, privateKey } = req.body;
        if (!address) return res.status(400).json({ error: '缺少必要参数: address' });
        res.json(await auth.authenticate(address, signature,
            nonce !== undefined ? parseInt(nonce) : undefined,
            timestamp !== undefined ? parseInt(timestamp) : undefined, privateKey));
    } catch (error) { res.status(401).json({ error: error.message }); }
});

router.get('/challenge/:address', async (req, res) => {
    try { res.json(await auth.requestOfflineChallenge(req.params.address, req.query.refresh === 'true')); }
    catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/warmup/:address', async (req, res) => {
    try { res.json(await auth.warmupDevice(req.params.address)); }
    catch (error) { res.status(400).json({ error: error.message }); }
});

router.post('/offline-auth', async (req, res) => {
    try {
        const { address, signature, nonce, timestamp, challenge, privateKey } = req.body;
        if (!address || !challenge) return res.status(400).json({ error: '缺少必要参数: address, challenge' });
        res.json(await auth.offlineAuth(address, signature, parseInt(nonce), parseInt(timestamp), challenge, privateKey));
    } catch (error) { res.status(401).json({ error: error.message }); }
});

router.post('/revoke', async (req, res) => {
    try {
        const { address } = req.body;
        if (!address) return res.status(400).json({ error: '缺少必要参数: address' });
        res.json(await auth.revoke(address));
    } catch (error) { res.status(400).json({ error: error.message }); }
});

router.get('/devices', async (req, res) => {
    try { res.json({ devices: await auth.getDeviceList() }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/device/:address', async (req, res) => {
    try { res.json(await auth.getDeviceInfo(req.params.address)); }
    catch (error) { res.status(404).json({ error: error.message }); }
});

router.get('/dashboard', async (req, res) => {
    try { res.json(await auth.getDashboardStats()); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/clear-memory', async (req, res) => {
    try { res.json(await auth.clearMemory()); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

module.exports = router;
