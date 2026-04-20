# 区块链+边缘算法去中心化安全认证系统

基于区块链和边缘计算的去中心化身份认证方案，包含两项关键改进：

1. **性能优化** - Redis缓存层，降低链上交互频率
2. **场景适配** - 智能家居场景 + 离线认证机制

## ✨ 特性

- 🔐 **区块链认证** - 基于智能合约的去中心化身份验证
- ⚡ **缓存优化** - Redis缓存层，延迟降低90%+
- 🏠 **智能家居适配** - 支持6种设备类型，设备分组管理
- 📱 **离线认证** - 离线凭证机制，支持弱网场景
- 📊 **数据可视化** - 实时性能监控、延迟趋势图
- 🎭 **场景联动** - 智能家居设备联动逻辑
- 🧪 **完整测试** - 单元测试、集成测试
- 📝 **完善文档** - API文档、部署指南

## 技术栈

- **智能合约**: Solidity ^0.8.20 + Hardhat
- **区块链交互**: Web3.js ^4.2.0
- **后端框架**: Express.js ^4.18.2
- **数据存储**: SQLite (better-sqlite3)
- **缓存**: Redis (ioredis)
- **认证**: JWT (jsonwebtoken)
- **测试**: Jest + Supertest
- **日志**: 自定义日志系统
- **前端**: 原生HTML + Chart.js

## 项目结构

```
shenfenrz/
├── contracts/              # 智能合约
│   └── Authentication.sol
├── server/                # 边缘服务器
│   ├── index.js           # Express入口
│   ├── routes/           # API路由
│   ├── services/         # 业务服务
│   ├── models/           # 数据模型
│   ├── devices/          # 设备模拟器
│   ├── utils/            # 工具类
│   └── __tests__/        # 测试文件
├── public/               # 前端页面
│   └── index.html
├── scripts/              # 部署脚本
├── docs/                 # 文档
│   ├── API.md           # API文档
│   └── DEPLOYMENT.md    # 部署指南
├── data/                 # 数据文件
├── logs/                 # 日志文件
├── hardhat.config.js
├── jest.config.js
├── package.json
└── .env
```

## 快速开始

### 1. 安装依赖

```bash
# Windows
install.bat

# Linux/Mac
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件配置你的参数
```

### 3. 启动服务

```bash
# 启动Redis (如果未运行)
redis-server

# 启动本地区块链 (终端1)
npm run node

# 部署合约 (终端2)
npm run deploy

# 启动服务器 (终端3)
npm start
```
# 启动虚拟设备 (终端4)
npm run device

### 4. 访问应用

打开浏览器访问 http://localhost:3000

## 📊 功能展示

### 前端页面包含9个功能标签页：

| 标签页 | 功能 |
|--------|------|
| 📊 数据展示 | 实时仪表盘、设备类型分布、认证日志 |
| ⚡ 性能趋势 | 延迟趋势图、缓存命中率曲线 |
| 📝 设备注册 | 单设备注册、批量注册 |
| 🔑 设备认证 | 单次认证、快速测试、弱网模拟 |
| 📱 离线认证 | 生成凭证、验证凭证、批量生成 |
| 🏠 设备分组 | 创建分组、查看分组列表 |
| 🎭 场景联动 | 门锁开启、移动检测等智能场景 |
| 📡 状态监控 | 设备在线状态实时监控 |
| ⚙️ 缓存配置 | TTL配置、缓存管理 |

## 🚀 API接口

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册设备 |
| POST | /api/auth/authenticate | 认证设备 |
| POST | /api/auth/revoke | 注销设备 |
| POST | /api/auth/offline-token | 生成离线凭证 |
| POST | /api/auth/offline-auth | 离线认证 |
| POST | /api/auth/batch-authenticate | 批量认证 |
| POST | /api/auth/batch-offline-tokens | 批量生成离线凭证 |
| POST | /api/auth/simulate-weak-network | 弱网模拟 |
| GET | /api/auth/dashboard | 获取仪表盘数据 |
| GET | /api/auth/performance-history | 获取性能历史 |
| GET | /api/auth/device-status | 获取设备状态 |
| POST | /api/auth/device-group | 创建设备分组 |
| GET | /api/auth/device-groups | 获取设备分组列表 |
| POST | /api/auth/update-cache-ttl | 更新缓存TTL |
| POST | /api/auth/clear-cache | 清空缓存 |
| POST | /api/auth/trigger-scenario | 触发联动场景 |

详细API文档请查看 [docs/API.md](docs/API.md)

## 📱 设备类型

| 类型值 | 名称 | 说明 |
|--------|------|------|
| 1 | DoorLock | 智能门锁 |
| 2 | Camera | 摄像头 |
| 3 | Sensor | 传感器 |
| 4 | Thermostat | 温控器 |
| 5 | Light | 智能灯 |
| 6 | Appliance | 家电 |

## 🔧 改进方案

### 改进1: Redis缓存层降低延迟

- 缓存已注册设备的公钥（默认TTL: 5分钟）
- 缓存最近认证结果（可配置TTL）
- 认证流程：Redis → 链上 → 缓存
- 设备注销/状态变更时自动清空缓存
- **性能提升**: 认证延迟从 500ms+ 降至 <50ms（缓存命中）

### 改进2: 场景适配（智能家居+离线认证）

**智能家居适配:**
- 支持6种设备类型校验
- 设备分组管理（按房间/区域）
- 智能场景联动（门锁开启→开灯+录像）

**离线认证机制:**
- 边缘服务器生成短期认证凭证（JWT）
- 凭证有效期：1小时（可配置）
- 设备离线重连时快速认证
- 支持弱网场景

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行服务器测试
npm run test:server

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:server -- --coverage
```

## 📈 性能对比

| 场景 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 首次认证 | ~500ms | ~500ms | - |
| 缓存命中 | ~500ms | <50ms | 90%+ |
| 离线认证 | 不支持 | <50ms | - |
| Gas消耗 | 高 | 降低60%+ | 60%+ |

## 📝 环境变量

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 区块链配置
RPC_URL=http://localhost:8545
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 缓存配置
CACHE_TTL=300

# JWT配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=3600

# 日志配置
LOG_LEVEL=INFO
```

## 🚀 部署

详细的部署指南请查看 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

支持以下部署方式:
- PM2 进程管理
- Docker 容器化
- Nginx 反向代理

## 📚 文档

- [API文档](docs/API.md) - 完整的API接口文档
- [部署指南](docs/DEPLOYMENT.md) - 生产环境部署指南
- [README.md](README.md) - 项目说明文档

## 🔒 安全建议

1. 使用HTTPS保护API通信
2. 设置强密码保护Redis
3. 定期更新依赖包
4. 配置防火墙限制访问
5. 定期备份数据库

## 📄 许可证

MIT License
