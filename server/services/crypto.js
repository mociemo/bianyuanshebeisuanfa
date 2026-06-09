const { Web3 } = require('web3');

const web3 = new Web3();
const AUTH_ACTION = 'authenticate';

/**
 * 构建认证消息哈希（与合约 abi.encodePacked 一致）
 */
function buildAuthMessageHash(address, nonce, timestamp, challenge = '') {
    return web3.utils.soliditySha3(
        { type: 'address', value: address },
        { type: 'uint256', value: String(nonce) },
        { type: 'uint256', value: String(timestamp) },
        { type: 'string', value: challenge || '' },
        { type: 'string', value: AUTH_ACTION }
    );
}

/**
 * 验证 ECDSA 签名
 */
function verifySignature(address, nonce, timestamp, challenge, signature) {
    try {
        const messageHash = buildAuthMessageHash(address, nonce, timestamp, challenge);
        const recovered = web3.eth.accounts.recover(messageHash, signature);
        return recovered.toLowerCase() === address.toLowerCase();
    } catch {
        return false;
    }
}

/**
 * 使用私钥签名认证消息
 */
function signAuthMessage(privateKey, address, nonce, timestamp, challenge = '') {
    const messageHash = buildAuthMessageHash(address, nonce, timestamp, challenge);
    return web3.eth.accounts.sign(messageHash, privateKey);
}

/**
 * 生成随机 challenge（离线认证用）
 */
function generateChallenge() {
    return web3.utils.randomHex(32);
}

module.exports = {
    AUTH_ACTION,
    buildAuthMessageHash,
    verifySignature,
    signAuthMessage,
    generateChallenge,
    getWeb3: () => web3
};
