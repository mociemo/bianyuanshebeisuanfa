const { Web3 } = require('web3');

const web3 = new Web3();
const AUTH_ACTION = 'authenticate';

function buildAuthMessageHash(address, nonce, timestamp, challenge = '') {
    // web3.utils.soliditySha3 在 v4.x 中的编码行为与 abi.encode 不完全一致。
    // 必须使用 encodeParameters + keccak256 才能精确匹配 Solidity 的 keccak256(abi.encode(...))。
    const encoded = web3.eth.abi.encodeParameters(
        ['address', 'uint256', 'uint256', 'string', 'string'],
        [address, String(nonce), String(timestamp), challenge || '', AUTH_ACTION]
    );
    return web3.utils.keccak256(encoded);
}

function verifySignature(address, nonce, timestamp, challenge, signature) {
    try {
        const messageHash = buildAuthMessageHash(address, nonce, timestamp, challenge);
        const recovered = web3.eth.accounts.recover(messageHash, signature);
        return recovered.toLowerCase() === address.toLowerCase();
    } catch { return false; }
}

function signAuthMessage(privateKey, address, nonce, timestamp, challenge = '') {
    const messageHash = buildAuthMessageHash(address, nonce, timestamp, challenge);
    console.log('[方案7] JS端签名参数:', {
        address, nonce: String(nonce), timestamp: String(timestamp),
        challenge: challenge || '', action: AUTH_ACTION,
        messageHash
    });
    return web3.eth.accounts.sign(messageHash, privateKey);
}

function generateChallenge() { return web3.utils.randomHex(32); }

module.exports = { AUTH_ACTION, buildAuthMessageHash, verifySignature, signAuthMessage, generateChallenge, getWeb3: () => web3 };
