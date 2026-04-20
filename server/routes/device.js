const express = require('express');
const router = express.Router();
const { Device } = require('../models/database');

/**
 * GET /api/device/list
 * 获取所有设备
 */
router.get('/list', (req, res) => {
    try {
        const devices = Device.findAll();
        res.json({
            total: devices.length,
            devices: devices.map(d => ({
                address: d.address,
                publicKey: d.public_key,
                deviceType: d.device_type,
                status: d.status,
                registeredAt: d.registered_at,
                lastAuthAt: d.last_auth_at
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/device/active
 * 获取活跃设备
 */
router.get('/active', (req, res) => {
    try {
        const devices = Device.findActive();
        res.json({
            total: devices.length,
            devices
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/device/type/:type
 * 按类型查询设备
 */
router.get('/type/:type', (req, res) => {
    try {
        const { type } = req.params;
        const devices = Device.findByType(parseInt(type));
        res.json({
            type: parseInt(type),
            total: devices.length,
            devices
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/device/:address
 * 获取设备详情
 */
router.get('/:address', (req, res) => {
    try {
        const { address } = req.params;
        const device = Device.findByAddress(address);

        if (!device) {
            return res.status(404).json({ error: '设备不存在' });
        }

        res.json(device);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
