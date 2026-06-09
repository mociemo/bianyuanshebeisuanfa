# 全去中心化身份认证 API 文档

## 基础信息

- **基础 URL**: `http://localhost:3000`
- **数据格式**: JSON
- **持久化存储**: 仅区块链（无数据库、无 Redis）
- **边缘内存**: 进程内临时数据，重启清空

## 响应格式

成功时各接口直接返回业务字段；失败时：

```json
{ "error": "错误描述" }
```

---

## 认证接口

### 1. 注册设备

**POST** `/api/auth/register`

将设备注册到链上合约（边缘服务器代发交易）。

**请求体:**

```json
{
  "address": "0x123...789",
  "publicKey": "0x123...789",
  "deviceType": 1
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 设备以太坊地址 |
| publicKey | string | 否 | 默认等于 address |
| deviceType | number | 是 | 1-6 |

**响应:**

```json
{
  "success": true,
  "address": "0x...",
  "transactionHash": "0xabc...",
  "responseTime": 450
}
```

---

### 2. 开发：自动创建并注册

**POST** `/api/auth/dev/create-and-register`（仅非 production）

创建新以太坊账户、充值、上链注册，返回私钥供演示。

```json
{ "deviceType": 1 }
```

---

### 3. 获取链上 Nonce

**GET** `/api/auth/nonce/:address`

```json
{
  "address": "0x...",
  "nonce": 0,
  "timestamp": 1717900000
}
```

---

### 4. 在线认证（写链）

**POST** `/api/auth/authenticate`

提交签名后发送链上交易，nonce 递增，更新 `lastAuthAt`。

**请求体:**

```json
{
  "address": "0x...",
  "privateKey": "0x...",
  "signature": "0x...",
  "nonce": 0,
  "timestamp": 1717900000
}
```

提供 `privateKey` 时服务端代签；否则需提供 `signature`。

签名消息：`soliditySha3(address, nonce, timestamp, "", "authenticate")`

**响应:**

```json
{
  "success": true,
  "mode": "online",
  "nonce": 0,
  "transactionHash": "0x...",
  "responseTime": 520,
  "message": "在线认证成功（链上 nonce 已递增）"
}
```

---

### 5. 链上验签（view，不写链）

**POST** `/api/auth/verify`

参数同 `/authenticate`，仅调用合约 `verifyAuth` view 方法。

---

### 6. 获取离线 Challenge（预热公钥）

**GET** `/api/auth/challenge/:address?refresh=true`

从链上拉取设备信息写入边缘内存，返回随机 challenge。

```json
{
  "success": true,
  "address": "0x...",
  "challenge": "0xabc...",
  "pubkeyCached": true,
  "pubkeyTtl": 3600,
  "offlineWindow": 60,
  "responseTime": 180
}
```

---

### 7. 离线认证（场景 B）

**POST** `/api/auth/offline-auth`

边缘内存公钥 + 本地 ECDSA 验签，不上链。

```json
{
  "address": "0x...",
  "challenge": "0xabc...",
  "nonce": 1,
  "timestamp": 1717900000,
  "privateKey": "0x...",
  "signature": "0x..."
}
```

签名消息：`soliditySha3(address, nonce, timestamp, challenge, "authenticate")`

防重放：`|now - timestamp| ≤ OFFLINE_TIMESTAMP_WINDOW` + 内存 offline nonce 单调递增。

---

### 8. 注销设备

**POST** `/api/auth/revoke`

```json
{ "address": "0x..." }
```

---

### 9. 清空边缘内存

**POST** `/api/auth/clear-memory`

清空公钥缓存、challenge、离线 nonce 记录。

---

### 10. 仪表盘

**GET** `/api/auth/dashboard`

```json
{
  "architecture": "fully-decentralized",
  "storage": "chain-only",
  "deviceStats": { "total": 5, "active": 4, "revoked": 1, "byType": {} },
  "performance": { "avgChainTime": 480, "avgOfflineTime": 8 },
  "memory": { "pubkeyCached": 4, "chainRequests": 12, "offlineRequests": 3 },
  "recentLogs": []
}
```

---

## 设备接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/device/list | 已知设备列表（链上查询） |
| GET | /api/device/active | 活跃设备 |
| GET | /api/device/:address | 设备详情 |
| GET | /api/device/chain/status | 区块链连接状态 |

---

## 设备类型

| 值 | 名称 |
|----|------|
| 1 | DoorLock |
| 2 | Camera |
| 3 | Sensor |
| 4 | Thermostat |
| 5 | Light |
| 6 | Appliance |

---

## 健康检查

**GET** `/health`

```json
{
  "status": "ok",
  "architecture": "fully-decentralized",
  "storage": "blockchain-only",
  "edgeCache": "memory-ephemeral",
  "blockchain": true
}
```

---

## 错误代码

| HTTP | 说明 |
|------|------|
| 400 | 参数错误或业务拒绝 |
| 401 | 认证/验签失败 |
| 403 | 开发接口在生产环境不可用 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
