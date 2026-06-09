# 全去中心化身份认证系统（方案 7）

基于 Polygon / 以太坊智能合约的 IoT 身份认证方案。**链上为唯一持久化真相源**，边缘服务器仅保留进程内存（重启清空），彻底移除 Redis、SQLite、MongoDB 等中心化存储。

## 架构

```
边缘设备 ──► 边缘服务器（内存验签，无持久化）──► Polygon 链（唯一真相源）
                │
                └── 断网时：场景 B 离线认证（内存公钥 + 本地验签）
```

| 组件 | 角色 |
|------|------|
| 智能合约 | 注册、注销、链上 nonce、最后认证时间 |
| 边缘服务器 | 链交互代理 + 离线验签（内存公钥预热） |
| 边缘内存 | 公钥、challenge、离线 nonce（非持久化） |

## 特性

- 全去中心化数据层：无 Redis / 无数据库
- 在线认证：链上自增 nonce，绝对防重放
- 离线认证（场景 B）：timestamp 时间窗 + 内存 offline nonce + ECDSA 验签
- 支持 6 种智能家居设备类型
- 设备分组、场景联动（内存会话级）
- Web 仪表盘实时监控

## 技术栈

- **智能合约**: Solidity ^0.8.20 + Hardhat
- **区块链交互**: Web3.js ^4.2.0
- **后端**: Express.js（无数据库依赖）
- **前端**: 原生 HTML + Chart.js

## 项目结构

```
shenfenrz/
├── contracts/Authentication.sol   # 链上认证合约
├── server/
│   ├── services/
│   │   ├── auth.js                # 认证业务
│   │   ├── blockchain.js          # 链交互
│   │   ├── crypto.js              # 签名/验签
│   │   └── memoryStore.js         # 边缘内存（非持久化）
│   └── routes/
├── public/index.html              # Web 控制台
├── docs/                          # 文档
└── test/Authentication.test.js    # 合约测试
```

## 快速开始

```bash
# 安装
install.bat        # Windows
npm install        # 通用

# 配置
cp .env.example .env
# 填写 CONTRACT_ADDRESS（部署后）

# 终端 1：本地区块链
npm run node

# 终端 2：部署合约
npm run deploy

# 终端 3：启动服务器
npm start
```

访问 http://localhost:3000

**推荐演示流程**：设备注册页 →「开发：自动创建并注册」→ 设备认证（填入私钥）→ 离线认证 →「运行离线认证演示」

## 认证流程

### 在线认证

1. `GET /api/auth/nonce/:address` 获取链上 nonce
2. 设备签名 `hash(address, nonce, timestamp, "", "authenticate")`
3. `POST /api/auth/authenticate` 提交签名，链上 nonce 递增

### 离线认证（场景 B）

1. 联网：`GET /api/auth/challenge/:address` 从链预热公钥 + 获取 challenge
2. 断网：设备签名 `hash(address, nonce, timestamp, challenge, "authenticate")`
3. `POST /api/auth/offline-auth` 边缘内存验签（不上链）

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 上链注册 |
| POST | /api/auth/dev/create-and-register | 开发：创建账户并注册 |
| GET | /api/auth/nonce/:address | 获取链上 nonce |
| POST | /api/auth/authenticate | 在线认证（写链） |
| POST | /api/auth/verify | 链上验签（view，不写链） |
| GET | /api/auth/challenge/:address | 预热公钥 + 获取 challenge |
| POST | /api/auth/offline-auth | 离线认证 |
| POST | /api/auth/revoke | 链上注销 |
| POST | /api/auth/clear-memory | 清空边缘内存 |
| GET | /api/auth/dashboard | 仪表盘 |

完整文档：[docs/API.md](docs/API.md)

## 环境变量

```env
BLOCKCHAIN_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
PORT=3000
PUBKEY_TTL=3600              # 内存公钥有效期（秒）
OFFLINE_TIMESTAMP_WINDOW=60  # 离线时间窗（秒）
CHALLENGE_TTL=300
```

## 测试

```bash
npm test              # 合约测试
npm run test:server   # API 测试
```

## 文档

- [API 文档](docs/API.md)
- [部署指南](docs/DEPLOYMENT.md)
- [架构改进说明](docs/IMPROVEMENTS.md)
- [性能对比](docs/PERFORMANCE_COMPARISON.md)

## 许可证

MIT License
