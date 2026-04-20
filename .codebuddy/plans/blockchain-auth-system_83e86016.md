---
name: blockchain-auth-system
overview: 构建基于区块链+边缘算法的去中心化身份认证系统，包含Redis性能优化和智能家居场景适配两项改进
todos:
  - id: init-project
    content: 初始化项目结构，创建package.json和配置文件
    status: completed
  - id: create-smart-contract
    content: 编写Authentication.sol智能合约（支持deviceType）
    status: completed
    dependencies:
      - init-project
  - id: setup-hardhat
    content: 配置Hardhat并部署合约
    status: completed
    dependencies:
      - create-smart-contract
  - id: build-express-server
    content: 创建Express服务器和SQLite数据模型
    status: completed
    dependencies:
      - setup-hardhat
  - id: implement-blockchain-service
    content: 实现Web3.js区块链交互服务
    status: completed
    dependencies:
      - build-express-server
  - id: implement-redis-cache
    content: 实现Redis缓存服务（5分钟有效期）
    status: completed
    dependencies:
      - build-express-server
  - id: implement-auth-flow
    content: 实现认证流程（缓存优先）
    status: completed
    dependencies:
      - implement-blockchain-service
      - implement-redis-cache
  - id: implement-device-type
    content: 新增设备类型校验（门锁/摄像头/传感器）
    status: completed
    dependencies:
      - implement-auth-flow
  - id: implement-offline-auth
    content: 实现离线认证机制（1小时有效期）
    status: completed
    dependencies:
      - implement-device-type
  - id: create-device-simulator
    content: 创建设备模拟器（支持离线重连）
    status: completed
    dependencies:
      - implement-offline-auth
  - id: test-and-verify
    content: 测试验证所有功能
    status: completed
    dependencies:
      - create-device-simulator
---

## 项目概述

基于区块链+边缘算法的去中心化安全身份认证系统，包含基础认证功能和两项关键改进。

## 基础功能

- 智能合约：设备注册、认证、注销功能
- 边缘服务器：Express后端 + SQLite存储
- 设备模拟器：Node.js模拟IoT设备
- 区块链交互：Web3.js连接以太坊/Hardhat本地网络

## 改进方向1：性能优化（Redis缓存）

- 缓存已注册设备的公钥（有效期5分钟）
- 缓存最近认证结果（有效期5分钟）
- 认证流程：先查Redis → 未命中查链上合约 → 结果写入Redis
- 设备注销/状态变更时清空对应缓存
- 预期效果：降低Gas消耗，减少认证延迟

## 改进方向2：场景适配（智能家居+离线认证）

- 设备类型校验：门锁、摄像头、传感器等
- 离线认证机制：边缘服务器缓存短期认证凭证（1小时有效期）
- 设备模拟器支持离线重连场景
- 预期效果：适配智能家居场景，解决弱网/离线设备认证痛点

## 技术栈

- 智能合约：Solidity + Hardhat
- 区块链交互：Web3.js
- 后端框架：Express.js
- 数据存储：SQLite（better-sqlite3）
- 缓存层：Redis（ioredis）
- 设备模拟器：Node.js原生

## 项目架构

```
shenfenrz/
├── contracts/              # 智能合约
│   └── Authentication.sol
├── server/                # 边缘服务器
│   ├── index.js           # Express入口
│   ├── routes/           # API路由
│   ├── services/         # 业务服务
│   │   ├── blockchain.js  # 区块链交互
│   │   ├── cache.js       # Redis缓存服务
│   │   └── auth.js        # 认证服务（含离线凭证）
│   ├── models/           # 数据模型
│   └── devices/          # 设备模拟器
├── scripts/              # 部署脚本
├── hardhat.config.js
├── package.json
└── .env
```

## 核心模块设计

### 1. 智能合约（Authentication.sol）

- registerDevice(address, publicKey, deviceType)：设备注册
- authenticate(address, signature)：设备认证
- revokeDevice(address)：设备注销
- getDeviceInfo(address)：查询设备信息
- deviceTypes映射：支持设备类型校验

### 2. 缓存服务（cache.js）

- cachePublicKey(address, publicKey)：缓存公钥，TTL=300秒
- getCachedPublicKey(address)：获取缓存公钥
- cacheAuthResult(address, result)：缓存认证结果
- getCachedAuthResult(address)：获取认证结果
- invalidateDevice(address)：注销时清空缓存

### 3. 认证服务（auth.js）

- register()：注册接口，先存SQLite再上链
- authenticate()：认证流程（缓存优先）
- offlineAuth()：离线认证（凭证校验）
- generateOfflineToken()：生成离线凭证（JWT，1小时有效）

## 性能优化实现

- 缓存命中时：O(1) Redis查询，避免链上交互
- 缓存未命中：查链上合约（~200-500ms），写入缓存
- 预期延迟：从500ms+降至50ms以内（缓存命中）

# Agent Extensions

本项目为全新创建，不涉及现有代码修改，暂无需使用的扩展。