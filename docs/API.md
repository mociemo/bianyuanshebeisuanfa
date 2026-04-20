# 区块链身份认证系统 API 文档

## 基础信息

- **基础URL**: `http://localhost:3000`
- **认证方式**: JWT Token
- **数据格式**: JSON

## 响应格式

### 成功响应
```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

---

## 认证接口

### 1. 注册设备
**POST** `/api/auth/register`

注册一个新的IoT设备到区块链网络。

**请求体:**
```json
{
  "address": "0x123...789",
  "deviceType": 1
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 设备钱包地址 |
| deviceType | number | 是 | 设备类型 (1-6) |

**设备类型:**
- 1: 门锁
- 2: 摄像头
- 3: 传感器
- 4: 温控器
- 5: 灯具
- 6: 家电

**响应:**
```json
{
  "success": true,
  "message": "设备注册成功",
  "data": {
    "txHash": "0xabc...",
    "responseTime": 1234
  }
}
```

---

### 2. 设备认证
**POST** `/api/auth/authenticate`

验证设备身份,支持缓存加速。

**请求体:**
```json
{
  "address": "0x123...789",
  "signature": "0xabc..."
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| address | string | 是 | 设备钱包地址 |
| signature | string | 是 | 签名数据 |

**响应:**
```json
{
  "success": true,
  "message": "认证成功",
  "cached": true,
  "responseTime": 45
}
```

---

### 3. 生成离线凭证
**POST** `/api/auth/offline-token`

为设备生成离线认证凭证。

**请求体:**
```json
{
  "address": "0x123...789"
}
```

**响应:**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "expiresAt": 1678901234567
}
```

---

### 4. 离线认证
**POST** `/api/auth/offline-auth`

使用离线凭证进行认证。

**请求体:**
```json
{
  "token": "eyJhbGc..."
}
```

**响应:**
```json
{
  "success": true,
  "message": "离线认证成功",
  "responseTime": 23
}
```

---

### 5. 批量认证
**POST** `/api/auth/batch-authenticate`

批量认证多个设备。

**请求体:**
```json
{
  "addresses": ["0x123...789", "0x456...012"],
  "signatures": ["0xabc...", "0xdef..."]
}
```

**响应:**
```json
{
  "success": true,
  "results": [
    {
      "address": "0x123...789",
      "success": true,
      "responseTime": 45
    }
  ]
}
```

---

### 6. 获取仪表盘数据
**GET** `/api/auth/dashboard`

获取系统统计数据。

**响应:**
```json
{
  "deviceStats": {
    "total": 10,
    "active": 8,
    "revoked": 2,
    "byType": {
      "门锁": 3,
      "摄像头": 2
    }
  },
  "performance": {
    "avgCacheTime": 45,
    "avgChainTime": 520,
    "timeSaved": 475,
    "improvementPercent": 91
  },
  "cache": {
    "cacheHitRate": 85.5
  }
}
```

---

### 7. 性能历史数据
**GET** `/api/auth/performance-history?hours=24`

获取性能历史趋势数据。

**查询参数:**
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| hours | number | 24 | 时间范围(小时) |

---

## 设备接口

### 1. 获取设备列表
**GET** `/api/device/list`

**响应:**
```json
{
  "success": true,
  "devices": [
    {
      "address": "0x123...789",
      "deviceType": 1,
      "status": 1,
      "createdAt": 1678901234567
    }
  ]
}
```

---

### 2. 获取活跃设备
**GET** `/api/device/active`

**响应:**
```json
{
  "success": true,
  "devices": [...]
}
```

---

## 缓存接口

### 1. 获取缓存统计
**GET** `/api/cache/stats`

**响应:**
```json
{
  "success": true,
  "stats": {
    "totalRequests": 1000,
    "cacheHits": 850,
    "cacheHitRate": 85
  }
}
```

---

### 2. 清空缓存
**POST** `/api/cache/clear`

**响应:**
```json
{
  "success": true,
  "message": "缓存已清空"
}
```

---

### 3. 更新缓存TTL
**POST** `/api/auth/update-cache-ttl`

**请求体:**
```json
{
  "ttl": 300
}
```

---

## 场景联动接口

### 触发场景
**POST** `/api/auth/trigger-scenario`

**请求体:**
```json
{
  "scenarioName": "door_unlock",
  "triggerDevice": "0x123...789"
}
```

**可用场景:**
- `door_unlock`: 门锁开启联动
- `motion_detected`: 移动检测联动

---

## 健康检查

### 健康状态
**GET** `/health`

**响应:**
```json
{
  "status": "ok",
  "timestamp": "2024-03-15T10:30:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 52428800,
    "heapTotal": 29360128,
    "heapUsed": 18874368
  },
  "environment": "development"
}
```

---

## 错误代码

| 代码 | 说明 | HTTP状态 |
|------|------|----------|
| VALIDATION_ERROR | 参数验证错误 | 400 |
| AUTHENTICATION_ERROR | 认证失败 | 401 |
| NOT_FOUND | 资源不存在 | 404 |
| DEVICE_ERROR | 设备操作失败 | 400 |
| BLOCKCHAIN_ERROR | 区块链操作失败 | 500 |
| DATABASE_ERROR | 数据库操作失败 | 500 |
| CACHE_ERROR | 缓存操作失败 | 500 |
| INTERNAL_ERROR | 内部服务器错误 | 500 |
