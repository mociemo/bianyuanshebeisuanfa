require('dotenv').config();

const PUBKEY_TTL = parseInt(process.env.PUBKEY_TTL) || 3600;
const OFFLINE_WINDOW = parseInt(process.env.OFFLINE_TIMESTAMP_WINDOW) || 60;
const CHALLENGE_TTL = parseInt(process.env.CHALLENGE_TTL) || 300;

/** @type {Map<string, object>} */
const pubkeyCache = new Map();

/** @type {Map<string, number>} */
const offlineNonce = new Map();

/** @type {Map<string, object>} */
const challenges = new Map();

/** @type {Set<string>} */
const knownDevices = new Set();

/** @type {Array<object>} */
const sessionLogs = [];

/** @type {Map<string, object>} */
const deviceGroups = new Map();

/** @type {Array<object>} */
const perfBuckets = new Map();

let groupIdCounter = 1;

function cachePublicKey(address, info) {
    const normalized = address.toLowerCase();
    pubkeyCache.set(normalized, {
        ...info,
        address: normalized,
        fetchedAt: Date.now()
    });
    knownDevices.add(normalized);
}

function getCachedPublicKey(address) {
    const normalized = address.toLowerCase();
    const entry = pubkeyCache.get(normalized);
    if (!entry) return null;

    if (Date.now() - entry.fetchedAt > PUBKEY_TTL * 1000) {
        return { ...entry, expired: true };
    }
    return { ...entry, expired: false };
}

function invalidatePublicKey(address) {
    const normalized = address.toLowerCase();
    pubkeyCache.delete(normalized);
    offlineNonce.delete(normalized);
    challenges.delete(normalized);
}

function setChallenge(address, challenge) {
    const normalized = address.toLowerCase();
    challenges.set(normalized, {
        challenge,
        expiresAt: Date.now() + CHALLENGE_TTL * 1000
    });
    return challenge;
}

function getChallenge(address) {
    const normalized = address.toLowerCase();
    const entry = challenges.get(normalized);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        challenges.delete(normalized);
        return null;
    }
    return entry.challenge;
}

function consumeChallenge(address, challenge) {
    const normalized = address.toLowerCase();
    const stored = getChallenge(normalized);
    if (!stored || stored !== challenge) return false;
    challenges.delete(normalized);
    return true;
}

function checkOfflineNonce(address, nonce) {
    const normalized = address.toLowerCase();
    const last = offlineNonce.get(normalized) || 0;
    if (nonce <= last) return false;
    offlineNonce.set(normalized, nonce);
    return true;
}

function addKnownDevice(address) {
    knownDevices.add(address.toLowerCase());
}

function getKnownDevices() {
    return Array.from(knownDevices);
}

function logAuth(deviceAddress, method, success, responseTime, mode = 'chain') {
    const entry = {
        device_address: deviceAddress,
        method,
        success: success ? 1 : 0,
        response_time: responseTime,
        mode,
        created_at: Date.now()
    };
    sessionLogs.unshift(entry);
    if (sessionLogs.length > 500) sessionLogs.pop();

    const hourKey = new Date().toISOString().slice(0, 13);
    if (!perfBuckets.has(hourKey)) {
        perfBuckets.set(hourKey, {
            time: hourKey,
            chain_requests: 0,
            offline_requests: 0,
            chain_total_time: 0,
            offline_total_time: 0
        });
    }
    const bucket = perfBuckets.get(hourKey);
    if (mode === 'offline') {
        bucket.offline_requests++;
        bucket.offline_total_time += responseTime;
    } else {
        bucket.chain_requests++;
        bucket.chain_total_time += responseTime;
    }
}

function getSessionLogs(limit = 20) {
    return sessionLogs.slice(0, limit);
}

function getPerfHistory(hours = 24) {
    const cutoff = Date.now() - hours * 3600000;
    return Array.from(perfBuckets.values())
        .filter((b) => new Date(b.time + ':00:00.000Z').getTime() >= cutoff)
        .map((b) => ({
            time: b.time,
            avg_chain_time: b.chain_requests
                ? Math.round(b.chain_total_time / b.chain_requests)
                : 0,
            avg_offline_time: b.offline_requests
                ? Math.round(b.offline_total_time / b.offline_requests)
                : 0,
            total_requests: b.chain_requests + b.offline_requests,
            chain_requests: b.chain_requests,
            offline_requests: b.offline_requests
        }))
        .sort((a, b) => a.time.localeCompare(b.time));
}

function getMemoryStats() {
    const logs = sessionLogs;
    const chainLogs = logs.filter((l) => l.mode === 'chain' && l.success);
    const offlineLogs = logs.filter((l) => l.mode === 'offline' && l.success);

    return {
        pubkeyCached: pubkeyCache.size,
        knownDevices: knownDevices.size,
        offlineNonceTracked: offlineNonce.size,
        activeChallenges: challenges.size,
        totalRequests: logs.length,
        chainRequests: chainLogs.length,
        offlineRequests: offlineLogs.length,
        avgChainTime: chainLogs.length
            ? Math.round(chainLogs.reduce((s, l) => s + l.response_time, 0) / chainLogs.length)
            : 0,
        avgOfflineTime: offlineLogs.length
            ? Math.round(offlineLogs.reduce((s, l) => s + l.response_time, 0) / offlineLogs.length)
            : 0
    };
}

function createDeviceGroup(groupName, addresses) {
    if (deviceGroups.has(groupName)) {
        throw new Error('分组名称已存在');
    }
    const id = groupIdCounter++;
    const group = {
        id,
        name: groupName,
        addresses: addresses.map((a) => a.toLowerCase()),
        createdAt: Date.now()
    };
    deviceGroups.set(groupName, group);
    return group;
}

function getDeviceGroups() {
    return Array.from(deviceGroups.values());
}

function clearMemory() {
    pubkeyCache.clear();
    offlineNonce.clear();
    challenges.clear();
}

function getOfflineWindow() {
    return OFFLINE_WINDOW;
}

function getPubkeyTtl() {
    return PUBKEY_TTL;
}

module.exports = {
    cachePublicKey,
    getCachedPublicKey,
    invalidatePublicKey,
    setChallenge,
    getChallenge,
    consumeChallenge,
    checkOfflineNonce,
    addKnownDevice,
    getKnownDevices,
    logAuth,
    getSessionLogs,
    getPerfHistory,
    getMemoryStats,
    createDeviceGroup,
    getDeviceGroups,
    clearMemory,
    getOfflineWindow,
    getPubkeyTtl
};
