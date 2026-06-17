#!/usr/bin/env node
const { Web3 } = require('web3');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const crypto = require('../server/services/crypto');

const C = {
    reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
    green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m',
    red: '\x1b[31m', magenta: '\x1b[35m', blue: '\x1b[34m'
};

const DEVICE_TYPES = { 1: 'DoorLock', 2: 'Camera', 3: 'Sensor', 4: 'Thermostat', 5: 'Light', 6: 'Appliance' };

const AUTHENTICATE_ABI = [{
    inputs: [
        { internalType: 'address', name: 'deviceAddress', type: 'address' },
        { internalType: 'uint256', name: 'nonce', type: 'uint256' },
        { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
        { internalType: 'string', name: 'challenge', type: 'string' },
        { internalType: 'bytes', name: 'signature', type: 'bytes' }
    ],
    name: 'authenticate', outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable', type: 'function'
}];

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        apiBase: process.env.API_BASE || `http://localhost:${process.env.PORT || 3000}`,
        deviceType: parseInt(process.env.DEVICE_TYPE || '1', 10),
        blockchainUrl: process.env.BLOCKCHAIN_URL || 'http://127.0.0.1:8545',
        contractAddress: process.env.CONTRACT_ADDRESS || '', skipFund: false
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--api' && args[i + 1]) opts.apiBase = args[++i].replace(/\/$/, '');
        else if (args[i] === '--device-type' && args[i + 1]) opts.deviceType = parseInt(args[++i], 10);
        else if (args[i] === '--blockchain' && args[i + 1]) opts.blockchainUrl = args[++i];
        else if (args[i] === '--contract' && args[i + 1]) opts.contractAddress = args[++i];
        else if (args[i] === '--skip-fund') opts.skipFund = true;
        else if (args[i] === '--help' || args[i] === '-h') {
            console.log(`\n用法: node scripts/client.js [选项]\n`);
            process.exit(0);
        }
    }
    return opts;
}

let stats = [];
function shortAddr(addr) { return `${addr.slice(0, 6)}...${addr.slice(-4)}`; }
function shortHex(hex, len = 16) { if (!hex || hex.length <= len + 4) return hex; return `${hex.slice(0, len)}...`; }

async function api(method, path, body) {
    const fullUrl = path.startsWith('http') ? path : `${global.__apiBase}${path}`;
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(fullUrl, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || `HTTP ${res.status}`); err.status = res.status; throw err; }
    return data;
}

async function authenticateOnChain(web3, contractAddress, account, nonce, timestamp, signature) {
    const contract = new web3.eth.Contract(AUTHENTICATE_ABI, contractAddress);
    const method = contract.methods.authenticate(account.address, nonce, timestamp, '', signature);
    const gas = await method.estimateGas({ from: account.address }).catch(() => 300000n);
    const tx = { from: account.address, to: contractAddress, data: method.encodeABI(), gas: gas.toString(), gasPrice: (await web3.eth.getGasPrice()).toString() };
    const signedTx = await web3.eth.accounts.signTransaction(tx, account.privateKey);
    return web3.eth.sendSignedTransaction(signedTx.rawTransaction);
}

