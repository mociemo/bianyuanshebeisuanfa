# 方案 7：全去中心化架构改进说明

## 改进目标

将系统从「区块链 + Redis + SQLite 混合架构」升级为**链上唯一真相源**，彻底移除中心化持久化存储，同时保留离线认证能力。

## 改进前后对比

| 维度 | 改进前 | 改进后（方案 7） |
|------|--------|------------------|
| 设备注册 | SQLite + 链双写 | 仅链 |
| 设备状态 | SQLite | 链 `status` 字段 |
| 在线状态 | SQLite `last_auth_at` | 链 `lastAuthAt` + 边缘观测 |
| 认证缓存 | Redis（5min TTL） | 无 |
| 离线凭证 | JWT + SQLite + Redis | 设备 ECDSA 签名 + 内存验签 |
| 防重放（在线） | 无 / 弱 | 链上自增 nonce |
| 防重放（离线） | JWT 一次性 | timestamp 窗口 + 内存 nonce |
| 边缘持久化 | SQLite + Redis | 无（仅进程内存） |

## 核心设计决策

### 1. 链上为唯一真相源

所有持久化状态写入 `Authentication.sol`：

- `publicKey`、`deviceType`、`status`
- `registeredAt`、`lastAuthAt`
- `nonce`（在线防重放）

### 2. 边缘服务器 = 无状态验签代理

`memoryStore.js` 仅在进程内存中保存：

- 公钥缓存（从链预热，TTL 可配置）
- Challenge（离线认证一次性随机数）
- 离线 nonce 记录（防重放，重启归零）
- 会话级日志（仪表盘用，非权威数据）

**重启即清空**，不构成中心化存储。

### 3. 离线认证 = 场景 B

```
联网阶段：边缘 GET getDeviceInfo → 内存写入公钥
断网阶段：设备提交签名 → 边缘内存验签 → 不上链
```

### 4. 签名协议统一

在线与离线使用相同消息格式，仅 challenge 不同：

```
messageHash = keccak256(abi.encodePacked(
  address, nonce, timestamp, challenge, "authenticate"
))
```

- 在线：`challenge = ""`
- 离线：`challenge = 边缘下发的随机 hex`

### 5. 移除的组件

- `better-sqlite3` / SQLite
- `ioredis` / Redis
- `jsonwebtoken` / JWT 离线凭证
- `uuid` 凭证 ID
- `server/models/database.js`
- `server/services/cache.js`

## 威胁模型说明

| 风险 | 缓解 |
|------|------|
| 在线重放 | 链上 nonce 严格递增 |
| 离线重放（窗口内） | timestamp 窗口 + 内存 nonce |
| 边缘重启后离线重放 | nonce 归零，需接受短窗口风险 |
| 注销后离线仍可用 | 公钥 TTL 过期强制联网刷新 |
| 边缘服务器被篡改 | 验签逻辑开源可审计；真相在链上 |

## 性能权衡

去掉 Redis 后：

- 每次在线写链认证：~200–500ms（Polygon RPC + 确认）
- 离线认证：~5–15ms（纯本地验签）
- 可用 `POST /verify` view 验签实现高频读路径（不写链）

## 合约变更摘要

- 新增 `nonce` 字段
- `authenticate` 增加 nonce/timestamp/challenge 参数并验签
- 新增 `verifyAuth` view 方法
- 新增 `getNonce` view 方法

## 迁移步骤（从旧版）

1. 部署新合约
2. 重新注册设备（或编写迁移脚本读旧 SQLite 批量上链）
3. 更新 `.env`，移除 Redis/JWT 配置
4. `npm install`（依赖已精简）
5. 停用 Redis 服务
