const express = require('express');
const router = express.Router();
const auth = require('../services/auth');
const blockchain = require('../services/blockchain');

router.get('/list', async (req, res) => {
    try { const devices = await auth.getDeviceList(); res.json({ total: devices.length, devices }); }
    catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/active', async (req, res) => {
    try {
        const devices = (await auth.getDeviceList()).filter(d => d.status === 'Active');
        res.json({ total: devices.length, devices });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/:address', async (req, res) => {
    try { res.json(await auth.getDeviceInfo(req.params.address)); }
    catch (error) { res.status(404).json({ error: error.message }); }
});

router.get('/chain/status', (req, res) => {
    res.json({ connected: blockchain.isConnected(), contractAddress: process.env.CONTRACT_ADDRESS || null });
});

module.exports = router;
