# IoT 设备身份认证系统 — 复现与改进对比

基于 Polygon / 以太坊智能合约的 IoT 设备身份认证方案对比项目。包含两个独立方案：

| 方案 | 架构 | 说明 |
|------|------|------|
| **scheme-a** (复现) | Polygon + MongoDB 混合 | 原论文方案的复现 |
| **scheme-7** (改进) | 链上唯一真相源 + 边缘内存验签 | 彻底移除中心化存储的全去中心化方案 |

## 项目结构

```
shenfenrz/
├── scheme-a/           # 复现方案：Polygon + MongoDB 混合架构
│   ├── contracts/      #   智能合约（Authentication.sol）
│   ├── server/         #   后端服务（Express + Mongoose）
│   ├── scripts/        #   部署脚本
│   ├── hardhat.config.js
│   └── package.json
├── scheme-7/           # 改进方案：全去中心化（链上唯一真相源）
│   ├── contracts/      #   智能合约（增加 nonce/verifyAuth）
│   ├── server/         #   后端服务（无数据库，仅内存验签）
│   │   ├── services/   #     auth / blockchain / crypto / memoryStore
│   │   └── routes/     #     auth / device
│   ├── scripts/        #   部署脚本
│   ├── test/           #   合约测试
│   ├── hardhat.config.js
│   └── package.json
├── frontend/           # 对比前端（同时连接两个方案）
│   ├── public/         #   comparison.html / user.html
│   ├── server.js
│   └── package.json
├── docs/               # 文档
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── IMPROVEMENTS.md
│   └── PERFORMANCE_COMPARISON.md
└── README.md
```

## 架构概览

### scheme-a（复现）

```
边缘设备 ──► 边缘服务器（Express）──► MongoDB（缓存 + 设备表）
                │
                └──────────► Polygon 链（注册/认证）
```

### scheme-7（改进）

```
边缘设备 ──► 边缘服务器（内存验签，无持久化）──► Polygon 链（唯一真相源）
                │
                └── 断网时：离线认证（内存公钥 + 本地 ECDSA 验签）
```

## 快速开始

### 前置条件

- Node.js 18+
- 各方案目录下分别 `npm install`

### 启动 scheme-a（复现方案）

```bash
cd scheme-a
cp .env.example .env         # 配置环境变量
npm run node                 # 终端 1：本地区块链
npm run deploy               # 终端 2：部署合约
npm start                    # 终端 3：启动服务器 → http://localhost:3001
```

### 启动 scheme-7（改进方案）

```bash
cd scheme-7
cp .env.example .env         # 配置环境变量
npm run node                 # 终端 1：本地区块链
npm run deploy               # 终端 2：部署合约
npm start                    # 终端 3：启动服务器 → http://localhost:3000
```

### 启动对比前端

```bash
cd frontend
npm install
npm start                    # → http://localhost:8080
```

访问 http://localhost:8080，在对比页面同时测试两个方案。

## 方案对比

| 维度 | scheme-a (复现) | scheme-7 (改进) |
|------|----------------|-----------------|
| 持久化存储 | 链 + MongoDB | 仅链 |
| 设备注册 | MongoDB + 链双写 | 仅链 |
| 在线认证 | MongoDB 缓存优先 + 链 | 链上 nonce + 验签 |
| 离线认证 | 一次性凭证 + MongoDB | ECDSA 签名 + 内存验签 |
| 防重放（在线） | MongoDB nonce | 链上自增 nonce |
| 防重放（离线） | 凭证哈希 + MongoDB | timestamp 窗口 + 内存 nonce |
| 外部依赖 | Node + MongoDB + RPC | Node + RPC |
| 数据一致性 | 最终一致 | 强一致（链上） |

## 方案 7 特性

- 全去中心化数据层：无 MongoDB / 无数据库
- 在线认证：链上自增 nonce，绝对防重放
- 离线认证（场景 B）：timestamp 时间窗 + 内存 offline nonce + ECDSA 验签
- 支持 6 种智能家居设备类型
- 边缘服务器重启即清空，不构成中心化存储

## 性能对比（黑盒实测）

> 数据由 `benchmark.js` 自动采集于 2026-06-18 10:56 (UTC+8)，5 设备 × 3 次在线认证 × 2 次 view 验签 × 1 次离线认证。

### 核心指标

| 认证场景 | scheme-a（MongoDB 混合） | scheme-7（全去中心化） | 变化 |
|----------|-------------------------|---------------------|------|
| 设备注册 | 36 ms | **26 ms** | ↓ 28% |
| 在线写链认证 | 58 ms | 59 ms | 基本持平 |
| 在线 view 验签 | ❌ 不支持 | **17 ms** | 仅 scheme-7 |
| 离线认证 | 28 ms（MongoDB 验证） | **15 ms**（ECDSA 验签） | ↓ **46%** |
| 弱网离线认证 | 24 ms | **13 ms** | ↓ 46% |

### 在线认证响应时间分布

| 百分位 | scheme-a | scheme-7 |
|--------|---------|----------|
| P50 | 54 ms | 52 ms |
| P90 | 80 ms | 80 ms |
| P99 | 87 ms | 98 ms |
| **平均** | **58 ms** | **59 ms** |

> 📄 完整数据见 [docs/PERFORMANCE_COMPARISON.md](docs/PERFORMANCE_COMPARISON.md)

## 技术栈

- **智能合约**: Solidity ^0.8.20 + Hardhat
- **区块链交互**: Web3.js ^4.2.0
- **后端**: Express.js
- **数据库**: scheme-a 用 Mongoose/MongoDB；scheme-7 无数据库
- **前端**: 原生 HTML + Chart.js

## 测试

```bash
# scheme-7 合约测试
cd scheme-7
npm test

# scheme-a 合约测试
cd scheme-a
npm test
```

## 文档

- [API 文档](docs/API.md) — scheme-7 API 参考
- [部署指南](docs/DEPLOYMENT.md) — 两个方案的部署说明
- [架构改进说明](docs/IMPROVEMENTS.md) — scheme-7 相比原论文的改进
- [性能对比](docs/PERFORMANCE_COMPARISON.md) — 两个方案的实验数据对比

## 许可证

MIT License
