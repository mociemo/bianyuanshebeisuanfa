# 部署指南 — 全去中心化方案

## 架构要求

本方案**不需要** Redis、MongoDB、SQLite。仅需：

1. Node.js 18+
2. Polygon / 以太坊 RPC 节点
3. 已部署的 `Authentication.sol` 合约
4. 边缘服务器（Express，无状态）

## 本地开发部署

```bash
# 1. 安装
npm install
npx hardhat compile

# 2. 启动本地区块链（终端 1）
npm run node

# 3. 部署合约（终端 2）
npm run deploy
# 将输出的 CONTRACT_ADDRESS 写入 .env

# 4. 启动服务器（终端 3）
npm start
```

## Polygon 测试网部署

### 1. 配置 Hardhat

在 `hardhat.config.js` 中添加 Polygon Amoy 网络：

```javascript
networks: {
  amoy: {
    url: process.env.POLYGON_RPC_URL,
    accounts: [process.env.DEPLOYER_PRIVATE_KEY]
  }
}
```

### 2. 部署合约

```bash
npx hardhat run scripts/deploy.js --network amoy
```

### 3. 配置边缘服务器 `.env`

```env
BLOCKCHAIN_URL=https://rpc-amoy.polygon.technology
CONTRACT_ADDRESS=0x你的合约地址
PORT=3000
NODE_ENV=production
PUBKEY_TTL=3600
OFFLINE_TIMESTAMP_WINDOW=60
```

### 4. 启动

```bash
npm start
```

## PM2 部署

```bash
npm install -g pm2
pm2 start server/index.js --name auth-edge
pm2 save
pm2 startup
```

## Docker（可选）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]
```

> 注意：容器重启会清空边缘内存，断网设备需重新联网预热公钥。

## Nginx 反向代理

```nginx
server {
    listen 443 ssl;
    server_name auth.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 安全建议

1. 生产环境禁用 `/api/auth/dev/*` 接口（`NODE_ENV=production`）
2. 使用 HTTPS
3. 合约 owner 私钥与边缘服务器分离保管
4. 设备私钥仅存于设备端，演示接口不可用于生产
5. 定期审计合约与依赖

## 与旧版差异

| 旧版 | 新版（方案 7） |
|------|----------------|
| Redis 缓存 | 无 |
| SQLite 设备表 | 无 |
| JWT 离线凭证 | 设备签名 + 内存验签 |
| 缓存 TTL 配置 | 公钥内存 TTL（`PUBKEY_TTL`） |

## 故障排查

| 问题 | 处理 |
|------|------|
| 注册失败 | 检查 `CONTRACT_ADDRESS`、RPC 连通性 |
| 认证 nonce 错误 | 先 `GET /nonce/:address` 获取最新值 |
| 离线认证失败 | 确认已执行 challenge 预热且未重启边缘服务 |
| 公钥缓存过期 | 重新联网调用 `/challenge/:address?refresh=true` |
