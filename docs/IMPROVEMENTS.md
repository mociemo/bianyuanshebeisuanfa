# scheme-7：全去中心化架构改进说明

## 改进目标

将系统从「Polygon 区块链 + MongoDB 混合架构」升级为**链上唯一真相源**，彻底移除中心化持久化存储，同时保留离线认证能力。

对应代码：`scheme-a/`（原论文复现）→ `scheme-7/`（改进方案）

## 改进前后对比

| 维度 | scheme-a（复现） | scheme-7（改进） |
|------|-------------------|------------------|
| 设备注册 | MongoDB + 链双写 | 仅链 |
| 设备状态 | MongoDB | 链 `status` 字段 |
| 在线状态 | MongoDB `lastAuthAt` | 链 `lastAuthAt` + 边缘观测 |
| 认证缓存 | MongoDB 查询 | 无 |
| 离线凭证 | 一次性凭证哈希 + MongoDB | 设备 ECDSA 签名 + 内存验签 |
| 防重放（在线） | MongoDB nonce | 链上自增 nonce |
| 防重放（离线） | 一次性凭证 + MongoDB | timestamp 窗口 + 内存 nonce |
| 边缘持久化 | MongoDB | 无（仅进程内存） |

## 核心设计决策

### 1. 链上为唯一真相源

所有持久化状态写入 `Authentication.sol`（位于 `scheme-7/contracts/`）：

- `publicKey`、`deviceType`、`status`
- `registeredAt`、`lastAuthAt`
- `nonce`（在线防重放）

### 2. 边缘服务器 = 无状态验签代理

`scheme-7/server/services/memoryStore.js` 仅在进程内存中保存：

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

### 5. 移除的组件（对比 scheme-a）

- `mongodb` / `mongoose`（MongoDB 数据库）
- MongoDB 设备表
- MongoDB 操作层
- 中心化离线凭证哈希存储

## 威胁模型说明

| 风险 | 缓解 |
|------|------|
| 在线重放 | 链上 nonce 严格递增 |
| 离线重放（窗口内） | timestamp 窗口 + 内存 nonce |
| 边缘重启后离线重放 | nonce 归零，需接受短窗口风险 |
| 注销后离线仍可用 | 公钥 TTL 过期强制联网刷新 |
| 边缘服务器被篡改 | 验签逻辑开源可审计；真相在链上 |

## 性能权衡（黑盒实测数据）

> 以下数据由 `benchmark.js` 在本地 Hardhat 节点 + 5 设备 × 3 次认证场景下实测采集（2026-06-17）。

去掉 MongoDB 后：

- 在线写链认证：avg **81ms**（scheme-7）vs 78ms（scheme-a），基本持平
- 离线认证（ECDSA 验签）：avg **13ms**（scheme-7）vs 25ms（scheme-a MongoDB 凭证），快 48%
- 可用 `POST /verify` view 验签实现高频读路径：avg **17ms**，不写链
- 弱网离线认证（RTT 2000ms）：仅 **11ms**，完全不受网络延迟影响

## 合约变更摘要

`scheme-7/contracts/Authentication.sol` 相比 `scheme-a/contracts/` 版本的变更：

- 新增 `nonce` 字段
- `authenticate` 增加 nonce/timestamp/challenge 参数并验签
- 新增 `verifyAuth` view 方法
- 新增 `getNonce` view 方法

## 迁移步骤（从 scheme-a 到 scheme-7）

1. 部署 scheme-7 新合约
2. 重新注册设备（或编写迁移脚本读 MongoDB 批量上链）
3. 更新 `.env`，移除 MongoDB 相关配置
4. 在 `scheme-7/` 目录下 `npm install`
5. 停用 MongoDB 服务
