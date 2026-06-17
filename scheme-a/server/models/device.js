const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    address:      { type: String, required: true, unique: true, lowercase: true, index: true },
    publicKey:    { type: String, required: true },
    deviceType:   { type: Number, required: true, min: 1, max: 6 },
    status:       { type: Number, default: 1 },
    nonce:        { type: Number, default: 0 },
    registeredAt: { type: Date, default: Date.now },
    lastAuthAt:   { type: Date }
});

const credentialSchema = new mongoose.Schema({
    address:        { type: String, required: true, index: true },
    credentialHash: { type: String, required: true, unique: true },
    expiresAt:      { type: Date, required: true },
    used:           { type: Boolean, default: false }
});

const authLogSchema = new mongoose.Schema({
    address:      { type: String, required: true, index: true },
    method:       { type: String, required: true },
    success:      { type: Boolean, default: false },
    responseTime: { type: Number },
    mode:         { type: String, default: 'chain' },
    createdAt:    { type: Date, default: Date.now }
});

const Device = mongoose.model('Device', deviceSchema);
const Credential = mongoose.model('Credential', credentialSchema);
const AuthLog = mongoose.model('AuthLog', authLogSchema);

module.exports = { Device, Credential, AuthLog };