async function main() {
    const opts = parseArgs();
    global.__apiBase = opts.apiBase;
    const apiBase = opts.apiBase;
    const authApi = `${apiBase}/api/auth`;

    console.log(`\n${C.cyan}${C.bold}╔══════════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.cyan}${C.bold}║   方案7 边缘设备客户端 — 全去中心化身份认证实验演示               ║${C.reset}`);
    console.log(`${C.cyan}${C.bold}╚══════════════════════════════════════════════════════════════╝${C.reset}\n`);

    console.log(`  ${C.dim}服务端: ${apiBase}  |  区块链: ${opts.blockchainUrl}${C.reset}\n`);

    const web3 = new Web3(opts.blockchainUrl);

    // Step 0: Health check
    console.log(`${C.blue}┌─ [步骤 0] 连通性检查${C.reset}`);
    try {
        const health = await api('GET', `${apiBase}/health`);
        console.log(`  ${C.green}✔${C.reset} 服务端在线 | ${health.architecture}`);
        const networkId = await web3.eth.net.getId();
        console.log(`  ${C.green}✔${C.reset} 区块链可达 | Network ID: ${networkId}`);
    } catch (e) {
        console.error(`  ${C.red}✘${C.reset} 连通性检查失败: ${e.message}`);
        process.exit(1);
    }

    // Step 1: Generate keypair
    console.log(`${C.blue}┌─ [步骤 1] 设备本地生成 ECDSA 密钥对${C.reset}`);
    const account = web3.eth.accounts.create();
    console.log(`  ${C.green}✔${C.reset} 设备地址: ${C.bold}${account.address}${C.reset}`);
    console.log(`  ${C.dim}私钥: ${account.privateKey}${C.reset}`);

    // Step 2: Fund
    if (!opts.skipFund) {
        console.log(`${C.blue}┌─ [步骤 2] Gas 充值${C.reset}`);
        const funder = (await web3.eth.getAccounts())[0];
        await web3.eth.sendTransaction({ from: funder, to: account.address, value: web3.utils.toWei('1', 'ether'), gas: 21000 });
        console.log(`  ${C.green}✔${C.reset} Gas 充值完成`);
    }

    // Step 3: Register
    console.log(`${C.blue}┌─ [步骤 3] 链上注册${C.reset}`);
    const startReg = Date.now();
    const reg = await api('POST', `${authApi}/register`, { address: account.address, publicKey: account.address, deviceType: opts.deviceType });
    console.log(`  ${C.green}✔${C.reset} 注册成功 | 类型: ${reg.deviceType} | ${Date.now() - startReg}ms`);
    stats.push({ phase: '设备注册', ms: Date.now() - startReg });

    // Step 4: Online auth
    console.log(`${C.blue}┌─ [步骤 4] 在线认证 — 链上 nonce + 设备签名 + 直写链${C.reset}`);
    const startAuth = Date.now();
    const { nonce } = await api('GET', `${authApi}/nonce/${account.address}`);
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = crypto.signAuthMessage(account.privateKey, account.address, nonce, timestamp, '');
    if (opts.contractAddress) {
        const receipt = await authenticateOnChain(web3, opts.contractAddress, account, nonce, timestamp, signed.signature);
        console.log(`  ${C.green}✔${C.reset} 在线认证成功 | 区块: ${receipt.blockNumber} | Gas: ${receipt.gasUsed}`);
    }
    stats.push({ phase: '在线认证', ms: Date.now() - startAuth });

    // Step 5: Warmup
    console.log(`${C.blue}┌─ [步骤 5] 离线认证预热${C.reset}`);
    const startWarm = Date.now();
    const ch = await api('GET', `${authApi}/challenge/${account.address}`);
    console.log(`  ${C.green}✔${C.reset} 公钥已预热 | TTL: ${ch.pubkeyTtl}s`);
    stats.push({ phase: '公钥预热', ms: Date.now() - startWarm });

    // Step 6: Offline auth
    console.log(`${C.blue}┌─ [步骤 6] 离线认证（场景 B）${C.reset}`);
    const startOffline = Date.now();
    const result = await api('POST', `${authApi}/offline-auth`, {
        address: account.address, privateKey: account.privateKey,
        challenge: ch.challenge, nonce: 1, timestamp: Math.floor(Date.now() / 1000)
    });
    console.log(`  ${C.green}✔${C.reset} ${result.message} | ${result.responseTime}ms`);
    stats.push({ phase: '离线认证', ms: Date.now() - startOffline });

    // Summary
    console.log(`\n${C.magenta}${C.bold}╔══════════════════════════════════════════════════════════════╗${C.reset}`);
    console.log(`${C.magenta}${C.bold}║   实验演示完成                                                  ║${C.reset}`);
    console.log(`${C.magenta}${C.bold}╚══════════════════════════════════════════════════════════════╝${C.reset}\n`);
    console.log(`  ${C.bold}设备地址${C.reset}  ${account.address}`);
    for (const s of stats) {
        console.log(`  ${s.phase.padEnd(12)}  ${String(s.ms).padEnd(8)}ms`);
    }
    const total = stats.reduce((sum, s) => sum + s.ms, 0);
    console.log(`\n  ${C.green}✔${C.reset} 全流程总耗时: ${C.bold}${total}ms${C.reset}\n`);
}

main().catch((err) => { console.error(`\n${C.red}${C.bold}错误:${C.reset} ${err.message}`); process.exit(1); });
